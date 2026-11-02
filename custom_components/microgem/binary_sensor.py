"""Outputs (B table) as binary sensors."""

from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import MicroGemConfigEntry
from .entity import MicroGemEntity, address


async def async_setup_entry(
    hass: HomeAssistant, entry: MicroGemConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    service = entry.runtime_data.service
    async_add_entities(
        OutputSensor(entry.entry_id, entry.title, service, i)
        for i in range(service.controller.config.outputs)
    )


class OutputSensor(MicroGemEntity, BinarySensorEntity):
    """One output terminal. Use it in an automation to drive a real light."""

    _attr_icon = "mdi:led-on"

    def __init__(self, entry_id, title, service, index: int) -> None:
        super().__init__(entry_id, title, service, f"output_{index}")
        self._index = index
        self._attr_name = f"Output {address('B', index)}"

    def current(self) -> bool:
        return self._service.controller.output(self._index)

    @property
    def is_on(self) -> bool:
        return self.current()
