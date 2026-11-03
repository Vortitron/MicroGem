"""Virtual MicroGEM: a GEM 80 style PLC running inside Home Assistant."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import voluptuous as vol

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType

from . import websocket
from .const import (
    CONF_INPUTS,
    CONF_OUTPUTS,
    DOMAIN,
    FRONTEND_URL,
    PANEL_ELEMENT,
    SAVE_DELAY_S,
    STORAGE_VERSION,
)
from .config_flow import expansions_of
from .core import ControllerConfig, ProgramError, __version__
from .core.service import EXAMPLE_PROGRAM, ControllerService

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.BINARY_SENSOR, Platform.SWITCH]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

SERVICE_LOAD_PROGRAM = "load_program"
LOAD_PROGRAM_SCHEMA = vol.Schema(
    {
        vol.Required("config_entry_id"): cv.string,
        vol.Required("program"): cv.string,
    }
)


@dataclass
class MicroGemData:
    service: ControllerService
    store: Store


type MicroGemConfigEntry = ConfigEntry[MicroGemData]


def panel_path(entry: ConfigEntry) -> str:
    return f"microgem-{entry.entry_id.lower()[:8]}"


def get_loaded_entry(hass: HomeAssistant, entry_id: str) -> MicroGemConfigEntry | None:
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None or entry.domain != DOMAIN or entry.state is not ConfigEntryState.LOADED:
        return None
    return entry


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    websocket.async_register(hass)
    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_URL, str(Path(__file__).parent / "frontend"), False)]
    )

    async def load_program(call: ServiceCall) -> None:
        entry = get_loaded_entry(hass, call.data["config_entry_id"])
        if entry is None:
            raise ServiceValidationError("That MicroGEM is not set up or not loaded")
        try:
            entry.runtime_data.service.load(call.data["program"])
        except ProgramError as exc:
            raise ServiceValidationError(f"Program not loaded: {exc}") from exc

    hass.services.async_register(DOMAIN, SERVICE_LOAD_PROGRAM, load_program, LOAD_PROGRAM_SCHEMA)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: MicroGemConfigEntry) -> bool:
    store: Store = Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}")
    saved = await store.async_load() or {}

    config = ControllerConfig(
        name=entry.title,
        inputs=int(entry.data.get(CONF_INPUTS, 12)),
        outputs=int(entry.data.get(CONF_OUTPUTS, 8)),
        expansions=expansions_of(entry),
    )
    remove_missing_io(hass, entry, config)
    replaced_saved = False
    try:
        service = ControllerService(config, saved.get("program", EXAMPLE_PROGRAM))
    except (ProgramError, ValueError) as exc:
        # Programs saved by an older release may use notation this one no longer reads.
        _LOGGER.warning("Saved MicroGEM program could not be loaded (%s); using the example", exc)
        service = ControllerService(config, EXAMPLE_PROGRAM)
        replaced_saved = True
    if saved.get("running") is False:
        service.halt()

    entry.runtime_data = MicroGemData(service, store)

    # Keep the program and the Run/Halt state across restarts.
    last_saved = {"program": service.controller.program.source, "running": service.controller.running}

    @callback
    def persist(state: dict) -> None:
        current = {"program": state["program"], "running": state["running"]}
        if current != last_saved:
            last_saved.update(current)
            store.async_delay_save(lambda: dict(last_saved), SAVE_DELAY_S)

    if replaced_saved:
        # Save the example now so the warning is not repeated on every restart.
        store.async_delay_save(lambda: dict(last_saved), SAVE_DELAY_S)

    entry.async_on_unload(service.subscribe(persist))
    service.start()
    entry.async_on_unload(service.stop)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=panel_path(entry),
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=entry.title,
        sidebar_icon="mdi:chip",
        # The version busts the browser cache when an update ships a new panel.
        module_url=f"{FRONTEND_URL}/panel.js?v={__version__}",
        config={"entry_id": entry.entry_id},
        require_admin=True,
    )
    entry.async_on_unload(lambda: frontend.async_remove_panel(hass, panel_path(entry)))
    entry.async_on_unload(entry.add_update_listener(_options_updated))
    return True


async def _options_updated(hass: HomeAssistant, entry: MicroGemConfigEntry) -> None:
    """Expansion units added or removed: rebuild the controller and its entities."""
    await hass.config_entries.async_reload(entry.entry_id)


def remove_missing_io(hass: HomeAssistant, entry: ConfigEntry, config: ControllerConfig) -> None:
    """Drop the entities of I/O that went away with a removed expansion unit."""
    registry = er.async_get(hass)
    limits = {"input": config.total_inputs, "output": config.total_outputs}
    for entity in er.async_entries_for_config_entry(registry, entry.entry_id):
        kind, _, index = entity.unique_id.removeprefix(f"{entry.entry_id}_").partition("_")
        if kind in limits and index.isdigit() and int(index) >= limits[kind]:
            registry.async_remove(entity.entity_id)


async def async_unload_entry(hass: HomeAssistant, entry: MicroGemConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
