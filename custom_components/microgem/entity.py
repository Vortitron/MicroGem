"""Shared base for MicroGEM entities."""

from __future__ import annotations

from typing import Any

from homeassistant.core import callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN
from .core.service import ControllerService


def address(table: str, index: int) -> str:
    return f"{table}{index // 16}.{index % 16}"


class MicroGemEntity(Entity):
    """An entity whose state is read from the controller and pushed on change."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, entry_id: str, title: str, service: ControllerService, key: str) -> None:
        self._service = service
        self._attr_unique_id = f"{entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry_id)},
            name=title,
            manufacturer="GEC (virtual)",
            model="MicroGEM",
        )
        self._last: Any = None

    def current(self) -> Any:
        raise NotImplementedError

    async def async_added_to_hass(self) -> None:
        self._last = self.current()
        self.async_on_remove(self._service.subscribe(self._handle_state))

    @callback
    def _handle_state(self, state: dict) -> None:
        value = self.current()
        if value != self._last:
            self._last = value
            self.async_write_ha_state()
