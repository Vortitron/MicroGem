"""Websocket commands used by the MicroGEM sidebar panel."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_command)


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
    forward(service.state())


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
