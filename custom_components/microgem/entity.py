"""Shared base for MicroGEM entities."""

from __future__ import annotations

from typing import Any

from homeassistant.core import callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN
from .core import __version__
from .core import ControllerConfig
from .core.service import ControllerService


def io_key(config: ControllerConfig, kind: str, index: int) -> str:
    """The unique id suffix of an input or output terminal's entity.

    A MicroGEM's terminals are numbered: expansion units only add to the end.
    A GEM 80's are named by address, since moving a module renumbers them,
    and an entity should stay with its terminal.
    """
    if config.family == "gem80":
        address = config.input_address(index) if kind == "input" else config.output_address(index)
        return f"{kind}_{str(address).lower()}"
    return f"{kind}_{index}"


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
            manufacturer="Harecastle Controls",
            model=service.controller.config.controller_model.label,
            sw_version=__version__,
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
