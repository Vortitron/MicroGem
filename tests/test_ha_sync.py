import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sync", ROOT / "scripts/sync_ha_core.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def test_home_assistant_copy_matches_engine():
    stale = [str(dest.relative_to(ROOT)) for source, dest in sync.COPIES
             if not dest.exists() or dest.read_bytes() != source.read_bytes()]
    assert not stale, f"run scripts/sync_ha_core.py; out of date: {stale}"
