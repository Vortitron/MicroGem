import pytest

from microgem import AddressError, Controller, ProgramError, parse_address, parse_program
from microgem.tables import Address


def make(source: str) -> Controller:
    plc = Controller()
    plc.load(source)
    plc.run()
    return plc


def test_parse_address():
    assert parse_address("a0.3") == Address("A", 0, 3)
    assert parse_address("G12") == Address("G", 12, None)
    with pytest.raises(AddressError):
        parse_address("A0.16")
    with pytest.raises(AddressError):
        parse_address("M0.0")  # there is no M table


def test_series_parallel_and_normally_closed():
    plc = make("(A0.0 OR A0.1) AND NOT A0.2 -> B0.0")
    plc.scan(20)
    assert not plc.output(0)
    plc.set_input(1, True)
    plc.scan(20)
    assert plc.output(0)
    plc.set_input(2, True)
    plc.scan(20)
    assert not plc.output(0)


def test_no_spaces_around_arrow():
    plc = make("A0.0->B0.0")
    plc.set_input(0, True)
    plc.scan(20)
    assert plc.output(0)


def test_set_and_reset_latch():
    plc = make("A0.0 -> SET B0.0\nA0.1 -> RESET B0.0")
    plc.set_input(0, True)
    plc.scan(20)
    plc.set_input(0, False)
    plc.scan(20)
    assert plc.output(0)
    plc.set_input(1, True)
    plc.scan(20)
    assert not plc.output(0)


def test_delay_times_out_and_resets():
    plc = make("A0.0 -> DELAY 1s B0.0")
    plc.set_input(0, True)
    for _ in range(49):
        plc.scan(20)
    assert not plc.output(0)
    plc.scan(20)
    assert plc.output(0)
    plc.set_input(0, False)
    plc.scan(20)
    assert not plc.output(0)
    assert plc.timer_ms(0) == 0


def test_count_counts_rising_edges_and_clears():
    plc = make("A0.0 -> COUNT 3 G0 B0.0\nA0.1 -> CLEAR G0")
    for _ in range(3):
        plc.set_input(0, True)
        plc.scan(20)
        plc.scan(20)  # holding the input does not count again
        plc.set_input(0, False)
        plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 3
    assert plc.output(0)
    plc.set_input(1, True)
    plc.scan(20)
    plc.scan(20)
    assert not plc.output(0)


def test_push_button_toggles_bedroom_light():
    plc = make("(RISE A0.0 AND NOT B0.0) OR (NOT RISE A0.0 AND B0.0) -> B0.0")

    def press():
        plc.set_input(0, True)
        plc.scan(20)
        plc.scan(20)
        plc.set_input(0, False)
        plc.scan(20)

    press()
    assert plc.output(0)
    press()
    assert not plc.output(0)


def test_compare_and_arithmetic_saturate():
    plc = make("TRUE -> OUT 32000 G0\nTRUE -> ADD G0 1000 G1\nG1 GE 32767 -> B0.0")
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 1)) == 32767
    assert plc.output(0)


def test_halt_turns_outputs_off_and_run_clears_workspace_but_not_retained():
    plc = make("TRUE -> B0.0, OUT 5 G0, OUT 7 R0")
    plc.scan(20)
    plc.halt()
    assert not plc.output(0)
    assert not any(plc.outputs())
    plc.run()
    assert plc.tables.get_word(Address("G", 0)) == 0
    assert plc.tables.get_word(Address("R", 0)) == 7


def test_halted_controller_does_not_scan():
    plc = Controller()
    plc.load("TRUE -> B0.0")
    plc.scan(20)
    assert not plc.output(0)


@pytest.mark.parametrize(
    "source, message",
    [
        ("A0.0 B0.0", "needs '->'"),
        ("A0 -> B0.0", "expected a comparison"),
        ("A0.0 -> B0", "is a word"),
        ("A0.0 -> DELAY 10ms B0.0", "between 100ms and 54m"),
        ("A0.0 -> COUNT 0 G0 B0.0", "COUNT preset"),
        ("A0.0 -> B0.0 B0.1", "unexpected"),
    ],
)
def test_helpful_errors(source, message):
    with pytest.raises(ProgramError, match=message) as info:
        parse_program("; header\n" + source)
    assert info.value.line == 2


def test_out_of_range_address_rejected_on_load():
    plc = Controller()
    with pytest.raises(AddressError):
        plc.load("A0.0 -> G999.0")


def test_e_table_timing_markers_clock_and_scan_time():
    import time as _time

    fixed = _time.struct_time((1987, 6, 5, 21, 30, 15, 4, 156, 1))
    plc = Controller(clock=lambda: fixed)
    plc.load("E0.1 -> COUNT 100 G0 G1.0\nE0.6 -> SET G2.0")
    plc.run()
    for _ in range(150):  # 3 seconds of 20 ms scans
        plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 3
    assert plc.tables.get_bit(Address("G", 2, 0))  # recompile flag seen once
    assert not plc.tables.get_bit(Address("E", 0, 6))
    assert [plc.tables.get_word(Address("E", w)) for w in range(1, 7)] == [15, 30, 21, 5, 6, 1987]
    assert plc.tables.get_word(Address("E", 7)) == 20


def test_limit_flag_and_hex_numbers():
    plc = make("TRUE -> OUT @7FFF G0\nTRUE -> ADD G0 1 G1\nE0.7 -> B0.0\nG0 EQ 32767 -> B0.1")
    plc.scan(20)
    assert plc.output(0) and plc.output(1)


def test_e_table_is_read_only():
    plc = Controller()
    with pytest.raises(ProgramError, match="read-only"):
        plc.load("A0.0 -> E0.0")


def test_ladder_json_live_values_and_titles():
    plc = make("; Door light\n(A0.0 OR NOT B0.0) AND G1 GE 2 -> B0.0, DELAY 1s G0.1\n\nA0.1 -> B0.1 ; lamp")
    rungs = plc.ladder()
    assert rungs[0]["comment"] == "Door light"
    assert rungs[1]["comment"] == "lamp"
    cond = rungs[0]["condition"]
    assert cond["t"] == "series" and cond["items"][0]["t"] == "parallel"
    assert cond["items"][0]["items"][1] == {"t": "contact", "addr": "B0.0", "nc": True}
    assert cond["items"][1] == {"t": "cmp", "op": "GE", "left": "G1", "right": "2"}
    assert rungs[0]["actions"][1] == {"t": "delay", "preset_ms": 1000, "done": "G0.1"}
    plc.write(parse_address("G1"), 3)
    plc.set_input(0, True)
    plc.scan(20)
    live = plc.live()
    assert live["G1"] == 3 and live["B0.0"] is True and live["A0.1"] is False
    assert plc.timers()["0.1"] == 20


def test_write_forces_values_but_not_flags():
    plc = make("A0.0 -> B0.0")
    plc.write(parse_address("A0.0"), 1)
    plc.scan(20)
    assert plc.output(0)
    plc.write(parse_address("G5"), 40000)
    assert plc.tables.get_word(Address("G", 5)) == 32767
    with pytest.raises(ProgramError):
        plc.write(parse_address("E0.0"), 1)
