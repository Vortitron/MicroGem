"""The controller: data tables plus a cyclic scan of the user program."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass

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
    Seqr,
    Series,
    addresses,
    parse_program,
    walk,
    rung_to_json,
)
from .tables import RETAINED_TABLES, TABLE_LETTERS, Address, DataTables, clamp16, to_signed

INPUT_TABLE = "A"
OUTPUT_TABLE = "B"
FLAG_TABLE = "E"

# E-table layout from the GEM80-400 Technical Manual (T1614, Table 2.6).
E_TENTH_SECOND = Address("E", 0, 0)  # on for one scan every 0.1 s
E_ONE_SECOND = Address("E", 0, 1)  # on for one scan every 1 s
E_RECOMPILED = Address("E", 0, 6)  # on for one scan after a program change
E_LIMIT = Address("E", 0, 7)  # the last ADD/SUB was limited to +/-32767
E_CLOCK_WORDS = range(1, 7)  # E1..E6: seconds, minutes, hours, day, month, year
E_LAST_SCAN = Address("E", 7)  # duration of the previous scan in ms


@dataclass(frozen=True)
class ControllerConfig:
    """What the virtual device looks like from the outside.

    The defaults match the MicroGEM60: 12 inputs and 8 relay outputs.
    """

    name: str = "MicroGEM"
    inputs: int = 12
    outputs: int = 8


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
        self._dt_ms = 0
        # DELAY state the data table cannot hold: whether it is timing, and the
        # part of a 0.1 s step already elapsed. Keyed by element id.
        self._delays: dict[int, list] = {}
        self._flow: dict[int, int] = {}
        self._skipped: set[int] = set()
        self._previous_bits: dict[Address, bool] = {}

    # --- program and mode ---------------------------------------------------

    def load(self, source: str) -> None:
        """Compile and install a new program. Raises ProgramError on mistakes."""
        program = parse_program(source)
        for rung in program.rungs:
            for address in addresses(rung):
                self.tables.check(address)
            written = [getattr(rung.output, "address", None)]
            written += [getattr(n, "word", None) for n in walk(rung)]
            for target in written:
                if isinstance(target, Address) and target.table == FLAG_TABLE:
                    raise ProgramError("E tables are read-only to the program", rung.line)
        self._recompiled = True
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
        self.tables.clear("".join(t for t in TABLE_LETTERS if t not in RETAINED_TABLES))
        self._reset_state()
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

    def _update_flags(self, dt_ms: int) -> None:
        tables = self.tables
        before, after = self.elapsed_ms, self.elapsed_ms + dt_ms
        tables.set_bit(E_TENTH_SECOND, after // 100 != before // 100)
        tables.set_bit(E_ONE_SECOND, after // 1000 != before // 1000)
        tables.set_bit(E_RECOMPILED, self._recompiled)
        self._recompiled = False
        now = self._clock()
        clock = (now.tm_sec, now.tm_min, now.tm_hour, now.tm_mday, now.tm_mon, now.tm_year)
        for word, value in zip(E_CLOCK_WORDS, clock):
            tables.set_word(Address(FLAG_TABLE, word), value)
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

    def snapshot(self, tables: str = "BEGHLRW") -> dict:
        return {
            "name": self.config.name,
            "running": self.running,
            "scan_count": self.scan_count,
            "inputs": self.inputs(),
            "outputs": self.outputs(),
            "tables": {letter: self.tables.table(letter)[:8] for letter in tables},
            "live": self.live(),
            "flow": self.flow(),
            "skipped": sorted(self._skipped),
        }

