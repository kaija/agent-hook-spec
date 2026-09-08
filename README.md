# Agent Hook Spec

Claude Code hook schemas, proposed extensions, and cross-agent naming comparisons.

## Schemas

- [Claude Code original schema](spec/schema/claude-code-hook.schema.json)
- [Proposed complete schema](spec/schema/proposed-hook.schema.json)

Both files are self-contained Draft 2020-12 JSON Schemas. The proposed schema contains every
Claude Code request and event-specific response definition, then adds three optional fields.

## Proposed improvements

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
