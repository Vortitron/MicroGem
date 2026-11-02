"""Runs a Controller in real time on an asyncio loop and tells listeners about changes.

Both the standalone web server and the Home Assistant integration use this, so
the scan loop and change notifications behave the same everywhere.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable

from .engine import Controller, ControllerConfig
from .program import ProgramError
from .tables import AddressError

SCAN_INTERVAL_MS = 20

EXAMPLE_PROGRAM = """\
; Bedroom lighting, MicroGEM style.
; Inputs  A0.0 push-button by the door, A0.1 bedside switch, A0.2 "all off"
; Outputs B0.0 main light, B0.1 bedside lamp, B0.2 landing light (timed)

; Door button toggles the main light
(RISE A0.0 AND NOT B0.0) OR (NOT RISE A0.0 AND B0.0 AND NOT A0.2) -> B0.0

; Bedside switch drives the lamp directly
A0.1 AND NOT A0.2 -> B0.1

; Landing light: on while the main light is on, and for 10 s after it goes off
B0.0 -> SET G0.0
NOT B0.0 AND G0.0 -> DELAY 10s G0.1
G0.1 -> RESET G0.0
G0.0 -> B0.2

; Count how many times the door button has been pressed
RISE A0.0 -> COUNT 32767 G1 G0.15
"""

Listener = Callable[[dict], None]


class ControllerService:
    def __init__(self, config: ControllerConfig | None = None, program: str = EXAMPLE_PROGRAM) -> None:
        self.controller = Controller(config)
        self.controller.load(program)
        self.controller.run()
        self._listeners: list[Listener] = []
        self._task: asyncio.Task | None = None
        self._last_state: dict | None = None

    # --- lifecycle --------------------------------------------------------------

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.get_running_loop().create_task(self._loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        last = time.monotonic()
        while True:
            await asyncio.sleep(SCAN_INTERVAL_MS / 1000)
            now = time.monotonic()
            self.controller.scan(round((now - last) * 1000))
            last = now
            self._notify_if_changed()

    # --- listeners ---------------------------------------------------------------

    def subscribe(self, listener: Listener) -> Callable[[], None]:
        self._listeners.append(listener)
        return lambda: self._listeners.remove(listener)

    def state(self) -> dict:
        state = self.controller.snapshot()
        state["program"] = self.controller.program.source
        return state

    def _notify_if_changed(self, force: bool = False) -> None:
        state = self.state()
        comparable = {k: v for k, v in state.items() if k != "scan_count"}
        if force or comparable != self._last_state:
            self._last_state = comparable
            for listener in list(self._listeners):
                listener(state)

    # --- commands ----------------------------------------------------------------

    def set_input(self, index: int, value: bool) -> None:
        self.controller.set_input(index, value)
        self._notify_if_changed()

    def run(self) -> None:
        self.controller.run()
        self._notify_if_changed(force=True)

    def halt(self) -> None:
        self.controller.halt()
        self._notify_if_changed(force=True)

    def load(self, source: str) -> None:
        """Install a new program; raises ProgramError and keeps the old one on a mistake."""
        self.controller.load(source)
        self._notify_if_changed(force=True)

    def command(self, message: dict) -> dict | None:
        """Apply one command from a front end and return a reply, if any.

        Commands: ``{"type": "input", "index": 0, "value": true}``, ``{"type": "run"}``,
        ``{"type": "halt"}`` and ``{"type": "load", "source": "..."}``.
        """
        kind = message.get("type")
        try:
            if kind == "input":
                self.set_input(int(message["index"]), bool(message["value"]))
            elif kind == "run":
                self.run()
            elif kind == "halt":
                self.halt()
            elif kind == "load":
                self.load(str(message["source"]))
                return {"type": "loaded"}
            else:
                return {"type": "error", "message": f"unknown command {kind!r}"}
        except ProgramError as exc:
            return {"type": "error", "message": str(exc), "line": exc.line}
        except (AddressError, IndexError, KeyError, TypeError, ValueError) as exc:
            return {"type": "error", "message": str(exc)}
        return None
