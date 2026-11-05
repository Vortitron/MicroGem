"""The controller: data tables plus a cyclic scan of the user program."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass

from . import functions
from .printer import Printer
from .models import (
    DEFAULT_MODEL,
    ANALOGUE_CHANNELS,
    ANALOGUE_CONVERSION_MS,
    SLOTS,
    analogue_word,
    ControllerModel,
    get_model,
    get_module,
    slot_words,
)
from .program import (
    ARITHMETIC,
    COMPARISONS,
    LOGIC,
    RAIL,
    Arith,
    Branch,
    Coil,
    Compare,
    Constant,
    Contact,
    Count,
    Delay,
    Edge,
    EndBlock,
    Inv,
    Latch,
    Logic,
    ObeyBlock,
    Out,
    Parallel,
    Program,
    ProgramError,
    pack_message,
    unescape,
    Seqr,
    Series,
    Spec,
    addresses,
    instruction_count,
    instruction_ranges,
    parse_program,
    walk,
    rung_to_json,
)
from .tables import Address, AddressError, DataTables, clamp16, to_signed

INPUT_TABLE = "A"
ANALOGUE_LIMIT_V = 12.0  # what the emulator lets a terminal see; the 8108 reads ±10.235 V
OUTPUT_TABLE = "B"
FLAG_TABLE = "E"

# E-table layout from the GEM80-400 Technical Manual (T1614, Table 2.6).
E_TENTH_SECOND = Address("E", 0, 0)  # on for one scan every 0.1 s
E_ONE_SECOND = Address("E", 0, 1)  # on for one scan every 1 s
E_RECOMPILED = Address("E", 0, 6)  # on for one scan after a program change
E_LIMIT = Address("E", 0, 7)  # the last ADD/SUB was limited to +/-32767
E_CLOCK_WORDS = range(1, 7)  # E1..E6: seconds, minutes, hours, day, month, year
E_LAST_SCAN = Address("E", 7)  # duration of the previous scan in ms

# Watchdog, from the GEM80-400 Technical Manual (T1614, 2.2.1, 2.4 and 2.12):
# the contacts close only after a few clean scans in Run, are open in Halt, and
# open (tripping the controller) when the program holds a non-zero code in F1
# for 100 ms. The MicroGEM60's W/DOG OUTPUT is assumed to behave the same way.
F_USER_TRIP = Address("F", 1)
KEYBOARD_WORD = Address("J", 0)  # a character typed on the printer port's keyboard
WATCHDOG_CLEAN_SCANS = 3
USER_TRIP_HOLD_MS = 100


#: A MicroGEM60 takes up to seven expansion units: 8 x (12 + 8) = 160 I/O points.
MAX_EXPANSIONS = 7


@dataclass(frozen=True)
class ControllerConfig:
    """What the virtual device looks like from the outside.

    ``model`` picks the controller (see ``models.py``). For a MicroGEM,
    ``inputs`` and ``outputs`` are per unit; the defaults match the MicroGEM60
    (12 inputs, 8 relay outputs). ``expansions`` is the number of expansion
    units on the expansion port, each with the same I/O as the controller.
    Unit ``n`` (0 is the controller) uses word ``n`` of the A and B tables, so
    terminal 03 on the first expansion unit is ``A1.3``.

    For a GEM 80, ``modules`` lists the Compact I/O module type number in each
    of the eight slots of the subrack (``None`` for an empty slot); see
    ``models.IO_MODULES`` for how a slot maps to A and B table words.
    """

    name: str = "MicroGEM"
    inputs: int = 12
    outputs: int = 8
    expansions: int = 0
    model: str = DEFAULT_MODEL
    modules: tuple[str | None, ...] = ()

    def __post_init__(self) -> None:
        model = get_model(self.model)
        if model.family == "gem80":
            modules = tuple(self.modules) + (None,) * (SLOTS - len(self.modules))
            if len(modules) > SLOTS:
                raise ValueError(f"a GEM 80 subrack has {SLOTS} I/O slots")
            for slot, code in enumerate(modules, start=1):
                if code is None:
                    continue
                module = get_module(code)
                for extra in range(slot + 1, slot + module.width):
                    if extra > SLOTS or modules[extra - 1] is not None:
                        raise ValueError(f"the {code} in slot {slot} is {module.width} slots wide: "
                                         f"slot {extra} must be empty" if extra <= SLOTS else
                                         f"the {code} is {module.width} slots wide and does not fit in slot {slot}")
            object.__setattr__(self, "modules", modules)
            ins, outs, analogue = [], [], []
            for slot, code in enumerate(modules, start=1):
                if code is None:
                    continue
                module = get_module(code)
                words = slot_words(slot)
                if module.kind == "analogue":
                    analogue.append((slot, Address(INPUT_TABLE, words[0])))
                    continue
                table, points = (ins, INPUT_TABLE) if module.kind == "input" else (outs, OUTPUT_TABLE)
                for ch in range(module.channels):
                    table.append(Address(points, words[ch // 16], ch % 16))
            object.__setattr__(self, "_points", (tuple(ins), tuple(outs)))
            object.__setattr__(self, "_analogue", tuple(analogue))
            return
        object.__setattr__(self, "_analogue", ())
        if self.inputs < 1 or self.outputs < 1:
            raise ValueError("a unit needs at least one input and one output")
        if not 0 <= self.expansions <= MAX_EXPANSIONS:
            raise ValueError(f"a MicroGEM takes 0 to {MAX_EXPANSIONS} expansion units")
        object.__setattr__(self, "_points", (
            tuple(_unit_address(INPUT_TABLE, i, self.inputs) for i in range(self.inputs * self.units)),
            tuple(_unit_address(OUTPUT_TABLE, i, self.outputs) for i in range(self.outputs * self.units)),
        ))

    @property
    def controller_model(self) -> ControllerModel:
        return get_model(self.model)

    @property
    def family(self) -> str:
        return self.controller_model.family

    @property
    def units(self) -> int:
        return 1 + self.expansions if self.family == "microgem" else 1

    @property
    def total_inputs(self) -> int:
        return len(self._points[0])

    @property
    def total_outputs(self) -> int:
        return len(self._points[1])

    @property
    def multiplexers(self) -> tuple[tuple[int, Address], ...]:
        """(slot, A word) of each analogue input module."""
        return self._analogue

    @property
    def total_analogue(self) -> int:
        return ANALOGUE_CHANNELS * len(self._analogue)

    def input_address(self, index: int) -> Address:
        return self._points[0][index]

    def output_address(self, index: int) -> Address:
        return self._points[1][index]

    def io(self) -> dict:
        info = {"family": self.family, "model": self.model,
                "units": self.units, "inputs": self.inputs, "outputs": self.outputs}
        if self.family == "gem80":
            slots, first_in, first_out, first_an, covered = [], 0, 0, 0, {}
            for slot, code in enumerate(self.modules, start=1):
                if code is None:
                    slots.append({"slot": slot, "module": None, "covered_by": covered.get(slot)})
                    continue
                module = get_module(code)
                for extra in range(slot + 1, slot + module.width):
                    covered[extra] = slot
                if module.kind == "analogue":
                    slots.append({
                        "slot": slot, "module": code, "kind": "analogue", "title": module.title,
                        "channels": module.channels, "relay": False, "width": module.width,
                        "words": [slot_words(slot)[0]], "first": first_an,
                    })
                    first_an += module.channels
                    continue
                first = first_in if module.kind == "input" else first_out
                slots.append({
                    "slot": slot, "module": code, "kind": module.kind, "title": module.title,
                    "channels": module.channels, "relay": module.relay,
                    "words": list(slot_words(slot)[: -(-module.channels // 16)]),
                    "first": first,  # index of its first point among all inputs or outputs
                })
                if module.kind == "input":
                    first_in += module.channels
                else:
                    first_out += module.channels
            info.update(slots=slots, inputs=self.total_inputs, outputs=self.total_outputs,
                        analogue=self.total_analogue)
        return info


def _unit_address(table: str, index: int, per_unit: int) -> Address:
    """The bit for I/O point ``index``, counting unit by unit."""
    unit, point = divmod(index, per_unit)
    words_per_unit = -(-per_unit // 16)
    return Address(table, unit * words_per_unit + point // 16, point % 16)


class Controller:
    def __init__(
        self,
        config: ControllerConfig | None = None,
        clock: Callable[[], time.struct_time] = time.localtime,
    ) -> None:
        self.config = config or ControllerConfig()
        self._clock = clock
        self._recompiled = False
        cfg = self.config
        self.model = cfg.controller_model
        sizes = dict(self.model.tables)
        if self.model.family == "microgem":
            words_needed = cfg.units * -(-max(cfg.inputs, cfg.outputs) // 16)
            sizes = {letter: max(size, words_needed) for letter, size in sizes.items()}
        self.tables = DataTables(sizes, self.model.letters)
        if self.model.printer:
            # The 130 6K sends complete lines only and has no keyboard input (T418, 6.1).
            later = self.model.memory != "6K"
            self.printer = Printer(part_lines=later, keyboard=later)
            self.printer.configure(self.tables)  # power on
        else:
            self.printer = None
        # Analogue channels (volts on the terminals) and each 8108's
        # multiplexer: the channel on its output and how long it has been there.
        self.analogue = [0.0] * cfg.total_analogue
        self._mux = [[0, 0] for _ in cfg.multiplexers]
        self._special = functions.Context(self.tables, self.model.protected, self.printer)
        self.program = Program()
        self.instructions = 0
        self.running = False
        self.scan_count = 0
        self.elapsed_ms = 0
        self._dt_ms = 0
        # DELAY state the data table cannot hold: whether it is timing, and the
        # part of a 0.1 s step already elapsed. Keyed by element id.
        self._delays: dict[int, list] = {}
        self._flow: dict[int, int] = {}
        self._skipped: set[int] = set()
        self._previous_bits: dict[Address, bool] = {}
        self.watchdog = False  # True while the watchdog contacts are closed
        self.trip_code = 0  # the F1 code of the last user watchdog trip
        # TEST INPUTS (set from a programmer): the field inputs are still read,
        # but no longer copied into the A table, so the program can be tried
        # with forced inputs; the watchdog contacts stay open (T478, 2.3.8).
        self.test_inputs = False
        self._field = [False] * cfg.total_inputs
        self._clean_scans = 0
        self._f1_held_ms = 0

    # --- program and mode ---------------------------------------------------

    def load(self, source: str) -> None:
        """Compile and install a new program. Raises ProgramError on mistakes."""
        program = parse_program(source)
        model = self.model
        for rung in program.rungs:
            for address in addresses(rung):
                self.tables.check(address)
            written = [getattr(rung.output, "address", None)]
            written += [getattr(n, "word", None) for n in walk(rung)]
            for target in written:
                if isinstance(target, Address) and target.table in model.protected:
                    what = "E tables are" if target.table == FLAG_TABLE else "the P table (in EPROM) is"
                    raise ProgramError(f"{what} read-only to the program", rung.line)
            for node in walk(rung):
                if isinstance(node, Spec) and node.number not in model.special:
                    raise ProgramError(
                        f"the {model.label} has no {node.name} ({node.number}) Special Function", rung.line
                    )
        for address in program.presets:
            try:
                self.tables.check(address)
            except AddressError as exc:
                raise ProgramError(f"PRESET {address}: {exc}") from None
            if address.table == FLAG_TABLE:
                raise ProgramError(f"PRESET {address}: the E tables are set by the controller")
            if address.table not in model.retained:
                keep = " or ".join(t for t in model.retained if t in self.tables.letters and t != "A")
                raise ProgramError(f"PRESET {address}: table {address.table} is cleared when the "
                                   f"controller goes to Run, so the preset would be lost; use {keep}")
        for address in program.notes:
            try:
                self.tables.check(address)
            except AddressError as exc:
                raise ProgramError(f"NAME {address}: {exc}") from None
        used = instruction_count(program)
        if used > model.instructions:
            raise ProgramError(
                f"the program needs about {used} instructions; the {model.label} holds {model.instructions}"
            )
        self.instructions = used
        self._recompiled = True
        # Presets go in where they are new or changed, so values changed since
        # (by the program or a programmer) survive an edit of the rungs.
        before = self.program.presets
        for address, value in program.presets.items():
            if before.get(address) != value:
                self.tables.set_word(address, value)
        self.program = program
        self._reset_state()

    def _reset_state(self) -> None:
        self._delays.clear()
        self._flow.clear()
        self._skipped.clear()
        self._snapshot_edges()

    def run(self) -> None:
        if self.running:
            return
        # As on a GEM 80, most tables are cleared on the Halt -> Run transition.
        self.tables.clear("".join(t for t in self.tables.letters if t not in self.model.retained))
        if self.printer is not None:
            self.printer.configure(self.tables)  # as a power off and on would
        self._reset_state()
        self.running = True
        self.trip_code = 0
        self._clean_scans = 0
        self._f1_held_ms = 0

    def power_cycle(self) -> None:
        """Switch off and on: the outputs drop, the printer buffer empties and
        the port reads P2 to P5 again; a running controller runs again."""
        was_running = self.running
        self.halt()
        if self.printer is not None:
            self.printer.clear()
            self.printer.configure(self.tables)
        if was_running:
            self.run()

    def halt(self) -> None:
        self.running = False
        self.watchdog = False
        self.tables.clear(OUTPUT_TABLE)

    def trip(self, code: int) -> None:
        """A watchdog trip: the contacts open and the controller stops."""
        self.halt()
        self.trip_code = code

    def single_cycle(self, dt_ms: int) -> bool:
        """From Halt, obey the program once (inputs, program and outputs), as a
        programmer's SINGLE CYCLE command does. The watchdog stays open."""
        if self.running:
            return False
        self.running = True
        try:
            self.scan(dt_ms)
        finally:
            self.running = False
            self.watchdog = False
            self._clean_scans = 0
        return True

    def set_test_inputs(self, on: bool) -> None:
        """TEST INPUTS (True) or NORMAL INPUTS (False)."""
        self.test_inputs = bool(on)
        if self.test_inputs:
            self.watchdog = False
            self._clean_scans = 0
        else:
            for index, value in enumerate(self._field):
                self.tables.set_bit(self.config.input_address(index), value)

    def clear_store(self) -> None:
        """CLEAR STORE: halt, then wipe the program and the data tables."""
        self.halt()
        self.load("")
        self.tables.clear("".join(t for t in self.tables.letters if t != FLAG_TABLE))
        if self.printer is not None:
            self.printer.clear()
        if not self.test_inputs:
            self.set_test_inputs(False)  # the inputs as wired

    # --- physical I/O ---------------------------------------------------------

    def set_input(self, index: int, value: bool) -> None:
        if not 0 <= index < self.config.total_inputs:
            raise IndexError(f"input {index} does not exist")
        self._field[index] = bool(value)
        if not self.test_inputs:
            self.tables.set_bit(self.config.input_address(index), value)

    def input(self, index: int) -> bool:
        return self.tables.get_bit(self.config.input_address(index))

    def output(self, index: int) -> bool:
        return self.tables.get_bit(self.config.output_address(index))

    def inputs(self) -> list[bool]:
        return [self.input(i) for i in range(self.config.total_inputs)]

    def outputs(self) -> list[bool]:
        return [self.output(i) for i in range(self.config.total_outputs)]

    # --- scanning -------------------------------------------------------------

    def scan(self, dt_ms: int) -> None:
        """Run the whole program once, as if ``dt_ms`` passed since the last scan."""
        if self.printer is not None:
            # The port empties its buffer whether or not the program runs.
            self.printer.tick(dt_ms)
            self.printer.flags(self.tables)
        if not self.running:
            return
        self._read_multiplexers(dt_ms)
        if self.printer is not None:
            code = self.printer.received()
            if code is not None and self.tables.size(KEYBOARD_WORD.table) > KEYBOARD_WORD.word:
                self.tables.set_word(KEYBOARD_WORD, code)  # each character over the last (T418, 6.3)
        self._dt_ms = dt_ms
        self._update_flags(dt_ms)
        self._skipped.clear()
        rungs = self.program.rungs
        r = 0
        while r < len(rungs):
            rung = rungs[r]
            if isinstance(rung.output, EndBlock):
                r += 1
                continue
            word = RAIL if rung.condition is None else self._evaluate(rung.condition, RAIL)
            if isinstance(rung.output, ObeyBlock) and word == 0:
                # Skip the block: everything in it keeps its state.
                self._skipped.update(range(r + 1, rung.end))
                r = rung.end + 1
                continue
            self._output(rung.output, word)
            r += 1
        self._snapshot_edges()
        self.scan_count += 1
        self.elapsed_ms += dt_ms
        self._check_watchdog(dt_ms)

    def _read_multiplexers(self, dt_ms: int) -> None:
        """Each 8108 moves on to its next channel once the last one has been
        read and the converter has settled, then shows it on its A word."""
        for k, (_slot, address) in enumerate(self.config.multiplexers):
            mux = self._mux[k]
            mux[1] += dt_ms
            if mux[1] >= ANALOGUE_CONVERSION_MS:
                mux[0] = (mux[0] + 1) % ANALOGUE_CHANNELS
                mux[1] = 0
            if not self.test_inputs:
                volts = self.analogue[k * ANALOGUE_CHANNELS + mux[0]]
                self.tables.set_word(address, analogue_word(volts, mux[0]))

    def set_analogue(self, index: int, volts: float) -> None:
        """The voltage on analogue channel ``index`` (all the 8108s' channels in slot order)."""
        if not 0 <= index < len(self.analogue):
            raise IndexError(f"analogue channel {index} does not exist")
        self.analogue[index] = max(-ANALOGUE_LIMIT_V, min(ANALOGUE_LIMIT_V, float(volts)))

    def _check_watchdog(self, dt_ms: int) -> None:
        code = to_signed(self.tables.get_word(F_USER_TRIP))
        self._f1_held_ms = self._f1_held_ms + dt_ms if code else 0
        if code and self._f1_held_ms >= USER_TRIP_HOLD_MS:
            self.trip(code)
            return
        self._clean_scans += 1
        self.watchdog = self._clean_scans >= WATCHDOG_CLEAN_SCANS and not self.test_inputs

    def _update_flags(self, dt_ms: int) -> None:
        tables = self.tables
        before, after = self.elapsed_ms, self.elapsed_ms + dt_ms
        tables.set_bit(E_TENTH_SECOND, after // 100 != before // 100)
        tables.set_bit(E_ONE_SECOND, after // 1000 != before // 1000)
        tables.set_bit(E_RECOMPILED, self._recompiled)
        self._recompiled = False
        e_words = tables.size(FLAG_TABLE)
        if e_words > 1:  # the 100C has E0 only: no clock
            now = self._clock()
            clock = (now.tm_sec, now.tm_min, now.tm_hour, now.tm_mday, now.tm_mon, now.tm_year)
            for word, value in zip(E_CLOCK_WORDS, clock):
                if word < e_words:
                    tables.set_word(Address(FLAG_TABLE, word), value)
        if E_LAST_SCAN.word < e_words:
            tables.set_word(E_LAST_SCAN, min(dt_ms, 0xFFFF))

    def _snapshot_edges(self) -> None:
        self._previous_bits = {
            address: self.tables.get_bit(address) for address in self.program.edge_addresses()
        }

    def _word(self, operand: Address | int | Branch) -> int:
        if isinstance(operand, int):
            return operand
        if isinstance(operand, Branch):
            return self._evaluate(operand.node, RAIL)
        if operand.is_bit:
            return RAIL if self.tables.get_bit(operand) else 0
        return to_signed(self.tables.get_word(operand))

    def _evaluate(self, node: object, word: int) -> int:
        """Pass a 16-bit word (as a signed int) through an element."""
        out = self._element(node, word)
        self._flow[node.nid] = out
        return out

    def _element(self, node: object, word: int) -> int:
        tables = self.tables
        if isinstance(node, Contact):
            return word if tables.get_bit(node.address) != node.normally_closed else 0
        if isinstance(node, Series):
            for item in node.items:
                word = self._evaluate(item, word)
            return word
        if isinstance(node, Parallel):
            result = 0
            for item in node.items:
                result |= self._evaluate(item, word) & 0xFFFF  # wired OR
            return to_signed(result)
        if isinstance(node, Logic):
            return to_signed(LOGIC[node.op](word & 0xFFFF, self._word(node.operand) & 0xFFFF))
        if isinstance(node, Inv):
            return to_signed(~word & 0xFFFF)
        if isinstance(node, Arith):
            result = ARITHMETIC[node.op](word, self._word(node.operand))
            limited = max(-32767, min(32767, result))
            if node.op in ("ADD", "SUB"):
                tables.set_bit(E_LIMIT, limited != result)
            return limited
        if isinstance(node, Delay):
            return self._delay(node, word)
        if isinstance(node, Count):
            return self._count(node, word)
        if isinstance(node, Edge):
            now = tables.get_bit(node.address)
            before = self._previous_bits.get(node.address, now)
            fired = (now and not before) if node.rising else (before and not now)
            return word if fired else 0
        if isinstance(node, Compare):
            ok = COMPARISONS[node.op](self._word(node.left), self._word(node.right))
            return word if ok else 0
        if isinstance(node, Constant):
            return word if node.value else 0
        if isinstance(node, Spec):
            second = self._evaluate(node.second.node, RAIL) if node.second is not None else 0
            return functions.run(self._special, node.number, word, second, node.value)
        raise TypeError(f"unknown element {node!r}")

    def _delay(self, node: Delay, word: int) -> int:
        """On-delay. The table word counts down the 0.1 s steps still to go."""
        state = self._delays.setdefault(node.nid, [False, 0])  # timing, ms into this step
        if word == 0:
            state[:] = [False, 0]
            self.tables.set_word(node.word, 0)
            return 0
        left = to_signed(self.tables.get_word(node.word))
        if not state[0]:
            # The VALUE is read when timing starts; later changes wait for the next start.
            left = max(0, self._word(node.value))
            state[:] = [True, 0]
        elif left > 0:
            state[1] += self._dt_ms
            steps, state[1] = divmod(state[1], 100)
            left = max(0, left - steps)
        self.tables.set_word(node.word, left)
        return RAIL if left == 0 else 0

    def _count(self, node: Count, word: int) -> int:
        """Count OFF-to-ON changes of the rung. Bits 0-14 count, bit 15 is the last input."""
        raw = self.tables.get_word(node.word)
        count, was_on = raw & 0x7FFF, bool(raw & 0x8000)
        on = word != 0
        target = max(0, self._word(node.value))
        reset = node.reset is not None and self._evaluate(node.reset, RAIL) != 0
        if reset:
            count = 0
        elif on and not was_on and count < target:
            count += 1
        self.tables.set_word(node.word, count | (0x8000 if on else 0))
        return RAIL if count >= target else 0

    def _output(self, output: object, word: int) -> None:
        tables = self.tables
        if isinstance(output, Coil):
            tables.set_bit(output.address, word != 0)
        elif isinstance(output, Out):
            tables.set_word(output.address, word & 0xFFFF)
        elif isinstance(output, Seqr):
            reset = output.reset is not None and self._evaluate(output.reset, RAIL) != 0
            value = tables.get_word(output.address)
            if reset or value == 0:
                value = 1
            elif word != 0:
                value = ((value << 1) | (value >> 15)) & 0xFFFF
            tables.set_word(output.address, value)
        elif isinstance(output, Latch):
            if word != 0:
                tables.set_bit(output.address, output.set)
        elif isinstance(output, ObeyBlock):
            pass
        else:
            raise TypeError(f"unknown output {output!r}")

    # --- for front ends -------------------------------------------------------

    def write(self, address: Address, value: int | bool) -> None:
        """Force a value into a data table, as a programmer's VALUE key does."""
        if address.table == FLAG_TABLE:
            raise ProgramError("E tables are read-only")
        self.tables.check(address)
        if address.is_bit:
            self.tables.set_bit(address, bool(value))
        else:
            self.tables.set_word(address, clamp16(int(value)))

    def ladder(self) -> list[dict]:
        rungs = [rung_to_json(rung) for rung in self.program.rungs]
        for rung, span in zip(rungs, instruction_ranges(self.program)):
            rung["instructions"] = list(span)
        return rungs

    def live(self) -> dict[str, int | bool]:
        """Current value of every address the program uses, for live ladder diagrams."""
        values: dict[str, int | bool] = {}
        for rung in self.program.rungs:
            for address in addresses(rung):
                key = str(address)
                if key not in values:
                    values[key] = (
                        self.tables.get_bit(address)
                        if address.is_bit
                        else to_signed(self.tables.get_word(address))
                    )
        return values

    def flow(self) -> dict[str, int]:
        """The word each element passed on in the last scan, by element id."""
        return {str(nid): word for nid, word in self._flow.items()}

    def _message_words(self) -> set[Address]:
        """The preset words that MESSAGE lines fill."""
        return {
            Address(start.table, start.word + k)
            for start, text in self.program.messages.items()
            for k in range(len(pack_message(unescape(text))))
        }

    def _printer_snapshot(self) -> dict | None:
        if self.printer is None:
            return None
        return {**self.printer.snapshot(), "changed": self.printer.changed(self.tables)}

    def type_keys(self, text: str) -> int:
        """Characters typed on the printer port's serial keyboard."""
        if self.printer is None:
            raise ValueError(f"the {self.model.label} has no printer port")
        if not self.printer.keyboard:
            raise ValueError(f"the {self.model.label}'s printer port takes no keyboard (12K only)")
        return self.printer.type(text)

    def snapshot(self, tables: str = "BEGHLRW") -> dict:
        return {
            "name": self.config.name,
            "model": self.model.info(),
            "instructions": self.instructions,
            "running": self.running,
            "test_inputs": self.test_inputs,
            "watchdog": self.watchdog,
            "trip_code": self.trip_code,
            "scan_count": self.scan_count,
            "io": self.config.io(),
            "points": {
                "inputs": [str(self.config.input_address(i)) for i in range(self.config.total_inputs)],
                "outputs": [str(self.config.output_address(i)) for i in range(self.config.total_outputs)],
            },
            "inputs": self.inputs(),
            "outputs": self.outputs(),
            "tables": {letter: self.tables.table(letter)[:8] for letter in tables if self.tables.has(letter)},
            "live": self.live(),
            "flow": self.flow(),
            "names": {str(a): list(n) for a, n in self.program.notes.items()},
            "presets": [[str(a), v] for a, v in sorted(
                self.program.presets.items(), key=lambda kv: (kv[0].table, kv[0].word))
                if a not in self._message_words()],
            "messages": {str(a): t for a, t in self.program.messages.items()},
            "skipped": sorted(self._skipped),
            "printer": self._printer_snapshot(),
            "analogue": [round(v, 3) for v in self.analogue],
            "mux": [k * ANALOGUE_CHANNELS + m[0] for k, m in enumerate(self._mux)],
        }

