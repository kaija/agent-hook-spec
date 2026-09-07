# Design Notes

The repository separates machine-readable schemas from human-readable comparisons:

- JSON Schema is used for validation and integration tooling.
- Markdown tables are used for event and tool-name comparisons.
- The proposed schema composes `current/claude-code/hooks.schema.json` to keep the extension diff small.

The proposal adds only `trace_id`, `content_hash`, and response `metadata`. It does not add
`escalation`: Claude Code already supports interactive approval with `permissionDecision: "ask"`,
allow/deny handling through `PermissionRequest`, and pause/resume with `"defer"` in non-interactive
`claude -p` sessions on Claude Code v2.1.89 or later.

`curl`, `wget`, and similar executables are treated as shell command values rather than portable
tool names. Cross-agent policy should normalize the shell-tool category, then inspect its command.
