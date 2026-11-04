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
        result["flow_id"], {"name": "Bedroom", "model": "microgem60"}
    )
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "expansions"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"expansions": 0})
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
    assert msg["event"]["io"] == {"family": "microgem", "model": "microgem60", "units": 1, "inputs": 12, "outputs": 8}
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


async def test_field_wiring(hass: HomeAssistant, hass_ws_client):
    entry = await _setup(hass)
    hass.states.async_set("binary_sensor.door", "off")
    hass.states.async_set("sensor.lounge", "ok", {"temperature": 19})
    calls = []

    async def record(call):
        calls.append((call.service, call.data["entity_id"]))

    hass.services.async_register("homeassistant", "turn_on", record)
    hass.services.async_register("homeassistant", "turn_off", record)

    client = await hass_ws_client(hass)
    for n, (kind, index, extra) in enumerate([
        ("inputs", 1, {"entity_id": "binary_sensor.door"}),
        ("inputs", 4, {"entity_id": "sensor.lounge", "attribute": "temperature", "above": 21}),
        ("outputs", 1, {"entity_id": "light.lamp"}),
    ]):
        await client.send_json({"id": 10 + n, "type": "microgem/wire", "entry_id": entry.entry_id,
                                "kind": kind, "index": index, **extra})
        msg = await client.receive_json()
        assert msg["success"], msg
    assert msg["result"]["wiring"]["outputs"]["1"]["entity_id"] == "light.lamp"
    await hass.async_block_till_done()
    assert calls == [("turn_off", "light.lamp")]  # brought into step with its relay
    await hass.async_block_till_done()
    assert entry.options["wiring"]["inputs"]["4"]["above"] == 21

    # The door closes input A0.1; the example program drives lamp B0.1, which
    # is wired to light.lamp.
    hass.states.async_set("binary_sensor.door", "on")
    await _settle(hass)
    assert hass.states.get("switch.bedroom_input_a0_1").state == "on"
    assert hass.states.get("binary_sensor.bedroom_output_b0_1").state == "on"
    assert calls[-1] == ("turn_on", "light.lamp")
    hass.states.async_set("binary_sensor.door", "off")
    await _settle(hass)
    assert calls[-1] == ("turn_off", "light.lamp")

    # An attribute against a threshold.
    hass.states.async_set("sensor.lounge", "ok", {"temperature": 22.5})
    await _settle(hass)
    assert hass.states.get("switch.bedroom_input_a0_4").state == "on"

    # Inverted: a normally closed contact, but open while the entity is unavailable.
    await client.send_json({"id": 18, "type": "microgem/wire", "entry_id": entry.entry_id,
                            "kind": "inputs", "index": 5, "entity_id": "binary_sensor.door", "invert": True})
    assert (await client.receive_json())["success"]
    await _settle(hass)
    assert entry.options["wiring"]["inputs"]["5"]["invert"] is True
    assert hass.states.get("switch.bedroom_input_a0_5").state == "on"  # door is off
    hass.states.async_set("binary_sensor.door", "on")
    await _settle(hass)
    assert hass.states.get("switch.bedroom_input_a0_5").state == "off"
    hass.states.async_set("binary_sensor.door", "unavailable")
    await _settle(hass)
    assert hass.states.get("switch.bedroom_input_a0_5").state == "off"

    # The controller's own entities are its internal I/O and cannot be wired.
    await client.send_json({"id": 19, "type": "microgem/wire", "entry_id": entry.entry_id,
                            "kind": "outputs", "index": 2, "entity_id": "switch.bedroom_input_a0_5"})
    reply = await client.receive_json()
    assert not reply["success"] and reply["error"]["code"] == "own_entity"

    # Unwire, and the wiring survives an expansion change.
    await client.send_json({"id": 20, "type": "microgem/wire", "entry_id": entry.entry_id,
                            "kind": "inputs", "index": 4})
    assert (await client.receive_json())["success"]
    await hass.async_block_till_done()
    assert "4" not in entry.options["wiring"]["inputs"]
    result = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(result["flow_id"], {"expansions": 1})
    await hass.async_block_till_done()
    assert entry.options["wiring"]["outputs"]["1"]["entity_id"] == "light.lamp"
    assert entry.options["expansions"] == 1

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()


DEFAULT_SLOTS = {"slot_1": "8177", "slot_2": "8178", "slot_3": "8110", "slot_4": "8130",
                 "slot_5": "empty", "slot_6": "empty", "slot_7": "empty", "slot_8": "empty"}


async def test_gem80_with_modules(hass: HomeAssistant, hass_ws_client, device_registry):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"name": "Line 3", "model": "gem80-130c-12k"}
    )
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "modules"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], DEFAULT_SLOTS)
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = result["result"]
    assert entry.data["modules"] == ["8177", "8178", "8110", "8130", None, None, None, None]
    await hass.async_block_till_done()

    # Slot 1: 16 inputs on A0; slot 2: 16 outputs on B2; slot 3: 8 inputs on
    # A4; slot 4: 8 relays on B6.
    assert hass.states.get("switch.line_3_input_a0_15").state == "off"
    assert hass.states.get("switch.line_3_input_a1_0") is None
    assert hass.states.get("switch.line_3_input_a4_7").state == "off"
    assert hass.states.get("binary_sensor.line_3_output_b2_15").state == "off"
    assert hass.states.get("binary_sensor.line_3_output_b6_7").state == "off"
    device = device_registry.async_get_device_by_identifier((DOMAIN, entry.entry_id), entry.entry_id)
    assert device.model == "GEM 80/130C 12K"

    # A new GEM 80 runs the bottling line: start, then the conveyor runs.
    for name in ("a0_1", "a4_0", "a0_0"):
        await hass.services.async_call("switch", "turn_on", {"entity_id": f"switch.line_3_input_{name}"},
                                       blocking=True)
    await _settle(hass)
    assert hass.states.get("binary_sensor.line_3_output_b6_0").state == "on"

    client = await hass_ws_client(hass)
    await client.send_json({"id": 1, "type": "microgem/subscribe", "entry_id": entry.entry_id})
    assert (await client.receive_json())["success"]
    assert (await client.receive_json())["event"]["type"] == "entities"
    state = (await client.receive_json())["event"]
    assert state["io"]["family"] == "gem80" and state["io"]["model"] == "gem80-130c-12k"
    assert [s["module"] for s in state["io"]["slots"]][:4] == ["8177", "8178", "8110", "8130"]

    # Wire the e-stop (input 16, A4.0) and the conveyor (output 16, B6.0).
    async def record(call):
        pass

    hass.services.async_register("homeassistant", "turn_on", record)
    hass.services.async_register("homeassistant", "turn_off", record)
    hass.states.async_set("binary_sensor.estop", "on")
    for n, (kind, index, entity_id) in enumerate([("inputs", 16, "binary_sensor.estop"),
                                                  ("outputs", 16, "light.conveyor")]):
        await client.send_json({"id": 10 + n, "type": "microgem/wire", "entry_id": entry.entry_id,
                                "kind": kind, "index": index, "entity_id": entity_id})
        while (msg := await client.receive_json())["id"] != 10 + n:
            pass  # state updates from the subscription
        assert msg["success"], msg
    await hass.async_block_till_done()

    # Move the 8 channel input module from slot 3 to slot 5: its inputs move
    # from A4 to A8, so their entities go and new ones come; the wiring of
    # A4.0 goes with its terminal. Then a 32 channel input module in slot 1
    # renumbers the rest, but the output's wire stays on B6.0.
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "modules"
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"model": "gem80-130c-12k", **DEFAULT_SLOTS, "slot_3": "empty", "slot_5": "8110"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert entry.options["modules"] == ["8177", "8178", None, "8130", "8110", None, None, None]
    assert hass.states.get("switch.line_3_input_a4_0") is None
    assert hass.states.get("switch.line_3_input_a8_0").state == "off"
    assert entry.options["wiring"]["inputs"] == {}
    assert entry.options["wiring"]["outputs"]["16"]["entity_id"] == "light.conveyor"

    result = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(
        result["flow_id"], {"model": "gem80-130c-12k", **DEFAULT_SLOTS, "slot_2": "8164"}
    )
    await hass.async_block_till_done()
    assert entry.options["wiring"]["outputs"] == {"32": {"entity_id": "light.conveyor"}}
    assert hass.states.get("binary_sensor.line_3_output_b3_15").state == "off"
    assert entry.runtime_data.wiring.points["outputs"]["32"]["entity_id"] == "light.conveyor"

    # A smaller controller without DIV or COMPARE starts the car wash instead.
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"model": "gem80-100c-2k", **DEFAULT_SLOTS}
    )
    await hass.async_block_till_done()
    assert entry.runtime_data.service.controller.program.source.startswith("; Car wash")
    device = device_registry.async_get_device_by_identifier((DOMAIN, entry.entry_id), entry.entry_id)
    assert device.model == "GEM 80/100C 2K"
    assert hass.states.get("switch.line_3_input_a4_0").state == "off"

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
