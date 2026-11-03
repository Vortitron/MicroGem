"""Field wiring: input terminals fed by Home Assistant entities, outputs driving them.

This stands in for the cables on a real installation. An input follows an
entity's state (or one of its attributes, optionally against a threshold),
and a relay output switches an entity on and off, so no automations are
needed. The wiring lives in the config entry's options under ``wiring``:

    {"inputs": {"3": {"entity_id": "binary_sensor.hall_motion"},
                "4": {"entity_id": "sensor.lounge", "attribute": "temperature", "above": 21},
                "5": {"entity_id": "binary_sensor.door", "invert": True}},
     "outputs": {"0": {"entity_id": "light.landing"}}}
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

import voluptuous as vol

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_state_change_event

from .core.service import ControllerService

_LOGGER = logging.getLogger(__name__)

CONF_WIRING = "wiring"

#: States that count as an open contact. Anything else (on, open, home,
#: playing, detected ...) closes it.
OFF_STATES = {
    "off", "closed", "not_home", "away", "idle", "standby", "paused", "locked",
    "false", "0", "none", "", STATE_UNAVAILABLE, STATE_UNKNOWN,
}

#: Domains that are triggered rather than switched: fired on the output's rising edge.
PRESS_DOMAINS = {"button": "press", "input_button": "press"}
TRIGGER_DOMAINS = {"scene": "turn_on", "script": "turn_on", "automation": "trigger"}

POINT_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Optional("attribute"): vol.Any(None, cv.string),
        vol.Optional("above"): vol.Any(None, vol.Coerce(float)),
        vol.Optional("invert"): cv.boolean,
    }
)


def closed(value: Any, above: float | None) -> bool:
    """Whether a state or attribute value closes the input contact."""
    if above is not None:
        try:
            return float(value) > above
        except (TypeError, ValueError):
            return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() not in OFF_STATES


def input_value(state: State | None, point: dict) -> bool:
    """The input contact for a wired entity. ``invert`` makes it normally
    closed; a missing or unavailable entity always leaves it open."""
    if state is None or state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return False
    attribute = point.get("attribute")
    value = state.attributes.get(attribute) if attribute else state.state
    return closed(value, point.get("above")) != bool(point.get("invert"))


def clean(wiring: dict | None, inputs: int, outputs: int) -> dict:
    """Valid points only, and only for terminals the controller has."""
    result: dict[str, dict[str, dict]] = {"inputs": {}, "outputs": {}}
    for kind, limit in (("inputs", inputs), ("outputs", outputs)):
        for index, point in ((wiring or {}).get(kind) or {}).items():
            try:
                if 0 <= int(index) < limit:
                    result[kind][str(int(index))] = POINT_SCHEMA(point)
            except (vol.Invalid, ValueError, TypeError):
                _LOGGER.warning("Ignoring bad MicroGEM wiring for %s %s: %s", kind, index, point)
    return result


class Wiring:
    """Keeps the controller's terminals and the wired entities in step."""

    def __init__(self, hass: HomeAssistant, service: ControllerService, entry_id: str = "") -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.service = service
        self.points: dict = {"inputs": {}, "outputs": {}}
        self._unsubs: list[Callable[[], None]] = []
        self._outputs: list[bool] = list(service.controller.outputs())

    @callback
    def apply(self, wiring: dict | None) -> None:
        self.stop()
        config = self.service.controller.config
        self.points = clean(wiring, config.total_inputs, config.total_outputs)
        # The controller's own switches and sensors are its internal I/O, not field devices.
        registry = er.async_get(self.hass)
        for kind in self.points.values():
            for index, point in list(kind.items()):
                entity = registry.async_get(point["entity_id"])
                if entity is not None and entity.config_entry_id == self.entry_id:
                    _LOGGER.warning("Ignoring MicroGEM wiring to its own entity %s", point["entity_id"])
                    del kind[index]
        by_entity: dict[str, list[tuple[int, dict]]] = {}
        for index, point in self.points["inputs"].items():
            by_entity.setdefault(point["entity_id"], []).append((int(index), point))
            self.service.set_input(int(index), input_value(self.hass.states.get(point["entity_id"]), point))

        @callback
        def changed(event: Event[EventStateChangedData]) -> None:
            for index, point in by_entity.get(event.data["entity_id"], []):
                self.service.set_input(index, input_value(event.data["new_state"], point))

        if by_entity:
            self._unsubs.append(async_track_state_change_event(self.hass, list(by_entity), changed))
        self._outputs = list(self.service.controller.outputs())
        if self.points["outputs"]:
            self._unsubs.append(self.service.subscribe(self._outputs_changed))

    @callback
    def _outputs_changed(self, state: dict) -> None:
        now = state["outputs"]
        for index, point in self.points["outputs"].items():
            i = int(index)
            if i < len(now) and (i >= len(self._outputs) or now[i] != self._outputs[i]):
                self._drive(point["entity_id"], now[i])
        self._outputs = list(now)

    @callback
    def sync_output(self, index: int) -> None:
        """Drive a wired entity to match its relay now (switches only)."""
        point = self.points["outputs"].get(str(index))
        if point is None or index >= len(self._outputs):
            return
        domain = point["entity_id"].split(".", 1)[0]
        if domain not in PRESS_DOMAINS and domain not in TRIGGER_DOMAINS:
            self._drive(point["entity_id"], self._outputs[index])

    @callback
    def _drive(self, entity_id: str, on: bool) -> None:
        domain = entity_id.split(".", 1)[0]
        if domain in PRESS_DOMAINS or domain in TRIGGER_DOMAINS:
            if not on:
                return  # triggered on the rising edge only
            service_domain, service = domain, (PRESS_DOMAINS | TRIGGER_DOMAINS)[domain]
        else:
            service_domain, service = "homeassistant", "turn_on" if on else "turn_off"
        self.hass.async_create_task(
            self.hass.services.async_call(service_domain, service, {"entity_id": entity_id}, blocking=False),
            f"microgem drive {entity_id}",
        )

    @callback
    def stop(self) -> None:
        while self._unsubs:
            self._unsubs.pop()()
