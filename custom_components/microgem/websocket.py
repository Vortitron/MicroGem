"""Websocket commands used by the MicroGEM sidebar panel."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .wiring import CONF_WIRING


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_command)
    websocket_api.async_register_command(hass, ws_wire)


def _service(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict):
    from . import get_loaded_entry

    entry = get_loaded_entry(hass, msg["entry_id"])
    if entry is None:
        connection.send_error(msg["id"], "not_found", "That MicroGEM is not set up or not loaded")
        return None
    return entry.runtime_data.service


@websocket_api.websocket_command(
    {vol.Required("type"): "microgem/subscribe", vol.Required("entry_id"): str}
)
@websocket_api.require_admin
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    service = _service(hass, connection, msg)
    if service is None:
        return

    @callback
    def forward(state: dict[str, Any]) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {"type": "state", **state}))

    connection.subscriptions[msg["id"]] = service.subscribe(forward)
    connection.send_result(msg["id"])
    connection.send_message(
        websocket_api.event_message(msg["id"], {"type": "entities", **entities(hass, msg["entry_id"])})
    )
    forward(service.state())


def device_of(hass: HomeAssistant, entry_id: str) -> dr.DeviceEntry | None:
    registry = dr.async_get(hass)
    if hasattr(registry, "async_get_device_by_identifier"):  # Home Assistant 2026.11 and later
        return registry.async_get_device_by_identifier((DOMAIN, entry_id), entry_id)
    return registry.async_get_device(identifiers={(DOMAIN, entry_id)})


def entities(hass: HomeAssistant, entry_id: str) -> dict[str, Any]:
    """The device and entity ids, so the panel can link to them.

    ``entities`` maps a key (``run``, ``input_3``, ``output_0``) to its entity id.
    """
    from . import get_loaded_entry
    from .entity import io_key

    device = device_of(hass, entry_id)
    entry = get_loaded_entry(hass, entry_id)
    keys: dict[str, str] = {}
    if entry is not None:
        config = entry.runtime_data.service.controller.config
        for kind, count in (("input", config.total_inputs), ("output", config.total_outputs)):
            keys |= {io_key(config, kind, i): f"{kind}_{i}" for i in range(count)}
    found = {}
    for entity in er.async_entries_for_config_entry(er.async_get(hass), entry_id):
        key = entity.unique_id.removeprefix(f"{entry_id}_")
        found[keys.get(key, key)] = entity.entity_id
    wiring = entry.runtime_data.wiring.points if entry else {"inputs": {}, "outputs": {}}
    return {"device_id": device.id if device else None, "entities": found, "wiring": wiring}


@websocket_api.websocket_command(
    {
        vol.Required("type"): "microgem/wire",
        vol.Required("entry_id"): str,
        vol.Required("kind"): vol.In(["inputs", "outputs", "analogue"]),
        vol.Required("index"): vol.All(vol.Coerce(int), vol.Range(min=0)),
        vol.Optional("entity_id"): vol.Any(None, cv.entity_id),
        vol.Optional("attribute"): vol.Any(None, str),
        vol.Optional("above"): vol.Any(None, vol.Coerce(float)),
        vol.Optional("invert"): bool,
        vol.Optional("low"): vol.Any(None, vol.Coerce(float)),
        vol.Optional("high"): vol.Any(None, vol.Coerce(float)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_wire(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Wire a terminal to an entity (or unwire it with no entity_id)."""
    from . import get_loaded_entry

    entry = get_loaded_entry(hass, msg["entry_id"])
    if entry is None:
        connection.send_error(msg["id"], "not_found", "That MicroGEM is not set up or not loaded")
        return
    config = entry.runtime_data.service.controller.config
    limit = {"inputs": config.total_inputs, "outputs": config.total_outputs,
             "analogue": config.total_analogue}[msg["kind"]]
    if msg["index"] >= limit:
        connection.send_error(msg["id"], "invalid_index", "That terminal does not exist")
        return
    own = er.async_get(hass).async_get(msg.get("entity_id") or "")
    if own is not None and own.config_entry_id == entry.entry_id:
        connection.send_error(
            msg["id"], "own_entity", "That is one of this controller's own entities; wire terminals to other devices"
        )
        return
    wiring = {k: dict(v) for k, v in entry.runtime_data.wiring.points.items()}
    fields = ("entity_id", "attribute", "low", "high") if msg["kind"] == "analogue" else ("entity_id", "attribute", "above")
    point = {k: msg[k] for k in fields if msg.get(k) is not None}
    if msg["kind"] == "analogue" and point.get("entity_id") and point.get("low", 0.0) == point.get("high", 100.0):
        connection.send_error(msg["id"], "invalid_range", "The values for 0 V and 10 V must differ")
        return
    if msg.get("invert") and msg["kind"] == "inputs":
        point["invert"] = True
    if point.get("entity_id"):
        wiring.setdefault(msg["kind"], {})[str(msg["index"])] = point
    else:
        wiring.setdefault(msg["kind"], {}).pop(str(msg["index"]), None)
    data = entry.runtime_data
    data.wiring.apply(wiring)
    if msg["kind"] == "outputs" and point.get("entity_id"):
        # Bring the newly wired entity into step with its relay straight away.
        data.wiring.sync_output(msg["index"])
    hass.config_entries.async_update_entry(entry, options={**entry.options, CONF_WIRING: data.wiring.points})
    connection.send_result(msg["id"], {"wiring": data.wiring.points})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "microgem/command",
        vol.Required("entry_id"): str,
        vol.Required("command"): dict,
    }
)
@websocket_api.require_admin
@callback
def ws_command(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    service = _service(hass, connection, msg)
    if service is None:
        return
    connection.send_result(msg["id"], service.command(msg["command"]))
