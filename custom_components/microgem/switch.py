"""Inputs (A table) and the Run/Halt switch, as switches."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import MicroGemConfigEntry
from .entity import MicroGemEntity, io_key


async def async_setup_entry(
    hass: HomeAssistant, entry: MicroGemConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    service = entry.runtime_data.service
    entities: list[SwitchEntity] = [RunSwitch(entry.entry_id, entry.title, service)]
    entities += [
        InputSwitch(entry.entry_id, entry.title, service, i)
        for i in range(service.controller.config.total_inputs)
    ]
    async_add_entities(entities)


class InputSwitch(MicroGemEntity, SwitchEntity):
    """One input terminal. Turning it on is like closing the contact wired to it."""

    _attr_icon = "mdi:electric-switch"

    def __init__(self, entry_id, title, service, index: int) -> None:
        super().__init__(entry_id, title, service, io_key(service.controller.config, "input", index))
        self._index = index
        self._attr_name = f"Input {service.controller.config.input_address(index)}"

    def current(self) -> bool:
        return self._service.controller.input(self._index)

    @property
    def is_on(self) -> bool:
        return self.current()

    async def async_turn_on(self, **kwargs: Any) -> None:
        self._service.set_input(self._index, True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        self._service.set_input(self._index, False)


class RunSwitch(MicroGemEntity, SwitchEntity):
    """On is RUN, off is HALT (which turns every output off)."""

    _attr_icon = "mdi:play-pause"
    _attr_name = "Run"

    def __init__(self, entry_id, title, service) -> None:
        super().__init__(entry_id, title, service, "run")

    def current(self) -> bool:
        return self._service.controller.running

    @property
    def is_on(self) -> bool:
        return self.current()

    async def async_turn_on(self, **kwargs: Any) -> None:
        self._service.run()

    async def async_turn_off(self, **kwargs: Any) -> None:
        self._service.halt()
