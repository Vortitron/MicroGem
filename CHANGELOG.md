# Changelog

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
