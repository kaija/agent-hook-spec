#!/usr/bin/env python3
"""Merge this logger's hook handlers into ~/.claude/settings.json."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from hook_settings import EVENTS, STATE_FILENAME, add_handler, atomic_write_json, build_groups, read_json_object


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--settings",
        type=Path,
        default=Path.home() / ".claude" / "settings.json",
        help="Claude Code settings file to patch (default: ~/.claude/settings.json)",
    )
    parser.add_argument(
        "--logger-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Directory containing forward_hook.py (default: this script's directory)",
    )
    parser.add_argument("--url", default="http://127.0.0.1:8765/hooks", help="Logger HTTP endpoint")
    parser.add_argument("--dry-run", action="store_true", help="Show the change without writing files")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    settings_path = args.settings.expanduser().resolve()
    logger_dir = args.logger_dir.expanduser().resolve()
    state_path = settings_path.parent / STATE_FILENAME

    if not (logger_dir / "forward_hook.py").is_file():
        print(f"error: forward_hook.py was not found in {logger_dir}", file=sys.stderr)
        return 2
    if state_path.exists():
        print(
            f"error: logger hooks are already tracked in {settings_path}; run unpatch_claude_settings.py first",
            file=sys.stderr,
        )
        return 2

    try:
        settings = read_json_object(settings_path)
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    hooks = settings.setdefault("hooks", {})
    if not isinstance(hooks, dict):
        print(f"error: {settings_path} has a non-object 'hooks' value", file=sys.stderr)
        return 2

    groups = build_groups(logger_dir, args.url)
    changed = 0
    for event_name, group in groups.items():
        event_groups = hooks.setdefault(event_name, [])
        if not isinstance(event_groups, list):
            print(f"error: hooks.{event_name} is not an array", file=sys.stderr)
            return 2
        changed += add_handler(event_groups, group)

    if args.dry_run:
        print(f"would add logger handlers for {len(EVENTS)} events to {settings_path} ({changed} new handlers)")
        return 0

    atomic_write_json(settings_path, settings)
    atomic_write_json(
        state_path,
        {
            "version": 1,
            "settings_path": str(settings_path),
            "groups": groups,
        },
    )
    print(f"patched {settings_path}: logger handlers active for {len(EVENTS)} events")
    print("WorktreeCreate was not added: it requires a replacement worktree path and cannot be pass-through.")
    print(f"To revert: python3 {Path(__file__).with_name('unpatch_claude_settings.py')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
