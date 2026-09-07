# Claude Code HTTP hook logger

This is a fail-open FastAPI receiver for documenting real Claude Code hook
payloads. It logs every event as one full JSON object per line (NDJSON) and
does not intentionally block the Claude Code lifecycle.

> Hook payloads can contain prompts, tool arguments, absolute paths, transcript
> locations, and tool results. Keep the server bound to `127.0.0.1`, protect or
> delete the log when appropriate, and never expose the endpoint publicly.

## Run it

```bash
cd examples/claude-code-http-logger
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8765
```

The server writes `hook-logs/claude-code-hooks.ndjson` relative to the process
directory. Set `HOOK_LOG_DIR` or `HOOK_LOG_FILE` to change that destination.
Check that it is running with `curl http://127.0.0.1:8765/healthz`.

## Connect every hook

1. Replace `/ABSOLUTE/PATH/TO/claude-code-http-logger` in
   [`claude-code-settings.json`](claude-code-settings.json) with the absolute
   path to this directory.
2. Merge its `hooks` object into `~/.claude/settings.json` to observe all your
   projects, or into `.claude/settings.json` to observe this project only.
3. Restart Claude Code or inspect `/hooks` in Claude Code to confirm the
   configuration was loaded.

### Patch your user settings automatically

Instead of editing JSON by hand, start the server and run:

```bash
python3 patch_claude_settings.py
```

It merges this logger's hook handlers into `~/.claude/settings.json`, preserves
all existing settings and handlers, and creates a small patch-state file beside
the settings file. Preview a change with `--dry-run`, use `--url` to point at a
different server, and use `--settings /path/to/settings.json` for a test file.
To remove only the entries the patch added later, run:

```bash
python3 unpatch_claude_settings.py
```

The HTTP endpoint handles every observational event that supports HTTP hooks.
`SessionStart` and `Setup` are command-only, so their entries use
`forward_hook.py` to POST their original JSON to the same endpoint. The adapter
is also fail-open.

`WorktreeCreate` is deliberately absent. Its handler replaces Claude Code's
normal worktree creation and must return a valid, already-prepared worktree
path. There is no pass-through or default-allow response for that event, so
logging it would change behavior. Add a dedicated handler only if you intend to
own worktree creation.

## Response behavior

Most events receive `{"continue": true}`. For `PreToolUse`, `PermissionRequest`,
and `PreModelSwitch`, the receiver returns the event-specific explicit
`allow` shape. This is useful for instrumentation, but it changes normal
permission prompting for the first two events. Remove those two hook entries
if you want to log without automatically approving tool permissions.

Each NDJSON record contains a UTC timestamp, event name, HTTP metadata, and
the full decoded request. For schema work, sample events by name with:

```bash
jq 'select(.event_name == "PreToolUse")' hook-logs/claude-code-hooks.ndjson
```
