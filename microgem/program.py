"""A text form of GEM 80 ladder rungs, and its parser.

The exact operand syntax of the original GEM 80 programming tools is defined in
the T391 *Ladder Diagram Language Programming Manual*, which we have not found
yet. Until then this is a readable, provisional notation that maps one-to-one
onto ladder rungs: the left of ``->`` is the contact network, the right is the
list of coils and function blocks the rung drives.

    ; comment
    A0.0 AND NOT A0.1 -> B0.0
    (A0.2 OR B0.1) AND NOT A0.3 -> B0.1
    A0.4 -> DELAY 2.5s G0.0
    RISE A0.5 -> COUNT 10 G1 G0.1
    A0.6 -> SET B0.2
    A0.7 -> RESET B0.2, CLEAR G1
    G1 GE 5 -> B0.3
    TRUE -> ADD G1 100 G2

Contacts: ``A0.0`` (normally open), ``NOT A0.0`` (normally closed),
``RISE A0.0`` / ``FALL A0.0`` (one-scan pulse on a change), ``TRUE``, and word
comparisons ``<word|number> EQ|NE|GT|LT|GE|LE <word|number>``.

Actions: a bare bit address is a coil; ``SET``/``RESET`` latch; ``DELAY <time>
<done-bit>`` is an on-delay timer (100 ms to 54 min, as the GEM 80 DELAY);
``COUNT <preset> <count-word> <done-bit>`` counts rising edges of the rung up
to 32,767; ``CLEAR <word>``; ``OUT <value|word> <word>`` writes a word;
``ADD SUB MULT DIV <a> <b> <dest>`` integer arithmetic (saturating at +/-32,767).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .tables import Address, AddressError, clamp16, parse_address, to_signed

COMPARISONS = {
    "EQ": lambda a, b: a == b,
    "NE": lambda a, b: a != b,
    "GT": lambda a, b: a > b,
    "LT": lambda a, b: a < b,
    "GE": lambda a, b: a >= b,
    "LE": lambda a, b: a <= b,
}

ARITHMETIC = {
    "ADD": lambda a, b: a + b,
    "SUB": lambda a, b: a - b,
    "MULT": lambda a, b: a * b,
    "DIV": lambda a, b: int(a / b) if b else 0,
}

DELAY_MIN_MS = 100
DELAY_MAX_MS = 54 * 60 * 1000
COUNT_MAX = 32767

_TOKEN_RE = re.compile(r"\s*(->|\(|\)|,|(?:(?!->)[^\s(),])+)")
_TIME_RE = re.compile(r"^(\d+(?:\.\d+)?)(ms|s|m|min)$", re.IGNORECASE)


class ProgramError(ValueError):
    def __init__(self, message: str, line: int | None = None) -> None:
        self.line = line
        super().__init__(f"line {line}: {message}" if line else message)


# --- contact network -------------------------------------------------------

@dataclass(frozen=True)
class Contact:
    address: Address
    normally_closed: bool = False


@dataclass(frozen=True)
class Edge:
    address: Address
    rising: bool = True


@dataclass(frozen=True)
class Constant:
    value: bool


@dataclass(frozen=True)
class Compare:
    op: str
    left: Address | int
    right: Address | int


@dataclass(frozen=True)
class Not:
    operand: object


@dataclass(frozen=True)
class Series:
    items: tuple


@dataclass(frozen=True)
class Parallel:
    items: tuple


# --- actions ---------------------------------------------------------------

@dataclass(frozen=True)
class Coil:
    address: Address


@dataclass(frozen=True)
class Latch:
    address: Address
    set: bool


@dataclass(frozen=True)
class Delay:
    preset_ms: int
    done: Address


@dataclass(frozen=True)
class Count:
    preset: int
    count: Address
    done: Address


@dataclass(frozen=True)
class Clear:
    address: Address


@dataclass(frozen=True)
class Out:
    source: Address | int
    dest: Address


@dataclass(frozen=True)
class Arith:
    op: str
    left: Address | int
    right: Address | int
    dest: Address


@dataclass(frozen=True)
class Rung:
    condition: object
    actions: tuple
    line: int
    source: str


@dataclass
class Program:
    rungs: list[Rung] = field(default_factory=list)
    source: str = ""

    def edge_addresses(self) -> set[Address]:
        found: set[Address] = set()

        def walk(node: object) -> None:
            if isinstance(node, Edge):
                found.add(node.address)
            elif isinstance(node, Not):
                walk(node.operand)
            elif isinstance(node, (Series, Parallel)):
                for item in node.items:
                    walk(item)

        for rung in self.rungs:
            walk(rung.condition)
        return found


# --- parser ----------------------------------------------------------------

class _Parser:
    def __init__(self, tokens: list[str], line: int) -> None:
        self.tokens = tokens
        self.pos = 0
        self.line = line

    def error(self, message: str) -> ProgramError:
        return ProgramError(message, self.line)

    def peek(self) -> str | None:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def take(self) -> str:
        token = self.peek()
        if token is None:
            raise self.error("rung ends too early")
        self.pos += 1
        return token

    def expect(self, wanted: str) -> None:
        token = self.take()
        if token.upper() != wanted:
            raise self.error(f"expected {wanted!r} but found {token!r}")

    def address(self, *, bit: bool | None) -> Address:
        token = self.take()
        try:
            address = parse_address(token)
        except AddressError as exc:
            raise self.error(str(exc)) from None
        if bit is True and not address.is_bit:
            raise self.error(f"{token} is a word; a bit address such as {token}.0 is needed here")
        if bit is False and address.is_bit:
            raise self.error(f"{token} is a bit; a word address is needed here")
        return address

    def operand(self) -> Address | int:
        token = self.peek()
        if token is not None and re.fullmatch(r"-?\d+", token):
            self.pos += 1
            return int(token)
        return self.address(bit=False)

    # condition := term (OR term)*
    def condition(self) -> object:
        items = [self.term()]
        while (self.peek() or "").upper() == "OR":
            self.take()
            items.append(self.term())
        return items[0] if len(items) == 1 else Parallel(tuple(items))

    def term(self) -> object:
        items = [self.factor()]
        while (self.peek() or "").upper() == "AND":
            self.take()
            items.append(self.factor())
        return items[0] if len(items) == 1 else Series(tuple(items))

    def factor(self) -> object:
        token = self.peek()
        if token is None:
            raise self.error("a contact is missing")
        upper = token.upper()
        if upper == "NOT":
            self.take()
            inner = self.factor()
            if isinstance(inner, Contact):
                return Contact(inner.address, not inner.normally_closed)
            return Not(inner)
        if token == "(":
            self.take()
            inner = self.condition()
            self.expect(")")
            return inner
        if upper in ("RISE", "FALL"):
            self.take()
            return Edge(self.address(bit=True), rising=upper == "RISE")
        if upper in ("TRUE", "FALSE"):
            self.take()
            return Constant(upper == "TRUE")
        # A bit contact, or the left side of a word comparison.
        start = self.pos
        try:
            address = parse_address(token)
        except AddressError:
            address = None
        if address is not None and address.is_bit:
            self.take()
            return Contact(address)
        self.pos = start
        left = self.operand()
        op = self.take().upper()
        if op not in COMPARISONS:
            raise self.error(f"expected a comparison (EQ, NE, GT, LT, GE, LE) after {token}, found {op!r}")
        return Compare(op, left, self.operand())

    def action(self) -> object:
        token = self.peek()
        if token is None:
            raise self.error("an action is missing after '->'")
        upper = token.upper()
        if upper in ("SET", "RESET"):
            self.take()
            return Latch(self.address(bit=True), upper == "SET")
        if upper == "DELAY":
            self.take()
            preset = parse_time(self.take(), self.line)
            return Delay(preset, self.address(bit=True))
        if upper == "COUNT":
            self.take()
            raw = self.take()
            if not raw.isdigit() or not 1 <= int(raw) <= COUNT_MAX:
                raise self.error(f"COUNT preset must be 1 to {COUNT_MAX}, found {raw!r}")
            return Count(int(raw), self.address(bit=False), self.address(bit=True))
        if upper == "CLEAR":
            self.take()
            return Clear(self.address(bit=False))
        if upper == "OUT":
            self.take()
            return Out(self.operand(), self.address(bit=False))
        if upper in ARITHMETIC:
            self.take()
            return Arith(upper, self.operand(), self.operand(), self.address(bit=False))
        return Coil(self.address(bit=True))


def parse_time(text: str, line: int | None = None) -> int:
    match = _TIME_RE.match(text)
    if not match:
        raise ProgramError(f"{text!r} is not a time; use for example 500ms, 2.5s or 3m", line)
    number, unit = float(match.group(1)), match.group(2).lower()
    ms = round(number * {"ms": 1, "s": 1000, "m": 60000, "min": 60000}[unit])
    if not DELAY_MIN_MS <= ms <= DELAY_MAX_MS:
        raise ProgramError(f"DELAY must be between 100ms and 54m, found {text}", line)
    return ms


def parse_program(source: str) -> Program:
    program = Program(source=source)
    for number, raw in enumerate(source.splitlines(), start=1):
        text = raw.split(";", 1)[0].strip()
        if not text:
            continue
        tokens = _TOKEN_RE.findall(text)
        if "->" not in tokens:
            raise ProgramError("a rung needs '->' between its contacts and its outputs", number)
        parser = _Parser(tokens, number)
        condition = parser.condition()
        parser.expect("->")
        actions = [parser.action()]
        while parser.peek() == ",":
            parser.take()
            actions.append(parser.action())
        if parser.peek() is not None:
            raise ProgramError(f"unexpected {parser.peek()!r}", number)
        program.rungs.append(Rung(condition, tuple(actions), number, raw.strip()))
    return program


__all__ = [
    "Arith", "Clear", "Coil", "Compare", "Constant", "Contact", "Count", "Delay",
    "Edge", "Latch", "Not", "Out", "Parallel", "Program", "ProgramError", "Rung",
    "Series", "ARITHMETIC", "COMPARISONS", "COUNT_MAX", "clamp16", "parse_program",
    "parse_time", "to_signed",
]
