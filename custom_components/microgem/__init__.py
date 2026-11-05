"""Virtual MicroGEM: a GEM 80 style PLC running inside Home Assistant."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
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
from .wiring import CONF_WIRING, Wiring
from .const import (
    DOMAIN,
    FRONTEND_URL,
    PANEL_ELEMENT,
    SAVE_DELAY_S,
    STORAGE_VERSION,
)
from .config_flow import config_of
from .core import ControllerConfig, ProgramError, __version__
from .core.service import ControllerService
from .entity import io_key

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
    wiring: Wiring
    saved: dict = field(default_factory=dict)  # what the store holds, or will after its delay


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

    config = config_of(entry)
    remove_missing_io(hass, entry, config)
    replaced_saved = False
    rejected = saved.get("rejected_program")
    try:
        # With no saved program yet, the example for this kind of controller.
        service = ControllerService(config, saved.get("program"))
    except (ProgramError, ValueError) as exc:
        # Programs saved by an older release may use notation this one no longer
        # reads, or the controller may now be one without the room or the Special
        # Functions for it. A copy stays in the store, so it is not lost outright.
        _LOGGER.warning("Saved program could not be loaded on the %s (%s); using the example",
                        config.controller_model.label, exc)
        service = ControllerService(config)
        replaced_saved = True
        rejected = saved.get("program")
    if saved.get("running") is False:
        service.halt()
    if saved.get("analogue_switches"):
        service.set_analogue_switches(saved["analogue_switches"])

    wiring = Wiring(hass, service, entry.entry_id)
    entry.runtime_data = MicroGemData(service, store, wiring)

    # Keep the program, the Run/Halt state and the 8108 switches across restarts.
    last_saved = {"program": service.controller.program.source, "running": service.controller.running,
                  "analogue_switches": service.controller.snapshot()["analogue_switches"]}
    if rejected is not None:
        last_saved["rejected_program"] = rejected
    entry.runtime_data.saved = last_saved

    @callback
    def persist(state: dict) -> None:
        current = {"program": state["program"], "running": state["running"],
                   "analogue_switches": state.get("analogue_switches", {})}
        if any(last_saved.get(key) != value for key, value in current.items()):
            last_saved.update(current)
            store.async_delay_save(lambda: dict(last_saved), SAVE_DELAY_S)

    if replaced_saved:
        # Save the example now so the warning is not repeated on every restart.
        store.async_delay_save(lambda: dict(last_saved), SAVE_DELAY_S)

    entry.async_on_unload(service.subscribe(persist))
    service.start()
    entry.async_on_unload(service.stop)
    wiring.apply(entry.options.get(CONF_WIRING))
    entry.async_on_unload(wiring.stop)

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
    """New wiring is applied in place; a change of I/O (expansion units, the
    modules in a GEM 80's slots) or of model rebuilds the controller and its
    entities. The options flow has already moved the wiring to suit."""
    data = entry.runtime_data
    old, new = data.service.controller.config, config_of(entry)
    if (old.model, old.expansions, old.modules) != (new.model, new.expansions, new.modules):
        await hass.config_entries.async_reload(entry.entry_id)
    else:
        data.wiring.apply(entry.options.get(CONF_WIRING))


def remove_missing_io(hass: HomeAssistant, entry: ConfigEntry, config: ControllerConfig) -> None:
    """Drop the entities of terminals the controller no longer has: those of a
    removed expansion unit, or of a GEM 80 module taken out or moved."""
    registry = er.async_get(hass)
    keep = {io_key(config, "input", i) for i in range(config.total_inputs)}
    keep |= {io_key(config, "output", i) for i in range(config.total_outputs)}
    for entity in er.async_entries_for_config_entry(registry, entry.entry_id):
        key = entity.unique_id.removeprefix(f"{entry.entry_id}_")
        if key.startswith(("input_", "output_")) and key not in keep:
            registry.async_remove(entity.entity_id)


async def async_unload_entry(hass: HomeAssistant, entry: MicroGemConfigEntry) -> bool:
    # Write now what is waiting for the save delay, so a reload (which opens
    # the store afresh) finds it.
    data = entry.runtime_data
    await data.store.async_save(dict(data.saved))
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
