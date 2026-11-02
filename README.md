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
  B0.7), and the SUPPLY ON, BATTERY LOW and W/DOG O.K. lamps. The real unit has
  no per-terminal LEDs; small ones are added here so you can see the I/O;
- an **input simulator** board of toggle switches (latching or push-button);
- the **MicroGEM Programmer**, with its key switch (RUN/HALT), 2×16 display and
  all 25 keys. `CTRL` gives a key its second legend.
  - *MON* (`Ø`): `ADDR`, a table key (`I` = A inputs, `Q` = B outputs, `G`,
    `W`, `C`, `D`, `S`) and a word or bit (`►` types the dot), `ENT` to watch
    it live; then a number and `ENT` to force it. `NEXT`/`PREV` step.
  - *PROG*: `▲▼` step through rungs, `◄►` scroll. `BLNK` starts a new rung,
    `ED` re-keys the selected one, `DEL` then `ENT` deletes it, `FIND` jumps to
    an address. Inside a rung the keys give their symbols: `-] [-`, `-]/[-`,
    `-( )-`, `-(S)-` (set), `-(D)-` (delay) and `-(C)-` (count), each followed by
    an address. `LINK` opens a parallel branch (or starts the next one), `JOIN`
    closes it. `ENT` writes the rung, `DEL` undoes the last step.
  - With the programmer focused, the computer keyboard works too.
- a live **ladder diagram** with power rails, contacts, coils and function
  blocks, where powered wires and closed contacts light up;
- the full **program text** editor, and a data-table monitor.

## How it works

| Layer | File | Job |
|---|---|---|
| Data tables | `microgem/tables.py` | Lettered tables of 16-bit words, addressed like `A0.3` or `G12` |
| Program | `microgem/program.py` | Parses one-rung-per-line ladder text |
| Controller | `microgem/engine.py` | Scan cycle, coils, latches, DELAY, COUNT, maths, Halt/Run behaviour |
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

```
; comment
A0.0 AND NOT A0.1 -> B0.0
(A0.2 OR B0.1) AND NOT A0.3 -> B0.1
A0.4 -> DELAY 2.5s G0.0              ; on-delay timer, 100 ms to 54 min
RISE A0.5 -> COUNT 10 G1 G0.1        ; count rising edges into G1, G0.1 at 10
A0.6 -> SET B0.2
A0.7 -> RESET B0.2, CLEAR G1
G1 GE 5 -> B0.3
TRUE -> ADD G1 100 G2                ; also SUB MULT DIV, saturating at +/-32767
```

Read-only flags follow the GEM80-400 manual (T1614): `E0.0` pulses for one
scan every 0.1 s, `E0.1` every second, `E0.6` after a program change, `E0.7`
when ADD/SUB saturates; `E1`-`E6` hold seconds, minutes, hours, day, month,
year; `E7` the previous scan time in ms. Hex numbers are written `@00FF`.

This notation is **provisional**. The real operand syntax is in the GEM 80
*Ladder Diagram Language Programming Manual* (T391), which we have not found
yet. The instruction names and ranges (DELAY, COUNT, SET/RESET coils, data
tables) come from the GEM80-500 Technical Manual (T2025).

## Home Assistant

`custom_components/microgem` is a custom integration. To install it with HACS,
open HACS > three-dot menu > **Custom repositories**, add
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

- The exact key sequences of the real programmer. The layout and legends come
  from a photo; what each key did (the I/Q table mapping, `-(S)-` as set, how
  LINK/JOIN build branches, RESET only in text) is a best guess.
- The default 12 inputs / 8 outputs match the MicroGEM60; `--inputs` /
  `--outputs` change them.

## Tests

```sh
pip install -e '.[test]'
pytest
```
