# Claude Code–based hook extensions

Status: superseded in part by [the cross-agent proposal](proposal.md).

This document describes three optional fields added to the **Claude Code** contract, and remains
the rationale for `spec/schema/proposed-hook.schema.json`. Where it and `proposal.md` describe the
same field, `proposal.md` governs the canonical cross-agent contract and this document governs the
Claude Code extension.

The [proposed schema](schema/proposed-hook.schema.json) contains the complete Claude Code contract
and adds three optional fields for cross-system operation.

## 1. Distributed tracing: `trace_id`

Correlates one request across the runtime, hook receiver, subagents, and observability systems.

> **Superseded for cross-agent use.** [`proposal.md` §10.2](proposal.md#10-correlation-and-content-identity)
> replaces this free-form string with a W3C Trace Context object (`trace_id`, `span_id`,
> `traceparent`), so hook activity correlates with the surrounding application trace. The flat
> `trace_id` below remains the Claude Code extension.

```diff
 {
   "session_id": "abc123",
+  "trace_id": "tr-9b8c-1234-5678",
   "hook_event_name": "PreToolUse"
 }
```

[Baseline request](examples/claude-code/pre-tool-use.json) ·
[Proposed request](examples/proposed/pre-tool-use-with-trace.json)

## 2. Content identity: `content_hash`

Identifies equivalent content and detects inconsistent mutation. Hash the RFC 8785 canonical
request after removing `content_hash`. Replay prevention still requires receiver-side state;
authenticity requires TLS and/or a signature or MAC.

```diff
 {
   "tool_use_id": "toolu_01ABC123",
+  "content_hash": "091beb03976dfcbfda17a51cc63db073353b2e971531c63f974aba155b3388f5"
 }
```

[Baseline request](examples/claude-code/pre-tool-use.json) ·
[Proposed request](examples/proposed/pre-tool-use-with-content-hash.json)

## 3. Receiver context: `metadata`

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

[Baseline response](examples/claude-code/pre-tool-use-response.json) ·
[Proposed response](examples/proposed/pre-tool-use-response-with-metadata.json)

## HITL scope

No `escalation` field is proposed. Claude Code already provides interactive approval through
`permissionDecision: "ask"` and `PermissionRequest`. Claude Code v2.1.89 or later also supports
`permissionDecision: "defer"` for pause/resume in non-interactive `claude -p` sessions.
