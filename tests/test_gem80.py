"""The GEM 80 compact controllers and their Special Functions.

Expected values come from the examples on the GEM 80 Software Data sheets and
the T278 data sheet wherever those give one.
"""

import pytest

from microgem import Controller, ControllerConfig, ProgramError
from microgem.models import MODELS, get_model
from microgem.tables import Address, AddressError, parse_address, to_signed


def gem80(source: str, model: str = "gem80-130c-12k", modules=("8163", "8164")) -> Controller:
    plc = Controller(ControllerConfig(name="GEM 80", model=model, modules=modules))
    plc.load(source)
    plc.run()
    return plc


def word(plc: Controller, text: str) -> int:
    return to_signed(plc.tables.get_word(parse_address(text)))


def put(plc: Controller, text: str, *values: int) -> None:
    start = parse_address(text)
    for i, value in enumerate(values):
        plc.write(Address(start.table, start.word + i), value)


# --- models and I/O ----------------------------------------------------------

def test_table_sizes_follow_the_data_sheet():
    plc = Controller(ControllerConfig(model="gem80-130c-12k"))
    sizes = plc.tables.sizes()
    assert sizes == {"A": 32, "B": 32, "E": 7, "F": 200, "G": 800, "J": 160, "K": 160,
                     "M": 10, "P": 1640, "R": 400}
    assert get_model("gem80-100c-2k").instructions == 456
    assert len(MODELS) == 8


def test_tables_the_controller_lacks_are_rejected():
    with pytest.raises(AddressError, match="no W table"):
        gem80("A0.0 -> W0.0")
    with pytest.raises(AddressError, match="beyond the end"):
        gem80("A0.0 -> G800.0")


def test_100c_has_no_clock_words():
    plc = gem80("E0.1 -> B2.0", model="gem80-100c-2k")
    plc.scan(1000)
    assert plc.tables.size("E") == 1
    with pytest.raises(AddressError):
        gem80("AND E1 -> OUT G0", model="gem80-100c-2k")


def test_program_capacity():
    rungs = "\n".join(f"A0.{i % 16} -> G{i // 16}.{i % 16}" for i in range(300))
    with pytest.raises(ProgramError, match="holds 456"):
        gem80(rungs, model="gem80-100c-2k")
    assert gem80(rungs).instructions == 600


def test_special_functions_depend_on_the_model():
    with pytest.raises(ProgramError, match="no SQRT"):
        gem80("AND G0 SPEC SQRT VALUE 10 -> OUT G1", model="gem80-100c-12k")
    gem80("AND G0 SPEC SQRT VALUE 10 -> OUT G1", model="gem80-130c-6k")


def test_p_table_is_read_only_on_eprom_models():
    with pytest.raises(ProgramError, match="EPROM"):
        gem80("AND 5 -> OUT P100", model="gem80-130ce-12k")
    gem80("AND 5 -> OUT P100", model="gem80-130c-12k")


def test_modules_map_slots_to_words():
    config = ControllerConfig(model="gem80-130c-12k", modules=("8163", "8178", "8110", None, "8130"))
    assert config.total_inputs == 40 and config.total_outputs == 24
    assert config.input_address(17) == Address("A", 1, 1)  # slot 1 owns words 0 and 1
    assert config.input_address(32) == Address("A", 4, 0)  # slot 3: words 4 and 5
    assert config.output_address(0) == Address("B", 2, 0)  # slot 2
    assert config.output_address(16) == Address("B", 8, 0)  # slot 5
    io = config.io()
    assert [s["module"] for s in io["slots"]] == ["8163", "8178", "8110", None, "8130", None, None, None]
    assert io["slots"][4]["first"] == 16 and io["slots"][4]["relay"]

    plc = Controller(config)
    plc.load("A1.1 AND A4.0 -> B8.7")
    plc.run()
    plc.set_input(17, True)
    plc.set_input(32, True)
    plc.scan(20)
    assert plc.output(23)


def test_unknown_module_is_refused():
    with pytest.raises(ValueError):
        ControllerConfig(model="gem80-130c-12k", modules=("9999",))


# --- Special Functions -----------------------------------------------------------

def test_parser_checks_spec_values():
    with pytest.raises(ProgramError, match="needs a VALUE"):
        gem80("AND G0 SPEC LIMIT -> OUT G1")
    with pytest.raises(ProgramError, match="takes no VALUE"):
        gem80("AND G0 SPEC BCDIN VALUE G5 -> OUT G1")
    with pytest.raises(ProgramError, match="table address"):
        gem80("AND G0 SPEC LIMIT VALUE 5 -> OUT G1")
    with pytest.raises(ProgramError, match="square brackets"):
        gem80("AND G0 SPEC MULT -> OUT G1")
    with pytest.raises(ProgramError, match="not emulated"):
        gem80("AND G0 SPEC S99 -> OUT G1")


def test_bcd_histate_and_swap():
    plc = gem80(
        "AND G0 SPEC S1 -> OUT G10\n"
        "AND G1 SPEC BCDOUT -> OUT G11\n"
        "AND G2 SPEC HISTATE -> OUT G12\n"
        "AND G3 SPEC SWAP -> OUT G13\n"
        "AND G4 SPEC BCDIN -> OUT G14"
    )
    put(plc, "G0", 0x1234, 1234, 0b0000_0100_0001_0001, 0x12FF, 0x12A4)
    plc.scan(20)
    assert word(plc, "G10") == 1234
    assert plc.tables.get_word(parse_address("G11")) == 0x1234
    assert word(plc, "G12") == 10
    assert plc.tables.get_word(parse_address("G13")) == 0xFF12
    assert word(plc, "G14") == -1  # @A is not a BCD digit
    put(plc, "G1", -12345)
    put(plc, "G2", 0)
    plc.scan(20)
    assert plc.tables.get_word(parse_address("G11")) == 0x9999
    assert word(plc, "G12") == -1


def test_dbounce_needs_n_steady_scans():
    plc = gem80("A0.4 SPEC DBOUNCE VALUE G60 -> B2.10")
    put(plc, "G61", 3)
    put(plc, "G64", -1)
    plc.set_input(4, True)
    for _ in range(2):
        plc.scan(20)
        assert not plc.output(10)
    plc.scan(20)
    assert plc.output(10)
    plc.set_input(4, False)
    plc.scan(20)
    plc.set_input(4, True)  # a bounce resets the count
    plc.scan(20)
    assert plc.output(10)
    put(plc, "G64", 0)
    plc.scan(20)
    assert not plc.output(10) and word(plc, "G60") == 9


def test_lincon_scales_a_signal():
    # LINCON data sheet: 0 to 90 degrees into 6400 to 32000 (4 to 20 mA).
    plc = gem80("AND G10 SPEC LINCON VALUE R100 -> OUT G32")
    put(plc, "R101", 25600, 90, 6400)
    for angle, expected in ((0, 6400), (45, 19200), (90, 32000)):
        put(plc, "G10", angle)
        plc.scan(20)
        assert word(plc, "G32") == expected
    put(plc, "R102", 0)
    plc.scan(20)
    assert word(plc, "G32") == 0 and word(plc, "R100") == 5


def test_sqrt_table_of_results():
    plc = gem80("AND G10 SPEC SQRT VALUE 100 -> OUT G11\nAND G10 SPEC SQRT VALUE G20 -> OUT G12")
    put(plc, "G20", -100)
    for x, q in ((10000, 10000), (3600, 6000), (64, 800), (-3600, -6000)):
        put(plc, "G10", x)
        plc.scan(20)
        assert word(plc, "G11") == q
        assert word(plc, "G12") == -q


def test_limit_flags():
    # LIMIT data sheet: limits 5 and 15, flags in Zm.
    plc = gem80("AND G10 SPEC LIMIT VALUE G100 -> OUT G11")
    put(plc, "G101", 5, 15)
    cases = ((20, 15, -26112), (15, 15, -28672), (10, 10, 0), (5, 5, 20480), (1, 5, 22016))
    for x, q, flags in cases:
        put(plc, "G10", x)
        plc.scan(20)
        assert (word(plc, "G11"), word(plc, "G100")) == (q, flags)
    put(plc, "G101", 15, 5)
    plc.scan(20)
    assert word(plc, "G100") == -12283


def test_dedband():
    plc = gem80("AND G10 SPEC DEDBAND VALUE G100 -> OUT G11")
    put(plc, "G101", 10, 0)
    for x, q in ((5, 0), (-9, 0), (10, 10), (-30, -30)):
        put(plc, "G10", x)
        plc.scan(20)
        assert word(plc, "G11") == q
    put(plc, "G10", 5)
    plc.scan(20)
    assert word(plc, "G100") == 8192
    put(plc, "G101", 100, -100)  # the second example on the sheet
    put(plc, "G10", 150)
    plc.scan(20)
    assert word(plc, "G11") == 50


def test_fgen_interpolates():
    # FGEN data sheet example: X1 = 30, dX = 20, points 20, 30, 50, 60.
    plc = gem80("AND G10 SPEC FGEN VALUE P150 -> OUT G11")
    put(plc, "P150", 0, 30, 20, 4, 20, 30, 50, 60)
    for x, q in ((0, 20), (30, 20), (40, 25), (50, 30), (60, 40), (90, 60), (200, 60)):
        put(plc, "G10", x)
        plc.scan(20)
        assert word(plc, "G11") == q


def test_analag_step_response():
    # ANALAG data sheet: K = 0.5, step of 32.
    plc = gem80("AND G10 SPEC ANALAG VALUE G100 -> OUT G11")
    put(plc, "G101", 500)
    put(plc, "G104", -1)
    put(plc, "G10", 32)
    outputs = []
    for _ in range(8):
        plc.scan(100)
        outputs.append(word(plc, "G11"))
    assert outputs == [16, 24, 28, 30, 31, 31, 32, 32]
    put(plc, "G101", 250)  # K = 0.25 from zero
    put(plc, "G102", 0, 0)
    outputs = []
    for _ in range(16):
        plc.scan(100)
        outputs.append(word(plc, "G11"))
    # The sheet's list for K = 0.25 agrees for ten scans; after that it drifts
    # from its own exact equation, which the emulator follows. Both reach 32.
    assert outputs[:10] == [8, 14, 18, 22, 24, 26, 28, 29, 29, 30] and outputs[-1] == 32


def test_compare_flags():
    plc = gem80("AND G10 SPEC COMPARE [AND G11] VALUE G59 G59.13 -> B2.8")
    for x, y, flags, lamp in ((5, 3, 25600, True), (3, 3, -27648, False), (2, 3, 22528, False)):
        put(plc, "G10", x, y)
        plc.scan(20)
        assert word(plc, "G59") == flags and plc.output(8) is lamp


def test_mult_and_div():
    plc = gem80(
        "AND G10 SPEC MULT [AND 8] -> OUT G22\n"
        "AND G20 SPEC DIV [AND G21] VALUE R120 -> OUT G30"
    )
    put(plc, "G10", 5000)
    for x, y, q, r in ((17, 3, 5, 2), (17, 18, 0, 17), (-17, 3, -5, -2), (-17, -3, 5, -2), (9, 0, 0, 0)):
        put(plc, "G20", x, y)
        plc.scan(20)
        assert (word(plc, "G30"), word(plc, "R120")) == (q, r)
    assert word(plc, "G22") == 32767


def test_locate_and_move_copy_a_block():
    # MOVE data sheet: copy P150 to P249 into a working table on start-up.
    plc = gem80(
        "AND 0 SPEC LOCATE VALUE G20 SPEC MOVE [AND 0 SPEC LOCATE VALUE G100] VALUE 20 -> OUT F150"
    )
    put(plc, "G20", *range(1, 21))
    plc.scan(20)
    assert [word(plc, f"G{100 + i}") for i in range(20)] == list(range(1, 21))
    assert word(plc, "F150") == 0


def test_locate_gives_byte_addresses_and_move_shifts_history():
    plc = gem80(
        "AND 0 SPEC LOCATE VALUE G100 -> OUT G1\nAND 0 SPEC LOCATE VALUE G101 -> OUT G2\n"
        "AND 0 SPEC LOCATE VALUE G21 SPEC MOVE [AND 0 SPEC LOCATE VALUE G22] VALUE 10 -> OUT F150\n"
        "AND G0 OUT G21"
        .replace("AND G0 OUT G21", "AND G0 -> OUT G21")
    )
    plc.scan(20)
    assert word(plc, "G2") - word(plc, "G1") == 2
    for sample in (1, 2, 3):
        put(plc, "G0", sample)
        plc.scan(20)
    assert [word(plc, f"G{w}") for w in (21, 22, 23, 24)] == [3, 2, 1, 0]


def test_move_faults():
    plc = gem80("AND -1 SPEC MOVE [AND 0] VALUE 5 -> OUT G0\n"
                "AND 0 SPEC LOCATE VALUE R399 SPEC MOVE [AND 0 SPEC LOCATE VALUE G0] VALUE 5 -> OUT G1")
    plc.scan(20)
    assert word(plc, "G0") == 9
    assert word(plc, "G1") == 3  # runs off the end of the R table's block


def test_locate_offset_out_of_range():
    plc = gem80("AND 10000 SPEC LOCATE VALUE G0 -> OUT G1\nAND 0 SPEC LOCATE VALUE G0 -> OUT G2")
    plc.scan(20)
    assert word(plc, "G1") == -1 and word(plc, "G2") > 0


def test_store_fifo_and_delay():
    plc = gem80("AND G20 SPEC STORE [AND G21] VALUE G100 -> OUT G22")
    put(plc, "G103", 3)
    for value in (11, 12, 13):
        put(plc, "G20", 1, value)
        plc.scan(20)
    assert word(plc, "G100") == 1024  # full
    put(plc, "G20", 1, 14)
    plc.scan(20)
    assert word(plc, "G100") == 3072  # full already: the oldest is lost
    reads = []
    for _ in range(3):
        put(plc, "G20", 2)
        plc.scan(20)
        reads.append(word(plc, "G22"))
    assert reads == [12, 13, 14] and word(plc, "G100") == 4096
    plc.scan(20)
    assert word(plc, "G22") == 14 and word(plc, "G100") == 12288

    # A delay of 10 scans: length 11, read displacement 10, WRITE then READ.
    plc = gem80("AND 10 -> OUT G122\nAND 11 -> OUT G123\nAND 3 SPEC STORE [AND G0] VALUE G120 -> OUT G32")
    seen = []
    for n in range(1, 21):
        put(plc, "G0", n)
        plc.scan(20)
        seen.append(word(plc, "G32"))
    assert seen[10:] == list(range(1, 11))


def test_bottling_demo_fills_counts_and_crates():
    from microgem.examples import BOTTLING
    from microgem.models import DEFAULT_MODULES

    plc = Controller(ControllerConfig(model="gem80-130c-12k", modules=DEFAULT_MODULES))
    plc.load(BOTTLING)
    plc.run()
    cfg = plc.config
    inp = {str(cfg.input_address(i)): i for i in range(cfg.total_inputs)}
    out = {str(cfg.output_address(i)): i for i in range(cfg.total_outputs)}

    def set_(addr, v):
        plc.set_input(inp[addr], v)

    def scan(n=1):
        for _ in range(n):
            plc.scan(20)

    set_("A0.1", True)  # stop button healthy (normally closed)
    set_("A4.0", True)  # e-stop healthy
    set_("A0.0", True)
    scan()
    set_("A0.0", False)
    scan()
    assert plc.output(out["B6.0"]) and plc.output(out["B6.2"])
    for bottle in range(12):
        set_("A0.2", True)
        scan(4)  # debounced after 3 steady scans
        assert plc.output(out["B6.1"]) and not plc.output(out["B6.0"])
        set_("A0.3", True)
        scan(2)
        assert not plc.output(out["B6.1"])
        set_("A0.2", False)
        set_("A0.3", False)
        scan(4)
    assert word(plc, "G12") == 1 and word(plc, "G13") == 0
    assert plc.tables.get_word(parse_address("B2")) == 0x0001
    assert plc.output(out["B6.4"])


def test_car_wash_demo_runs_on_the_smallest_gem80():
    from microgem.examples import CAR_WASH
    from microgem.models import DEFAULT_MODULES
    from microgem.service import ControllerService

    # The bottling line needs DIV and COMPARE, which a 100C 2K lacks, so a
    # new one starts with the car wash instead.
    service = ControllerService(ControllerConfig(model="gem80-100c-2k", modules=DEFAULT_MODULES))
    plc = service.controller
    assert plc.program.source == CAR_WASH
    cfg = plc.config
    inp = {str(cfg.input_address(i)): i for i in range(cfg.total_inputs)}
    out = {str(cfg.output_address(i)): i for i in range(cfg.total_outputs)}

    def on(addr):
        return plc.output(out[addr])

    def seconds(s):
        for _ in range(int(s * 10)):
            plc.scan(100)

    plc.set_input(inp["A0.2"], True)  # stop healthy (normally closed)
    plc.set_input(inp["A4.0"], True)  # e-stop healthy
    seconds(0.5)
    assert on("B6.3") and not on("B6.0")  # drive forward
    plc.set_input(inp["A0.1"], True)
    seconds(0.5)
    assert not on("B6.3")
    plc.set_input(inp["A0.0"], True)
    seconds(0.2)
    plc.set_input(inp["A0.0"], False)
    assert on("B6.0") and on("B6.1") and not on("B6.2")
    seconds(20)
    assert on("B6.2") and not on("B6.0")
    seconds(10.2)
    assert not on("B6.2") and on("B6.4")
    assert plc.tables.get_word(parse_address("B2")) == 0x0001
    seconds(6)
    assert not on("B6.4")


def test_programmer_commands_single_cycle_test_inputs_and_clear_store():
    from microgem.models import DEFAULT_MODULES
    from microgem.service import ControllerService

    service = ControllerService(ControllerConfig(model="gem80-130c-12k", modules=DEFAULT_MODULES), "A0.0 -> B2.0\nA0.1 COUNT G5 VALUE 99 -> G0.0")
    plc = service.controller
    ladder = plc.ladder()
    assert ladder[0]["instructions"] == [0, 1] and ladder[1]["instructions"] == [2, 5]
    assert plc.instructions == 6

    # TEST INPUTS: the field no longer reaches the A table, which the
    # programmer can force instead; the watchdog stays open.
    service.command({"type": "test_inputs", "value": True})
    service.set_input(0, True)
    for _ in range(4):
        plc.scan(20)
    assert not plc.output(0) and not plc.watchdog and plc.snapshot()["test_inputs"]
    service.write("A0.0", True)
    plc.scan(20)
    assert plc.output(0)
    service.write("A0.0", False)
    service.command({"type": "test_inputs", "value": False})  # back to the field: A0.0 is on
    plc.scan(20)
    assert plc.output(0) and plc.input(0)

    # SINGLE CYCLE from Halt: one scan, outputs updated, watchdog open.
    service.halt()
    service.set_input(1, True)
    assert service.command({"type": "single"}) is None
    assert not plc.running and plc.output(0) and not plc.watchdog
    assert word(plc, "G5") & 0x7FFF == 1  # bit 15 holds the last input

    reply = service.command({"type": "read", "address": "G4", "count": 3})
    assert reply == {"type": "values", "address": "G4", "values": [0, word(plc, "G5"), 0], "size": 800}
    assert service.command({"type": "read", "address": "C0", "count": 3})["type"] == "error"

    service.command({"type": "clear"})
    assert plc.program.rungs == [] and plc.instructions == 0 and word(plc, "G5") == 0
    assert plc.input(1)  # the inputs are still as wired


def _zm(tables, start, values):
    for i, v in enumerate(values):
        tables.set_word(parse_address(f"W{start + i}"), v)


def test_ramp_follows_the_worked_example():
    from microgem.functions import Context, ramp
    from microgem.tables import DataTables

    t = DataTables({"W": 200}, "W")
    ctx = Context(t, "E")
    zm = parse_address("W100")
    # The data sheet's example: 0 to 32000 in 30 s, back in 10 s, 20 ms scans.
    _zm(t, 100, [0, 1067, 3200, 64, 2, 32000, -32000, -1, -1, 0, 0, 0])
    q = [ramp(ctx, 32000, 0, zm) for _ in range(1700)]
    assert q[0] < 5 and all(b >= a for a, b in zip(q, q[1:]))  # rounded start, never back
    assert 14000 < q[750] < 18000  # about half way after 15 s
    assert q[-1] == 32000
    down = [ramp(ctx, 0, 0, zm) for _ in range(700)]
    assert 15000 < down[250] < 18000 and down[-1] == 0  # three times faster
    # Hold: the ramp rounds off and stays.
    up = [ramp(ctx, 32000, 0, zm) for _ in range(200)]
    t.set_word(parse_address("W108"), 0)
    held = [ramp(ctx, 32000, 0, zm) for _ in range(100)]
    assert held[-1] == held[-2] >= up[-1]
    # Suicide: straight to zero.
    t.set_word(parse_address("W107"), 0)
    assert ramp(ctx, 32000, 0, zm) == 0
    # A bad rate is a fault.
    t.set_word(parse_address("W101"), 20000)
    assert ramp(ctx, 32000, 0, zm) == 0 and word_of(t, "W100") == 5


def word_of(tables, addr):
    from microgem.tables import to_signed
    return to_signed(tables.get_word(parse_address(addr)))


def test_pidabs_pidinc_and_incout():
    from microgem.functions import Context, incout, pidabs, pidinc
    from microgem.tables import DataTables

    t = DataTables({"W": 200}, "W")
    ctx = Context(t, "E")
    zm = parse_address("W100")
    # P = 1.00, I = 0.1 a scan, no D; limits +/-1000, rate limits wide open.
    _zm(t, 100, [0, 100, 10, 0, 1000, -1000, 32767, 32767, -1, 0])
    assert pidabs(ctx, 100, 0, zm) == 110  # P step 100, plus I 10
    assert pidabs(ctx, 100, 0, zm) == 120  # then the integral keeps adding
    for _ in range(200):
        q = pidabs(ctx, 100, 0, zm)
    assert q == 1000 and word_of(t, "W100") == -28672  # at the positive limit
    t.set_word(parse_address("W109"), -1)  # hold
    assert pidabs(ctx, -500, 0, zm) == 1000
    t.set_word(parse_address("W109"), 0)
    t.set_word(parse_address("W106"), 50)  # L1: at most 50 a scan away from zero
    t.set_word(parse_address("W107"), 50)  # L2: and towards it
    t.set_word(parse_address("W108"), 0)  # suicide: to zero at the L2 rate
    assert pidabs(ctx, 0, 0, zm) == 950
    t.set_word(parse_address("W104"), -1)
    assert pidabs(ctx, 0, 0, zm) == 0 and word_of(t, "W100") == 5

    # PIDINC gives the change, not the level: a step gives one pulse of P.
    _zm(t, 120, [0, 100, 0, 0, -32767, 32767, 0, 0, -1])
    z2 = parse_address("W120")
    assert [pidinc(ctx, x, 0, z2) for x in (0, 100, 100)] == [0, 100, 0]

    # INCOUT passes it on within its window, owing what it holds back.
    _zm(t, 140, [0, 10, 40, 0, -1])
    z3 = parse_address("W140")
    assert [incout(ctx, x, 0, z3) for x in (100, 0, 0, 5, 3, 0)] == [40, 40, 20, 0, 0, 0]
    assert word_of(t, "W140") == 8192  # in the dead zone, 8 owed
    assert incout(ctx, 4, 0, z3) == 12


def test_presets_and_mnemonics_in_the_program():
    from microgem.models import DEFAULT_MODULES

    plc = Controller(ControllerConfig(model="gem80-130c-12k", modules=DEFAULT_MODULES))
    source = """\
NAME A0.0 START Start push button
NAME A0.1 STOP Stop push button (normally closed)
NAME B6.0 MOTOR
PRESET P1 = 20
PRESET R10 = 5, -6 @00FF

; Start and stop
(START OR MOTOR) AND STOP -> MOTOR
"""
    plc.load(source)
    plc.run()
    assert plc.program.rungs[0].comment == "Start and stop"
    assert word(plc, "P1") == 20 and [word(plc, f"R{w}") for w in (10, 11, 12)] == [5, -6, 255]
    assert plc.snapshot()["names"]["A0.0"] == ["START", "Start push button"]
    out = {str(plc.config.output_address(i)): i for i in range(plc.config.total_outputs)}
    inp = {str(plc.config.input_address(i)): i for i in range(plc.config.total_inputs)}
    plc.set_input(inp["A0.1"], True)
    plc.set_input(inp["A0.0"], True)
    plc.scan(20)
    plc.set_input(inp["A0.0"], False)
    plc.scan(20)
    assert plc.output(out["B6.0"])

    # Editing the rungs leaves data alone unless its preset changes.
    plc.write(parse_address("R10"), 99)
    plc.load(source + "STOP -> G0.0\n")
    assert word(plc, "R10") == 99
    plc.load(source.replace("R10 = 5", "R10 = 7"))
    assert word(plc, "R10") == 7

    for bad, message in [("NAME A0.0 AND", "cannot be a mnemonic"), ("NAME A0.0 G12", "looks like an address"),
                         ("PRESET P1 20", "needs '='"), ("PRESET E1 = 3", "set by the controller"),
                         ("PRESET C0 = 1", "no C table")]:
        try:
            plc.load(bad)
        except Exception as exc:  # noqa: BLE001
            assert message in str(exc), (bad, exc)
        else:
            raise AssertionError(bad)
