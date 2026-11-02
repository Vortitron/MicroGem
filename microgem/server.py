"""Standalone web server: ``python -m microgem`` then open http://localhost:8080."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from aiohttp import WSMsgType, web

from .engine import ControllerConfig
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
    parser.add_argument("--inputs", type=int, default=12)
    parser.add_argument("--outputs", type=int, default=8)
    args = parser.parse_args(argv)

    source = args.program.read_text() if args.program else EXAMPLE_PROGRAM
    service = ControllerService(ControllerConfig(inputs=args.inputs, outputs=args.outputs), source)
    print(f"Virtual MicroGEM on http://{args.host}:{args.port}")
    web.run_app(create_app(service), host=args.host, port=args.port, print=None)
