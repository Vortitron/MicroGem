"""Smoke tests for the Home Assistant integration (needs pytest-homeassistant-custom-component)."""

import asyncio

import pytest
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError

DOMAIN = "microgem"


async def _setup(hass: HomeAssistant):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"name": "Bedroom", "expansions": 0}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    return result["result"]


async def _settle(hass: HomeAssistant) -> None:
    await asyncio.sleep(0.1)  # a few real scans
    await hass.async_block_till_done()


async def test_inputs_drive_outputs_through_the_program(hass: HomeAssistant, hass_ws_client):
    entry = await _setup(hass)

    assert hass.states.get("switch.bedroom_input_a0_1").state == "off"
    assert hass.states.get("binary_sensor.bedroom_output_b0_1").state == "off"
    assert hass.states.get("switch.bedroom_run").state == "on"
    assert hass.states.get("switch.bedroom_input_a0_11").state == "off"
    assert hass.states.get("switch.bedroom_input_a0_12") is None  # a MicroGEM60 has 12 inputs
    assert hass.states.get("binary_sensor.bedroom_output_b0_8") is None  # and 8 outputs

    # The example program: bedside switch A0.1 drives lamp B0.1.
    await hass.services.async_call("switch", "turn_on", {"entity_id": "switch.bedroom_input_a0_1"}, blocking=True)
    await _settle(hass)
    assert hass.states.get("binary_sensor.bedroom_output_b0_1").state == "on"

    # Load a new program through the action.
    await hass.services.async_call(
        DOMAIN, "load_program",
        {"config_entry_id": entry.entry_id, "program": "A0.1 -> B0.3"}, blocking=True,
    )
    await _settle(hass)
    assert hass.states.get("binary_sensor.bedroom_output_b0_3").state == "on"

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN, "load_program",
            {"config_entry_id": entry.entry_id, "program": "A0.1 -> B0"}, blocking=True,
        )

    assert hass.states.get("binary_sensor.bedroom_watchdog").state == "on"

    # Halt turns outputs off and opens the watchdog.
    await hass.services.async_call("switch", "turn_off", {"entity_id": "switch.bedroom_run"}, blocking=True)
    await _settle(hass)
    assert hass.states.get("binary_sensor.bedroom_output_b0_3").state == "off"
    assert hass.states.get("binary_sensor.bedroom_watchdog").state == "off"

    # The panel's websocket API.
    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "microgem/subscribe", "entry_id": entry.entry_id})
    msg = await client.receive_json()
    assert msg["success"]
    msg = await client.receive_json()
    assert msg["event"]["type"] == "entities"
    assert msg["event"]["entities"]["input_1"] == "switch.bedroom_input_a0_1"
    assert msg["event"]["entities"]["output_7"] == "binary_sensor.bedroom_output_b0_7"
    assert msg["event"]["device_id"]
    msg = await client.receive_json()
    assert msg["event"]["type"] == "state" and msg["event"]["running"] is False
    assert msg["event"]["io"] == {"units": 1, "inputs": 12, "outputs": 8}
    assert msg["event"]["watchdog"] is False
    await client.send_json({"id": 2, "type": "microgem/command", "entry_id": entry.entry_id,
                            "command": {"type": "run"}})
    while True:
        msg = await client.receive_json()
        if msg["id"] == 2:
            assert msg["success"]
            break

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()


async def test_expansion_units_from_options(hass: HomeAssistant):
    entry = await _setup(hass)

    # Add two expansion units: each brings 12 inputs and 8 outputs on its own word.
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"expansions": 2})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    assert hass.states.get("switch.bedroom_input_a2_11").state == "off"
    assert hass.states.get("binary_sensor.bedroom_output_b2_7").state == "off"
    assert hass.states.get("switch.bedroom_input_a2_12") is None

    await hass.services.async_call(
        DOMAIN, "load_program", {"config_entry_id": entry.entry_id, "program": "A1.3 -> B2.0"}, blocking=True,
    )
    await hass.services.async_call("switch", "turn_on", {"entity_id": "switch.bedroom_input_a1_3"}, blocking=True)
    await _settle(hass)
    assert hass.states.get("binary_sensor.bedroom_output_b2_0").state == "on"

    # Taking a unit away removes its entities.
    result = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(result["flow_id"], {"expansions": 1})
    await hass.async_block_till_done()
    assert hass.states.get("switch.bedroom_input_a1_3") is not None
    assert hass.states.get("switch.bedroom_input_a2_0") is None
    assert hass.states.get("binary_sensor.bedroom_output_b2_0") is None

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
