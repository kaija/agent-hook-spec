# Examples

- `claude-code/` — baseline request and response payloads.
- `proposed/` — payloads showing the three proposed fields across `SessionStart`, `PreToolUse`, and
  `PostToolUse`.
- `agent-hook/` — reference vectors for the canonical contract in [`spec/proposal.md`](../proposal.md).

## `agent-hook/`

One request vector per Core event, forming a single coherent session: a prompt, a model call whose
tool use is refused for plaintext transport, a retry over HTTPS that succeeds, a failing read, a
delegated subagent, and the session bookends. `sequence` runs 0–12 across them.

Also included: verdicts covering each axis of §5 (`observe`, `deny`, `ask`, a two-operation
redacting transform, and a whole-target replacement via the empty pointer), a host conformance
declaration, and a host-synthesized timeout verdict.

Every JSON file in this directory is validated by `npm test`, which additionally checks the §5.4.1
pointer-overlap rule, the §5.5 `$target` table, and that every Core event has a vector.
