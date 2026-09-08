# Agent Hook Spec

A cross-agent hook specification, the Claude Code baseline it was derived from, and the
eight-runtime comparison that grounds it.

## The specification

**[spec/proposal.md](spec/proposal.md)** — Status: Draft · Version 0.1.0

A transport-neutral contract: 13 Core events a conforming host MUST emit, a request envelope, and a
verdict whose gate, enrichment, and mutation axes are independent. Core events are drawn from
[AITF](https://github.com/girdav01/AITF)'s OCSF observable-action classes, so a policy layer can
reconstruct what was asked, sent, returned, executed, approved, and delegated. Document conventions
follow [responsibleai/agent-hooks](https://responsibleai.github.io/agent-hooks/spec/); the
eight-point interception model does not (§3.5).

Two findings, computed from the comparison table:

- **No surveyed host emits all 13 Core events.** Claude Code leads at 11/13.
- **Five of eight hosts expose no model-call boundary**, so prompt injection arriving through tool
  output is unobservable at any hook on those hosts (§14.2). `PermissionDenied` is emitted by one of
  eight, so refusal is not independently auditable elsewhere.

## Schemas

- [Canonical cross-agent schema](spec/schema/agent-hook.schema.json) — the contract above
- [Claude Code original schema](spec/schema/claude-code-hook.schema.json) — one vendor's baseline
- [Proposed complete schema](spec/schema/proposed-hook.schema.json) — that baseline plus three fields

All three are self-contained Draft 2020-12 JSON Schemas, and all three are validated by `npm test`.
They are not versions of one another: the canonical schema is hand-written, the proposed schema is
generated from the baseline and parity-locked to it. See [spec/schema/README.md](spec/schema/README.md).

## Claude Code extensions

These three fields extend the Claude Code contract specifically. `trace_id` is superseded for
cross-agent use by [proposal.md §10.2](spec/proposal.md#10-correlation-and-content-identity), which
uses W3C Trace Context.

### 1. Distributed tracing: `trace_id`

Correlates one request across the runtime, hook receiver, subagents, and observability systems.

```diff
 {
   "session_id": "abc123",
+  "trace_id": "tr-9b8c-1234-5678",
   "hook_event_name": "PreToolUse"
 }
```

[Baseline request](spec/examples/claude-code/pre-tool-use.json) ·
[Proposed request](spec/examples/proposed/pre-tool-use-with-trace.json)

### 2. Content identity: `content_hash`

Identifies equivalent content and detects inconsistent mutation. Replay prevention still requires
receiver-side state; authenticity requires TLS and/or a signature or MAC.

```diff
 {
   "tool_use_id": "toolu_01ABC123",
+  "content_hash": "091beb03976dfcbfda17a51cc63db073353b2e971531c63f974aba155b3388f5"
 }
```

[Baseline request](spec/examples/claude-code/pre-tool-use.json) ·
[Proposed request](spec/examples/proposed/pre-tool-use-with-content-hash.json)

### 3. Receiver context: `metadata`

Returns audit and rule-processing details without changing the permission decision.

```diff
 {
   "hookSpecificOutput": { "permissionDecision": "deny" },
+  "metadata": {
+    "auditId": "aud-7788-9900-1122",
+    "latencyMs": 1.25,
+    "triggeredRules": ["rule_network_egress"]
+  }
 }
```

[Baseline response](spec/examples/claude-code/pre-tool-use-response.json) ·
[Proposed response](spec/examples/proposed/pre-tool-use-response-with-metadata.json)

## Comparisons

- [Event naming comparison](spec/comparison/event-comparison.md)
- [Tool name comparison](spec/comparison/tool-name-comparison.md)

The comparison is Markdown because it explains semantic and naming differences for readers. The
schemas and examples remain JSON so integrations and CI can validate them.

## HITL scope

No custom `escalation` field is proposed. Claude Code already provides interactive approval through
`permissionDecision: "ask"` and `PermissionRequest`. Claude Code v2.1.89 or later also supports
`permissionDecision: "defer"` in non-interactive `claude -p` sessions.

## Validation

```sh
npm ci
npm test
```

To rebuild the complete proposed schema after updating the Claude Code baseline:

```sh
npm run build:schema
```
