"""Config flow: name the virtual controller, pick the model, then choose its I/O.

A MicroGEM60 takes expansion units; a GEM 80 has eight subrack slots, each
empty or holding a Compact I/O module.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import CONF_EXPANSIONS, CONF_INPUTS, CONF_MODEL, CONF_MODULES, CONF_OUTPUTS, DOMAIN
from .core import MAX_EXPANSIONS, ControllerConfig
from .wiring import CONF_WIRING
from .core.models import DEFAULT_GEM80, DEFAULT_MODEL, DEFAULT_MODULES, IO_MODULES, MODELS, SLOTS

EXPANSIONS = vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_EXPANSIONS))
EMPTY = "empty"


Settings = tuple[Mapping[str, Any], Mapping[str, Any]]  # an entry's data and options


def _setting(entry: ConfigEntry | Settings, key: str, default: Any) -> Any:
    data, options = (entry.data, entry.options) if isinstance(entry, ConfigEntry) else entry
    return options.get(key, data.get(key, default))


def expansions_of(entry: ConfigEntry | Settings) -> int:
    return int(_setting(entry, CONF_EXPANSIONS, 0))


def model_of(entry: ConfigEntry | Settings) -> str:
    model = _setting(entry, CONF_MODEL, DEFAULT_MODEL)
    return model if model in MODELS else DEFAULT_MODEL


def modules_of(entry: ConfigEntry | Settings) -> tuple[str | None, ...]:
    modules = list(_setting(entry, CONF_MODULES, DEFAULT_MODULES))[:SLOTS]
    return tuple(code if code in IO_MODULES else None for code in modules)


def config_of(entry: ConfigEntry, options: Mapping[str, Any] | None = None) -> ControllerConfig:
    """The controller an entry describes, from its data and options (or the
    options given, for one about to be changed)."""
    settings = (entry.data, entry.options if options is None else options)
    model = model_of(settings)
    if MODELS[model].family == "gem80":
        return ControllerConfig(name=entry.title, model=model, modules=modules_of(settings))
    return ControllerConfig(
        name=entry.title,
        inputs=int(entry.data.get(CONF_INPUTS, 12)),
        outputs=int(entry.data.get(CONF_OUTPUTS, 8)),
        expansions=expansions_of(settings),
        model=model,
    )


def follow_wiring(wiring: Mapping | None, old: ControllerConfig, new: ControllerConfig) -> dict:
    """Field wiring after an I/O change: each wire stays on its terminal (the
    same address), wherever that now is in the list; wires to terminals that
    went away are dropped."""
    result: dict[str, dict] = {"inputs": {}, "outputs": {}}
    for kind, address, count in (("inputs", "input_address", "total_inputs"),
                                 ("outputs", "output_address", "total_outputs")):
        index_of = {getattr(new, address)(i): i for i in range(getattr(new, count))}
        for index, point in ((wiring or {}).get(kind) or {}).items():
            if not str(index).isdigit() or int(index) >= getattr(old, count):
                continue
            moved_to = index_of.get(getattr(old, address)(int(index)))
            if moved_to is not None:
                result[kind][str(moved_to)] = point
    return result


def _select(options: list[SelectOptionDict]) -> SelectSelector:
    return SelectSelector(SelectSelectorConfig(options=options, mode=SelectSelectorMode.DROPDOWN))


def _models(family: str | None = None) -> SelectSelector:
    return _select([
        SelectOptionDict(value=m.key, label=m.label)
        for m in MODELS.values() if family is None or m.family == family
    ])


_MODULE_SELECT = _select(
    [SelectOptionDict(value=EMPTY, label="Empty")]
    + [SelectOptionDict(value=m.code, label=f"{m.code}: {m.title}") for m in IO_MODULES.values()]
)


def _slot(n: int) -> str:
    return f"slot_{n}"


def _slots_schema(modules: tuple[str | None, ...]) -> dict:
    return {
        vol.Required(_slot(n), default=modules[n - 1] or EMPTY): _MODULE_SELECT
        for n in range(1, SLOTS + 1)
    }


def _modules_from(user_input: dict[str, Any]) -> list[str | None]:
    modules = []
    for n in range(1, SLOTS + 1):
        code = user_input.pop(_slot(n), EMPTY)
        modules.append(code if code in IO_MODULES else None)
    return modules


class MicroGemConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            self._data = dict(user_input)
            if MODELS[user_input[CONF_MODEL]].family == "gem80":
                return await self.async_step_modules()
            return await self.async_step_expansions()
        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default="MicroGEM"): str,
                vol.Required(CONF_MODEL, default=DEFAULT_MODEL): _models(),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    async def async_step_expansions(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            # Every unit is a MicroGEM60: 12 inputs and 8 relay outputs.
            data = {CONF_INPUTS: 12, CONF_OUTPUTS: 8, **self._data, **user_input}
            return self.async_create_entry(title=data[CONF_NAME], data=data)
        schema = vol.Schema({vol.Required(CONF_EXPANSIONS, default=0): EXPANSIONS})
        return self.async_show_form(step_id="expansions", data_schema=schema)

    async def async_step_modules(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            data = {**self._data, CONF_MODULES: _modules_from(dict(user_input))}
            return self.async_create_entry(title=data[CONF_NAME], data=data)
        return self.async_show_form(
            step_id="modules",
            data_schema=vol.Schema(_slots_schema(DEFAULT_MODULES)),
            description_placeholders={"model": MODELS[self._data.get(CONF_MODEL, DEFAULT_GEM80)].label},
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return MicroGemOptionsFlow()


class MicroGemOptionsFlow(OptionsFlow):
    """Change the I/O later (and, for a GEM 80, the memory size); the entry
    reloads with the new I/O."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        entry = self.config_entry
        gem80 = MODELS[model_of(entry)].family == "gem80"
        if user_input is not None:
            settings = dict(user_input)
            if gem80:
                settings[CONF_MODULES] = _modules_from(settings)
            options = {**entry.options, **settings}
            # Keep the field wiring, which the panel edits, on the same terminals.
            if CONF_WIRING in options:
                options[CONF_WIRING] = follow_wiring(options[CONF_WIRING], config_of(entry),
                                                     config_of(entry, options))
            return self.async_create_entry(data=options)
        if gem80:
            schema = {vol.Required(CONF_MODEL, default=model_of(entry)): _models("gem80"),
                      **_slots_schema(modules_of(entry))}
            return self.async_show_form(step_id="modules", data_schema=vol.Schema(schema))
        schema = {vol.Required(CONF_EXPANSIONS, default=expansions_of(entry)): EXPANSIONS}
        return self.async_show_form(step_id="init", data_schema=vol.Schema(schema))

    async def async_step_modules(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return await self.async_step_init(user_input)
