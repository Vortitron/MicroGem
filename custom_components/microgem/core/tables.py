"""GEM 80 style data tables.

Every operand in a GEM 80 program lives in a lettered table of 16-bit words.
A bit is addressed as ``<table><word>.<bit>`` (for example ``A0.3``) and a whole
word as ``<table><word>`` (for example ``G12``).

Table meanings follow the GEM80-500 Technical Manual (T2025, Table 5-5):

* ``A`` inputs, ``B`` outputs
* ``C``/``D`` remote I/O receive/transmit, ``J``/``K`` serial receive/transmit
* ``G H L N O U`` general workspace, ``S`` (MicroGEM programmer key) workspace
* ``R W`` retained workspace (survive a Halt/Run transition)
* ``E`` flags and clock, ``F`` fault codes, ``P`` presets, ``I`` serial link control
* ``M`` maintainer (user-programmed tests) on the GEM 80/100C and 130C

Each controller model has only some of these tables (see ``models.py``).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

TABLE_LETTERS = "ABCDEFGHIJKLMNOPRSUW"

#: Tables that keep their contents across a Halt -> Run transition.
RETAINED_TABLES = frozenset("APRW")

DEFAULT_TABLE_SIZE = 64

_ADDRESS_RE = re.compile(r"^([A-Z])(\d+)(?:\.(\d+))?$")


class AddressError(ValueError):
    """Raised for a malformed or out-of-range data table address."""


@dataclass(frozen=True)
class Address:
    table: str
    word: int
    bit: int | None = None

    @property
    def is_bit(self) -> bool:
        return self.bit is not None

    def __str__(self) -> str:
        return f"{self.table}{self.word}" + (f".{self.bit}" if self.bit is not None else "")


def parse_address(text: str) -> Address:
    match = _ADDRESS_RE.match(text.strip().upper())
    if not match:
        raise AddressError(f"not a data table address: {text!r}")
    table, word, bit = match.group(1), int(match.group(2)), match.group(3)
    if table not in TABLE_LETTERS:
        raise AddressError(f"unknown data table {table!r} in {text!r}")
    if bit is not None:
        bit = int(bit)
        if not 0 <= bit <= 15:
            raise AddressError(f"bit must be 0-15 in {text!r}")
    return Address(table, word, bit)


def to_signed(value: int) -> int:
    value &= 0xFFFF
    return value - 0x10000 if value & 0x8000 else value


def clamp16(value: int) -> int:
    """Saturate to the signed 16-bit range used by GEM 80 arithmetic."""
    return max(-32768, min(32767, value))


#: Internal (byte) addressing for LOCATE and MOVE. The Special Function data
#: sheets (S20 LOCATE, T20 MOVE) say a typical GEM 80 keeps tables A B C D G J
#: K L M and W as one contiguous block in alphabetical order, with E, F, R and
#: P in blocks of their own, and that the first models use byte addresses, so
#: the addresses of G100 and G101 differ by 2. The block bases are the
#: emulator's own.
MEMORY_GROUPS = ("E", "F", "R", "ABCDGHIJKLMNOSUW", "P")
MEMORY_BASE = 0x0100
MEMORY_ALIGN = 0x0100


class DataTables:
    """All data tables of one controller, stored as unsigned 16-bit words."""

    def __init__(self, sizes: dict[str, int] | None = None, letters: str | None = None) -> None:
        sizes = sizes or {}
        letters = letters if letters is not None else TABLE_LETTERS
        self._words: dict[str, list[int]] = {
            letter: [0] * sizes.get(letter, DEFAULT_TABLE_SIZE) for letter in letters
        }
        self._layout()

    def _layout(self) -> None:
        """Lay the tables out in memory, for internal addresses."""
        self._base: dict[str, int] = {}
        self._areas: list[tuple[int, int, str]] = []  # (start, end, letters in the block)
        address = MEMORY_BASE
        for group in MEMORY_GROUPS:
            start = address
            present = "".join(t for t in group if t in self._words)
            if not present:
                continue
            for letter in present:
                self._base[letter] = address
                address += 2 * len(self._words[letter])
            self._areas.append((start, address, present))
            address = -(-address // MEMORY_ALIGN) * MEMORY_ALIGN + MEMORY_ALIGN

    @property
    def letters(self) -> str:
        return "".join(self._words)

    def has(self, table: str) -> bool:
        return table in self._words

    def size(self, table: str) -> int:
        return len(self._words[table])

    def sizes(self) -> dict[str, int]:
        return {letter: len(words) for letter, words in self._words.items()}

    def _check(self, address: Address) -> None:
        if address.table not in self._words:
            raise AddressError(f"this controller has no {address.table} table")
        if not 0 <= address.word < len(self._words[address.table]):
            raise AddressError(f"{address} is beyond the end of the {address.table} table")

    def check(self, address: Address) -> None:
        self._check(address)

    def get_word(self, address: Address) -> int:
        self._check(address)
        return self._words[address.table][address.word]

    def set_word(self, address: Address, value: int) -> None:
        self._check(address)
        self._words[address.table][address.word] = value & 0xFFFF

    def get_bit(self, address: Address) -> bool:
        if address.bit is None:
            raise AddressError(f"{address} is a word address, a bit was expected")
        return bool(self.get_word(address) >> address.bit & 1)

    def set_bit(self, address: Address, value: bool) -> None:
        if address.bit is None:
            raise AddressError(f"{address} is a word address, a bit was expected")
        word = self.get_word(address)
        mask = 1 << address.bit
        self.set_word(address, word | mask if value else word & ~mask)

    def table(self, letter: str) -> list[int]:
        """A copy of one whole table."""
        return list(self._words[letter])

    def clear(self, letters: str | None = None) -> None:
        for letter in letters if letters is not None else self.letters:
            if letter in self._words:
                words = self._words[letter]
                words[:] = [0] * len(words)

    # --- internal addresses, for LOCATE and MOVE -----------------------------

    def internal(self, table: str, word: int) -> int | None:
        """The internal address of word ``word`` of ``table`` (which may run on
        into the next table of the same memory block), or None outside it."""
        if table not in self._base:
            return None
        address = self._base[table] + 2 * word
        return address if self.area(address) is not None else None

    def area(self, address: int) -> tuple[int, int, str] | None:
        """The memory block an internal address is in."""
        for start, end, letters in self._areas:
            if start <= address < end and (address - start) % 2 == 0:
                return start, end, letters
        return None

    def locate(self, address: int) -> Address | None:
        """The table word at an internal address."""
        if self.area(address) is None:
            return None
        for letter, base in self._base.items():
            if base <= address < base + 2 * len(self._words[letter]):
                return Address(letter, (address - base) // 2)
        return None
