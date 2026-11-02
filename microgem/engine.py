"""The controller: data tables plus a cyclic scan of the user program."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass

from .program import (
    ARITHMETIC,
    COMPARISONS,
    COUNT_MAX,
    Arith,
    Clear,
    Coil,
    Compare,
    Constant,
    Contact,
    Count,
    Delay,
    Edge,
    Latch,
    Not,
    Out,
    Parallel,
    Program,
    Series,
    parse_program,
    rung_to_json,
)
from .program import ProgramError
from .tables import RETAINED_TABLES, TABLE_LETTERS, Address, DataTables, clamp16, to_signed

INPUT_TABLE = "A"
OUTPUT_TABLE = "B"
FLAG_TABLE = "E"

# E-table layout from the GEM80-400 Technical Manual (T1614, Table 2.6).
E_TENTH_SECOND = Address("E", 0, 0)  # on for one scan every 0.1 s
E_ONE_SECOND = Address("E", 0, 1)  # on for one scan every 1 s
E_RECOMPILED = Address("E", 0, 6)  # on for one scan after a program change
E_LIMIT = Address("E", 0, 7)  # an ADD/SUB result hit +/-32767 this scan
E_CLOCK_WORDS = range(1, 7)  # E1..E6: seconds, minutes, hours, day, month, year
E_LAST_SCAN = Address("E", 7)  # duration of the previous scan in ms


@dataclass(frozen=True)
class ControllerConfig:
    """What the virtual device looks like from the outside.

    The MicroGEM's real I/O count is not yet confirmed, so these are
    placeholders that the front end and Home Assistant both read.
    """

    name: str = "MicroGEM"
    inputs: int = 16
    outputs: int = 16


class Controller:
    def __init__(
        self,
        config: ControllerConfig | None = None,
        clock: Callable[[], time.struct_time] = time.localtime,
    ) -> None:
        self.config = config or ControllerConfig()
        self._clock = clock
        self._recompiled = False
        words_needed = max(self.config.inputs, self.config.outputs) // 16 + 1
        self.tables = DataTables({letter: max(64, words_needed) for letter in TABLE_LETTERS})
        self.program = Program()
        self.running = False
        self.scan_count = 0
        self.elapsed_ms = 0
        self._timers: dict[tuple[int, int], int] = {}
        self._rung_was_on: dict[tuple[int, int], bool] = {}
        self._previous_bits: dict[Address, bool] = {}

    # --- program and mode ---------------------------------------------------

    def load(self, source: str) -> None:
        """Compile and install a new program. Raises ProgramError on mistakes."""
        program = parse_program(source)
        for rung in program.rungs:
            for address in _addresses(rung):
                self.tables.check(address)
            for action in rung.actions:
                for name in ("address", "done", "count", "dest"):
                    target = getattr(action, name, None)
                    if isinstance(target, Address) and target.table == FLAG_TABLE:
                        raise ProgramError("E tables are read-only to the program", rung.line)
        self._recompiled = True
        self.program = program
        self._timers.clear()
        self._rung_was_on.clear()
        self._snapshot_edges()

    def run(self) -> None:
        if self.running:
            return
        # As on a GEM 80, most tables are cleared on the Halt -> Run transition.
        self.tables.clear("".join(t for t in TABLE_LETTERS if t not in RETAINED_TABLES))
        self._timers.clear()
        self._rung_was_on.clear()
        self._snapshot_edges()
        self.running = True

    def halt(self) -> None:
        self.running = False
        self.tables.clear(OUTPUT_TABLE)

    # --- physical I/O ---------------------------------------------------------

    def set_input(self, index: int, value: bool) -> None:
        if not 0 <= index < self.config.inputs:
            raise IndexError(f"input {index} does not exist")
        self.tables.set_bit(Address(INPUT_TABLE, index // 16, index % 16), value)

    def input(self, index: int) -> bool:
        return self.tables.get_bit(Address(INPUT_TABLE, index // 16, index % 16))

    def output(self, index: int) -> bool:
        return self.tables.get_bit(Address(OUTPUT_TABLE, index // 16, index % 16))

    def inputs(self) -> list[bool]:
        return [self.input(i) for i in range(self.config.inputs)]

    def outputs(self) -> list[bool]:
        return [self.output(i) for i in range(self.config.outputs)]

    # --- scanning -------------------------------------------------------------

    def scan(self, dt_ms: int) -> None:
        """Run the whole program once, as if ``dt_ms`` passed since the last scan."""
        if not self.running:
            return
        self._update_flags(dt_ms)
        for r, rung in enumerate(self.program.rungs):
            power = self._evaluate(rung.condition)
            for a, action in enumerate(rung.actions):
                self._execute(action, power, (r, a), dt_ms)
        self._snapshot_edges()
        self.scan_count += 1
        self.elapsed_ms += dt_ms

    def _update_flags(self, dt_ms: int) -> None:
        tables = self.tables
        before, after = self.elapsed_ms, self.elapsed_ms + dt_ms
        tables.set_bit(E_TENTH_SECOND, after // 100 != before // 100)
        tables.set_bit(E_ONE_SECOND, after // 1000 != before // 1000)
        tables.set_bit(E_RECOMPILED, self._recompiled)
        self._recompiled = False
        tables.set_bit(E_LIMIT, False)
        now = self._clock()
        clock = (now.tm_sec, now.tm_min, now.tm_hour, now.tm_mday, now.tm_mon, now.tm_year)
        for word, value in zip(E_CLOCK_WORDS, clock):
            tables.set_word(Address(FLAG_TABLE, word), value)
        tables.set_word(E_LAST_SCAN, min(dt_ms, 0xFFFF))

    def _snapshot_edges(self) -> None:
        self._previous_bits = {
            address: self.tables.get_bit(address) for address in self.program.edge_addresses()
        }

    def _word(self, operand: Address | int) -> int:
        if isinstance(operand, int):
            return operand
        return to_signed(self.tables.get_word(operand))

    def _evaluate(self, node: object) -> bool:
        if isinstance(node, Contact):
            return self.tables.get_bit(node.address) != node.normally_closed
        if isinstance(node, Series):
            return all(self._evaluate(item) for item in node.items)
        if isinstance(node, Parallel):
            return any(self._evaluate(item) for item in node.items)
        if isinstance(node, Not):
            return not self._evaluate(node.operand)
        if isinstance(node, Edge):
            now = self.tables.get_bit(node.address)
            before = self._previous_bits.get(node.address, now)
            return (now and not before) if node.rising else (before and not now)
        if isinstance(node, Compare):
            return COMPARISONS[node.op](self._word(node.left), self._word(node.right))
        if isinstance(node, Constant):
            return node.value
        raise TypeError(f"unknown contact {node!r}")

    def _execute(self, action: object, power: bool, key: tuple[int, int], dt_ms: int) -> None:
        tables = self.tables
        if isinstance(action, Coil):
            tables.set_bit(action.address, power)
        elif isinstance(action, Latch):
            if power:
                tables.set_bit(action.address, action.set)
        elif isinstance(action, Delay):
            accumulated = min(self._timers.get(key, 0) + dt_ms, action.preset_ms) if power else 0
            self._timers[key] = accumulated
            tables.set_bit(action.done, power and accumulated >= action.preset_ms)
        elif isinstance(action, Count):
            count = to_signed(tables.get_word(action.count))
            if power and not self._rung_was_on.get(key, False) and count < COUNT_MAX:
                count += 1
                tables.set_word(action.count, count)
            self._rung_was_on[key] = power
            tables.set_bit(action.done, count >= action.preset)
        elif isinstance(action, Clear):
            if power:
                tables.set_word(action.address, 0)
        elif isinstance(action, Out):
            if power:
                tables.set_word(action.dest, self._word(action.source))
        elif isinstance(action, Arith):
            if power:
                result = ARITHMETIC[action.op](self._word(action.left), self._word(action.right))
                if clamp16(result) != result:
                    tables.set_bit(E_LIMIT, True)
                tables.set_word(action.dest, clamp16(result))
        else:
            raise TypeError(f"unknown action {action!r}")

    def timer_ms(self, rung: int, action: int = 0) -> int:
        return self._timers.get((rung, action), 0)

    # --- for front ends -------------------------------------------------------

    def write(self, address: Address, value: int | bool) -> None:
        """Force a value into a data table, as a programmer's VALUE key does."""
        if address.table == FLAG_TABLE:
            raise ProgramError("E tables are read-only")
        if address.is_bit:
            self.tables.set_bit(address, bool(value))
        else:
            self.tables.set_word(address, clamp16(int(value)))

    def ladder(self) -> list[dict]:
        return [rung_to_json(rung) for rung in self.program.rungs]

    def live(self) -> dict[str, int | bool]:
        """Current value of every address the program uses, for live ladder diagrams."""
        values: dict[str, int | bool] = {}
        for rung in self.program.rungs:
            for address in _addresses(rung):
                key = str(address)
                if key not in values:
                    values[key] = (
                        self.tables.get_bit(address)
                        if address.is_bit
                        else to_signed(self.tables.get_word(address))
                    )
        return values

    def timers(self) -> dict[str, int]:
        return {f"{r}.{a}": ms for (r, a), ms in self._timers.items()}

    def snapshot(self, tables: str = "BEGHLRW") -> dict:
        return {
            "name": self.config.name,
            "running": self.running,
            "scan_count": self.scan_count,
            "inputs": self.inputs(),
            "outputs": self.outputs(),
            "tables": {letter: self.tables.table(letter)[:8] for letter in tables},
            "live": self.live(),
            "timers": self.timers(),
        }


def _addresses(rung) -> list[Address]:
    found: list[Address] = []

    def add(value: object) -> None:
        if isinstance(value, Address):
            found.append(value)

    def walk(node: object) -> None:
        for name in ("address", "left", "right"):
            add(getattr(node, name, None))
        for child in getattr(node, "items", ()):
            walk(child)
        if isinstance(node, Not):
            walk(node.operand)

    walk(rung.condition)
    for action in rung.actions:
        for name in ("address", "done", "count", "dest", "source", "left", "right"):
            add(getattr(action, name, None))
    return found
