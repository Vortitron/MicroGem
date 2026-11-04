"""Standalone web server: ``python -m microgem`` then open http://localhost:8080."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from aiohttp import WSMsgType, web

from .engine import MAX_EXPANSIONS, ControllerConfig
from .models import DEFAULT_MODEL, DEFAULT_MODULES, IO_MODULES, MODELS
from .service import EXAMPLE_PROGRAM, ControllerService

WEB_DIR = Path(__file__).parent / "web"

SERVICE_KEY = web.AppKey("service", ControllerService)


async def index(request: web.Request) -> web.FileResponse:
    return web.FileResponse(WEB_DIR / "index.html")


async def api_state(request: web.Request) -> web.Response:
    return web.json_response(request.app[SERVICE_KEY].state())


async def websocket(request: web.Request) -> web.WebSocketResponse:
    service = request.app[SERVICE_KEY]
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)

    def push(state: dict) -> None:
        if not ws.closed:
            asyncio.ensure_future(ws.send_json({"type": "state", **state}))

    unsubscribe = service.subscribe(push)
    try:
        await ws.send_json({"type": "state", **service.state()})
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue
            try:
                message = json.loads(msg.data)
            except json.JSONDecodeError:
                continue
            reply = service.command(message)
            if reply:
                await ws.send_json(reply)
    finally:
        unsubscribe()
    return ws


def create_app(service: ControllerService) -> web.Application:
    app = web.Application()
    app[SERVICE_KEY] = service

    async def on_startup(app: web.Application) -> None:
        service.start()

    async def on_cleanup(app: web.Application) -> None:
        await service.stop()

    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    app.router.add_get("/", index)
    app.router.add_get("/api/state", api_state)
    app.router.add_get("/ws", websocket)
    app.router.add_static("/static", WEB_DIR)
    return app


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run a virtual MicroGEM in your browser.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--program", type=Path, help="program file to load at start-up")
    parser.add_argument("--inputs", type=int, default=12, help="inputs per unit (MicroGEM60: 12)")
    parser.add_argument("--outputs", type=int, default=8, help="relay outputs per unit (MicroGEM60: 8)")
    parser.add_argument(
        "--expansions", type=int, default=0, choices=range(MAX_EXPANSIONS + 1),
        help="expansion units on the expansion port, each adding 12 inputs and 8 outputs",
    )
    parser.add_argument(
        "--model", default=DEFAULT_MODEL, choices=list(MODELS),
        help="the controller: microgem60, or a GEM 80 compact controller such as gem80-130c-12k",
    )
    parser.add_argument(
        "--modules", default=",".join(m or "-" for m in DEFAULT_MODULES),
        help="GEM 80 only: Compact I/O module type numbers in slots 1 to 8, '-' for an empty slot "
             f"({', '.join(f'{c} {m.title}' for c, m in IO_MODULES.items())})",
    )
    args = parser.parse_args(argv)

    source = args.program.read_text() if args.program else None
    modules = tuple(None if m in ("", "-") else m for m in args.modules.split(","))
    config = ControllerConfig(
        name=MODELS[args.model].label, inputs=args.inputs, outputs=args.outputs,
        expansions=args.expansions, model=args.model, modules=modules,
    )
    service = ControllerService(config, source)
    print(f"Virtual {MODELS[args.model].label} on http://{args.host}:{args.port}")
    web.run_app(create_app(service), host=args.host, port=args.port, print=None)
