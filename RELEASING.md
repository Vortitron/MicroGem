# Releasing

## Every release

1. Pick the new version, say `0.4.1`, and set it in all four places:
   `custom_components/microgem/manifest.json`, `pyproject.toml`,
   `microgem/__init__.py`, then run `python scripts/sync_ha_core.py` to copy it
   into `custom_components/microgem/core/__init__.py`. The panel uses this
   version to make browsers fetch the new `panel.js`.
2. Add a section to `CHANGELOG.md`.
3. Merge to `main` and check the **Validate** and **Tests** workflows are green.
4. On GitHub: Releases > **Draft a new release**, tag `v0.4.1` on `main`,
   title `0.4.1`, paste the changelog section and **Publish**. (A tag on its own
   is not enough: HACS lists releases, not tags.)
5. The **Release** workflow checks the tag matches `manifest.json` and attaches
   `microgem.zip`. If the check fails, delete the release and tag, fix the
   version and start again.

HACS users see the update within a few hours.

## Getting into the HACS default list (once)

HACS's requirements are at <https://hacs.xyz/docs/publish/include>. Before
opening the pull request:

- [ ] Merge the work into `main`, so the default branch has the integration.
- [ ] Repository settings: a description, topics (for example `home-assistant`,
      `hacs`, `homeassistant-integration`, `plc`, `ladder-logic`, `emulator`,
      `gem80`) and Issues turned on.
- [ ] **Validate** (Hassfest and HACS) passes on `main` with no ignores.
- [ ] Publish the first release (above), after the workflows pass.
- [ ] Fork <https://github.com/hacs/default> to your personal account (not an
      organisation, so the HACS team can edit the pull request), make a new
      branch from `master`, and add `"Vortitron/MicroGem"` to the `integration`
      file in alphabetical order.
- [ ] Open the pull request, fill in the template completely, and link the
      latest release and the passing **Validate** run (the HACS action run and
      the Hassfest run).

Review takes weeks to months; the backlog is linked from the HACS page above.
Brand images live in `custom_components/microgem/brand/`, so nothing goes to
`home-assistant/brands` (it no longer takes custom integrations).
