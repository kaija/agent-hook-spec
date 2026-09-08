# Schemas

- `claude-code-hook.schema.json` is the derived Claude Code baseline.
- `proposed-hook.schema.json` is a complete, self-contained copy of that contract with
  `trace_id`, `content_hash`, and response `metadata` added.

Run `npm run build:schema` after changing the baseline. CI checks that the generated proposed
schema is current and contains every baseline request and response event.
