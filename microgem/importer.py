"""Bringing an existing programme into the emulator.

A GEM 80 programme usually survives as one of three things, and ``import_text``
takes any of them:

* a ladder print-out (from a programmer, or one this emulator printed): the
  rungs are read back from the drawing (see ``printout.read_printout``);
* program text in the emulator's own form (see ``program``), which is checked
  and passed through;
* a table of names or data, as the PC programming packages export it: one row
  per address, separated by commas, semicolons or tabs. A row whose second
  column is a mnemonic becomes a ``NAME`` line (``A0.0,START,Start button``);
  a row whose second column is a number becomes a ``PRESET`` (``G10,250``).
  Header rows and rows without an address are skipped. These are merged into
  the programme already in the editor, replacing names and presets for the same
  addresses.

The original packages' own file formats are not published, so they cannot be
read directly; export a print-out or a CSV from them instead.
"""

from __future__ import annotations

import csv
import io
import re

from .printout import PrintoutError, _is_symbol_line, _normalise, read_printout
from .program import RESERVED, ProgramError, parse_program
from .tables import AddressError, parse_address

#: Longest mnemonic the emulator keeps (the 8940 allowed seven characters).
NAME_LENGTH = 12

_ADDRESS_IN = re.compile(r"^\s*([A-Za-z])\s*0*(\d+)(?:\s*[./]\s*0*(\d+))?\s*$")
_NUMBER = re.compile(r"^\s*(-?\d+|@[0-9A-Fa-f]{1,4}|0x[0-9A-Fa-f]{1,4})\s*$")


def _address(cell: str):
    """An address from a table cell, allowing leading zeros (``A000.07``) and
    ``/`` for the bit separator. None if the cell is not one."""
    match = _ADDRESS_IN.match(cell or "")
    if not match:
        return None
    table, word, bit = match.groups()
    text = f"{table.upper()}{int(word)}" + (f".{int(bit)}" if bit is not None else "")
    try:
        return parse_address(text)
    except AddressError:
        return None


def _mnemonic(cell: str, taken: set[str]) -> str | None:
    name = re.sub(r"[^A-Z0-9_]", "_", cell.strip().upper()).strip("_")
    if not name:
        return None
    if not name[0].isalpha():
        name = "N" + name
    name = name[:NAME_LENGTH]
    if name in RESERVED or _address(name) is not None:
        name = (name[:NAME_LENGTH - 1] + "_")
    base, n = name, 2
    while name in taken:
        suffix = str(n)
        name = base[:NAME_LENGTH - len(suffix)] + suffix
        n += 1
    taken.add(name)
    return name


def _number(cell: str) -> int | None:
    match = _NUMBER.match(cell or "")
    if not match:
        return None
    token = match.group(1)
    value = int(token[1:], 16) if token.startswith("@") else int(token, 0)
    return value if -32768 <= value <= 0xFFFF else None


def is_printout(text: str) -> bool:
    return any(_normalise(line).startswith("+") and _is_symbol_line(_normalise(line))
               for line in text.splitlines())


def read_table(text: str) -> tuple[list[tuple], list[tuple]]:
    """(names, presets) from CSV-like rows: names are (address, mnemonic,
    description) and presets (address, value)."""
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    names, presets = [], []
    taken: set[str] = set()
    for row in csv.reader(io.StringIO(text), dialect):
        cells = [c.strip() for c in row]
        if len(cells) < 2:
            continue
        address = _address(cells[0])
        if address is None:
            continue
        value = _number(cells[1])
        if value is not None and not address.is_bit:
            presets.append((address, value))
            continue
        name = _mnemonic(cells[1], taken)
        if name is None:
            continue
        note = " ".join(c for c in cells[2:] if c).replace(";", ",")
        names.append((address, name, note))
    return names, presets


def _merge(current: str, names: list[tuple], presets: list[tuple]) -> str:
    """The current programme with these names and presets in place of any for
    the same addresses (or the same mnemonics)."""
    replaced = {str(a) for a, _n, _d in names} | {str(a) for a, _v in presets}
    new_names = {n for _a, n, _d in names}
    kept = []
    for line in current.splitlines():
        words = line.partition(";")[0].split()
        if len(words) >= 2 and words[0].upper() in ("NAME", "PRESET"):
            address = _address(words[1])
            if address is not None and str(address) in replaced:
                continue
            if words[0].upper() == "NAME" and len(words) >= 3 and words[2].upper() in new_names:
                continue
        kept.append(line)
    head = [f"NAME {a} {n} {d}".rstrip() for a, n, d in names]
    head += [f"PRESET {a} = {v}" for a, v in presets]
    body = "\n".join(kept).strip()
    return "\n".join(head) + ("\n\n" + body if body else "") + "\n"


def import_text(text: str, current: str = "") -> dict:
    """Program text from a print-out, program text or a names/data table.

    Returns ``{"source", "kind", "summary"}``; ``kind`` is ``printout``,
    ``program`` or ``table``. Raises ProgramError when the text is none of
    these, with the most useful reason."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if not text.strip():
        raise ProgramError("there is nothing to import")
    if is_printout(text):
        try:
            source = read_printout(text)
        except PrintoutError as exc:
            raise ProgramError(f"print-out: {exc}") from None
        program = parse_program(source)
        return {"source": source, "kind": "printout",
                "summary": f"{len(program.rungs)} rungs read from the print-out"}
    try:
        program = parse_program(text)
    except ProgramError as exc:
        first_error = exc
    else:
        if program.rungs or program.notes or program.presets:
            return {"source": text if text.endswith("\n") else text + "\n", "kind": "program",
                    "summary": f"{len(program.rungs)} rungs"}
        first_error = ProgramError("there are no rungs, names or presets in it")
    names, presets = read_table(text)
    if not names and not presets:
        raise first_error
    source = _merge(current, names, presets)
    parse_program(source)
    parts = []
    if names:
        parts.append(f"{len(names)} name" + ("s" if len(names) != 1 else ""))
    if presets:
        parts.append(f"{len(presets)} preset" + ("s" if len(presets) != 1 else ""))
    return {"source": source, "kind": "table", "summary": " and ".join(parts) + " added"}
