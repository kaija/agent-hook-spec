"""Fail-open HTTP receiver for Claude Code hook events.

Run with:
    uvicorn app:app --host 127.0.0.1 --port 8765
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())
logger = logging.getLogger("claude_hook_logger")

LOG_DIRECTORY = Path(os.getenv("HOOK_LOG_DIR", "hook-logs"))
LOG_FILENAME = os.getenv("HOOK_LOG_FILE", "claude-code-hooks.ndjson")

app = FastAPI(
    title="Claude Code hook logger",
    version="0.1.0",
    description="Records Claude Code hook payloads and always responds permissively.",
)


def allow_response(event_name: str | None) -> dict[str, Any]:
    """Return the least-surprising permissive response for an event.

    Claude Code normally proceeds when a successful hook returns an empty JSON
    object.  `continue: true` makes that intent explicit.  The three events
    with a dedicated allow decision receive their documented explicit form.
    """

    if event_name == "PreToolUse":
        return {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
            },
        }

    if event_name == "PermissionRequest":
        return {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {"behavior": "allow"},
            },
        }

    if event_name == "PreModelSwitch":
        return {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": "PreModelSwitch",
                "permissionDecision": "allow",
            },
        }

    return {"continue": True}


def append_record(record: dict[str, Any]) -> None:
    """Append one complete event record, making NDJSON easy to process later."""

    LOG_DIRECTORY.mkdir(parents=True, exist_ok=True)
    destination = LOG_DIRECTORY / LOG_FILENAME
    with destination.open("a", encoding="utf-8") as stream:
        json.dump(record, stream, ensure_ascii=False, separators=(",", ":"))
        stream.write("\n")


async def record_event(request: Request, path_event_name: str | None = None) -> JSONResponse:
    """Record raw request details without letting logging failures block Claude."""

    body = await request.body()
    parsed_payload: Any
    parse_error: str | None = None
    try:
        parsed_payload = json.loads(body)
    except json.JSONDecodeError as error:
        parsed_payload = None
        parse_error = str(error)

    event_name = path_event_name
    if isinstance(parsed_payload, dict):
        event_name = parsed_payload.get("hook_event_name", path_event_name)

    record: dict[str, Any] = {
        "received_at": datetime.now(timezone.utc).isoformat(),
        "event_name": event_name,
        "request": {
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host if request.client else None,
            "content_type": request.headers.get("content-type"),
            "payload": parsed_payload,
        },
    }
    if parse_error:
        record["request"]["raw_body"] = body.decode("utf-8", errors="replace")
        record["request"]["parse_error"] = parse_error

    try:
        await asyncio.to_thread(append_record, record)
    except OSError:
        # The logger is deliberately fail-open: a full disk or bad log path
        # must not turn an observation hook into a Claude Code outage.
        logger.exception("Unable to persist hook event")

    return JSONResponse(content=allow_response(event_name))


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/hooks")
async def receive_hook(request: Request) -> JSONResponse:
    """Receive every HTTP-capable Claude Code hook event at one URL."""

    return await record_event(request)


@app.post("/hooks/{event_name}")
async def receive_named_hook(event_name: str, request: Request) -> JSONResponse:
    """Optional endpoint useful for manual tests or event-specific routing."""

    return await record_event(request, event_name)
