"""Ladder print-outs: the program drawn as text, as a GEM 80 programmer prints
it, and the way back from such a print-out to a program.

The drawing follows the GEM 80 manual (T391) and the 8920 Portable
Programmer screen (T208, Figure 7): each element's symbol on one line with its
address on the line below, parallel branches hanging from ``+`` joined by
``!``, the left rail down the left. A lower branch that is a second input
(the RESET of a COUNT or SEQR, or the lower input of a T Special Function)
rises into the rung line just before its element; a parallel branch joins at
a ``+``.

``read_printout`` turns such a drawing back into program text. It accepts
this module's own print-outs, the screen layout of the 8920 (``-DELAY----VALUE-``
without the angle brackets, ``|`` or ``:`` for the verticals, slashed zeros),
and comment, heading and blank lines between rungs.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .models import SPECIAL_NAMES
from .program import (Program, addresses, instruction_ranges, pack_message, parse_program,
                      rung_to_json, unescape)
from .tables import Address

CELL = 8


# --- drawing -------------------------------------------------------------------

def _leaf(n: dict) -> tuple[str, str]:
    t = n["t"]

    def opnd(a):
        return None if isinstance(a, dict) else a

    if t == "contact":
        return ("]/[" if n["nc"] else "] [", n["addr"])
    if t == "edge":
        return ("]^[" if n["rising"] else "]v[", n["addr"])
    if t == "const":
        return ("", "")
    if t == "cmp":
        return (f"<{n['op']}>", f"{opnd(n['left']) or ''} {opnd(n['right']) or ''}")
    if t == "inv":
        return ("<INV>", "")
    if t in ("logic", "arith"):
        a = opnd(n["arg"])
        if n.get("spec"):
            return ("SPEC.", n["spec"] + (" " + a if a is not None else ""))
        return (f"<{n['op']}>", a or "")
    if t == "spec":
        if n["value"] is not None:
            return ("SPEC.--VALUE", f"{n['num']}".ljust(7) + n["value"])
        return ("SPEC.", n["num"])
    if t == "delay":
        return ("<DELAY>--VALUE", n["word"].ljust(9) + n["value"])
    if t == "count":
        return ("<COUNT>--VALUE", n["word"].ljust(9) + n["value"])
    return ("?", "")


def _branch_of(n: dict) -> dict | None:
    if n["t"] == "count":
        return n.get("reset")
    if n["t"] in ("logic", "arith", "spec") and isinstance(n.get("arg"), dict):
        return n["arg"]
    return None


_OUTPUT_SYMBOLS = {"coil": "( )", "out": "<OUT>", "seqr": "<SEQR>", "block": "<OBEY BLOCK>", "end": "END OF BLOCK",
        "set": "(L)", "reset": "(U)"}


def draw_rung(rung: dict) -> list[str]:
    """The rung as lines of text (the same drawing as the 8920 screen)."""

    def width(n):
        sym, addr = _leaf(n)
        return max(CELL, len(sym) + 4, len(addr) + 4)

    def measure(n):
        if not n:
            return (0, 1)
        if n["t"] == "series":
            ms = [measure(i) for i in n["items"]]
            return (sum(m[0] for m in ms), max([1] + [m[1] for m in ms]))
        if n["t"] == "parallel":
            ms = [measure(i) for i in n["items"]]
            return (max(m[0] for m in ms) + 2, sum(m[1] for m in ms))
        b = _branch_of(n)
        if b:
            bw, bh = measure(b)
            return (bw + 2 + width(n), 1 + bh)
        return (width(n), 1)

    cond = rung.get("condition")
    out = rung.get("output") or {}
    mw, mh = measure(cond)
    osym = _OUTPUT_SYMBOLS.get(out.get("t"), "")
    ow = len(osym) + 5
    reset = out.get("reset") if out.get("t") == "seqr" else None
    rw, rh = measure(reset) if reset else (0, 0)
    W = max(1 + mw + ow, 1 + rw + ow + 2, 2 * CELL)
    rows = mh + rh
    grid = [[" "] * W for _ in range(rows * 2)]

    def put(line, x, text):
        for k, ch in enumerate(text):
            if 0 <= x + k < W and 0 <= line < len(grid):
                grid[line][x + k] = ch

    def vline(x, top, bottom):
        for line in range(top * 2 + 1, bottom * 2):
            put(line, x, "!")
        put(bottom * 2, x, "+")

    def draw(n, x, y, w):
        if not n:
            put(y * 2, x, "-" * w)
            return
        if n["t"] == "series":
            ms = [measure(i)[0] for i in n["items"]]
            total, cx = sum(ms), x
            for k, item in enumerate(n["items"]):
                iw = ms[k] + (w - total if k == len(n["items"]) - 1 else 0)
                draw(item, cx, y, iw)
                cx += iw
            return
        if n["t"] == "parallel":
            row, starts = y, []
            left, right = (0 if x == 1 else x), x + w - 1
            for item in n["items"]:
                starts.append(row)
                put(row * 2, x, "-")
                draw(item, x + 1, row, w - 2)
                row += measure(item)[1]
            vline(left, y, starts[-1])
            vline(right, y, starts[-1])
            for r in starts:
                put(r * 2, left, "+")
                put(r * 2, right, "+")
            return
        sym, addr = _leaf(n)
        ex = x
        b = _branch_of(n)
        if b:
            bw, _ = measure(b)
            put(y * 2, x, "-" * (bw + 2))
            draw(b, x, y + 1, bw + 1)
            vline(x + bw + 1, y, y + 1)
            lx = x - 1
            while lx > 0 and grid[(y + 1) * 2][lx] == " ":
                put((y + 1) * 2, lx, "-")
                lx -= 1
            if lx == 0:
                put((y + 1) * 2, 0, "+")
            ex = x + bw + 2
        ew = w - (ex - x)
        put(y * 2, ex, "--" + sym + "-" * max(0, ew - 2 - len(sym)))
        put(y * 2 + 1, ex + 2, str(addr)[: max(0, ew - 2)])

    for line in range(rows * 2):
        put(line, 0, "+" if line == 0 else "!")
    if cond:
        draw(cond, 1, 0, mw)
    ox = W - ow
    put(0, 1 + mw, "-" * max(0, ox - 1 - mw))
    if reset:
        draw(reset, 1, mh, ox - 1)
        vline(ox, 0, mh)
        put(mh * 2, 0, "+")
    put(0, ox, "--" + osym + "--+")
    put(1, ox + 2, (out.get("addr") or "")[: ow - 3])
    for line in range(1, rows * 2):
        put(line, W - 1, "!")
    return ["".join(r).rstrip() for r in grid]


def print_program(program: Program, title: str = "", model: str = "") -> str:
    """A print-out of the whole program: the rungs, the presets and the names,
    with a cross-reference of the addresses each rung uses."""
    out: list[str] = []
    if title or model:
        out += [f"{title}  {model}".strip(), ""]
    for address, (name, note) in sorted(program.notes.items(), key=lambda kv: _addr_key(kv[0])):
        out.append(f"NAME {address} {name} {note}".rstrip())
    if program.notes:
        out.append("")
    ranges = instruction_ranges(program)
    block = 0
    blocks: list[int] = []
    for i, rung in enumerate(program.rungs):
        data = rung_to_json(rung)
        first, last = ranges[i]
        head = f"RUNG {i + 1}   INSTRUCTIONS {first} TO {last}"
        if data["output"]["t"] == "block":
            block += 1
            blocks.append(block)
            head += f"   START OF BLOCK {block}"
        elif data["output"]["t"] == "end":
            head += f"   END OF BLOCK {blocks.pop() if blocks else ''}".rstrip()
        out.append(head)
        for line in (rung.comment or "").split("\n"):
            if line.strip():
                out.append("; " + line.strip())
        out += draw_rung(data)
        out.append("")
    used: dict[Address, set[int]] = {}
    for i, rung in enumerate(program.rungs):
        for address in addresses(rung):
            used.setdefault(address, set()).add(i + 1)
    if used:
        out.append("CROSS REFERENCE")
        for address in sorted(used, key=_addr_key):
            name = program.notes.get(address, ("", ""))[0]
            rungs = ", ".join(str(n) for n in sorted(used[address]))
            out.append(f"  {str(address):<8}{name:<8} RUNGS {rungs}")
        out.append("")
    covered = {
        Address(start.table, start.word + k)
        for start, text in program.messages.items()
        for k in range(len(pack_message(unescape(text))))
    }
    presets = {a: v for a, v in program.presets.items() if a not in covered}
    if presets or program.messages:
        out.append("PRESET DATA")
        for address, text in sorted(program.messages.items(), key=lambda kv: _addr_key(kv[0])):
            out.append(f'MESSAGE {address} = "{text}"')
        for address, value in sorted(presets.items(), key=lambda kv: _addr_key(kv[0])):
            out.append(f"PRESET {address} = {value}")
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def _addr_key(address):
    return (address.table, address.word, -1 if address.bit is None else address.bit)


# --- reading a print-out back -------------------------------------------------

class PrintoutError(ValueError):
    pass


_ELEMENT_RE = re.compile(
    r"\]\s?\[|\]/\[|\]\^\[|\]v\[|\(\s?\)|\(L\)|\(U\)|<?OBEY\s?BLOCK>?|END OF BLOCK"
    r"|<?(?:DELAY|COUNT|VALUE|AND|OR|XOR|ADD|SUB|INV|OUT|SEQR|EQ|NE|GT|LT|GE|LE)>?"
    r"|SPEC\.?"
)
_WIRE = set("-.=")
_OUTPUTS = {"()", "(L)", "(U)", "OUT", "SEQR", "OBEYBLOCK", "ENDOFBLOCK"}
_WORDS = {"AND", "OR", "XOR", "ADD", "SUB", "INV", "DELAY", "COUNT", "SPEC"}
_RAIL = ("rail",)
_OUT = ("out",)


@dataclass
class _Element:
    kind: str  # the symbol, normalised: "][", "]/[", "DELAY", "SPEC", "()" ...
    col: int
    end: int
    words: list[str] = field(default_factory=list)  # what is written under it
    value: str | None = None  # the VALUE operand of a DELAY, COUNT or SPEC
    second: object = None  # node of the lower branch feeding it, if any


@dataclass
class _Segment:
    start: object
    end: object
    elements: list[_Element]
    row: int
    col: int


def _normalise(line: str) -> str:
    line = line.replace("\t", "    ").replace("Ø", "0").replace("ø", "0")
    return re.sub(r"[|¦]", "!", line.rstrip())


def _is_symbol_line(line: str) -> bool:
    return bool(re.search(r"[-.=]{2}|\+[-.]|[-.]\+", line))


def _words_under(line: str, start: int, stop: int) -> list[str]:
    return [m.group() for m in re.finditer(r"[^\s!+]+", line) if start - 1 <= m.start() < stop]


def _join(parts: list[tuple[str, bool]]) -> tuple[str, bool]:
    """Series elements: a word element follows with a space, a contact with AND."""
    text, first_word = "", False
    for k, (part, word) in enumerate(parts):
        if not part:
            continue
        if not text:
            text, first_word = part, word
        else:
            text += (" " if word else " AND ") + part
    return text, first_word


def _paren(text: str) -> str:
    return text if re.fullmatch(r"[^\s()]+|\(.*\)", text) and text.count("(") == text.count(")") and not (
        text.startswith("(") and _closes_early(text)) else f"({text})"


def _closes_early(text: str) -> bool:
    depth = 0
    for k, ch in enumerate(text):
        depth += ch == "("
        depth -= ch == ")"
        if depth == 0 and k < len(text) - 1:
            return True
    return False



def _branch(text: str) -> str:
    """Bracket one parallel branch unless it is a single element or group."""
    if " " not in text or text.startswith("NOT ") and " " not in text[4:]:
        return text
    if text.startswith("(") and text.endswith(")"):
        depth = 0
        for i, ch in enumerate(text):
            depth += ch == "("
            depth -= ch == ")"
            if depth == 0 and i < len(text) - 1:
                break
        else:
            return text
    return f"({text})"

class _Rung:
    def __init__(self, lines: list[str]) -> None:
        width = max(len(l) for l in lines)
        self.grid = [l.ljust(width + 1) for l in lines]
        self.width = width + 1
        self.rows = [r for r, l in enumerate(self.grid) if _is_symbol_line(l) and l[:1] in "+!-"]
        if not self.rows or self.rows[0] != 0:
            raise PrintoutError("a rung should start with its top line")
        self.parent: dict = {}
        self._nodes()
        self._elements()
        self._segments()

    # nodes: every + on a rung line, joined down columns of ! (and the rail)
    def find(self, p):
        self.parent.setdefault(p, p)
        while self.parent[p] != p:
            self.parent[p] = self.parent[self.parent[p]]
            p = self.parent[p]
        return p

    def union(self, p, q):
        self.parent[self.find(p)] = self.find(q)

    def _nodes(self):
        g = self.grid
        self.taps: dict[tuple[int, int], tuple[int, int]] = {}
        for r in self.rows:
            for c, ch in enumerate(g[r]):
                if ch != "+":
                    continue
                self.find((r, c))
                if c == 0:
                    self.union((r, c), _RAIL)
                k = r - 1
                while k >= 0 and g[k][c] == "!":
                    k -= 1
                if k < 0 or k == r - 1:
                    continue
                if g[k][c] == "+":
                    self.union((r, c), (k, c))
                elif g[k][c] in _WIRE and k in self.rows:
                    self.taps[(k, c)] = (r, c)  # a lower input rises into the line above

    def _elements(self):
        g = self.grid
        self.elements: dict[int, list[_Element]] = {}
        for r in self.rows:
            below = g[r + 1] if r + 1 < len(g) and r + 1 not in self.rows else ""
            found = [_Element(re.sub(r"[<>\s.]", "", m.group()).upper(), m.start(), m.end())
                     for m in _ELEMENT_RE.finditer(g[r])]
            for k, e in enumerate(found):
                stop = found[k + 1].col if k + 1 < len(found) else e.end + 12
                e.words = _words_under(below, e.col, stop)
            merged: list[_Element] = []
            for e in found:
                if e.kind == "VALUE":
                    if not merged or merged[-1].kind not in ("DELAY", "COUNT", "SPEC"):
                        raise PrintoutError("VALUE with no DELAY, COUNT or SPEC before it")
                    merged[-1].value = e.words[0] if e.words else None
                    merged[-1].end = e.end
                else:
                    merged.append(e)
            self.elements[r] = merged
        for (r, c), plus in self.taps.items():
            target = next((e for e in self.elements[r] if e.col > c), None)
            if target is None:
                raise PrintoutError("a lower branch rises into the rung after its last element")
            target.second = plus
        top = self.elements[0]
        self.output = next((e for e in top if e.kind in _OUTPUTS), None)
        if self.output is None:
            raise PrintoutError("no output element (COIL, OUT, SEQR or BLOCK) on the top line")

    def _segments(self):
        g = self.grid
        raw: list[tuple[object, object, list[_Element], int, int]] = []
        for r in self.rows:
            line = g[r]
            els = {e.col: e for e in self.elements[r]}
            start = (r, 0) if line[0] == "+" or r == 0 else None
            if r == 0:
                self.union((0, 0), _RAIL)
            seg: list[_Element] = []
            seg_col = 0
            c = 1
            while c < self.width:
                ch = line[c]
                if c in els:
                    e = els[c]
                    if start is None:
                        raise PrintoutError(f"an element at column {c + 1} is not wired to anything on its left")
                    if e is self.output:
                        raw.append((start, _OUT, seg, r, seg_col))
                        start = None
                        break
                    seg.append(e)
                    c = e.end
                    continue
                if ch == "+":
                    if start is not None:
                        raw.append((start, (r, c), seg, r, seg_col))
                    start, seg, seg_col = (r, c), [], c
                elif ch == " ":
                    if seg:
                        raise PrintoutError("a branch stops short of a junction")
                    start = None
                c += 1
        # A bare wire between two junctions makes them one node.
        for a, b, seg, _, _ in raw:
            if not seg and b is not _OUT:
                self.union(a, b)
        self.segments = []
        for a, b, seg, r, col in raw:
            a = self.find(a)
            b = b if b is _OUT else self.find(b)
            if seg or b is _OUT or a != b:
                if seg or b is _OUT or a != b:
                    if not seg and b is not _OUT:
                        continue
                    self.segments.append(_Segment(a, b, seg, r, col))

    # turning the network into text
    def text(self) -> str:
        cond = self.reduce(self.find(_RAIL), _OUT)
        out = self.element_text(self.output)[0]
        if self.output.kind == "ENDOFBLOCK":
            return "END BLOCK"
        return f"{cond} -> {out}" if cond else f"-> {out}"

    def reduce(self, src, dst) -> str:
        # The segments that lead to dst, and no further.
        wanted, frontier = set(), {dst}
        while frontier:
            node = frontier.pop()
            for k, s in enumerate(self.segments):
                if s.end == node and k not in wanted:
                    wanted.add(k)
                    frontier.add(s.start)
        edges = []
        for k in sorted(wanted, key=lambda k: (self.segments[k].row, self.segments[k].col)):
            s = self.segments[k]
            edges.append([s.start, s.end, *_join([self.element_text(e) for e in s.elements]), s.row])
        changed = True
        while changed and not (len(edges) == 1 and edges[0][0] == src and edges[0][1] == dst):
            changed = False
            groups: dict = {}
            for e in edges:
                groups.setdefault((e[0], e[1]), []).append(e)
            for (a, b), group in groups.items():
                if len(group) > 1:
                    group.sort(key=lambda g: g[4])
                    text = "(" + " OR ".join(_branch(g[2] or "TRUE") for g in group) + ")"
                    for g in group:
                        edges.remove(g)
                    edges.append([a, b, text, False, min(g[4] for g in group)])
                    changed = True
                    break
            if changed:
                continue
            for node in {e[1] for e in edges} - {src, dst}:
                ins = [e for e in edges if e[1] == node]
                outs = [e for e in edges if e[0] == node]
                if len(ins) == 1 and len(outs) == 1:
                    i, o = ins[0], outs[0]
                    text, word = _join([(i[2], i[3]), (o[2], o[3])])
                    edges.remove(i)
                    edges.remove(o)
                    edges.append([i[0], o[1], text, word, i[4]])
                    changed = True
                    break
        if len(edges) == 1 and edges[0][0] == src and edges[0][1] == dst:
            return edges[0][2]
        if not edges and src == dst:
            return ""
        raise PrintoutError("the rung's branches cannot be read as series and parallel wiring")

    def element_text(self, e: _Element) -> tuple[str, bool]:
        w = e.words
        first = w[0] if w else ""
        second = None
        if e.second is not None:
            second = self.reduce(self.find(_RAIL), self.find(e.second)) or "TRUE"
        k = e.kind
        if k == "][":
            return first, False
        if k == "]/[":
            return f"NOT {first}", False
        if k == "]^[":
            return f"RISE {first}", False
        if k == "]v[":
            return f"FALL {first}", False
        if k in ("AND", "OR", "XOR", "ADD", "SUB"):
            return f"{k} " + (f"[{second}]" if second else first), True
        if k == "INV":
            return "INV", True
        if k in ("EQ", "NE", "GT", "LT", "GE", "LE"):
            return f"{first} {k} {w[1] if len(w) > 1 else ''}".strip(), False
        if k == "DELAY":
            return f"DELAY {first} VALUE {e.value}", True
        if k == "COUNT":
            return f"COUNT {first} VALUE {e.value}" + (f" RESET {_paren(second)}" if second else ""), True
        if k == "SPEC":
            num = first
            if e.value is None and num in ("T10", "T11"):
                op = "MULT" if num == "T10" else "DIV"
                return f"{op} " + (f"[{second}]" if second else (w[1] if len(w) > 1 else "")), True
            text = f"SPEC {SPECIAL_NAMES.get(num, num)}" + (f" [{second}]" if second else "")
            return text + (f" VALUE {e.value}" if e.value is not None else ""), True
        if k == "()":
            return first, False
        if k == "(L)":
            return f"SET {first}", False
        if k == "(U)":
            return f"RESET {first}", False
        if k == "OUT":
            return f"OUT {first}", False
        if k == "SEQR":
            return f"SEQR {first}" + (f" RESET {_paren(second)}" if second else ""), False
        if k == "OBEYBLOCK":
            return "BLOCK", False
        return k, False


def read_printout(text: str) -> str:
    """Program text from a ladder print-out (see the module notes). Comment
    lines (starting ;) and NAME, PRESET and MESSAGE lines are kept; headings and other
    text between rungs are left out. Raises PrintoutError for a rung it
    cannot follow, naming the line it starts on."""
    lines = text.splitlines()
    out: list[str] = []
    k = 0
    while k < len(lines):
        line = _normalise(lines[k])
        stripped = line.strip()
        if line.startswith("+") and _is_symbol_line(line):
            start = k
            rung = [line]
            k += 1
            while k < len(lines) and _normalise(lines[k])[:1] in ("!", "+"):
                rung.append(_normalise(lines[k]))
                k += 1
            try:
                out.append(_Rung(rung).text())
            except PrintoutError as exc:
                raise PrintoutError(f"line {start + 1}: {exc}") from None
            continue
        if stripped.startswith(";"):
            out.append(stripped)
        elif re.match(r"(?i)(PRESET\s+[A-Z]\d|NAME\s+[A-Z]\d|MESSAGE\s+[A-Z]\d)", stripped):
            out.append(stripped)
        elif not stripped and out and out[-1] != "":
            out.append("")
        k += 1
    source = "\n".join(out).strip() + "\n"
    parse_program(source)  # check it reads as a program
    return source
