# Changelog

## 0.5.0 (unreleased)

The GEM 80 compact controllers join the MicroGEM60.

- Controller models GEM 80/100C (2K, 6K, 12K), 100CE, 130C (6K, 12K) and
  130CE, with data table sizes, program capacity and Special Functions from
  the T278 data sheet. Tables a model lacks are refused; the P table is
  read-only on the EPROM (CE) models.
- Eight Compact I/O slots with 8, 16 and 32 channel input, output and relay
  modules (T438), each slot on its own pair of A or B words.
- The SPEC element and 17 Special Functions, each following its GEM 80
  Software Data sheet: DBOUNCE, BCDIN, BCDOUT, HISTATE, SWAP, LINCON, SQRT,
  LOCATE, FGEN, DEDBAND, LIMIT, ANALAG, COMPARE, MULT, DIV, MOVE and STORE.
- The front panel draws a GEM 80 as its 19 inch subrack: I/O modules with a
  lamp per channel, the power supply and the processor module.
- `python -m microgem --model gem80-130c-12k --modules 8177,8178,8110,8130`
  runs one standalone, with bottle filling, car wash and room heating demos.
- Home Assistant: setup asks for the controller, then a MicroGEM60's
  expansion units or a GEM 80's module in each slot; **Configure** changes
  them (and a GEM 80's memory size) later. The device's model is the
  controller's. GEM 80 entities are keyed by address, so they and their field
  wiring stay with their terminals when modules move.
- The 8920 Portable Programmer on the GEM 80 panel (data sheet T208): an 80
  by 24 screen with the ladder drawn as in its Figure 7, the GEM 80 function
  keys, rung entry, change, insert, replace and delete, search, live
  monitoring, a 32 location data table monitor, and HALT, RUN, SINGLE CYCLE,
  TEST INPUTS, NORMAL INPUTS and CLEAR STORE. The key switch gives MONITOR
  ONLY; CE models refuse program changes.
- The engine has SINGLE CYCLE, TEST INPUTS (T478, 2.3.8) and CLEAR STORE, and
  reports which instructions each rung is stored as.
- RAMP (S33), PIDABS (S34), PIDINC (S35) and INCOUT (S36), and the printer
  functions WRITEXT (S22, message *n* of a list) and WRINUM (S23, a number in
  a width, decimal places and scaling) with a virtual printer on fanfold
  paper (130C and 130CE). Port 1 is set up by `P2` to `P5` as the data sheets
  give it: padding, characters a line, 110 to 9600 bit/s, and `P5` negative
  for a printer. A 255-character buffer with `E0.8` on at two thirds full,
  part lines with ETX and a keyboard into `J0` on the 12K.
- The 8108 Compact Analogue Input Module: 16 channels multiplexed into one A
  word (T443), sliders on the panel, and in Home Assistant a channel can follow
  any numeric entity. It is in the default modules (slots 5 and 6). Its
  INPUT (10 V, 5 V, 20 mA), Scan Number and SELF/FORCED scan switches work,
  forced scan taking the channel from a B word, and are kept by Home
  Assistant.
- A Room heating demo: an analogue temperature and set point, PIDABS, a
  time-proportioned heater and a time-stamped printed log.
- `NAME`, `PRESET` and `MESSAGE` lines keep mnemonics, preset data and
  printer text with the program; the ladder shows the mnemonics.
- Bring old programmes in: open, drop or paste a ladder print-out (read back
  from its drawing), a CSV of mnemonics or data, or program text. Save the
  program as a file, and print it with instruction numbers, blocks, a
  cross-reference and the preset data.
- The 8920 has a preset data table (`P`) and print-outs (`O`).
- A car wash demo for the GEM 80s without DIV and COMPARE (100C 2K and 6K).
  A saved program that no longer fits the controller is kept aside in the
  store as `rejected_program` when the example replaces it.

## 0.4.0

First release for the HACS default list.

- Brand icon in `custom_components/microgem/brand/`, shown by Home Assistant
  2026.3 and later.
- `categories` in the manifest (DIY & makers), for the Marketplace.
- Needs Home Assistant 2025.1 or later; earlier releases lack the options flow
  behaviour the integration relies on.
- Hassfest, HACS and test workflows, and a release workflow that attaches
  `microgem.zip` to each release.
- MIT licence, changelog, bug report form and a README written for HACS.

## 0.3.6

- Field wiring: wire input terminals and relay outputs straight to Home
  Assistant entities, with a searchable entity picker and an invert option.
- Programmer display drawn as a window onto a movable ladder, the same width
  all the way down.
- Demo programmes: bedroom lighting, pelican crossing, star-delta starter,
  duty/standby pumps and a bottle conveyor.
- Expansion units (0 to 7), a Watchdog binary sensor and entity links on the
  panel.

## 0.2.0

- Rung behaviour follows the GEM 80 programming manual (T391): 16-bit rung
  words, DELAY and COUNT with VALUE, SEQR, OUT, OBEY BLOCK.
- Controller and programmer redrawn to match the real MicroGEM60.

## 0.1.0

- Engine, standalone web front panel and Home Assistant integration.
