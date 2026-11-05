"""Port 1 of a GEM 80/130C used as a printer port, with its printer.

What the documents say, and where:

* The 130C and 130CE have a port that is a printer port or a tributary port,
  "user adjustable by preset data", and the power must be switched off and on
  after changing between the two (T278, Table 5). The 130C 12K also takes
  "individual characters from serial keyboard"; the 6K prints only.
* Early ports (the 130 6K) send complete lines only; later ones (the 130 12K
  and the 225/235/245) also send part lines up to an ETX character (@3), and
  put a character typed on a serial keyboard in J0, one per program scan,
  each one over the last (Serial Links manual T418, 6.1 and 6.3).
* The port's preset data, its buffer and its flag are given for the
  225/235/245 (T247 8.3 and T419 Table 2.6), which T418 puts in the same
  generation as the 130 12K. The emulator uses them for the 130C too:

  ====  ===============================================================
  P5    negative: port 1 is a printer port (zero or more: tributary)
  P2    NUL characters added to each line, for a slow printer (0 to 127)
  P3    characters a line, to suit the printer (1 to 125)
  P4    bit/s, the same for output and input: 110, 300, 600, 1200,
        2400, 4800 or 9600 (zero: the port is not in use)
  ====  ===============================================================

  The output buffer holds 255 characters, and E0.8 is ON while it is more
  than two thirds full. Characters go out as 1 start bit, 7 data bits, even
  parity and 2 stop bits (11 bits each) on a 20 mA current loop.

A current loop has no handshake, so what the port sends while the printer is
off line is lost. The emulator reads the port's preset data at power on
(when it starts, and at ``Controller.power_cycle``) and also when it goes
from Halt to Run.
"""

from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass

from .tables import Address, to_signed

BUFFER_SIZE = 255
FULL_FLAG = Address("E", 0, 8)  # ON while the buffer is more than 2/3 full
FULL_AT = BUFFER_SIZE * 2 // 3
MAX_LINE = 125
MAX_PADDING = 127
RATES = (110, 300, 600, 1200, 2400, 4800, 9600)
BITS_PER_CHARACTER = 11
KEPT_LINES = 200  # how much paper the emulator keeps

SETUP_WORDS = (2, 3, 4, 5)  # P2 to P5
NUL, ETX, LF, FF, CR = 0, 3, 10, 12, 13
LINE_ENDS = (CR, LF, FF)


@dataclass(frozen=True)
class PortSetup:
    """Port 1 as its preset data (P2 to P5) sets it up."""

    printer: bool = False  # P5 < 0
    padding: int = 0  # P2
    line: int = 0  # P3
    rate: int = 0  # P4
    problem: str = ""  # why the printer port cannot work, if it cannot

    @property
    def working(self) -> bool:
        return self.printer and not self.problem


def read_setup(tables) -> PortSetup:
    """The port setup from P2 to P5 (all zero on a new controller: a tributary port)."""
    if "P" not in tables.letters or tables.size("P") <= max(SETUP_WORDS):
        return PortSetup(problem="there is no P2 to P5")
    p2, p3, p4, p5 = (to_signed(tables.get_word(Address("P", w))) for w in SETUP_WORDS)
    if p5 >= 0:
        return PortSetup(problem="P5 is not negative, so port 1 is a tributary port")
    problem = ""
    if not 0 <= p2 <= MAX_PADDING:
        problem = f"P2 (padding) is {p2}; it must be 0 to {MAX_PADDING}"
    elif not 1 <= p3 <= MAX_LINE:
        problem = f"P3 (characters a line) is {p3}; it must be 1 to {MAX_LINE}"
    elif p4 == 0:
        problem = "P4 (bit/s) is 0, so the port is not in use"
    elif p4 not in RATES:
        problem = f"P4 (bit/s) is {p4}; it must be one of {', '.join(map(str, RATES))}"
    return PortSetup(True, p2, p3, p4, problem)


class Printer:
    def __init__(self, part_lines: bool = True, keyboard: bool = True) -> None:
        self.part_lines = part_lines  # ETX sends a part line (130 12K, not 6K)
        self.keyboard = keyboard  # characters typed reach J0 (130 12K only)
        self.setup = PortSetup()
        self.buffer: deque[int] = deque()
        self.line: list[str] = []  # the line on the print head
        self.paper: deque[str] = deque(maxlen=KEPT_LINES)
        self.printed = 0  # lines printed since power on
        self.lost = 0  # characters sent while the printer was off line
        self.on_line = True
        self._credit = 0.0  # character times the port has had so far
        self._pending = 0  # characters ready to send: complete lines, or up to an ETX
        self._column = 0  # characters sent on the current line
        self._after_cr = False
        self._keys: deque[int] = deque()  # typed, not yet sent by the keyboard
        self._key_credit = 0.0
        self._arrived: int | None = None  # the last character received since the last scan
        self.listeners: list = []  # called with each line as it is printed

    # --- set-up --------------------------------------------------------------

    def configure(self, tables) -> PortSetup:
        """Read P2 to P5 (power on, or Halt to Run)."""
        self.setup = read_setup(tables)
        if not self.setup.working:
            self.clear()
            self._keys.clear()
        self._mark_ready()
        return self.setup

    def changed(self, tables) -> bool:
        """True if P2 to P5 no longer match the setup in use."""
        return read_setup(tables) != self.setup

    # --- the program side ---------------------------------------------------

    def room(self) -> int:
        return BUFFER_SIZE - len(self.buffer)

    def put(self, codes: list[int]) -> bool:
        """Queue characters; False (and nothing queued) if they do not fit."""
        if len(codes) > self.room():
            return False
        self.buffer.extend(c & 0x7F for c in codes)
        self._mark_ready()
        return True

    def _mark_ready(self) -> None:
        # Characters up to the last line end are ready to go, and so is a line
        # that has reached the printer's width; an ETX sends a part line.
        ready, column = 0, self._column
        width = self.setup.line or MAX_LINE
        for i, code in enumerate(self.buffer):
            if code in LINE_ENDS or (code == ETX and self.part_lines):
                ready, column = i + 1, 0
            elif code >= 32:
                column += 1
                if column >= width:
                    ready, column = i + 1, 0
        self._pending = ready

    # --- the port side ------------------------------------------------------

    def tick(self, dt_ms: int) -> None:
        if not self.setup.working:
            self._credit = self._key_credit = 0.0
            return
        per_ms = self.setup.rate / BITS_PER_CHARACTER / 1000
        self._receive(dt_ms * per_ms)
        if not self._pending:
            self._credit = 0.0
            return
        self._credit += dt_ms * per_ms
        while self._pending and self._credit >= 1:
            self._credit -= 1
            self._pending -= 1
            self._send(self.buffer.popleft())

    def _send(self, code: int) -> None:
        after_cr, self._after_cr = self._after_cr, code == CR
        if code in LINE_ENDS:
            if code != LF or not after_cr:  # CR LF is one line end
                self._feed()
            self._credit -= self.setup.padding  # the NULs after each line
        elif code >= 32:
            self._print(chr(code))
            self._column += 1
            if self._column >= self.setup.line:
                self._credit -= 2 + self.setup.padding  # the port's own CR LF
                self._feed()
        elif code == 8 and self.line and self.on_line:  # backspace
            self.line.pop()

    def _print(self, ch: str) -> None:
        if self.on_line:
            self.line.append(ch)
        else:
            self.lost += 1

    def _feed(self) -> None:
        self._column = 0
        if not self.on_line:
            return
        text = "".join(self.line)
        self.line = []
        self.paper.append(text)
        self.printed += 1
        for listener in list(self.listeners):
            listener(text)

    # --- the keyboard ----------------------------------------------------------

    def type(self, text: str) -> int:
        """Characters typed on the serial keyboard; how many were taken."""
        if not (self.keyboard and self.setup.working):
            return 0
        codes = [ord(c) & 0x7F for c in text if ord(c) < 128]
        self._keys.extend(codes)
        return len(codes)

    def _receive(self, characters: float) -> None:
        if not self._keys:
            self._key_credit = 0.0
            return
        self._key_credit += characters
        while self._keys and self._key_credit >= 1:
            self._key_credit -= 1
            self._arrived = self._keys.popleft()  # each one over the last

    def received(self) -> int | None:
        """The character for J0 at this scan, if one has come in since the last."""
        code, self._arrived = self._arrived, None
        return code

    # --- flags and the panel ----------------------------------------------------

    def flags(self, tables) -> None:
        if FULL_FLAG.table in tables.letters:
            tables.set_bit(FULL_FLAG, len(self.buffer) > FULL_AT)

    def tear_off(self) -> None:
        self.paper.clear()

    def clear(self) -> None:
        self.buffer.clear()
        self._pending = 0
        self._column = 0
        self.line = []

    def snapshot(self, recent: int | None = 20) -> dict:
        """The port's state and the last few lines; ``recent=None`` for all the paper."""
        lines = list(self.paper)
        return {
            "lines": lines if recent is None else lines[-recent:],
            "head": "".join(self.line),
            "printed": self.printed,
            "lost": self.lost,
            "buffered": len(self.buffer),
            "size": BUFFER_SIZE,
            "on_line": self.on_line,
            "keyboard": self.keyboard,
            "part_lines": self.part_lines,
            "setup": asdict(self.setup),
        }
