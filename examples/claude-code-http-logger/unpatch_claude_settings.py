#!/usr/bin/env python3
"""Remove only the Claude Code hook handlers installed by the patch script."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from hook_settings import STATE_FILENAME, atomic_write_json, read_json_object, remove_handler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--settings",
        type=Path,
        default=Path.home() / ".claude" / "settings.json",
        help="Claude Code settings file to unpatch (default: ~/.claude/settings.json)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show the change without writing files")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    settings_path = args.settings.expanduser().resolve()
    state_path = settings_path.parent / STATE_FILENAME
    if not state_path.exists():
        print(f"no logger patch state found beside {settings_path}; nothing changed")
        return 0

    try:
        settings = read_json_object(settings_path)
        state = read_json_object(state_path)
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    groups = state.get("groups")
    if not isinstance(groups, dict):
        print(f"error: {state_path} has no valid logger patch state", file=sys.stderr)
        return 2
    hooks = settings.get("hooks")
    if not isinstance(hooks, dict):
        print(f"error: {settings_path} has a non-object 'hooks' value", file=sys.stderr)
        return 2

    removed = 0
    remaining_groups: dict[str, object] = {}
    for event_name, group in groups.items():
        event_groups = hooks.get(event_name)
        if not isinstance(event_groups, list) or not isinstance(group, dict):
            remaining_groups[event_name] = group
            continue
        if remove_handler(event_groups, group):
            removed += 1
        else:
            remaining_groups[event_name] = group
        if not event_groups:
            hooks.pop(event_name)

    if not hooks:
        settings.pop("hooks")

    if args.dry_run:
        print(f"would remove {removed} logger handlers from {settings_path}")
        return 0

    atomic_write_json(settings_path, settings)
    if remaining_groups:
        state["groups"] = remaining_groups
        atomic_write_json(state_path, state)
        print(f"removed {removed} logger handlers; retained patch state for {len(remaining_groups)} changed entries")
    else:
        state_path.unlink()
        print(f"removed {removed} logger handlers from {settings_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
