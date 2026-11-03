"""Run with: pytest tests_ha (needs pytest-homeassistant-custom-component)."""

from pathlib import Path

import custom_components
import pytest

# The test plugin ships its own ``custom_components`` package; add ours to it.
OURS = str(Path(__file__).resolve().parent.parent / "custom_components")
if OURS not in custom_components.__path__:
    custom_components.__path__.append(OURS)


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield
