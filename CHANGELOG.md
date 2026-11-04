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
  runs one standalone, with a bottle filling demo.

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
