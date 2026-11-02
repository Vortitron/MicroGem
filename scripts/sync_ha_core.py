"""Copy the engine and front panel into the Home Assistant integration.

HACS installs only ``custom_components/microgem``, so the integration carries
its own copy of the engine. Run this after changing anything in ``microgem/``;
``tests/test_ha_sync.py`` fails if the copies drift.
"""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENGINE_FILES = ["__init__.py", "tables.py", "program.py", "engine.py", "service.py"]
COPIES = [(ROOT / "microgem" / name, ROOT / "custom_components/microgem/core" / name) for name in ENGINE_FILES]
COPIES.append((ROOT / "microgem/web/panel.js", ROOT / "custom_components/microgem/frontend/panel.js"))


def main() -> None:
    for source, dest in COPIES:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, dest)
        print(f"{source.relative_to(ROOT)} -> {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
