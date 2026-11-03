"""Config flow: name the virtual controller and choose its expansion units."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_NAME
from homeassistant.core import callback

from .const import CONF_EXPANSIONS, CONF_INPUTS, CONF_OUTPUTS, DOMAIN
from .core import MAX_EXPANSIONS

EXPANSIONS = vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_EXPANSIONS))


def expansions_of(entry: ConfigEntry) -> int:
    return int(entry.options.get(CONF_EXPANSIONS, entry.data.get(CONF_EXPANSIONS, 0)))


class MicroGemConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            # Every unit is a MicroGEM60: 12 inputs and 8 relay outputs.
            data = {CONF_INPUTS: 12, CONF_OUTPUTS: 8, **user_input}
            return self.async_create_entry(title=data[CONF_NAME], data=data)
        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default="MicroGEM"): str,
                vol.Required(CONF_EXPANSIONS, default=0): EXPANSIONS,
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return MicroGemOptionsFlow()


class MicroGemOptionsFlow(OptionsFlow):
    """Add or remove expansion units later; the entry reloads with the new I/O."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            # Keep the field wiring, which the panel edits.
            return self.async_create_entry(data={**self.config_entry.options, **user_input})
        schema = vol.Schema(
            {vol.Required(CONF_EXPANSIONS, default=expansions_of(self.config_entry)): EXPANSIONS}
        )
        return self.async_show_form(step_id="init", data_schema=schema)
