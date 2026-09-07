"""Shared, reversible Claude Code hook-settings patching helpers."""

from __future__ import annotations

import json
import os
import shlex
import stat
import tempfile
from pathlib import Path
from typing import Any


EVENTS = (
    "ConfigChange",
    "CwdChanged",
    "DirectoryAdded",
    "Elicitation",
    "ElicitationResult",
    "FileChanged",
    "InstructionsLoaded",
    "MessageDisplay",
    "Notification",
    "PermissionDenied",
    "PermissionRequest",
    "PostCompact",
    "PostModelSwitch",
    "PostToolBatch",
    "PostToolUse",
    "PostToolUseFailure",
    "PreCompact",
    "PreModelSwitch",
    "PreToolUse",
    "SessionEnd",
    "SessionStart",
    "Setup",
    "Stop",
    "StopFailure",
    "SubagentStart",
    "SubagentStop",
    "TaskCompleted",
    "TaskCreated",
    "TeammateIdle",
    "UserPromptExpansion",
    "UserPromptSubmit",
    "WorktreeRemove",
)

COMMAND_ONLY_EVENTS = {"SessionStart", "Setup"}
NO_MATCHER_EVENTS = {
    "CwdChanged",
    "MessageDisplay",
    "PostToolBatch",
    "Stop",
    "TaskCompleted",
    "TaskCreated",
    "TeammateIdle",
    "UserPromptSubmit",
    "WorktreeRemove",
}
STATE_FILENAME = ".agent-hook-logger.patch-state.json"


def read_json_object(path: Path, *, missing_value: dict[str, Any] | None = None) -> dict[str, Any]:
    if not path.exists():
        return {} if missing_value is None else missing_value
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"{path} is not valid JSON: {error}") from error
    if not isinstance(parsed, dict):
        raise ValueError(f"{path} must contain one JSON object")
    return parsed


def atomic_write_json(path: Path, content: dict[str, Any]) -> None:
    """Write JSON atomically and retain an existing settings file's mode."""

    path.parent.mkdir(parents=True, exist_ok=True)
    mode = stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o600
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(content, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
        temporary.chmod(mode)
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def handler_for(event_name: str, logger_dir: Path, url: str) -> dict[str, Any]:
    if event_name in COMMAND_ONLY_EVENTS:
        return {
            "type": "command",
            "command": f"python3 {shlex.quote(str(logger_dir / 'forward_hook.py'))}",
            "timeout": 5,
        }
    return {"type": "http", "url": url, "timeout": 5}


def group_for(event_name: str, handler: dict[str, Any]) -> dict[str, Any]:
    group: dict[str, Any] = {"hooks": [handler]}
    if event_name not in NO_MATCHER_EVENTS:
        group["matcher"] = "*"
    return group


def group_identity(group: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in group.items() if key != "hooks"}


def add_handler(groups: list[Any], group: dict[str, Any]) -> bool:
    """Add a handler, reusing a matching matcher group when possible."""

    desired_identity = group_identity(group)
    handler = group["hooks"][0]
    for candidate in groups:
        if not isinstance(candidate, dict) or group_identity(candidate) != desired_identity:
            continue
        hooks = candidate.get("hooks")
        if not isinstance(hooks, list):
            continue
        if handler not in hooks:
            hooks.append(handler)
            return True
        return False
    groups.append(group)
    return True


def remove_handler(groups: list[Any], group: dict[str, Any]) -> bool:
    """Remove only the exact handler inserted by this logger patch."""

    desired_identity = group_identity(group)
    handler = group["hooks"][0]
    removed = False
    for candidate in list(groups):
        if not isinstance(candidate, dict) or group_identity(candidate) != desired_identity:
            continue
        hooks = candidate.get("hooks")
        if not isinstance(hooks, list) or handler not in hooks:
            continue
        hooks.remove(handler)
        removed = True
        if not hooks:
            groups.remove(candidate)
    return removed


def build_groups(logger_dir: Path, url: str) -> dict[str, dict[str, Any]]:
    return {
        event_name: group_for(event_name, handler_for(event_name, logger_dir, url))
        for event_name in EVENTS
    }
