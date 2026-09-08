# Schemas

Three schemas with three different jobs. They are not versions of one another.

| File | What it is | Maintained by |
|---|---|---|
| `claude-code-hook.schema.json` | The derived Claude Code baseline — one vendor's documented contract. | Hand-edited from the upstream docs. |
| `proposed-hook.schema.json` | A complete, self-contained copy of that baseline with `trace_id`, `content_hash`, and response `metadata` added. | **Generated.** Run `npm run build:schema`. |
| `agent-hook.schema.json` | The canonical cross-agent contract of [`spec/proposal.md`](../proposal.md): 13 Core events, the unified verdict, and the conformance declaration. | Hand-written. |

`agent-hook.schema.json` is deliberately separate from `proposed-hook.schema.json`. The generated
schema is parity-locked to the Claude Code baseline, and CI asserts it defines exactly the baseline's
events — so it cannot carry `BeforeModelRequest` or `AfterModelResponse`, two of the Core 13 that
Claude Code does not emit.

CI checks that the generated proposed schema is current and contains every baseline request and
response event, and that all three schemas are self-contained (every `$ref` is local).
