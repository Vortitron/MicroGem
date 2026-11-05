"""A text form of GEM 80 ladder rungs, and its parser.

The elements and their behaviour follow the GEM 80 *Ladder Diagram Programming
Manual* (T391, issue 4). A 16-bit word flows along each rung from left to
right: the left rail feeds in -1 (@FFFF, all bits set), a contact passes the
word on or blocks it to 0, and a rung is ON when its word is not zero.

Each line is one rung. The elements are written left to right, and ``->``
comes before the one output element in the top-right corner of the rung::

    ; comment lines above a rung become its title
    A0.0 AND NOT A0.1 -> B0.0                 contacts in series, then a COIL
    (A0.2 OR B0.1) AND NOT A0.3 -> B0.1       parallel branches joined (wired OR)
    A0.4 DELAY G10 VALUE 25 -> B0.2           on-delay of 2.5 s (VALUE is in 0.1 s)
    A0.5 COUNT G11 VALUE 10 RESET A0.6 -> B0.3
    E0.1 -> SEQR G12 RESET A0.7               sequencer: one bit walks left
    AND G1 ADD 5 -> OUT G2                    plant G1 on the rung, add 5, OUT to G2
    A1.0 AND @00FF -> OUT G3                  mask with a constant (@ is hex)
    A1.1 -> BLOCK                             OBEY BLOCK: the rungs up to
    ...                                       the matching END BLOCK only run
    END BLOCK                                 while A1.1 is on

Contacts: ``A0.0`` (N/O), ``NOT A0.0`` (N/C), ``TRUE`` (a plain wire).
``AND``, ``OR`` and ``XOR`` between contacts mean series and parallel wiring;
followed by a number or a word address they are the 16-bit logic elements.
``INV`` inverts all 16 bits, and ``NOT (...)`` is a group followed by INV.

Word elements: ``AND OR XOR ADD SUB MULT DIV`` take a number, a word address,
or a second branch in square brackets (``ADD [A0.3 AND G4]``, which the
programmer builds with JOIN). ``MULT`` and ``DIV`` are the GEM 80 Special
Functions T10 and T11. ``DELAY w VALUE v`` and ``COUNT w VALUE v [RESET c]``
work as in the manual: the word ``w`` holds the time left (0.1 s units) or the
count (bits 0 to 14, with bit 15 the last input).

Special Functions: ``SPEC n`` where ``n`` is the number (``S12``) or the
mnemonic (``SQRT``), then for the two-input T functions the lower branch in
square brackets, then ``VALUE v`` where the function needs one::

    AND G10 SPEC SQRT VALUE 100 -> OUT G11
    AND G10 SPEC COMPARE [AND G11] VALUE G59 -> OUT G58
    AND 0 SPEC LOCATE VALUE G20 SPEC MOVE [AND 0 SPEC LOCATE VALUE G100] VALUE 20 -> OUT F250

Output elements: a bit address is a COIL; ``OUT w`` writes the rung word;
``SEQR w [RESET c]``; ``BLOCK`` (OBEY BLOCK). ``END BLOCK`` (or ``BLOCK`` on
its own) closes a block.

Preset data and names, which a programmer keeps with the program::

    PRESET P1 = 20                          P1 (the repetition interval) is 20
    PRESET W100 = 0 1067 3200 64 2          W100 to W104, one after another
    MESSAGE P100 = "FILL FAULT\\n"           text for WRITEXT (S22), packed as it needs;
    MESSAGE P107 = "DOOR OPEN\\n"            the next words: message 2 of the list at P100
    NAME A0.0 START Start push button       a mnemonic (up to 7 characters) and
                                            a description for an address

A mnemonic can stand for its address in the rungs (``START AND NOT STOP ->
MOTOR``); the ladder shows both. Presets are written into the tables when the
program is loaded, and again only where they change, so data the program or
an operator has changed since is left alone.

Not in the GEM 80, kept as marked extensions for convenience: ``RISE``/``FALL``
contacts (one-scan pulses), word comparisons such as ``G1 GE 5`` (the real
controller uses Special Functions), and ``SET``/``RESET`` latching outputs (the
GEM 80 latches with a seal-in branch).
"""

from __future__ import annotations

import itertools
import re
from dataclasses import dataclass, field

from .models import SPECIAL_NAMES, SPECIAL_NUMBERS
from .tables import Address, AddressError, clamp16, parse_address, to_signed

COMPARISONS = {
    "EQ": lambda a, b: a == b,
    "NE": lambda a, b: a != b,
    "GT": lambda a, b: a > b,
    "LT": lambda a, b: a < b,
    "GE": lambda a, b: a >= b,
    "LE": lambda a, b: a <= b,
}

LOGIC = {
    "AND": lambda a, b: a & b,
    "OR": lambda a, b: a | b,
    "XOR": lambda a, b: a ^ b,
}

ARITHMETIC = {
    "ADD": lambda a, b: a + b,
    "SUB": lambda a, b: a - b,
    "MULT": lambda a, b: a * b,
    "DIV": lambda a, b: int(a / b) if b else 0,
}

# Special Function numbers of the arithmetic that is not a key of its own.
SPECIAL = {"MULT": "T10", "DIV": "T11"}

#: What follows SPEC: "none" (no VALUE), "ignored" (a VALUE does nothing),
#: "location" (VALUE must be a table address, the start of the function's
#: parameter list) or "either" (a number or a table address holding it).
SPEC_VALUE = {
    "S0": "location", "S1": "none", "S2": "none", "S3": "none", "S4": "ignored",
    "S11": "location", "S12": "either", "S20": "location", "S22": "location",
    "S23": "location", "S30": "location",
    "S31": "location", "S32": "location", "S33": "location", "S34": "location",
    "S35": "location", "S36": "location", "S37": "location",
    "T0": "location", "T10": "none", "T11": "location", "T20": "either", "T30": "location",
}

VALUE_MAX = 32767
RAIL = -1  # the left rail feeds 16 bits all set

_TOKEN_RE = re.compile(r"\s*(->|\(|\)|\[|\]|,|(?:(?!->)[^\s()\[\],])+)")


class ProgramError(ValueError):
    def __init__(self, message: str, line: int | None = None) -> None:
        self.line = line
        super().__init__(f"line {line}: {message}" if line else message)


_ids = itertools.count(1)


def _nid() -> int:
    return next(_ids)


# --- rung elements -----------------------------------------------------------
# Every element has an ``nid`` so the controller can report the word it passed
# on, which the ladder monitor uses to draw live and dead paths.

@dataclass(frozen=True, eq=False)
class Contact:
    address: Address
    normally_closed: bool = False
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Edge:
    """Extension: on for one scan when the bit changes."""

    address: Address
    rising: bool = True
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Constant:
    value: bool
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Compare:
    """Extension: -1 when the comparison holds, else 0."""

    op: str
    left: Address | int
    right: Address | int
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Branch:
    """A second rung branch from the left rail, feeding an element (JOIN)."""

    node: object


@dataclass(frozen=True, eq=False)
class Logic:
    op: str  # AND OR XOR
    operand: Address | int | Branch
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Inv:
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Arith:
    op: str  # ADD SUB MULT DIV
    operand: Address | int | Branch
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Delay:
    word: Address
    value: Address | int
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Count:
    word: Address
    value: Address | int
    reset: object | None = None
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Spec:
    """A Special Function. T functions take a second (lower) branch input."""

    number: str  # "S12", "T20"
    value: Address | int | None = None
    second: Branch | None = None
    nid: int = field(default_factory=_nid)

    @property
    def name(self) -> str:
        return SPECIAL_NAMES.get(self.number, self.number)


@dataclass(frozen=True, eq=False)
class Series:
    items: tuple
    nid: int = field(default_factory=_nid)


@dataclass(frozen=True, eq=False)
class Parallel:
    items: tuple
    nid: int = field(default_factory=_nid)


# --- output elements ---------------------------------------------------------

@dataclass(frozen=True, eq=False)
class Coil:
    address: Address


@dataclass(frozen=True, eq=False)
class Out:
    address: Address


@dataclass(frozen=True, eq=False)
class Seqr:
    address: Address
    reset: object | None = None


@dataclass(frozen=True, eq=False)
class ObeyBlock:
    pass


@dataclass(frozen=True, eq=False)
class EndBlock:
    pass


@dataclass(frozen=True, eq=False)
class Latch:
    """Extension: SET or RESET a bit while the rung is on."""

    address: Address
    set: bool


@dataclass(frozen=True, eq=False)
class Rung:
    condition: object | None  # None: the output joins straight to the left rail
    output: object
    line: int
    source: str
    comment: str = ""
    end: int | None = None  # for an OBEY BLOCK, the index of its END BLOCK rung


@dataclass
class Program:
    rungs: list[Rung] = field(default_factory=list)
    source: str = ""
    presets: dict[Address, int] = field(default_factory=dict)  # word -> value
    names: dict[str, Address] = field(default_factory=dict)  # MNEMONIC -> address
    notes: dict[Address, tuple[str, str]] = field(default_factory=dict)  # address -> (mnemonic, description)
    messages: dict[Address, str] = field(default_factory=dict)  # start -> MESSAGE text as written

    def edge_addresses(self) -> set[Address]:
        return {n.address for rung in self.rungs for n in walk(rung) if isinstance(n, Edge)}


def walk(rung: Rung):
    """Every element of a rung, including those in RESET and JOIN branches."""

    def visit(node: object):
        if node is None:
            return
        yield node
        if isinstance(node, (Series, Parallel)):
            for item in node.items:
                yield from visit(item)
        elif isinstance(node, (Logic, Arith)) and isinstance(node.operand, Branch):
            yield from visit(node.operand.node)
        elif isinstance(node, Spec) and node.second is not None:
            yield from visit(node.second.node)
        elif isinstance(node, Count):
            yield from visit(node.reset)

    yield from visit(rung.condition)
    if isinstance(rung.output, Seqr):
        yield from visit(rung.output.reset)


def addresses(rung: Rung) -> list[Address]:
    found: list[Address] = []
    for node in itertools.chain(walk(rung), [rung.output]):
        for name in ("address", "word", "value", "operand", "left", "right"):
            value = getattr(node, name, None)
            if isinstance(value, Address):
                found.append(value)
    return found


# --- JSON form, for drawing ladder diagrams ---------------------------------

def _operand(value: object) -> object:
    if isinstance(value, Branch):
        return node_to_json(value.node)
    return str(value)


def node_to_json(node: object) -> dict:
    if isinstance(node, Contact):
        return {"t": "contact", "id": node.nid, "addr": str(node.address), "nc": node.normally_closed}
    if isinstance(node, Edge):
        return {"t": "edge", "id": node.nid, "addr": str(node.address), "rising": node.rising}
    if isinstance(node, Constant):
        return {"t": "const", "id": node.nid, "value": node.value}
    if isinstance(node, Compare):
        return {"t": "cmp", "id": node.nid, "op": node.op,
                "left": _operand(node.left), "right": _operand(node.right)}
    if isinstance(node, Logic):
        return {"t": "logic", "id": node.nid, "op": node.op, "arg": _operand(node.operand)}
    if isinstance(node, Inv):
        return {"t": "inv", "id": node.nid}
    if isinstance(node, Arith):
        return {"t": "arith", "id": node.nid, "op": node.op, "spec": SPECIAL.get(node.op),
                "arg": _operand(node.operand)}
    if isinstance(node, Delay):
        return {"t": "delay", "id": node.nid, "word": str(node.word), "value": str(node.value)}
    if isinstance(node, Count):
        return {"t": "count", "id": node.nid, "word": str(node.word), "value": str(node.value),
                "reset": node_to_json(node.reset) if node.reset is not None else None}
    if isinstance(node, Spec):
        return {"t": "spec", "id": node.nid, "num": node.number, "name": node.name,
                "value": None if node.value is None else str(node.value),
                "arg": None if node.second is None else node_to_json(node.second.node)}
    if isinstance(node, Series):
        return {"t": "series", "id": node.nid, "items": [node_to_json(i) for i in node.items]}
    if isinstance(node, Parallel):
        return {"t": "parallel", "id": node.nid, "items": [node_to_json(i) for i in node.items]}
    raise TypeError(f"unknown element {node!r}")


def output_to_json(output: object) -> dict:
    if isinstance(output, Coil):
        return {"t": "coil", "addr": str(output.address)}
    if isinstance(output, Out):
        return {"t": "out", "addr": str(output.address)}
    if isinstance(output, Seqr):
        return {"t": "seqr", "addr": str(output.address),
                "reset": node_to_json(output.reset) if output.reset is not None else None}
    if isinstance(output, ObeyBlock):
        return {"t": "block"}
    if isinstance(output, EndBlock):
        return {"t": "end"}
    if isinstance(output, Latch):
        return {"t": "set" if output.set else "reset", "addr": str(output.address)}
    raise TypeError(f"unknown output {output!r}")


def rung_to_json(rung: Rung) -> dict:
    return {
        "line": rung.line,
        "comment": rung.comment,
        "source": rung.source,
        "condition": node_to_json(rung.condition) if rung.condition is not None else None,
        "output": output_to_json(rung.output),
    }


# --- parser ----------------------------------------------------------------

_CONTACT_STARTS = {"NOT", "RISE", "FALL", "TRUE", "FALSE", "(", "INV", "DELAY", "COUNT"}
_WORD_ELEMENTS = set(LOGIC) | set(ARITHMETIC)


class _Parser:
    def __init__(self, tokens: list[str], line: int) -> None:
        self.tokens = tokens
        self.pos = 0
        self.line = line

    def error(self, message: str) -> ProgramError:
        return ProgramError(message, self.line)

    def peek(self, ahead: int = 0) -> str | None:
        i = self.pos + ahead
        return self.tokens[i] if i < len(self.tokens) else None

    def upper(self, ahead: int = 0) -> str:
        return (self.peek(ahead) or "").upper()

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

    def _is_number(self, token: str | None) -> bool:
        return token is not None and bool(
            re.fullmatch(r"-?\d+", token) or re.fullmatch(r"@[0-9A-Fa-f]{1,4}", token)
        )

    def _is_bit(self, token: str | None) -> bool:
        if token is None:
            return False
        try:
            return parse_address(token).is_bit
        except AddressError:
            return False

    def number_or_word(self) -> Address | int:
        token = self.peek()
        if token is not None and re.fullmatch(r"-?\d+", token):
            self.pos += 1
            return clamp16(int(token))
        if token is not None and re.fullmatch(r"@[0-9A-Fa-f]{1,4}", token):
            self.pos += 1
            return to_signed(int(token[1:], 16))  # GEM 80 writes hex as @FFFF
        return self.address(bit=False)

    def operand(self) -> Address | int | Branch:
        if self.peek() == "[":
            self.take()
            node = self.condition()
            self.expect("]")
            return Branch(node)
        return self.number_or_word()

    def _contact_follows(self, ahead: int = 1) -> bool:
        token = self.peek(ahead)
        if token is None:
            return False
        if self.upper(ahead + 1) in COMPARISONS:  # extension: AND G1 GE 5
            return True
        return token.upper() in _CONTACT_STARTS or self._is_bit(token)

    # condition := term (OR term)*     -- OR before a contact is a parallel branch
    def condition(self) -> object:
        items = [self.term()]
        while self.upper() == "OR" and self._contact_follows():
            self.take()
            items.append(self.term())
        return items[0] if len(items) == 1 else Parallel(tuple(items))

    # term := item+                     -- elements in series, AND between contacts optional
    def term(self) -> object:
        items = [self.item()]
        while True:
            upper = self.upper()
            if upper == "AND" and self._contact_follows():
                self.take()
                items.append(self.item())
            elif upper in ("", "->", ")", "]", "RESET") or (upper == "OR" and self._contact_follows()):
                break
            else:
                items.append(self.item())
        return items[0] if len(items) == 1 else Series(tuple(items))

    def item(self) -> object:
        token = self.peek()
        if token is None:
            raise self.error("an element is missing")
        upper = token.upper()
        if upper == "NOT":
            self.take()
            if self._is_bit(self.peek()):
                return Contact(self.address(bit=True), normally_closed=True)
            inner = self.item()
            return Series((inner, Inv()))
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
        if upper == "INV":
            self.take()
            return Inv()
        if upper in LOGIC:
            self.take()
            return Logic(upper, self.operand())
        if upper in ARITHMETIC:
            self.take()
            return Arith(upper, self.operand())
        if upper == "DELAY":
            self.take()
            word = self.address(bit=False)
            self.expect("VALUE")
            return Delay(word, self.value())
        if upper == "COUNT":
            self.take()
            word = self.address(bit=False)
            self.expect("VALUE")
            value = self.value()
            reset = None
            if self.upper() == "RESET":
                self.take()
                reset = self.item()
            return Count(word, value, reset)
        if upper == "SPEC":
            self.take()
            return self.spec()
        if self._is_bit(token):
            self.take()
            return Contact(parse_address(token))
        # Extension: a word comparison such as G1 GE 5.
        left = self.number_or_word()
        op = self.take().upper()
        if op not in COMPARISONS:
            raise self.error(f"{token} is not an element; expected a contact, AND, ADD, DELAY, COUNT …")
        return Compare(op, left, self.number_or_word())

    def spec(self) -> Spec:
        token = self.take().upper()
        number = SPECIAL_NUMBERS.get(token, token)
        if number not in SPEC_VALUE:
            if re.fullmatch(r"[ST]\d+", number):
                raise self.error(f"Special Function {number} is not emulated")
            raise self.error(f"{token} is not a Special Function; give its number (S12) or name (SQRT)")
        name = SPECIAL_NAMES[number]
        second = None
        if number.startswith("T"):
            if self.peek() != "[":
                raise self.error(f"{name} ({number}) needs its lower input in square brackets")
            second = self.operand()
        elif self.peek() == "[":
            raise self.error(f"{name} ({number}) has one input; only T functions take a second")
        value = None
        kind = SPEC_VALUE[number]
        if self.upper() == "VALUE":
            self.take()
            if kind == "none":
                raise self.error(f"{name} ({number}) takes no VALUE")
            value = self.number_or_word()
            if kind == "location" and not isinstance(value, Address):
                raise self.error(f"the VALUE after {name} must be a table address, such as G100")
            if kind == "ignored":
                value = None
        elif kind in ("location", "either"):
            raise self.error(f"{name} ({number}) needs a VALUE after it")
        return Spec(number, value, second)

    def value(self) -> Address | int:
        value = self.number_or_word()
        if isinstance(value, int) and not 0 <= value <= VALUE_MAX:
            raise self.error(f"VALUE must be 0 to {VALUE_MAX}, found {value}")
        return value

    def output(self) -> object:
        token = self.peek()
        if token is None:
            raise self.error("the output element is missing after '->'")
        upper = token.upper()
        if upper in ("SET", "RESET"):
            self.take()
            return Latch(self.address(bit=True), upper == "SET")
        if upper == "OUT":
            self.take()
            return Out(self.address(bit=False))
        if upper == "SEQR":
            self.take()
            address = self.address(bit=False)
            reset = None
            if self.upper() == "RESET":
                self.take()
                reset = self.item()
            return Seqr(address, reset)
        if upper == "BLOCK":
            self.take()
            return ObeyBlock()
        address = self.address(bit=None)
        if not address.is_bit:
            raise self.error(f"{token} is a word: use OUT {token}, or a bit such as {token}.0 for a COIL")
        return Coil(address)


_NAME_RE = re.compile(r"[A-Z][A-Z0-9_]{0,11}")
#: Words that cannot be mnemonics, as they mean something in a rung.
RESERVED = {
    "AND", "OR", "XOR", "NOT", "INV", "TRUE", "FALSE", "RISE", "FALL", "DELAY", "COUNT", "VALUE",
    "RESET", "SET", "SPEC", "OUT", "SEQR", "BLOCK", "END", "OBEY", "ADD", "SUB", "MULT", "DIV",
    "PRESET", "NAME", "MESSAGE", *COMPARISONS, *SPECIAL_NUMBERS,
}


def _number(token: str, line: int) -> int:
    try:
        value = int(token[1:], 16) if token.startswith("@") else int(token)
    except ValueError:
        raise ProgramError(f"{token!r} is not a number", line) from None
    if not -32768 <= value <= 0xFFFF:
        raise ProgramError(f"{token} does not fit in a 16-bit word", line)
    return to_signed(value)


_ESCAPES = {"n": "\r\n", "r": "\r", "l": "\n", "f": "\f", "e": "\x03", "\\": "\\", '"': '"'}


def unescape(text: str, line: int = 0) -> str:
    """Message text with its escapes: \\n a new line (CR LF), \\r CR, \\l LF,
    \\f form feed, \\e ETX (send the part line now), \\xHH any code."""
    out, i = [], 0
    while i < len(text):
        ch = text[i]
        if ch != "\\":
            out.append(ch)
            i += 1
            continue
        nxt = text[i + 1:i + 2]
        if nxt.isalpha():
            nxt = nxt.lower()  # a programmer keyboard has capitals only
        if nxt in _ESCAPES:
            out.append(_ESCAPES[nxt])
            i += 2
        elif nxt == "x" and re.fullmatch(r"[0-9A-Fa-f]{2}", text[i + 2:i + 4]):
            out.append(chr(int(text[i + 2:i + 4], 16)))
            i += 4
        else:
            raise ProgramError(f"unknown escape \\{nxt} in a MESSAGE", line)
    return "".join(out)


def pack_message(text: str, line: int = 0) -> list[int]:
    """Words for WRITEXT: the length in bits 0-7 of the first word and the
    first character in bits 8-15, then two characters a word, low byte first."""
    codes = [ord(c) for c in text]
    if len(codes) > 255:
        raise ProgramError("a MESSAGE holds at most 255 characters", line)
    if any(c > 0x7F for c in codes):
        raise ProgramError("a MESSAGE takes 7-bit ASCII characters only", line)
    data = [len(codes)] + codes + ([0] if len(codes) % 2 == 0 else [])
    return [to_signed(data[k] | (data[k + 1] << 8)) for k in range(0, len(data), 2)]


def _uncommented(raw: str) -> str:
    """A line without its comment, leaving a ; inside quotes alone."""
    quoted = False
    for i, ch in enumerate(raw):
        if ch == '"' and (i == 0 or raw[i - 1] != "\\"):
            quoted = not quoted
        elif ch == ";" and not quoted:
            return raw[:i]
    return raw


def _directive(program: Program, text: str, line: int) -> bool:
    """PRESET, MESSAGE and NAME lines; True if the line was one."""
    word, _, rest = text.partition(" ")
    word = word.upper()
    if word == "PRESET":
        target, eq, values = rest.partition("=")
        if not eq:
            raise ProgramError("PRESET needs '=': PRESET P1 = 20", line)
        try:
            start = parse_address(target)
        except AddressError as exc:
            raise ProgramError(str(exc), line) from None
        if start.is_bit:
            raise ProgramError("PRESET takes a word address, such as P1", line)
        numbers = values.replace(",", " ").split()
        if not numbers:
            raise ProgramError("PRESET needs at least one value", line)
        for k, token in enumerate(numbers):
            program.presets[Address(start.table, start.word + k)] = _number(token, line)
        return True
    if word == "MESSAGE":
        target, eq, text = rest.partition("=")
        text = text.strip()
        if not eq or len(text) < 2 or text[0] != '"' or text[-1] != '"':
            raise ProgramError('MESSAGE needs an address and quoted text: MESSAGE G100 = "FILL FAULT\\n"', line)
        try:
            start = parse_address(target)
        except AddressError as exc:
            raise ProgramError(str(exc), line) from None
        if start.is_bit:
            raise ProgramError("MESSAGE takes a word address, such as G100", line)
        words = pack_message(unescape(text[1:-1], line), line)
        for other, other_text in program.messages.items():
            size = len(pack_message(unescape(other_text)))
            if other.table == start.table and other.word < start.word + len(words) \
                    and start.word < other.word + size:
                end = Address(other.table, other.word + size)
                raise ProgramError(f"this MESSAGE overlaps the one at {other}, which ends before {end}"
                                   if other.word < start.word else
                                   f"this MESSAGE ({len(words)} words) runs into the one at {other}", line)
        for k, value in enumerate(words):
            program.presets[Address(start.table, start.word + k)] = value
        program.messages[start] = text[1:-1]
        return True
    if word == "NAME":
        parts = rest.split(None, 2)
        if len(parts) < 2:
            raise ProgramError("NAME needs an address and a mnemonic: NAME A0.0 START Start button", line)
        try:
            address = parse_address(parts[0])
        except AddressError as exc:
            raise ProgramError(str(exc), line) from None
        name = parts[1].upper()
        if not _NAME_RE.fullmatch(name) or name in RESERVED:
            raise ProgramError(f"{parts[1]!r} cannot be a mnemonic (letters and digits, "
                               "starting with a letter, and not a word the rungs use)", line)
        try:
            parse_address(name)
        except AddressError:
            pass
        else:
            raise ProgramError(f"{name} looks like an address, so it cannot be a mnemonic", line)
        if name in program.names and program.names[name] != address:
            raise ProgramError(f"{name} already names {program.names[name]}", line)
        program.names[name] = address
        program.notes[address] = (name, parts[2].strip() if len(parts) > 2 else "")
        return True
    return False


# --- editing presets in the program text -------------------------------------
# A programmer changes one preset word at a time; these keep the program text
# (which is what is saved) in step, changing the PRESET line that holds the
# word, or adding one.

def _preset_line(raw: str) -> tuple[Address, list[str]] | None:
    text = _uncommented(raw).strip()
    if text[:7].upper() != "PRESET ":
        return None
    target, eq, values = text[7:].partition("=")
    try:
        start = parse_address(target)
    except AddressError:
        return None
    return (start, values.replace(",", " ").split()) if eq else None


def _insert_directive(lines: list[str], line: str) -> list[str]:
    """After the last PRESET, MESSAGE or NAME line, or before the first rung."""
    last = None
    for i, raw in enumerate(lines):
        if _uncommented(raw).strip()[:7].upper() in ("PRESET ", "MESSAGE") or \
                _uncommented(raw).strip()[:5].upper() == "NAME ":
            last = i
    if last is not None:
        return lines[:last + 1] + [line] + lines[last + 1:]
    first = next((i for i, raw in enumerate(lines) if _uncommented(raw).strip()), len(lines))
    while first > 0 and lines[first - 1].strip().startswith(";"):
        first -= 1  # keep the first rung's title with it
    return lines[:first] + [line, ""] + lines[first:]


def set_preset(source: str, address: Address, value: int | None) -> str:
    """The program text with the preset for one word set (or, with None, removed)."""
    if address.is_bit:
        raise ProgramError("a preset is a whole word, such as R100")
    lines = source.split("\n")
    for i, raw in enumerate(lines):
        found = _preset_line(raw)
        if not found:
            continue
        start, values = found
        k = address.word - start.word
        if start.table != address.table or not 0 <= k < len(values):
            continue
        before, after = values[:k], values[k + 1:]
        new = []
        if before:
            new.append(f"PRESET {start} = {' '.join(before)}")
        if value is not None:
            if before or after:
                new = [f"PRESET {start} = {' '.join(before + [str(value)] + after)}"]
            else:
                new = [f"PRESET {address} = {value}"]
        elif after:
            new.append(f"PRESET {Address(address.table, address.word + 1)} = {' '.join(after)}")
        return "\n".join(lines[:i] + new + lines[i + 1:])
    if value is None:
        return source
    return "\n".join(_insert_directive(lines, f"PRESET {address} = {value}"))


def set_message(source: str, address: Address, text: str | None) -> str:
    """The program text with the MESSAGE starting at a word set (or removed)."""
    if text is not None:
        pack_message(unescape(text))  # check it
        if '"' in text.replace('\\"', ""):
            raise ProgramError('a " inside a MESSAGE is written \\"')
    lines = source.split("\n")
    line = None if text is None else f'MESSAGE {address} = "{text}"'
    for i, raw in enumerate(lines):
        words = _uncommented(raw).split("=", 1)[0].split()
        if len(words) == 2 and words[0].upper() == "MESSAGE":
            try:
                if parse_address(words[1]) == address:
                    return "\n".join(lines[:i] + ([line] if line else []) + lines[i + 1:])
            except AddressError:
                pass
    if line is None:
        return source
    return "\n".join(_insert_directive(lines, line))


def parse_program(source: str) -> Program:
    program = Program(source=source)
    comments: list[str] = []
    open_blocks: list[int] = []
    lines = source.splitlines()
    # Names first, so a rung may use a mnemonic defined further down.
    directives = set()
    for number, raw in enumerate(lines, start=1):
        text = _uncommented(raw).strip()
        if text[:5].upper() in ("PRESE", "NAME ", "MESSA") and _directive(program, text, number):
            directives.add(number)
    for number, raw in enumerate(lines, start=1):
        if number in directives:
            continue
        text, _, note = raw.partition(";")
        text = text.strip()
        if not text:
            # Comment lines directly above a rung become its title; a blank line resets.
            comments = comments + [note.strip()] if note.strip() else []
            continue
        title = " ".join(comments) or note.strip()
        comments = []
        if text.upper() in ("END BLOCK", "BLOCK", "END"):
            if not open_blocks:
                raise ProgramError("END BLOCK without an OBEY BLOCK above it", number)
            start = open_blocks.pop()
            program.rungs[start] = _with_end(program.rungs[start], len(program.rungs))
            program.rungs.append(Rung(None, EndBlock(), number, raw.strip(), title))
            continue
        tokens = _TOKEN_RE.findall(text)
        if program.names:
            tokens = [str(program.names.get(t.upper(), t)) for t in tokens]
        if "->" not in tokens:
            raise ProgramError("a rung needs '->' before its output element", number)
        parser = _Parser(tokens, number)
        condition = None if parser.peek() == "->" else parser.condition()
        parser.expect("->")
        output = parser.output()
        if parser.peek() is not None:
            extra = parser.peek()
            hint = " (a rung has one output element)" if extra == "," else ""
            raise ProgramError(f"unexpected {extra!r}{hint}", number)
        if isinstance(output, ObeyBlock):
            if condition is None:
                raise ProgramError("an OBEY BLOCK needs a condition; use END BLOCK to close a block", number)
            open_blocks.append(len(program.rungs))
        program.rungs.append(Rung(condition, output, number, raw.strip(), title))
    if open_blocks:
        raise ProgramError("OBEY BLOCK without a matching END BLOCK", program.rungs[open_blocks[-1]].line)
    return program


def instruction_count(program: Program) -> int:
    """Roughly how many instructions the program takes in the controller.

    From T278 Table 3: one per element, one more for the VALUE of a DELAY,
    COUNT or Special Function, two for each branch opened and one for each
    branch closed.
    """
    return sum(rung_instructions(rung) for rung in program.rungs)


def instruction_ranges(program: Program) -> list[tuple[int, int]]:
    """Where each rung sits in the controller's store, as first and last
    instruction numbers (counting from 0), as a programmer reports it."""
    ranges, at = [], 0
    for rung in program.rungs:
        size = rung_instructions(rung)
        ranges.append((at, at + size - 1))
        at += size
    return ranges


def rung_instructions(rung: Rung) -> int:
    """The instructions one rung takes; see ``instruction_count``."""

    def size(node: object) -> int:
        if node is None:
            return 0
        if isinstance(node, Series):
            return sum(size(item) for item in node.items)
        if isinstance(node, Parallel):
            return sum(size(item) for item in node.items) + 3 * (len(node.items) - 1)
        count = 1
        if isinstance(node, (Delay, Count)) or (isinstance(node, Spec) and node.value is not None):
            count += 1
        if isinstance(node, Count):
            count += size(node.reset) + (3 if node.reset is not None else 0)
        operand = getattr(node, "operand", None) or getattr(node, "second", None)
        if isinstance(operand, Branch):
            count += size(operand.node) + 3
        return count

    total = size(rung.condition) + 1
    if isinstance(rung.output, Seqr) and rung.output.reset is not None:
        total += size(rung.output.reset) + 3
    return total


def _with_end(rung: Rung, end: int) -> Rung:
    return Rung(rung.condition, rung.output, rung.line, rung.source, rung.comment, end)


__all__ = [
    "Arith", "Branch", "Coil", "Compare", "Constant", "Contact", "Count", "Delay", "Edge",
    "EndBlock", "Inv", "Latch", "Logic", "ObeyBlock", "Out", "Parallel", "Program",
    "ProgramError", "Rung", "Seqr", "Series", "Spec", "SPEC_VALUE", "instruction_count", "ARITHMETIC", "COMPARISONS", "LOGIC", "RAIL",
    "SPECIAL", "VALUE_MAX", "addresses", "clamp16", "instruction_ranges", "parse_program",
    "rung_instructions", "rung_to_json",
    "to_signed", "walk",
]
