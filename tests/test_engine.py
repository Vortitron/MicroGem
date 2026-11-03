import pytest

from microgem import AddressError, Controller, ControllerConfig, ProgramError, parse_address, parse_program
from microgem.service import EXAMPLE_PROGRAM
from microgem.tables import Address, to_signed


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


def test_rung_carries_a_word_from_the_left_rail():
    # The left rail is -1; AND plants a number, contacts pass it or give 0.
    plc = make("AND 25 ADD 17 -> OUT G0\nA0.0 AND @00FF -> OUT G1\nNOT A0.0 -> OUT G2")
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 42
    assert plc.tables.get_word(Address("G", 1)) == 0
    assert to_signed(plc.tables.get_word(Address("G", 2))) == -1
    plc.set_input(0, True)
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 1)) == 0x00FF
    assert plc.tables.get_word(Address("G", 2)) == 0


def test_logic_elements_work_on_all_16_bits():
    plc = make("AND @0F0F OR @00F0 -> OUT G0\nAND @0F0F XOR @FFFF -> OUT G1\nAND @1234 INV -> OUT G2")
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 0x0FFF
    assert plc.tables.get_word(Address("G", 1)) == 0xF0F0
    assert plc.tables.get_word(Address("G", 2)) == 0xEDCB


def test_second_branch_input_and_special_functions():
    plc = make("AND G1 ADD [AND G2] -> OUT G3\nAND G1 MULT 3 -> OUT G4\nAND G1 DIV 4 -> OUT G5")
    plc.write(parse_address("G1"), 10)
    plc.write(parse_address("G2"), 7)
    plc.scan(20)
    assert [plc.tables.get_word(Address("G", w)) for w in (3, 4, 5)] == [17, 30, 2]


def test_add_limits_to_32767_and_sets_e0_7_until_next_add():
    plc = make("AND @7FFF ADD 1 -> OUT G0\nE0.7 -> B0.0\nAND 1 ADD 1 -> OUT G1\nE0.7 -> B0.1")
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 32767
    assert plc.output(0) and not plc.output(1)
    plc = make("AND -32768 ADD 0 -> OUT G0")
    plc.scan(20)
    assert to_signed(plc.tables.get_word(Address("G", 0))) == -32767


def test_seal_in_latch():
    plc = make("(A0.0 OR B0.0) AND NOT A0.1 -> B0.0")
    plc.set_input(0, True)
    plc.scan(20)
    plc.set_input(0, False)
    plc.scan(20)
    assert plc.output(0)
    plc.set_input(1, True)
    plc.scan(20)
    assert not plc.output(0)


def test_set_and_reset_extension():
    plc = make("A0.0 -> SET B0.0\nA0.1 -> RESET B0.0")
    plc.set_input(0, True)
    plc.scan(20)
    plc.set_input(0, False)
    plc.scan(20)
    assert plc.output(0)
    plc.set_input(1, True)
    plc.scan(20)
    assert not plc.output(0)


def test_delay_counts_down_in_tenths_and_resets():
    plc = make("A0.0 DELAY G0 VALUE 10 -> B0.0")
    plc.set_input(0, True)
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 10  # 1.0 s loaded when timing starts
    for _ in range(25):
        plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 5  # 0.5 s to go
    for _ in range(24):
        plc.scan(20)
    assert not plc.output(0)
    plc.scan(20)
    assert plc.output(0)
    plc.set_input(0, False)
    plc.scan(20)
    assert not plc.output(0)
    assert plc.tables.get_word(Address("G", 0)) == 0


def test_delay_value_from_a_table_is_read_when_timing_starts():
    plc = make("A0.0 DELAY G0 VALUE W1 -> B0.0")
    plc.write(parse_address("W1"), 3)
    plc.set_input(0, True)
    plc.scan(20)
    plc.write(parse_address("W1"), 100)
    for _ in range(15):
        plc.scan(20)
    assert plc.output(0)


def test_count_detects_its_own_edges_and_holds_at_value():
    plc = make("A0.0 COUNT G0 VALUE 3 RESET A0.1 -> B0.0")
    for _ in range(5):
        plc.set_input(0, True)
        plc.scan(20)
        plc.scan(20)  # holding the input does not count again
        plc.set_input(0, False)
        plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 3  # bit 15 clear: input is off
    assert plc.output(0)
    plc.set_input(0, True)
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 0x8003  # bit 15 holds the last input
    plc.set_input(1, True)
    plc.scan(20)
    assert not plc.output(0)
    assert plc.tables.get_word(Address("G", 0)) & 0x7FFF == 0


def test_seqr_walks_one_bit_left_and_wraps():
    plc = make("A0.0 -> SEQR G0 RESET A0.1")
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 1  # first execution sets bit 0
    plc.set_input(0, True)
    for _ in range(15):
        plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 0x8000
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 1
    plc.scan(20)
    plc.set_input(1, True)
    plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) == 1  # RESET overrides the input


def test_obey_block_skips_and_freezes():
    plc = make("A0.0 -> BLOCK\nA0.1 -> B0.0\nA0.1 DELAY G0 VALUE 10 -> B0.1\nEND BLOCK\nA0.1 -> B0.2")
    plc.set_input(0, True)
    plc.set_input(1, True)
    for _ in range(10):
        plc.scan(20)
    assert plc.output(0) and plc.output(2)
    plc.set_input(0, False)
    plc.set_input(1, False)
    for _ in range(100):
        plc.scan(20)
    assert plc.output(0)  # frozen while the block is not obeyed
    assert not plc.output(2)
    assert plc.tables.get_word(Address("G", 0)) == 9  # DELAY count-down frozen
    assert plc.snapshot()["skipped"] == [1, 2]


def test_blocks_must_match():
    with pytest.raises(ProgramError, match="without a matching END"):
        parse_program("A0.0 -> BLOCK")
    with pytest.raises(ProgramError, match="without an OBEY BLOCK"):
        parse_program("END BLOCK")


def test_push_button_toggles_bedroom_light():
    plc = make(EXAMPLE_PROGRAM)

    def press():
        plc.set_input(0, True)
        plc.scan(20)
        plc.scan(20)
        plc.set_input(0, False)
        plc.scan(20)

    press()
    assert plc.output(0) and plc.output(2)
    press()
    assert not plc.output(0)
    assert plc.output(2)  # landing light stays on for 10 s
    for _ in range(500):
        plc.scan(20)
    assert not plc.output(2)
    assert plc.tables.get_word(Address("G", 11)) == 2


def test_rise_and_compare_extensions():
    plc = make("RISE A0.0 -> B0.0\nG1 GE 5 -> B0.1")
    plc.set_input(0, True)
    plc.scan(20)
    assert plc.output(0)
    plc.scan(20)
    assert not plc.output(0)
    plc.write(parse_address("G1"), 5)
    plc.scan(20)
    assert plc.output(1)


def test_halt_turns_outputs_off_and_run_clears_workspace_but_not_retained():
    plc = make("-> B0.0\nAND 5 -> OUT G0\nAND 7 -> OUT R0")
    plc.scan(20)
    assert plc.output(0)
    plc.halt()
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
        ("A0 -> B0.0", "not an element"),
        ("A0.0 -> B0", "is a word"),
        ("A0.0 DELAY G0 VALUE -1 -> B0.0", "VALUE must be"),
        ("A0.0 COUNT G0 3 -> B0.0", "expected 'VALUE'"),
        ("A0.0 -> B0.0, B0.1", "one output element"),
        ("-> BLOCK", "needs a condition"),
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
    plc.load("E0.1 COUNT G0 VALUE 100 -> G1.0\nE0.6 -> SET G2.0")
    plc.run()
    for _ in range(150):  # 3 seconds of 20 ms scans
        plc.scan(20)
    assert plc.tables.get_word(Address("G", 0)) & 0x7FFF == 3
    assert plc.tables.get_bit(Address("G", 2, 0))  # recompile flag seen once
    assert not plc.tables.get_bit(Address("E", 0, 6))
    assert [plc.tables.get_word(Address("E", w)) for w in range(1, 7)] == [15, 30, 21, 5, 6, 1987]
    assert plc.tables.get_word(Address("E", 7)) == 20


def test_e_table_is_read_only():
    plc = Controller()
    with pytest.raises(ProgramError, match="read-only"):
        plc.load("A0.0 -> E0.0")


def test_ladder_json_flow_and_titles():
    plc = make("; Door light\n(A0.0 OR NOT B0.0) AND G1 GE 2 DELAY G0 VALUE 10 -> B0.0\n\nA0.1 -> B0.1 ; lamp")
    rungs = plc.ladder()
    assert rungs[0]["comment"] == "Door light"
    assert rungs[1]["comment"] == "lamp"
    cond = rungs[0]["condition"]
    assert cond["t"] == "series" and cond["items"][0]["t"] == "parallel"
    nc = cond["items"][0]["items"][1]
    assert (nc["t"], nc["addr"], nc["nc"]) == ("contact", "B0.0", True)
    assert {k: cond["items"][1][k] for k in ("t", "op", "left", "right")} == {"t": "cmp", "op": "GE", "left": "G1", "right": "2"}
    delay = cond["items"][2]
    assert (delay["t"], delay["word"], delay["value"]) == ("delay", "G0", "10")
    assert rungs[0]["output"] == {"t": "coil", "addr": "B0.0"}
    plc.write(parse_address("G1"), 3)
    plc.set_input(0, True)
    plc.scan(20)
    flow = plc.flow()
    assert flow[str(cond["items"][0]["id"])] == -1  # live path
    assert flow[str(delay["id"])] == 0  # still timing
    assert plc.live()["G0"] == 10


def test_write_forces_values_but_not_flags():
    plc = make("A0.0 -> B0.0")
    plc.write(parse_address("A0.0"), 1)
    plc.scan(20)
    assert plc.output(0)
    plc.write(parse_address("G5"), 40000)
    assert plc.tables.get_word(Address("G", 5)) == 32767
    with pytest.raises(ProgramError):
        plc.write(parse_address("E0.0"), 1)


def test_expansion_units_use_one_word_each():
    # MicroGEM60 with two expansion units: each unit has 12 inputs and 8 outputs
    # in its own word, so terminal 03 on the first expansion unit is A1.3.
    config = ControllerConfig(expansions=2)
    assert (config.total_inputs, config.total_outputs) == (36, 24)
    assert config.input_address(11) == Address("A", 0, 11)
    assert config.input_address(12 + 3) == Address("A", 1, 3)
    assert config.output_address(8 + 7) == Address("B", 1, 7)
    assert config.output_address(16) == Address("B", 2, 0)

    plc = Controller(config)
    plc.load("A1.3 AND A2.11 -> B2.7")
    plc.run()
    plc.set_input(12 + 3, True)
    plc.set_input(24 + 11, True)
    plc.scan(20)
    assert plc.outputs() == [False] * 23 + [True]
    assert plc.snapshot()["io"] == {"units": 3, "inputs": 12, "outputs": 8}
    with pytest.raises(IndexError):
        plc.set_input(36, True)


def test_expansion_limits():
    assert ControllerConfig(expansions=7).total_inputs + ControllerConfig(expansions=7).total_outputs == 160
    with pytest.raises(ValueError):
        ControllerConfig(expansions=8)
    # Without expansions, wider units keep the old contiguous numbering.
    assert ControllerConfig(inputs=32).input_address(20) == Address("A", 1, 4)


def test_watchdog_closes_after_clean_scans_and_opens_in_halt():
    plc = make("A0.0 -> B0.0")
    assert not plc.watchdog
    for _ in range(2):
        plc.scan(20)
    assert not plc.watchdog  # still doing its first checks
    plc.scan(20)
    assert plc.watchdog
    plc.halt()
    assert not plc.watchdog
    plc.run()
    plc.scan(20)
    assert not plc.watchdog


def test_user_program_trips_the_watchdog_through_f1():
    # T1614 2.12: hold a non-zero code in F1 (inside an obey block) to trip.
    plc = make("A0.5 -> BLOCK\nAND 123 -> OUT F1\nEND BLOCK\nTRUE -> B0.0")
    for _ in range(4):
        plc.scan(20)
    assert plc.watchdog and plc.output(0)
    plc.set_input(5, True)
    for _ in range(4):
        plc.scan(20)
    assert plc.running and plc.watchdog  # held for 80 ms only
    plc.scan(20)
    assert not plc.running and not plc.watchdog and not plc.output(0)
    assert plc.trip_code == 123
    plc.set_input(5, False)
    plc.run()  # Halt -> Run clears F and the trip
    assert plc.trip_code == 0
    for _ in range(3):
        plc.scan(20)
    assert plc.watchdog
