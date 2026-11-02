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

The page shows the MicroGEM face (input LEDs, output LEDs, RUN/HALT), a row
of input switches you can click (as latching switches or push-buttons), the
program editor, and a monitor for the data tables.

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

This notation is **provisional**. The real operand syntax is in the GEM 80
*Ladder Diagram Language Programming Manual* (T391), which we have not found
yet. The instruction names and ranges (DELAY, COUNT, SET/RESET coils, data
tables) come from the GEM80-500 Technical Manual (T2025).

## Not known yet

- The MicroGEM's real I/O count and front panel. 16 inputs and 16 outputs are
  placeholders (`--inputs` / `--outputs` change them).
- How programs were keyed in on the MicroGEM programmer (an ADDR / VALUE
  keypad).

## Tests

```sh
pip install -e '.[test]'
pytest
```
