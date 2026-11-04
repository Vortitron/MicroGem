"""The printer on a GEM 80/130C printer port, and its buffer.

From the GEM 80 Serial Links manual (T418, section 6): the user program puts
messages in a printer buffer with Special Functions (S22 WRITEXT and S23
WRINUM on the 130), and the port sends the buffer to the printer on its own.
Normally only complete lines are sent; an ETX character (@3) in a message sends
what is there even if the line is not complete. NUL characters fill the
unused half of a word and print nothing. The 130 port sends 7-bit ASCII with
even parity and two stop bits: 11 bits a character.

The buffer size, the baud rate and where the flags go are not in the
documents we have, so they are the emulator's choice and kept in one place
here: a 512-character buffer at 1200 bit/s, and the flags in F50 (on the
GEM 80/131 the programmer/printer port's flags are F50.0 printer off line and
F50.1 buffer not available; the 130C is assumed to be the same).
"""

from __future__ import annotations

from collections import deque

from .tables import Address

BUFFER_SIZE = 512
LINE_LENGTH = 80  # "room for one complete line"
BAUD = 1200
BITS_PER_CHARACTER = 11
KEPT_LINES = 200  # how much paper the emulator keeps

FLAG_WORD = Address("F", 50)
OFF_LINE = 0  # F50.0
FILLING = 1  # F50.1: no room for a complete line
EMPTY = 2  # F50.2: everything sent (the emulator's own flag)

NUL, ETX, LF, FF, CR = 0, 3, 10, 12, 13


class Printer:
    def __init__(self) -> None:
        self.buffer: deque[int] = deque()
        self.line: list[str] = []  # the line on the print head
        self.paper: deque[str] = deque(maxlen=KEPT_LINES)
        self.printed = 0  # lines printed since power on
        self.on_line = True
        self._credit = 0.0  # characters the port could have sent so far
        self._pending = 0  # characters of a complete line, or forced by ETX, ready to send
        self._after_cr = False
        self.listeners: list = []  # called with each line as it is printed

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
        # Characters up to the last line end or ETX are ready to go.
        ready = 0
        for i, code in enumerate(self.buffer):
            if code in (CR, LF, FF, ETX):
                ready = i + 1
        self._pending = ready

    # --- the port side ------------------------------------------------------

    def tick(self, dt_ms: int) -> None:
        if not self.on_line or not self._pending:
            self._credit = 0.0
            return
        self._credit += dt_ms * BAUD / BITS_PER_CHARACTER / 1000
        while self._pending and self._credit >= 1:
            self._credit -= 1
            self._pending -= 1
            self._print(self.buffer.popleft())

    def _print(self, code: int) -> None:
        after_cr, self._after_cr = self._after_cr, code == CR
        if code == CR or code == FF or (code == LF and not after_cr):
            self._feed()  # CR LF is one line end
        elif code in (LF, ETX, NUL):
            return
        elif code == 8:  # backspace
            if self.line:
                self.line.pop()
        elif code >= 32:
            self.line.append(chr(code))
            if len(self.line) >= 132:  # a wide carriage
                self._feed()

    def _feed(self) -> None:
        text = "".join(self.line)
        self.line = []
        self.paper.append(text)
        self.printed += 1
        for listener in list(self.listeners):
            listener(text)

    def flags(self, tables) -> None:
        if tables.size(FLAG_WORD.table) <= FLAG_WORD.word:
            return
        tables.set_bit(Address("F", FLAG_WORD.word, OFF_LINE), not self.on_line)
        tables.set_bit(Address("F", FLAG_WORD.word, FILLING), self.room() < LINE_LENGTH)
        tables.set_bit(Address("F", FLAG_WORD.word, EMPTY), not self.buffer)

    def tear_off(self) -> None:
        self.paper.clear()

    def clear(self) -> None:
        self.buffer.clear()
        self._pending = 0
        self.line = []

    def snapshot(self, recent: int = 20) -> dict:
        """The port's state and the last few lines; ``recent=None`` for all the paper."""
        lines = list(self.paper)
        return {
            "lines": lines if recent is None else lines[-recent:],
            "head": "".join(self.line),
            "printed": self.printed,
            "buffered": len(self.buffer),
            "size": BUFFER_SIZE,
            "on_line": self.on_line,
        }
