"""Config flow: name the virtual controller and choose its I/O count."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_NAME

from .const import CONF_INPUTS, CONF_OUTPUTS, DOMAIN

IO_RANGE = vol.All(vol.Coerce(int), vol.Range(min=1, max=64))


class MicroGemConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title=user_input[CONF_NAME], data=user_input)
        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default="MicroGEM"): str,
                vol.Required(CONF_INPUTS, default=12): IO_RANGE,
                vol.Required(CONF_OUTPUTS, default=8): IO_RANGE,
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)
