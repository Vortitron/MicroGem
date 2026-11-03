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
"""

from __future__ import annotations

import re
from dataclasses import dataclass

TABLE_LETTERS = "ABCDEFGHIJKLNOPRSUW"

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


class DataTables:
    """All data tables of one controller, stored as unsigned 16-bit words."""

    def __init__(self, sizes: dict[str, int] | None = None) -> None:
        sizes = sizes or {}
        self._words: dict[str, list[int]] = {
            letter: [0] * sizes.get(letter, DEFAULT_TABLE_SIZE) for letter in TABLE_LETTERS
        }

    def size(self, table: str) -> int:
        return len(self._words[table])

    def _check(self, address: Address) -> None:
        if address.table not in self._words:
            raise AddressError(f"unknown data table {address.table!r}")
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
        for letter in letters if letters is not None else TABLE_LETTERS:
            words = self._words[letter]
            words[:] = [0] * len(words)
