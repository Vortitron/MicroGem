# Virtual MicroGEM

A software emulation of the GEC **MicroGEM** programmable controller, with the
bigger **GEM 80** as the longer-term goal. It runs a ladder program against
GEM 80 style data tables and shows a front panel in your browser whose input
and output lights change live. A Home Assistant integration is planned so the
virtual controller can switch real lights.

## Run it

```sh
pip install -e .
python -m microgem            # then open http://127.0.0.1:8080
python -m microgem --program my_program.txt --port 8080
```

The page shows:

- the **MicroGEM60 controller**, drawn from a photo of the real unit: 12
  sink/source inputs (00 to 11, words A0.0 to A0.11), 8 relay outputs (B0.0 to
  B0.7), a red LED under each terminal number, and the SUPPLY ON, BATTERY LOW
  and W/DOG O.K. lamps;
- an **input simulator** board of toggle switches (latching or push-button);
- the **MicroGEM Programmer**, with its key switch (RUN/HALT), 2×16 display and
  all 25 keys. `CTRL` gives a key its second legend.
  - *MON* (`Ø`): `ADDR`, a table key (`I` = A inputs, `Q` = B outputs, `G`,
    `W`, `C`, `D`, `S`) and a word or bit (`►` types the dot), `ENT` to watch
    it live; then a number and `ENT` to force it. `NEXT`/`PREV` step.
  - *PROG*: `▲▼` step through rungs, `◄►` scroll. `BLNK` starts a new rung,
    `ED` re-keys the selected one, `DEL` then `ENT` deletes it, `FIND` jumps to
    an address. Inside a rung the keys give their symbols: contacts `-] [-` and
    `-]/[-`, `-(D)-` (DELAY word and VALUE in 0.1 s) and `-(C)-` (COUNT word and
    VALUE), which sit in the rung as on the GEM 80. `▼` opens a parallel
    branch (or starts the next line down) and `JOIN` closes it; `LINK` is only
    a spacer, as in the manual. End the rung with `-( )-` (coil), `-(S)-`
    (sequencer) or `BLK` (OBEY BLOCK, or END OF BLOCK on an empty rung). `ENT`
    writes the rung, `DEL` undoes the last step.
  - With the programmer focused, the computer keyboard works too.
- a live **ladder diagram** drawn like the GEM 80 programmer screen: live
  paths solid, dead paths dotted, with the time left above each DELAY, the
  count above each COUNT, and values above OUT and word elements;
- the full **program text** editor, and a data-table monitor.

## How it works

| Layer | File | Job |
|---|---|---|
| Data tables | `microgem/tables.py` | Lettered tables of 16-bit words, addressed like `A0.3` or `G12` |
| Program | `microgem/program.py` | Parses one-rung-per-line ladder text |
| Controller | `microgem/engine.py` | Scan cycle, 16-bit rung words, DELAY, COUNT, SEQR, OBEY BLOCK, Halt/Run behaviour |
| Service | `microgem/service.py` | Runs the scan every 20 ms and tells listeners about changes |
| Web | `microgem/server.py`, `microgem/web/` | Standalone page over a WebSocket |

The engine has no I/O of its own, so the same code will run inside Home
Assistant.

### Data tables

As on a GEM 80: `A` inputs, `B` outputs, `G H L N O U` workspace, `R W`
retained workspace, `E` flags, `F` faults, `P` presets, `C D J K I` remote and
serial I/O. Most tables are cleared on the Halt to Run transition; `A`, `P`,
`R` and `W` are kept.

### Program notation

Elements and behaviour follow the GEM 80 *Ladder Diagram Programming Manual*
(T391, issue 4). A 16-bit word flows along each rung: the left rail gives -1
(@FFFF), a contact passes the word on or gives 0, and the rung is ON when its
word is not 0. One line is one rung; `->` comes before its single output
element.

```
; comment lines above a rung become its title
A0.0 AND NOT A0.1 -> B0.0                 ; contacts in series, then a COIL
(A0.2 OR B0.1) AND NOT A0.3 -> B0.1       ; parallel branches (wired OR); also a seal-in latch
A0.4 DELAY G10 VALUE 25 -> B0.2           ; on-delay 2.5 s; G10 counts down the 0.1 s steps left
A0.5 COUNT G11 VALUE 10 RESET A0.6 -> B0.3 ; counts OFF-to-ON changes; bit 15 of G11 is the last input
B0.0 INV DELAY G12 VALUE 50 INV -> B0.4   ; INV, DELAY, INV: an off-delay
E0.1 -> SEQR G13 RESET A0.7               ; one bit walks left each scan the rung is on
AND G1 ADD 5 -> OUT G2                    ; plant G1 on the rung, add 5, write the word
A1.0 AND @00FF -> OUT G3                  ; 16-bit logic: AND OR XOR INV
AND G1 MULT 3 -> OUT G4                   ; MULT and DIV are Special Functions T10 and T11
AND G1 ADD [AND G5] -> OUT G6             ; [ ] is a second branch into ADD (JOIN)
A1.1 -> BLOCK                             ; OBEY BLOCK: rungs down to END BLOCK run only
A1.2 -> B0.5                              ;   while A1.1 is on, and freeze while it is off
END BLOCK
```

ADD and SUB limit their result to ±32,767 and set `E0.7` (cleared by the next
ADD or SUB that does not overflow). Read-only flags follow the GEM80-400 manual
(T1614): `E0.0` pulses for one scan every 0.1 s, `E0.1` every second, `E0.6`
after a program change; `E1`-`E6` hold seconds, minutes, hours, day, month,
year; `E7` the previous scan time in ms. Hex numbers are written `@00FF`.

Extensions that are not in a real GEM 80, kept for convenience and marked
"ext" on the ladder: `RISE A0.0` / `FALL A0.0` one-scan pulses, word
comparisons such as `G1 GE 5` (the real controller uses Special Functions),
and `SET` / `RESET` outputs (the real one latches with a seal-in branch).

## Home Assistant

`custom_components/microgem` is a custom integration. To install it with HACS,
open HACS (the **Marketplace** from Home Assistant 2026.11) > three-dot menu > **Custom repositories**, add
`https://github.com/Vortitron/MicroGem` as type **Integration**, download
**Virtual MicroGEM** and restart Home Assistant. (Or copy
`custom_components/microgem` into your `config/custom_components/`.) Then add **Virtual MicroGEM** under Settings > Devices &
services, choose a name and the number of inputs and outputs, and you get:

- a switch for each input (`switch.<name>_input_a0_0` ...): automations can
  "press" the controller's inputs,
- a binary sensor for each output (`binary_sensor.<name>_output_b0_0` ...):
  use these in automations to switch real lights,
- a **Run** switch (off = HALT, all outputs off),
- the front panel and program editor in the sidebar (admins only),
- a `microgem.load_program` action.

The program and Run/Halt state survive restarts. The integration carries a copy
of the engine in `custom_components/microgem/core`; after changing anything in
`microgem/`, run `python scripts/sync_ha_core.py` (a test checks they match).

Integration tests use `pytest-homeassistant-custom-component` and
`home-assistant-frontend`:

```sh
pip install pytest-homeassistant-custom-component home-assistant-frontend
pytest -c tests_ha/pytest.ini --rootdir=. tests_ha
```

## Not known yet

- The MicroGEM's own details. T391 covers the GEM 80; the MicroGEM programmer
  photo shows I and Q table keys (mapped here to the A and B tables), and
  `-(S)-` is taken to be SEQR. Which GEM 80 elements the MicroGEM lacked (it
  has no keys for AND, ADD or OUT) is not known, so the text editor accepts
  them all.
- The default 12 inputs / 8 outputs match the MicroGEM60; `--inputs` /
  `--outputs` change them.

## Tests

```sh
pip install -e '.[test]'
pytest
```
