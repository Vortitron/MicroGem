"""Runs a Controller in real time on an asyncio loop and tells listeners about changes.

Both the standalone web server and the Home Assistant integration use this, so
the scan loop and change notifications behave the same everywhere.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable

from .engine import Controller, ControllerConfig
from .examples import BEDROOM, examples_for
from .importer import import_text
from .printout import print_program
from .program import ProgramError, parse_program, rung_to_json
from .tables import Address, AddressError, parse_address, to_signed

SCAN_INTERVAL_MS = 20

EXAMPLE_PROGRAM = BEDROOM

Listener = Callable[[dict], None]


class ControllerService:
    def __init__(self, config: ControllerConfig | None = None, program: str | None = None) -> None:
        self.controller = Controller(config)
        if program is None:
            self._load_example()
        else:
            self.controller.load(program)
        self.controller.run()
        self._listeners: list[Listener] = []
        self._task: asyncio.Task | None = None
        self._last_state: dict | None = None

    def _load_example(self) -> None:
        """Load the first example this controller can run (not every GEM 80 has
        every Special Function, or room for every example)."""
        examples = examples_for(self.controller.config.family)
        for example in examples:
            try:
                self.controller.load(example.source)
                return
            except ProgramError:
                if example is examples[-1]:
                    raise

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
        state["ladder"] = self.controller.ladder()
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

    def single_cycle(self) -> None:
        self.controller.single_cycle(SCAN_INTERVAL_MS)
        self._notify_if_changed(force=True)

    def set_test_inputs(self, on: bool) -> None:
        self.controller.set_test_inputs(on)
        self._notify_if_changed(force=True)

    def clear_store(self) -> None:
        self.controller.clear_store()
        self._notify_if_changed(force=True)

    def write(self, address: str, value: int | bool) -> None:
        self.controller.write(parse_address(address), value)
        self._notify_if_changed()

    def load(self, source: str) -> None:
        """Install a new program; raises ProgramError and keeps the old one on a mistake."""
        self.controller.load(source)
        self._notify_if_changed(force=True)

    def command(self, message: dict) -> dict | None:
        """Apply one command from a front end and return a reply, if any.

        Commands: ``{"type": "input", "index": 0, "value": true}``, ``{"type": "run"}``,
        ``{"type": "halt"}``, ``{"type": "read", "address": "G12"}``,
        ``{"type": "preview", "source": "..."}`` (parse without loading), ``{"type": "write", "address": "G12", "value": 5}`` and
        ``{"type": "load", "source": "..."}`` and ``{"type": "examples"}`` (the demo
        programmes, to pick from). A programmer also sends ``{"type": "single"}``
        (SINGLE CYCLE), ``{"type": "test_inputs", "value": true}`` (TEST or
        NORMAL INPUTS), ``{"type": "clear"}`` (CLEAR STORE) and ``{"type":
        "read", "address": "G0", "count": 32}`` for a run of words. ``{"type":
        "printout"}`` returns the program drawn as a print-out, and ``{"type":
        "import", "text": "...", "current": "..."}`` turns a print-out, program
        text or a names/data CSV into program text for the editor (merging a CSV
        into ``current``) without loading it.
        """
        kind = message.get("type")
        try:
            if kind == "input":
                self.set_input(int(message["index"]), bool(message["value"]))
            elif kind == "run":
                self.run()
            elif kind == "halt":
                self.halt()
            elif kind == "single":
                self.single_cycle()
            elif kind == "test_inputs":
                self.set_test_inputs(bool(message["value"]))
            elif kind == "clear":
                self.clear_store()
            elif kind == "read" and "count" in message:
                start = parse_address(str(message["address"]))
                if start.is_bit:
                    raise ValueError("a run of words starts at a word address, such as G0")
                tables = self.controller.tables
                tables.check(start)
                size = tables.size(start.table)
                last = min(size, start.word + max(1, min(int(message["count"]), 64)))
                values = [to_signed(tables.get_word(Address(start.table, w)))
                          for w in range(start.word, last)]
                return {"type": "values", "address": str(start), "values": values, "size": size}
            elif kind == "read":
                address = parse_address(str(message["address"]))
                tables = self.controller.tables
                value = tables.get_bit(address) if address.is_bit else to_signed(tables.get_word(address))
                return {"type": "value", "address": str(address), "value": value}
            elif kind == "preview":
                program = parse_program(str(message["source"]))
                return {"type": "preview", "rungs": [rung_to_json(r) for r in program.rungs]}
            elif kind == "write":
                self.write(str(message["address"]), int(message["value"]))
            elif kind == "examples":
                family = self.controller.config.family
                return {"type": "examples", "examples": [vars(e) for e in examples_for(family)]}
            elif kind == "printout":
                model = self.controller.config.controller_model.label
                text = print_program(self.controller.program, str(message.get("title", "")), model)
                return {"type": "printout", "text": text}
            elif kind == "import":
                result = import_text(str(message["text"]), str(message.get("current", "")))
                return {"type": "imported", **result}
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
