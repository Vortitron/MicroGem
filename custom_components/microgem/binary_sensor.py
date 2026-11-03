"""Outputs (B table) and the watchdog contacts as binary sensors."""

from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import MicroGemConfigEntry
from .entity import MicroGemEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: MicroGemConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    service = entry.runtime_data.service
    entities: list[BinarySensorEntity] = [WatchdogSensor(entry.entry_id, entry.title, service)]
    entities += [
        OutputSensor(entry.entry_id, entry.title, service, i)
        for i in range(service.controller.config.total_outputs)
    ]
    async_add_entities(entities)


class OutputSensor(MicroGemEntity, BinarySensorEntity):
    """One output terminal. Use it in an automation to drive a real light."""

    _attr_icon = "mdi:led-on"

    def __init__(self, entry_id, title, service, index: int) -> None:
        super().__init__(entry_id, title, service, f"output_{index}")
        self._index = index
        self._attr_name = f"Output {service.controller.config.output_address(index)}"

    def current(self) -> bool:
        return self._service.controller.output(self._index)

    @property
    def is_on(self) -> bool:
        return self.current()


class WatchdogSensor(MicroGemEntity, BinarySensorEntity):
    """The W/DOG OUTPUT contacts: on (closed) while the controller is running healthily.

    As on a GEM 80 they close after a few clean scans in Run, open in Halt, and
    open with a trip when the program holds a non-zero code in F1 for 100 ms.
    Wire safety interlocks to this, as the manual asks for the real relay.
    """

    _attr_icon = "mdi:shield-check"
    _attr_name = "Watchdog"

    def __init__(self, entry_id, title, service) -> None:
        super().__init__(entry_id, title, service, "watchdog")

    def current(self) -> tuple[bool, int]:
        controller = self._service.controller
        return controller.watchdog, controller.trip_code

    @property
    def is_on(self) -> bool:
        return self._service.controller.watchdog

    @property
    def extra_state_attributes(self) -> dict[str, int]:
        return {"trip_code": self._service.controller.trip_code}
