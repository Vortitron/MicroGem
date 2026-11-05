# Virtual MicroGEM

[![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)
[![Release](https://img.shields.io/github/v/release/Vortitron/MicroGem)](https://github.com/Vortitron/MicroGem/releases)
[![Validate](https://github.com/Vortitron/MicroGem/actions/workflows/validate.yml/badge.svg)](https://github.com/Vortitron/MicroGem/actions/workflows/validate.yml)
[![Tests](https://github.com/Vortitron/MicroGem/actions/workflows/tests.yml/badge.svg)](https://github.com/Vortitron/MicroGem/actions/workflows/tests.yml)

A software emulation of the GEC **MicroGEM** programmable controller and the
bigger **GEM 80** compact controllers (80/100C, 100CE, 130C and 130CE). It runs a ladder program against
GEM 80 style data tables and shows a front panel whose input and output lights
change live. In Home Assistant the virtual controller's relays can switch real
lights, and its inputs can be wired to real sensors.

![The virtual MicroGEM60 controller, input simulator and programmer, with three inputs on and their relay outputs lit](https://raw.githubusercontent.com/Vortitron/MicroGem/main/docs/images/front-panel.png)

## Install in Home Assistant

Needs Home Assistant 2025.1 or later.

### With HACS

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Vortitron&repository=MicroGem&category=integration)

Or by hand: open HACS (the **Marketplace** from Home Assistant 2026.11) >
three-dot menu > **Custom repositories**, add
`https://github.com/Vortitron/MicroGem` as type **Integration**, download
**Virtual MicroGEM** and restart Home Assistant.

### Without HACS

Download `microgem.zip` from the [latest release](https://github.com/Vortitron/MicroGem/releases/latest),
unzip it into `config/custom_components/microgem/` and restart Home Assistant.

## Set up

[![Open your Home Assistant instance and start setting up Virtual MicroGEM.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=microgem)

Add **Virtual MicroGEM** under Settings > Devices & services, choose a name and
the controller:

- a **MicroGEM60**, then how many expansion units it has (0 to 7),
- or a **GEM 80** compact controller (100C 2K, 6K or 12K, 100CE, 130C 6K or
  12K, 130CE), then the Compact I/O module in each of its eight slots. Slot 1
  has A0 and A1 (or B0 and B1), slot 2 the next pair, and so on, so the 16
  channel input module that a new GEM 80 has in slot 1 is `A0.0` to `A0.15`.
  A new GEM 80 runs a bottle filling line demo, or a car wash on the smaller
  models that lack its Special Functions.

You can change the I/O (and a GEM 80's memory size) later under **Configure**.
A GEM 80's entities are named by address, so moving a module gives its
terminals new entities, and field wiring stays with its terminal. You can add
more than one controller. You get:

- a switch for each input (`switch.<name>_input_a0_0` ...): automations can
  "press" the controller's inputs,
- a binary sensor for each output (`binary_sensor.<name>_output_b0_0` ...):
  use these in automations to switch real lights,
- a **Run** switch (off = HALT, all outputs off),
- a **Watchdog** binary sensor, the W/DOG OUTPUT contacts: on after three
  clean scans in Run, off in Halt, and off with a trip when the program holds a
  non-zero code in `F1` for 100 ms (GEM80-400 manual T1614, 2.12; its
  `trip_code` attribute holds the code). Use it to interlock anything the
  controller drives,
- the front panel and program editor in the sidebar (admins only), with links
  to all of these entities,
- a `microgem.load_program` action.

The program and Run/Halt state survive restarts.

### Field wiring

You can also wire terminals straight to Home Assistant entities, as you would
cable a real controller, with no automations. Click an input terminal or a
relay output on the controller drawing in the panel and pick an entity. The
picker searches names and ids as you type (`*` matches anything, so
`kitchen*light` finds "Kitchen ceiling light"), and buttons narrow it to
switches, lights, sensors, helpers and so on. It starts on switches.

- an **input** follows the entity's state: the contact is closed while it is
  on, open, home, playing and so on, and open while it is off, closed, away,
  unavailable and so on. You can read one of its attributes instead, and give a
  threshold so the contact closes while a number is above it (a temperature,
  say). **Invert** makes it a normally closed contact, closed while the entity
  is off. A missing or unavailable entity always leaves the contact open. A
  wired input's simulator switch is greyed out;
- a **relay output** switches the entity on and off with the relay
  (`homeassistant.turn_on` / `turn_off`, so lights, switches, fans, helpers,
  covers and so on). Buttons are pressed, and scenes, scripts and automations
  run, each time the relay closes. A newly wired entity is put in step with its
  relay at once; after that it changes only when the relay does.

The controller's own input switches and output sensors are its internal I/O,
so they are left out of the list and cannot be wired to a terminal.

The cables and the entity names are drawn on the controller (click a name to change it), and listed under
**Field wiring** in the panel. The wiring is kept in the config entry's
options and changes take effect at once.

To remove it, delete the controller under Settings > Devices & services, then
remove **Virtual MicroGEM** in HACS and restart.

## The front panel

The same panel runs in the Home Assistant sidebar and as a standalone web page.
It shows:

- the **MicroGEM60 controller**, drawn from a photo of the real unit: 12
  sink/source inputs (00 to 11, words A0.0 to A0.11), 8 relay outputs (B0.0 to
  B0.7), a red LED under each terminal number, and the SUPPLY ON, BATTERY LOW
  and W/DOG O.K. lamps;
- any **expansion units** on its expansion port (`--expansions`, 0 to 7). The
  original MicroGEM took one (40 I/O); the MicroGEM60 takes up to 160 I/O,
  which matches seven units of 12 inputs and 8 outputs. Unit *n* uses word *n*
  of the A and B tables, so terminal 03 on expansion unit 1 is `A1.3`. The
  expansion units' size and addressing are our best guess: no MicroGEM manual
  has turned up yet, and T1282 describes the GEM 80's 9007/9008 remote I/O
  units, not MicroGEM expansions;
- an **input simulator** board of toggle switches (latching or push-button);
- the **MicroGEM Programmer**, with its key switch (RUN/HALT), 2×16 display and
  all 25 keys. `CTRL` gives a key its second legend.
  - *MON* (`Ø`): `ADDR`, a table key (`I` = A inputs, `Q` = B outputs, `G`,
    `W`, `C`, `D`, `S`) and a word or bit (`►` types the dot), `ENT` to watch
    it live; then a number and `ENT` to force it. `NEXT`/`PREV` step.
  - *PROG*: the display is a 2 × 16 window onto the ladder, drawn as in the
    GEM 80 manual (T391): symbols on the top line (`+--] [-----]/[-----( )--+`),
    addresses underneath, branches hanging from `+` and `!`, live wires as
    dashes and dead ones as dots. The element under the cursor blinks. `◄►`
    move along a branch, `▲▼` between branches and on to the next rung, and
    `NEXT`/`PREV` jump a rung. `BLNK` starts a new rung,
    `ED` re-keys the selected one, `DEL` then `ENT` deletes it, `FIND` jumps to
    an address. Inside a rung the keys give their symbols: contacts `-] [-` and
    `-]/[-`, `-(D)-` (DELAY word and VALUE in 0.1 s) and `-(C)-` (COUNT word and
    VALUE), which sit in the rung as on the GEM 80. `▼` opens a parallel
    branch (or starts the next line down) and `JOIN` closes it; `LINK` is only
    a spacer, as in the manual. End the rung with `-( )-` (coil), `-(S)-`
    (sequencer) or `BLK` (OBEY BLOCK, or END OF BLOCK on an empty rung). `ENT`
    writes the rung, `DEL` undoes the last step.
  - With the programmer focused, the computer keyboard works too.
- **demo programmes** to load from a picker above the program text: bedroom
  lighting, a pelican crossing (SEQR), a star-delta starter, a duty/standby
  pumping station and a bottle packing conveyor. Each one's first comment
  lines say which inputs and outputs do what;
- a live **ladder diagram** drawn like the GEM 80 programmer screen: live
  paths solid, dead paths dotted, with the time left above each DELAY, the
  count above each COUNT, and values above OUT and word elements;
- the full **program text** editor, and a data-table monitor.

![The live ladder diagram, drawn like the GEM 80 programmer screen](https://raw.githubusercontent.com/Vortitron/MicroGem/main/docs/images/ladder.png)

### A GEM 80

A GEM 80 is drawn as its 19 inch subrack: eight I/O slots (right to left, as
on the real one) with a lamp for each channel of each Compact I/O module, the
power supply and the processor module. Below it is the **8920 Portable
Programmer** (product data sheet T208): a 24 line by 80 character screen, the
GEM 80 function keys, a typewriter keyboard, a number pad and a key switch for
PROGRAM or MONITOR ONLY. Click it and type, or use its keys; the PC keys F1 to
F10 give N/O, N/C, COIL, LINK, LF, JOIN, DELAY, COUNT, SPEC and VALUE.

- *Control mode*: `L` ladder diagram, `D` data tables, `H` halt, `R` run, `S`
  single cycle, `T` test inputs (the A table stops following the inputs, so
  they can be forced, and the watchdog stays open), `N` normal inputs, `C`
  clear store.
- *Ladder diagram*: one rung to a screen, as in the data sheet's Figure 7,
  with where it is stored (`DISPLAYED RUNG STORED AS INSTRUCTIONS 25 to 62`)
  and live monitoring (`..] [..` open, `--] [--` closed). At COMMAND LEVEL:
  `F` first, `L` last, `N` next and `B` back a rung, `S` search for an
  address, `E` enter a new rung, `I` insert it, `R` replace the stored rung
  with it, `C` change a rung as text, `D` delete, `M` monitor on or off, `W`
  write to a data table and `T` back to control mode.
- *Rung entry*: `N/O` and the address then SPACE puts a contact in series;
  `LINK` opens a branch point, `LF` starts the next line down and `JOIN` closes
  it; `DELAY G26 VALUE 50`, `COUNT`, `SPEC`, `AND`, `ADD`, `SUB` and `LOGIC`
  are keyed the same way; `COIL`, `OUT`, `SEQR` or `BLOCK` ends the rung, and
  `ESC` shows it for `I` or `R`. A rung holds up to five parallel branches of
  up to nine series elements, as on the real programmer.
- *Data tables*: 32 locations at a time, each as a number and as bits.
- *Preset data table* (`P` in control mode): the presets and messages kept
  with the program. `W` sets one (a number, or `"TEXT"` for a WRITEXT
  message, `\N` for a new line) and `D` deletes one; the program text changes
  to match and is loaded.
- *Print-out* (`O`): the program, or a run of data table words, printed to
  the print-out box under the program text.

The programmer will not change the program of a CE model (it is in EPROM), and
does nothing but monitor with the key at MONITOR ONLY.

An **8108 analogue input module** (in slots 5 and 6 by default; it is two
slots wide) reads 16 channels of ±10 V, multiplexed into one A word as its
manual (T443) describes: bits 4 to 15 the value, bits 0 to 3 the channel, a
new channel every 70 ms. Sliders set the voltages; in Home Assistant a channel
can follow any numeric entity (click the channel and give the values at 0 V
and 10 V). The **Room heating** demo reads it with LOCATE and MOVE exactly as
the manual's example does, scales with LINCON, controls with PIDABS and
switches a heater relay in proportion over a 10 s cycle.

On a 130C or 130CE, port 1 can be a **printer port**, set up by preset data as
the data sheets give it (T278 Table 5, and T247/T419 for the 225 series of the
same generation): `P5` negative makes it a printer port, `P2` is the NULs
added after each line for a slow printer, `P3` the characters a line (1 to
125) and `P4` the bit/s (110 to 9600), so `PRESET P2 = 0 80 1200 -1` gives an
80-column printer at 1200 bit/s. The real controller reads these at power on;
the emulator reads them when it goes to Run, or at **Switch off and on**
(which the panel offers when they have changed, and does for you when it
loads a demo). The program prints with
`WRITEXT` (S22) and `WRINUM` (S23) into a 255-character buffer, and `E0.8` is
on while the buffer is more than two thirds full. Lines come out on fanfold
paper in the panel at the set rate (11 bits a character), wrapped at `P3`.
On the 12K an ETX (`\e`) sends a part line, and the panel's keyboard puts each
key in `J0`, one a scan, as the Serial Links manual (T418, 6.3) describes; the
6K sends complete lines only and takes no keyboard. The 20 mA loop has no
handshake, so what is sent with the printer off line is lost.

`WRITEXT`'s rung input picks message *n* from the list that starts at
`VALUE` (1 the first): each message is a length byte and its characters,
packed two to a word, and the next one starts in the following word. Write
the list with `MESSAGE` lines in consecutive words (`MESSAGE P100 = ":"`,
`MESSAGE P101 = "HEATING ON"` and so on); the emulator refuses ones that
overlap. `WRINUM` prints the rung word in the format in three words at
`VALUE`: the field width, the characters from the decimal point on (0 for
none) and a power of ten to scale by, so `PRESET P146 = 4 2 -1` prints 215 as
`21.5`. A number that does not fit loses decimals, then the 0 before the
point, then is printed in the six-character default format (`P00215`).

### Your own programmes

**Open file…** (or drop a file on the program box, or paste and **Convert
pasted text**) brings in:

- a ladder **print-out** saved as text, from a programmer or a PC package, in
  the layout this emulator prints (`] [`, `]/[`, `( )`, `<AND>`, `SPEC.`,
  `VALUE`, branches hanging from `+` and joined by `!`) or the 8920's
  (verticals as `|` or `:`, slashed zeros): the rungs are read back from the
  drawing;
- a **CSV** of mnemonics (`A0.0,START,Start push button`) or data
  (`G10,250`), as the PC packages export them, merged into the program as
  `NAME` and `PRESET` lines;
- program text.

The result goes into the program box to check before **Load program**.
**Save as file** keeps the program text (names, presets and messages
included), and **Print-out** prints it with instruction numbers, blocks, a
cross-reference of every address and the preset data. The original packages'
own file formats are not published, so export a print-out or a CSV from them.

## Run it without Home Assistant

```sh
pip install -e .
python -m microgem            # then open http://127.0.0.1:8080
python -m microgem --program my_program.txt --port 8080
python -m microgem --expansions 2   # add two expansion units
python -m microgem --model gem80-130c-12k --modules 8177,8178,8110,8130,8108   # a GEM 80
```

## How it works

| Layer | File | Job |
|---|---|---|
| Data tables | `microgem/tables.py` | Lettered tables of 16-bit words, addressed like `A0.3` or `G12` |
| Program | `microgem/program.py` | Parses one-rung-per-line ladder text |
| Controller | `microgem/engine.py` | Scan cycle, 16-bit rung words, DELAY, COUNT, SEQR, OBEY BLOCK, Halt/Run behaviour |
| Service | `microgem/service.py` | Runs the scan every 20 ms and tells listeners about changes |
| Special Functions | `microgem/functions.py` | Each SPEC, from its GEM 80 Software Data sheet |
| Print-outs | `microgem/printout.py`, `microgem/importer.py` | Ladder print-outs both ways, CSV import |
| Printer | `microgem/printer.py` | The 130C printer port and its buffer |
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

Names, presets and messages are kept with the program, as a programmer keeps
them, and can stand anywhere in it:

```
NAME A0.0 START Start push button        ; a mnemonic the rungs can use, and a description
PRESET R100 = 0 400 32000 0              ; R100 to R103, written at a program load
MESSAGE P100 = "PUMP 1 TRIPPED\n"        ; text packed for WRITEXT (\n new line, \e ETX, \xHH)
START AND NOT STOP -> MOTOR
```

Presets are written into the tables when the program is loaded, and again
only where they change, so values the program or an operator has changed
since are left alone. They must be in a table kept across Run (`P` or `R` on a
GEM 80).

Extensions that are not in a real GEM 80, kept for convenience and marked
"ext" on the ladder: `RISE A0.0` / `FALL A0.0` one-scan pulses, word
comparisons such as `G1 GE 5` (the real controller uses Special Functions),
and `SET` / `RESET` outputs (the real one latches with a seal-in branch).

## Not known yet

- The MicroGEM's own details. T391 covers the GEM 80; the MicroGEM programmer
  photo shows I and Q table keys (mapped here to the A and B tables), and
  `-(S)-` is taken to be SEQR. Which GEM 80 elements the MicroGEM lacked (it
  has no keys for AND, ADD or OUT) is not known, so the text editor accepts
  them all.
- The default 12 inputs / 8 outputs match the MicroGEM60; `--inputs` /
  `--outputs` change them.
- WRITEXT (S22) and WRINUM (S23) have no data sheets online. The message
  layout is the one in the Serial Links manual's WRITEXT example (T418, 6.3);
  that the rung input numbers a message in a list comes from their timing and
  memory figures (T278, T419: "0.23 x message no.", half "qty of messages +
  total qty of characters"), and starting each message on a new word is our
  choice. WRINUM's three words are read as the three quantities of a numeric
  field on the later PRINT (T38); the order is ours.
- The 130C's printer port preset words: the 130C data sheet (T278) says only
  that preset data sets the port up, so the 225/235/245's `P2` to `P5` (T419)
  are used. The 130C has `E0` to `E6`, and its E0.8 is taken from the 225's.
- The 8108's forced-scan mode, its 5 V and 20 mA ranges and the scan number
  switch are not emulated: it self-scans all 16 channels at ±10 V.
- The 8920's preset data table and print-out keys (`P` and `O`): its data
  sheet says it has both, but not which keys.
- What most of the 8920's COMMAND LEVEL options do. Its data sheet lists them
  (`S, F, L, N, E, B, D, I, R, C, M, W, T?`) and says `I` inserts the
  displayed rung and `T` terminates, but no 8920 manual has turned up; the
  rest are our reading of the letters, and control mode is laid out to suit.

## Development

```sh
pip install -e '.[test]'
pytest                                   # engine and standalone panel

pip install pytest-homeassistant-custom-component home-assistant-frontend
pytest -c tests_ha/pytest.ini --rootdir=. tests_ha   # Home Assistant integration
```

HACS installs only `custom_components/microgem`, so the integration carries a
copy of the engine in `custom_components/microgem/core`. After changing
anything in `microgem/`, run `python scripts/sync_ha_core.py` (a test checks
they match). [RELEASING.md](RELEASING.md) explains how to cut a release.

## Disclaimer

This is an independent hobby project. It is not made, endorsed or supported by
GEC, GEC Industrial Controls, Cegelec, Alstom, Converteam, GE or any of their
successors. The names GEC, GEM 80 and MicroGEM are used only to say which
hardware is being emulated. The controller drawing carries a made-up badge,
CEG Industrial Controls, and Home Assistant lists the devices as made by the
equally made-up Harecastle Controls; neither is the GEC mark. Do not use it
to control anything where a fault could hurt someone.

## Licence

[MIT](LICENSE)
