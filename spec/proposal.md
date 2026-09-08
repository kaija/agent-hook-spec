# Agent Hook Specification

**Status:** Draft · **Version:** 0.1.0 · **Date:** 2026-09-08

A transport-neutral specification for agent lifecycle hooks, derived from a survey of eight
shipping agent runtimes.

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Terminology](#2-terminology)
3. [Lifecycle events](#3-lifecycle-events)
4. [Request envelope](#4-request-envelope)
5. [Verdict](#5-verdict)
6. [Host obligations](#6-host-obligations)
7. [Composition](#7-composition)
8. [Enforcement mode](#8-enforcement-mode)
9. [Approval seam](#9-approval-seam)
10. [Correlation and content identity](#10-correlation-and-content-identity)
11. [Reserved reasons](#11-reserved-reasons)
12. [Streaming and parallel tool calls](#12-streaming-and-parallel-tool-calls)
13. [Conformance](#13-conformance)
14. [Security considerations](#14-security-considerations)
15. [References](#15-references)

- [Annex A (normative) — Telemetry mapping](#annex-a-normative--telemetry-mapping)
- [Annex B (informative) — Host coverage matrix](#annex-b-informative--host-coverage-matrix)

---

## 1. Introduction

### 1.1 Scope

This specification defines a portable contract between an **agent runtime** and an **external hook**
that observes, enriches, transforms, or gates the runtime's behaviour.

It specifies four things:

1. A canonical **event vocabulary** (§3) with a mandatory Core tier and an open Extended registry.
2. A **request envelope** (§4) carried by every event.
3. A **verdict** (§5) by which a hook expresses observation, enrichment, mutation, and gating on
   independent axes.
4. **Host obligations** (§6–§9) governing emission, failure, composition, and human approval.

It does **not** specify a transport. See §1.4.

### 1.2 Requirement language

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY, and
OPTIONAL in this document are to be interpreted as described in [RFC 2119] and [RFC 8174] when, and
only when, they appear in all capitals, as shown here.

Sections and subsections are numbered and cross-referenced as §n.m.

### 1.3 Relationship to existing work

| Work | Relationship |
|---|---|
| [Claude Code hooks] | The most complete shipping implementation surveyed. Its documented contract is this repository's baseline (`spec/claude-code.md`) and the source of most canonical event names. |
| [responsibleai/agent-hooks] | This document adopts that specification's **document conventions** — numbered sections, RFC 2119 language, closed verdict vocabulary, reserved `host_error:*` namespace, declared-surface conformance. It does **not** adopt its eight-point interception model; see §3.5. |
| [AITF] (AI Telemetry Framework) | Supplies the security rationale for the Core tier (§3.1). AITF maps agent behaviour onto OCSF classes and OpenTelemetry GenAI semantic conventions; the Core events are exactly those needed to populate AITF's observable-action classes. Annex A is the mapping. |
| [OpenTelemetry GenAI semantic conventions] | The normative attribute vocabulary for telemetry export (Annex A). |

### 1.4 Non-goals

This specification does not:

- **Define a transport binding.** Delivery over stdin/stdout, HTTP, IPC, or in-process callback is
  host-defined. Two conformant hosts MAY therefore be operationally incompatible; §14.3 records the
  consequences, which are significant.
- Replace a host's native configuration format, matcher syntax, or permission model.
- Standardize the argument or result schema of any individual tool. See `spec/comparison/tool-name-comparison.md`.
- Require a host to emit every event. Only the Core tier (§3.1) is mandatory.
- Conceal behavioural differences behind an identical schema. Where hosts genuinely differ, this
  document names the difference rather than averaging it away.

---

## 2. Terminology

### 2.1 Terms

| Term | Definition |
|---|---|
| **Host** | An agent runtime that emits lifecycle events and honours verdicts. |
| **Hook** | External code registered against one or more events that returns a verdict. |
| **Event** | A named point in the agent lifecycle at which a host emits a request. |
| **Request** | The JSON object a host sends to a hook, comprising the common envelope (§4.1) and event-specific fields (§4.3). |
| **Verdict** | The JSON object a hook returns (§5). |
| **Gate event** | An event whose verdict can prevent the pending operation: `UserPromptSubmit`, `BeforeModelRequest`, `PreToolUse`, `PermissionRequest`. |
| **Observe event** | Any event that is not a gate event. A `deny` on an observe event MUST be recorded and MUST NOT alter the lifecycle. |
| **`$target`** | The single mutable value of an event, against which `transform` paths resolve (§5.5). |
| **Session** | One continuous agent run, bounded by `SessionStart` and `SessionEnd`. |
| **Turn** | One user-initiated cycle within a session, bounded by `UserPromptSubmit` and `Stop`. |
| **Declaration** | A host's published statement of which events it emits and under what posture (§13.1). |

### 2.2 Document conventions

Canonical event names are written in `PascalCase` and are case-sensitive. Field names are
`snake_case` in requests and verdicts. JSON examples are illustrative unless marked normative.

### 2.3 Evidentiary basis

Coverage claims in §3.4 and Annex B are derived from each host's **published hook documentation**,
verified 2026-09-07 (Claude Code, OpenAI Codex, Gemini CLI, Cursor, GitHub Copilot CLI) and
2026-09-08 (Kiro, OpenClaw, Hermes Agent). Sources are listed in §15.

These are **not** conformance-run results. No host behaviour was verified by execution. Where a host
publishes a §13 declaration, that declaration supersedes the tables in this document.

Readers evaluating a host for policy enforcement SHOULD confirm its §6.3 failure posture empirically,
because that behaviour is the least reliably documented property surveyed.

---

## 3. Lifecycle events

### 3.1 Core events

A conforming host MUST emit all thirteen Core events.

| Core event | Boundary | AITF observable-action class |
|---|---|---|
| `SessionStart` | Before the first input of a session | AI Agent Activity (OCSF 9001) |
| `UserPromptSubmit` | On each external request ingress | AI Agent Activity (OCSF 9001) |
| `BeforeModelRequest` | Before dispatch to a model provider | AI Model Inference (OCSF 6003) |
| `AfterModelResponse` | After a complete model response is received | AI Model Inference (OCSF 6003) |
| `PreToolUse` | Before a tool is invoked | AI Tool Execution (OCSF 6003) |
| `PostToolUse` | After a tool completes successfully | AI Tool Execution (OCSF 6003) |
| `PostToolUseFailure` | After a tool fails or is interrupted | AI Tool Execution (OCSF 6003) |
| `PermissionRequest` | When an operation requires an approval decision | AI Identity (OCSF 3002) |
| `PermissionDenied` | After an approval decision refused an operation | AI Identity (OCSF 3002) |
| `SubagentStart` | Before a subagent begins | AI Delegation (OCSF 9002) |
| `SubagentStop` | After a subagent finishes | AI Delegation (OCSF 9002) |
| `Stop` | At the end of a turn | AI Agent Activity (OCSF 9001) |
| `SessionEnd` | After the last output, or on abnormal termination | AI Agent Activity (OCSF 9001) |

The Core tier is drawn from what a security or governance hook must observe to reconstruct agent
behaviour — *what was asked, what was sent to the model, what came back, what was executed, what
failed, what was approved or refused, and what was delegated* — rather than from what is most widely
implemented today. §3.4 states the resulting gap.

AITF's fifth observable-action class, **AI Data Retrieval** (OCSF 6005), has no distinct event.
Retrieval is performed through tools and is therefore observable at `PreToolUse` / `PostToolUse`.
Hosts SHOULD make retrieval tools distinguishable by name so that a hook can classify them; see
`spec/comparison/tool-name-comparison.md`.

### 3.2 Extended events

A host MAY emit any event in the Extended registry. If it does, it MUST use the canonical name and
the payload defined for that event.

The Extended registry is the non-Core rows of `spec/comparison/event-comparison.md`, which currently
comprises: `Setup`, `InstructionsLoaded`, `UserPromptExpansion`, `MessageDisplay`,
`ReasoningBlockCompleted`, `BeforeToolSelection`, `PostToolBatch`, `Notification`, `TaskCreated`,
`TaskCompleted`, `TaskExecutionStarted`, `TaskExecutionCompleted`, `StopFailure`, `TurnInterrupted`,
`TeammateIdle`, `ConfigChange`, `CwdChanged`, `DirectoryAdded`, `FileChanged`, `WorktreeCreate`,
`WorktreeRemove`, `PreCompact`, `PostCompact`, `PreModelSwitch`, `PostModelSwitch`, `Elicitation`,
`ElicitationResult`, and `NetworkAccessRequest`.

The registry is **open**. Registering a new canonical event requires a documented boundary, at least
one shipping implementation, and an entry in the comparison table.

### 3.3 Vendor events

A host MAY emit events outside the registry. Such an event's `hook_event_name` MUST be prefixed
`x-<vendor>/`, where `<vendor>` matches `^[a-z][a-z0-9-]*$` — for example `x-acme/PolicyReload`.

A host MUST NOT emit an unprefixed name that is not in the registry. A hook receiving an unknown
`hook_event_name` MUST return no verdict rather than fail.

### 3.4 Coverage today

**No surveyed host emits all thirteen Core events.**

| Host | Core events emitted as an exact boundary | Emitted with divergent semantics | Not emitted |
|---|---:|---:|---:|
| Claude Code | 11 | 0 | 2 |
| OpenAI Codex | 9 | 1 | 3 |
| Cursor | 9 | 1 | 3 |
| GitHub Copilot CLI | 9 | 0 | 4 |
| Gemini CLI | 7 | 3 | 3 |
| Hermes Agent | 8 | 4 | 1 |
| OpenClaw | 2 | 10 | 1 |
| Kiro | 5 | 0 | 8 |

Two gaps dominate, and they are this document's principal findings:

- **`BeforeModelRequest` and `AfterModelResponse` are emitted by three of eight hosts** (Gemini CLI,
  OpenClaw, Hermes Agent). Five hosts — including Claude Code, the most complete implementation
  surveyed — expose no hook at the model-call boundary at all. A policy layer on those hosts cannot
  see what was sent to the model provider or what came back, only what was done afterwards. Prompt
  injection arriving through retrieved content, and data egress in an outbound prompt, are both
  invisible.
- **`PermissionDenied` is emitted by one of eight hosts** (Claude Code). A refusal is therefore not
  independently auditable on seven hosts; it can only be inferred from the absence of a subsequent
  `PreToolUse`, which is not a sound inference.

Per-event detail is in Annex B. Full cross-agent naming is in `spec/comparison/event-comparison.md`.

### 3.5 Why not eight interception points

[responsibleai/agent-hooks] defines a closed set of eight interception points. This document defines
a larger, open registry instead, for two reasons.

First, the surveyed runtimes emit boundaries that do not map onto eight points without loss —
`PreCompact`, `WorktreeCreate`, `Elicitation`, `TaskCreated`, `ConfigChange`, `FileChanged`, and
`PermissionDenied` among them. Collapsing them discards documented behaviour that policy code
already depends on.

Second, a closed set cannot absorb new boundaries as runtimes evolve. §3.2's registry admits new
events under a stated bar, and §3.3 gives vendors a namespace that does not require registry changes.

Where the two models overlap, this document's Core events are a superset of the reference
specification's tool and model seams, and §11's reserved reasons are deliberately name-compatible
with it.

---

## 4. Request envelope

### 4.1 Common fields

Every request MUST contain:

| Field | Type | Description |
|---|---|---|
| `spec` | string | Matches `^agent-hooks/\d+\.\d+$`. This version emits `agent-hooks/0.1`. |
| `hook_event_name` | string | A canonical event name (§3) or an `x-<vendor>/` name (§3.3). |
| `session_id` | string | Stable for the lifetime of one session. |
| `timestamp` | string | RFC 3339 instant in UTC. |
| `sequence` | integer | ≥ 0, strictly increasing within a session. See §10.1. |
| `cwd` | string | Absolute path of the host's working directory. |

Every request SHOULD contain:

| Field | Type | Description |
|---|---|---|
| `trace` | object | W3C Trace Context; see §10.2. |
| `agent` | object | `{ id, framework }` REQUIRED if present; `{ name, version }` OPTIONAL. |
| `turn_id` | string | Stable across one turn. Present from `UserPromptSubmit` through `Stop`. |
| `permission_mode` | string | The host's active permission mode, where applicable. |

A request MAY contain any additional field. Hooks MUST ignore fields they do not recognise.

Vendor-specific fields MUST be namespaced under `extensions.<vendor>`, where `<vendor>` matches
`^[a-z][a-z0-9_]*$`. The namespaces `agent_hooks`, `ocsf`, and `otel` are reserved.

### 4.2 Envelope example

```json
{
  "spec": "agent-hooks/0.1",
  "hook_event_name": "PreToolUse",
  "session_id": "3f1a9c2e-8b47-4d51-9e0a-6c2d7f8b1a30",
  "turn_id": "turn_04",
  "timestamp": "2026-09-08T11:42:07.318Z",
  "sequence": 87,
  "cwd": "/Users/dev/project",
  "trace": {
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
    "span_id": "00f067aa0ba902b7",
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
  },
  "agent": { "id": "main", "framework": "claude-code", "version": "2.1.89" },
  "permission_mode": "default",
  "tool_name": "Bash",
  "tool_use_id": "toolu_01ABC123",
  "tool_input": {
    "command": "curl http://internal.example/api",
    "description": "Fetch service config",
    "timeout": 120000
  }
}
```

### 4.3 Core event payloads

Fields below are additional to §4.1. A field marked REQUIRED MUST be present when the host emits
that event.

| Event | Field | Req. | Type | Notes |
|---|---|---|---|---|
| `SessionStart` | `source` | ✔ | string | `startup`, `resume`, `clear`, `compact`, or `fork`. |
| | `model` | | object | `{ id, vendor }` of the initially selected model. |
| `UserPromptSubmit` | `prompt` | ✔ | string | The submitted text. |
| `BeforeModelRequest` | `model` | ✔ | object | `{ id, vendor, params }`. |
| | `messages` | ✔ | array | The full message array about to be dispatched. |
| | `tools` | | array | Names of tools offered to the model on this call. |
| `AfterModelResponse` | `model` | ✔ | object | `{ id, vendor }`. |
| | `response` | ✔ | object | `{ content, tool_calls, finish_reason }`. |
| | `usage` | | object | `{ input_tokens, output_tokens }`. |
| `PreToolUse` | `tool_name` | ✔ | string | See `spec/comparison/tool-name-comparison.md`. |
| | `tool_input` | ✔ | object | Tool-specific. Validate by `tool_name`, never as a fixed schema. |
| | `tool_use_id` | ✔ | string | Correlates with `PostToolUse` / `PostToolUseFailure`. |
| `PostToolUse` | `tool_name`, `tool_input`, `tool_use_id` | ✔ | | As above. |
| | `tool_response` | ✔ | object | Structured result. |
| | `duration_ms` | | number | |
| `PostToolUseFailure` | `tool_name`, `tool_input`, `tool_use_id` | ✔ | | As above. |
| | `error` | ✔ | object | `{ type, message }`. |
| | `is_interrupt` | | boolean | |
| `PermissionRequest` | `tool_name` | ✔ | string | |
| | `tool_input` | ✔ | object | |
| | `suggestions` | | array | Host-proposed permission grants. |
| `PermissionDenied` | `tool_name`, `tool_input`, `tool_use_id` | ✔ | | |
| | `reason` | ✔ | string | Why the operation was refused. |
| | `denied_by` | ✔ | string | `user`, `policy`, `hook`, or `host`. |
| `SubagentStart` | `agent_id` | ✔ | string | |
| | `agent_type` | ✔ | string | |
| | `parent_agent_id` | | string | Absent for a top-level spawn. |
| `SubagentStop` | `agent_id`, `agent_type` | ✔ | | |
| | `last_assistant_message` | | string | |
| `Stop` | `turn_id` | ✔ | string | |
| | `last_assistant_message` | | string | |
| `SessionEnd` | `reason` | ✔ | string | `clear`, `resume`, `logout`, `exit`, `error`, or `other`. |

`PermissionRequest` intentionally omits `tool_use_id`: the approval decision precedes the creation of
a tool-use identity. `PermissionDenied` carries `tool_use_id` because the refusal is bound to a
specific attempt.

Extended event payloads are host-defined until registered. Hosts SHOULD follow
`spec/claude-code.md` where an equivalent Claude Code contract exists.

---

## 5. Verdict

### 5.1 Object

A verdict is a JSON object. Every field is OPTIONAL. An empty object `{}`, an empty body, or no
response at all is a valid verdict meaning *observed, no action* — this is how a hook expresses pure
observation.

```
Verdict := {
  decision:  "allow" | "deny" | "ask" | "defer",   // §5.2  gate axis
  reason:    string,                               // §5.6  machine identifier
  message:   string,                               // §5.6  human-readable text
  context:   string,                               // §5.3  enrichment
  transform: [ { path, value }, ... ],             // §5.4  mutation
  continue:  boolean                               // §5.7  turn control
}
```

`decision`, `context`, and `transform` are **independent axes**. A hook MAY return any combination.
Returning `{"decision": "allow", "context": "...", "transform": [...]}` in a single verdict is
well-formed and common: the hook permits the operation, rewrites part of it, and explains why.

This is a deliberate departure from a flat verdict enum. Every host surveyed already returns such
combinations — Claude Code's `permissionDecision` coexists with `additionalContext` and
`updatedInput` in one response — and a single enum cannot represent them.

A verdict containing an unrecognised field MUST be accepted; the host MUST ignore that field.

### 5.2 `decision`

The gate axis. The vocabulary is closed.

| Value | Meaning | Host obligation |
|---|---|---|
| `allow` | Proceed. | Continue the operation. |
| `deny` | Do not proceed. | On a gate event, abort the operation and surface `message`. On an observe event, record and continue (§6.2). |
| `ask` | Require human approval before proceeding. | Route to the approval seam (§9). |
| `defer` | Suspend pending an out-of-band decision. | Suspend the operation (§9.3). |

Absence of `decision` is equivalent to `allow` for gating purposes, but MUST NOT be recorded as an
affirmative allow in an audit trail. The distinction matters in §7: an absent decision does not
compete in severity ordering.

### 5.3 `context`

A string injected into the agent's context before the operation proceeds. It does not alter the
gate.

A host MUST deliver `context` to the model at the earliest point after the event at which context can
be added, and MUST NOT deliver it as a user message. If a host cannot deliver context for a given
event, it MUST declare that event as not supporting enrichment (§13.1).

`context` originates outside the model and outside the user. Hosts SHOULD delimit it so the model can
distinguish it from user input; see §14.5.

### 5.4 `transform`

An array of replacement operations, applied to the event's `$target` (§5.5).

```
transform := [ { path: JSONPointer, value: any }, ... ]
```

- `path` is an [RFC 6901] JSON Pointer resolved **against `$target`**, not against the request root.
- The empty pointer `""` addresses the entire target, and is how whole-object replacement is
  expressed. A host that supports only whole-object replacement conforms by accepting `""` and
  rejecting all other pointers with `host_error:transform_invalid`.
- Operations within one verdict are applied in array order.
- A host MUST reject a verdict whose own operations overlap (§5.4.1) with
  `host_error:transform_invalid`. This is a hook defect; silently choosing a winner hides it.

#### 5.4.1 Overlap

Two pointers **overlap** if one is a token-wise prefix of the other, or they are equal.

Comparison is by reference token, not by string. `/foo` and `/foobar` do **not** overlap; `/foo` and
`/foo/0` do. A host MUST NOT use string prefix comparison.

| A | B | Overlap | Rationale |
|---|---|---|---|
| `/stdout` | `/stderr` | no | disjoint siblings |
| `""` | `/stdout` | yes | `""` is an ancestor of every pointer |
| `/stdout` | `/stdout/0` | yes | ancestor/descendant |
| `/foo` | `/foobar` | no | distinct tokens, not a token prefix |
| `/a/b` | `/a/b` | yes | equal |

Overlap across verdicts from different hooks is resolved in §7.4.

#### 5.4.2 Ordering

A host MUST apply `transform` **before** honouring `decision`, so that a hook can rewrite an
operation and permit the rewritten form in one verdict. A host MUST NOT apply `transform` when the
effective decision is `deny`.

### 5.5 `$target` per event

Each event declares at most one mutable value. Events not listed forbid transform; a `transform` on
such an event MUST be rejected with `host_error:transform_target_forbidden`.

| Event | `$target` resolves to |
|---|---|
| `UserPromptSubmit` | `prompt` |
| `BeforeModelRequest` | `messages` |
| `AfterModelResponse` | `response.content` |
| `PreToolUse` | `tool_input` |
| `PostToolUse` | `tool_response` |
| `PostToolUseFailure` | `error` |
| All other Core events | *transform forbidden* |

Confining transform to a declared per-event target keeps the mutable surface closed. A hook cannot
rewrite `session_id`, `tool_use_id`, `trace`, or `sequence`, so correlation and audit identity are
not hook-controlled.

Example — redacting a secret from tool output without blocking the call:

```json
{
  "decision": "allow",
  "reason": "secret_redacted",
  "context": "One environment variable was redacted from this output by policy.",
  "transform": [
    { "path": "/stdout", "value": "AWS_SECRET_ACCESS_KEY=[redacted]\nHOME=/root" },
    { "path": "/stderr", "value": "" }
  ]
}
```

### 5.6 `reason` and `message`

`reason` is a stable machine identifier for correlation and metrics. It SHOULD match
`^[a-z][a-z0-9_]*$`. A hook MUST NOT emit a `reason` beginning with `host_error:` — that namespace is
reserved to the host (§11).

`message` is human-readable text surfaced to the user and, for a `deny` on a gate event, to the model
as the failure explanation. `message` MUST NOT be relied upon for programmatic dispatch.

### 5.7 `continue`

`continue: false` requests that the host end the current turn after resolving this event, rather than
continuing to the next model call. It is orthogonal to `decision`: `{"decision": "allow",
"continue": false}` permits the operation and then stops.

A host MUST honour `continue: false` on `PostToolUse`, `PostToolUseFailure`, and `AfterModelResponse`
at minimum, and MUST declare which other events honour it (§13.1). Where honoured, the host SHOULD
surface `message` as the stop reason.

---

## 6. Host obligations

### 6.1 Emission

A host MUST emit every Core event it declares (§13.1). A host MUST NOT coalesce two occurrences of an
event into one request; see §12.2.

A host MUST emit `sequence` values that strictly increase within a session, across all events,
including events emitted from subagents. See §10.1.

### 6.2 Honouring verdicts

On a **gate event**, a host MUST honour the effective decision (§7) and MUST NOT proceed with the
operation on `deny`.

On an **observe event**, a host MUST record a `deny` and MUST continue. A `deny` on an observe event
is a hook signalling a policy violation after the fact; it is audit signal, not control. A host MUST
NOT silently discard it.

A host MUST apply `context` and `transform` on any event that declares support for them, regardless
of whether the event is a gate event.

### 6.3 Failure semantics

If a hook times out, is unreachable, returns malformed output, or returns a verdict that fails §5
validation, the host MUST synthesize a verdict with a reserved reason (§11) and MUST record it.

**The default disposition of a synthesized failure verdict is `allow` (fail-open).** This matches the
behaviour of the majority of hosts surveyed and is chosen so that a misconfigured hook does not
render an agent unusable.

A host SHOULD additionally implement **strict mode**, in which a synthesized failure verdict on a
gate event has disposition `deny`. Strict mode MAY be configured per session or per event. A host
that implements strict mode MUST declare it (§13.1) and MUST NOT enable it by default.

The security consequences of the fail-open default are stated in §14.1. Deployments enforcing
security policy SHOULD enable strict mode.

### 6.4 Timeouts

A host MUST apply a timeout to every hook invocation and MUST declare its default. On expiry the host
MUST synthesize `host_error:hook_timeout` per §6.3 and MUST NOT wait for a late response. A late
response arriving after synthesis MUST be discarded, not applied.

---

## 7. Composition

When more than one hook is registered for an event, the host MUST invoke all of them, then combine
their verdicts by the following rules. There are no configurable composition profiles.

### 7.1 Invocation

A host MUST invoke every registered hook for the event, even after a `deny`. Short-circuiting would
make an audit hook's record depend on the registration order of an unrelated gate hook.

Hooks are **registered in order**; the registration index is used only for tie-breaking (§7.2) and
transform gathering (§7.4).

### 7.2 Decision aggregation

The effective decision is the one of greatest severity:

```
deny  >  ask  >  defer  >  allow  >  (absent)
```

Ties break to the lowest registration index, which determines whose `reason` and `message` are
surfaced.

**A host MUST NOT let a later verdict weaken an earlier `deny`.** A permissive hook registered after
a restrictive one cannot override it, regardless of order.

`defer` ranks below `ask` because `ask` names a resolver that exists, while `defer` suspends pending
an unspecified external decision; where both are returned, the actionable one wins.

### 7.3 Context aggregation

Every `context` string from every verdict is delivered, concatenated in registration order, separated
by a newline. Contexts are not deduplicated. A `deny` does not suppress the `context` of other hooks,
because that context may explain the denial.

### 7.4 Transform aggregation

The host MUST:

1. Gather the `transform` operations of all verdicts whose effective disposition is not `deny`, in
   registration order.
2. Verify that no two gathered operations overlap (§5.4.1), **across the whole set, before applying
   any of them**.
3. On overlap, deny the operation with `host_error:transform_conflict` and apply nothing.
4. Otherwise apply all operations in gathered order.

Step 2 is deliberately all-or-nothing. Partially applying a transform set produces a state neither
hook intended and neither can detect.

Disjoint operations from independent hooks therefore compose without coordination: a secret redactor
writing `/stdout` and a truncator writing `/stderr` both take effect.

---

## 8. Enforcement mode

A host MUST support at least the `enforce` mode and SHOULD support `evaluate_only`.

| Mode | Behaviour |
|---|---|
| `enforce` | The host honours combined verdicts per §6. |
| `evaluate_only` | The host invokes every hook and records every verdict, but proceeds as if the effective decision were `allow`. Transforms are validated per §5.4 but not applied. The approval seam (§9) is not consulted. |

`evaluate_only` is the only conformant way to observe hook behaviour without enforcing it. A host
MUST NOT achieve the same effect by silently discarding verdicts in `enforce` mode.

A host MUST make the active mode observable to operators and SHOULD include it in the request as
`extensions.agent_hooks.enforcement_mode`.

---

## 9. Approval seam

### 9.1 `ask`

An effective decision of `ask` requires the host to obtain a human decision before proceeding.

A host that has an interactive approval path MUST route the operation to it, presenting `message`.
The human outcome maps to `allow` or `deny` and MUST be recorded, including the identity of the
approver where the host knows it.

A host with no available approval path MUST treat `ask` as `deny` and record
`host_error:approval_unavailable`. This is conformant, not an error condition — but it MUST NOT be
treated as `allow`.

### 9.2 `PermissionRequest` and `PermissionDenied`

`ask` and the `PermissionRequest` event are distinct. `ask` is a hook *requesting* approval;
`PermissionRequest` is the host *notifying hooks* that an approval decision is pending, giving them
the chance to resolve it without human involvement.

A host MUST emit `PermissionDenied` whenever an approval decision refuses an operation, whatever the
source of the refusal — human, policy, hook, or host — recording that source in `denied_by`. This is
what makes refusal independently auditable rather than inferred.

### 9.3 `defer`

An effective decision of `defer` suspends the operation pending an out-of-band decision, without
consuming a human's attention now.

A host that supports `defer` MUST declare a resolution mechanism and a maximum suspension duration.
On expiry it MUST resolve to `deny` and record `host_error:approval_unresolved`. A host that does not
support `defer` MUST treat it as `ask`.

---

## 10. Correlation and content identity

### 10.1 `sequence`

`sequence` is a per-session monotonic counter, strictly increasing across every event the host emits,
including events from subagents. It exists so a receiver can detect dropped or reordered deliveries
without depending on transport ordering or on clock accuracy.

A host MUST NOT reuse a `sequence` value within a session and MUST NOT reset it on resume.

### 10.2 `trace`

Where present, `trace` MUST be [W3C Trace Context]:

| Field | Format |
|---|---|
| `trace_id` | 32 lowercase hex characters, not all zero |
| `span_id` | 16 lowercase hex characters, not all zero |
| `traceparent` | The full `00-<trace_id>-<span_id>-<flags>` header value |

A host SHOULD propagate an inbound trace context rather than generating a new one, so that hook
activity correlates with the surrounding application trace. A host MUST NOT place `trace` in a
verdict; it is host-to-hook only.

This supersedes the free-form `trace_id` string proposed in `spec/extensions.md`.

### 10.3 `content_hash`

A host MAY include `content_hash`: the lowercase hex SHA-256 digest of the [RFC 8785] JSON
Canonicalization Scheme serialization of the request object with `content_hash` itself removed.

`content_hash` identifies equivalent content and detects inconsistent mutation across a delivery
path. It is **not** an authenticity mechanism. Replay prevention requires receiver-side state.
Authenticity requires TLS and a signature or MAC. A receiver MUST NOT treat a matching
`content_hash` as evidence that a request originated from the host.

---

## 11. Reserved reasons

All host-synthesized verdicts MUST carry a `reason` from this closed set. Hooks MUST NOT emit a
`reason` beginning with `host_error:`.

| Reason | Condition |
|---|---|
| `host_error:context_invalid` | The request failed §4 validation before dispatch. |
| `host_error:hook_failed` | The hook raised, exited abnormally, or returned non-JSON. |
| `host_error:hook_timeout` | The hook exceeded the §6.4 timeout. |
| `host_error:verdict_invalid` | The returned verdict failed §5 validation. |
| `host_error:transform_invalid` | A pointer did not resolve, the value could not be set, or operations within one verdict overlapped. |
| `host_error:transform_target_forbidden` | A transform was returned for an event with no `$target` (§5.5). |
| `host_error:transform_conflict` | Two or more gathered operations overlapped (§7.4). |
| `host_error:approval_unavailable` | `ask` was returned but the host has no approval path (§9.1). |
| `host_error:approval_unresolved` | A `defer` expired without resolution (§9.3). |
| `host_error:event_unsupported` | The host cannot emit a declared event. |
| `host_error:enforcement_unavailable` | The host could not enforce a verdict it was obliged to honour. |

Names are deliberately compatible with [responsibleai/agent-hooks] §11 where the conditions
correspond, so that a receiver can classify failures from either specification with one table.

---

## 12. Streaming and parallel tool calls

### 12.1 `AfterModelResponse` fires once per response

`AfterModelResponse` MUST be emitted **once per complete model response**, after the response has
been fully received. A host MUST NOT emit it per streamed chunk.

This is a normative correction to observed behaviour: Gemini CLI's `AfterModel` fires per response
chunk. A hook that gates on a partial response reasons about text that may be contradicted by the
remainder, and a hook that counts invocations cannot infer how many model calls occurred.

A host that surfaces incremental output SHOULD do so through a separate Extended event
(`MessageDisplay`), which carries `delta` and `final` and is explicitly per-chunk.

### 12.2 Parallel tool calls

When a host executes tool calls concurrently, it MUST emit a distinct `PreToolUse` and a distinct
`PostToolUse` or `PostToolUseFailure` per call, each carrying its own `tool_use_id`. A host MUST NOT
coalesce concurrent calls into one event.

`sequence` remains strictly increasing, so interleaved `PreToolUse` events from concurrent calls are
ordered by emission; `tool_use_id` is the only reliable way to pair a pre-event with its post-event.

A host that also emits a batch event (`PostToolBatch`, Extended) MUST still emit the per-call events.

### 12.3 Subagent events

Events emitted from within a subagent MUST carry the subagent's `agent.id` and MUST share the parent
`session_id` and `sequence` space. A receiver reconstructs the delegation tree from
`SubagentStart.parent_agent_id`.

---

## 13. Conformance

### 13.1 Declaration

A host claims conformance by publishing a declaration:

```json
{
  "spec_version": "agent-hooks/0.1",
  "host": "example-agent",
  "host_version": "3.2.0",
  "core_events": {
    "SessionStart": true,
    "UserPromptSubmit": true,
    "BeforeModelRequest": false,
    "AfterModelResponse": false,
    "PreToolUse": true,
    "PostToolUse": true,
    "PostToolUseFailure": true,
    "PermissionRequest": true,
    "PermissionDenied": false,
    "SubagentStart": true,
    "SubagentStop": true,
    "Stop": true,
    "SessionEnd": true
  },
  "extended_events": ["PreCompact", "PostCompact", "Notification"],
  "vendor_events": ["x-example/PolicyReload"],
  "failure_posture": "fail_open",
  "strict_mode_available": true,
  "enforcement_modes": ["enforce", "evaluate_only"],
  "default_timeout_ms": 5000,
  "context_support": ["UserPromptSubmit", "PreToolUse", "PostToolUse"],
  "transform_support": ["UserPromptSubmit", "PreToolUse", "PostToolUse"],
  "continue_support": ["PostToolUse", "PostToolUseFailure"],
  "approval_seam": { "ask": true, "defer": false }
}
```

Every field is REQUIRED. `core_events` MUST list all thirteen keys.

### 13.2 Payload validation

For every event a host declares, an emitted request MUST validate against
`spec/schema/agent-hook.schema.json`. Every verdict a host accepts MUST validate against that
schema's verdict definition.

Reference vectors are in `spec/examples/agent-hook/`. A host MAY treat those vectors as a test
corpus; passing them is necessary but not sufficient for conformance, since a declaration also
asserts behaviour a schema cannot observe.

### 13.3 Full and partial conformance

A host is **conformant** when its declaration is accurate, `core_events` are all `true`, and every
emitted payload validates.

A host is **partially conformant** when its declaration is accurate and every emitted payload
validates, but one or more `core_events` are `false`. A partially conformant host MUST list its gaps
alongside its claim.

Partial conformance is a named, publishable state rather than a failure. On the evidence in §3.4,
every host surveyed would today claim partial conformance.

### 13.4 What a declaration does not prove

A declaration asserts emission and posture. It does not assert that verdicts are honoured correctly,
that failure posture matches documentation under load, or that `sequence` is genuinely gap-free.
Verifying those requires execution against the host, which is out of scope for this version.

---

## 14. Security considerations

### 14.1 Fail-open is the default and is remotely triggerable

§6.3 makes `allow` the default disposition of a synthesized failure verdict. A hook that is slow,
unreachable, or crashing therefore does not block the agent.

The consequence is that **an attacker who can degrade the hook can bypass it**. Load on the policy
service, a saturated network path, or input crafted to make a hook slow all reduce to the same
outcome: the gate opens. The attack requires no access to the hook's logic.

Deployments enforcing security policy SHOULD enable strict mode (§6.3). Deployments that cannot
SHOULD treat hook-derived controls as detective rather than preventive, and MUST NOT represent them
as preventive in a control narrative.

The `host_error:hook_timeout` rate is the signal that distinguishes a healthy deployment from a
bypassed one; it SHOULD be alerted on, not merely logged.

### 14.2 Missing model-call visibility

On the five hosts that do not emit `BeforeModelRequest` or `AfterModelResponse` (§3.4), no hook can
inspect what is sent to or received from the model provider. Two consequences follow.

Content retrieved by a tool and then placed in a prompt is gated at `PreToolUse` — at which point the
content does not yet exist — and never re-examined. **Prompt injection arriving through tool output
is therefore not observable at any hook boundary** on those hosts. Inspecting `PostToolUse` output is
a partial mitigation, because it sees the content, but it cannot see how the content was assembled
into the eventual prompt.

Likewise, data egress in an outbound prompt is invisible. A hook can see that `Read` was called on a
sensitive file, but not whether its contents left the boundary in the next model call.

### 14.3 Transport is unspecified, and exit codes diverge

§1.4 leaves transport host-defined. The practical consequence is that a hook portable at the level of
this specification may still be non-portable in deployment.

The sharpest instance is command-hook exit codes. Claude Code treats exit `2` as a block signal and
other nonzero exits as non-blocking, with `WorktreeCreate` as a documented exception where any
failure aborts. Other hosts assign different meanings. A hook that signals denial by exiting `2`
therefore fails **open and silently** on a host that does not share that convention — the worst
available failure mode, because it produces no error.

Hooks SHOULD signal decisions through an explicit verdict object rather than through exit status.
Operators MUST verify exit-code semantics per host before relying on them. A future version of this
specification SHOULD define normative bindings.

### 14.4 Transform is a privileged capability

A hook with transform capability can rewrite a prompt (`UserPromptSubmit`), the outbound message
array (`BeforeModelRequest`), tool arguments (`PreToolUse`), and tool results (`PostToolUse`). A
compromised or malicious hook can therefore redirect agent behaviour without ever emitting a `deny`,
and the rewrite is invisible to the user unless the host surfaces it.

§5.5's closed `$target` table bounds this: correlation and audit identity (`session_id`,
`tool_use_id`, `trace`, `sequence`) are outside every target and cannot be rewritten. Hosts SHOULD
record the applied operation set in the audit trail, and SHOULD surface transforms applied to
`UserPromptSubmit` to the user, since that is the one target the user authored.

Hook registration is a privileged operation and SHOULD be governed accordingly.

### 14.5 `context` is untrusted input to the model

`context` is injected into the model's context by a party that is neither the user nor the model.
Hosts SHOULD delimit it so the model can distinguish it from user input, and hooks SHOULD NOT place
unvalidated third-party content in it. A hook that forwards an upstream scanner's message verbatim
into `context` extends that scanner's trust boundary to the model.

### 14.6 Requests carry sensitive content

Requests contain prompts, file contents, tool arguments, and model messages. Any delivery path is a
data path out of the agent's boundary.

Hosts SHOULD support restricting which events a given hook receives, so that a hook needing only
`PreToolUse` for `Bash` does not receive every prompt. Receivers SHOULD treat stored requests with
the sensitivity of the underlying content, and `content_hash` (§10.3) SHOULD NOT be assumed to make
a payload safe to log.

### 14.7 `deny` on observe events is not enforcement

§6.2 requires a host to record but not act on a `deny` at an observe event. A hook denying at
`PostToolUse` has not prevented anything; the tool has run and its effect exists. It has changed what
the model subsequently sees.

Control narratives SHOULD NOT count observe-event denials as preventive controls.

---

## 15. References

### Normative

- [RFC 2119] Key words for use in RFCs to Indicate Requirement Levels — https://www.rfc-editor.org/rfc/rfc2119
- [RFC 8174] Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words — https://www.rfc-editor.org/rfc/rfc8174
- [RFC 6901] JavaScript Object Notation (JSON) Pointer — https://www.rfc-editor.org/rfc/rfc6901
- [RFC 8785] JSON Canonicalization Scheme (JCS) — https://www.rfc-editor.org/rfc/rfc8785
- [RFC 3339] Date and Time on the Internet: Timestamps — https://www.rfc-editor.org/rfc/rfc3339
- [W3C Trace Context] — https://www.w3.org/TR/trace-context/
- [OpenTelemetry GenAI semantic conventions] — https://opentelemetry.io/docs/specs/semconv/gen-ai/

### Informative

- [responsibleai/agent-hooks] Agent Hooks Specification v0.1 — https://responsibleai.github.io/agent-hooks/spec/
- [AITF] AI Telemetry Framework v0.2 — https://github.com/girdav01/AITF
- [OCSF] Open Cybersecurity Schema Framework — https://schema.ocsf.io/

### Host documentation (verified 2026-09-07 / 2026-09-08)

- [Claude Code hooks] — https://code.claude.com/docs/en/hooks
- OpenAI Codex hooks — https://developers.openai.com/codex/hooks/
- Gemini CLI hooks — https://geminicli.com/docs/hooks/reference/
- Cursor hooks — https://cursor.com/docs/hooks
- GitHub Copilot CLI hooks — https://docs.github.com/en/copilot/reference/hooks-reference
- Kiro hooks — https://kiro.dev/docs/hooks/
- OpenClaw hooks — https://docs.openclaw.ai/plugins/hooks
- Hermes Agent hooks — https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks

### In this repository

- `spec/claude-code.md` — Claude Code contract notes
- `spec/comparison/event-comparison.md` — cross-agent event registry
- `spec/comparison/tool-name-comparison.md` — cross-agent tool naming
- `spec/schema/agent-hook.schema.json` — canonical schema
- `spec/examples/agent-hook/` — reference vectors

---

## Annex A (normative) — Telemetry mapping

A host or receiver exporting hook events as telemetry MUST use the mappings below, so that events
from different hosts land in the same OCSF classes with the same OpenTelemetry attributes.

### A.1 Event to OCSF class

| Canonical event | OCSF class | Class UID | AITF class |
|---|---|---:|---|
| `SessionStart`, `Stop`, `SessionEnd`, `UserPromptSubmit` | agent_activity | 9001 | AI Agent Activity |
| `BeforeModelRequest`, `AfterModelResponse` | API Activity (Application) | 6003 | AI Model Inference |
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure` | API Activity (Application) | 6003 | AI Tool Execution |
| `SubagentStart`, `SubagentStop` | delegation_activity | 9002 | AI Delegation |
| `PermissionRequest`, `PermissionDenied` | Authentication (IAM) | 3002 | AI Identity |
| Any event with a `deny` verdict | Detection Finding | 2004 | AI Security Finding |

An event carrying an effective `deny` MUST be exported **both** as its class above and as a Detection
Finding, so that policy outcomes are queryable independently of the operation that triggered them.

### A.2 Field to OpenTelemetry GenAI attribute

| Canonical field | OTel GenAI attribute |
|---|---|
| `agent.id` | `gen_ai.agent.id` |
| `agent.name` | `gen_ai.agent.name` |
| `agent.framework` | `gen_ai.system` |
| `session_id` | `gen_ai.conversation.id` |
| `model.id` | `gen_ai.request.model` (request) / `gen_ai.response.model` (response) |
| `model.vendor` | `gen_ai.provider.name` |
| `model.params.temperature` | `gen_ai.request.temperature` |
| `model.params.max_tokens` | `gen_ai.request.max_tokens` |
| `response.finish_reason` | `gen_ai.response.finish_reasons` |
| `usage.input_tokens` | `gen_ai.usage.input_tokens` |
| `usage.output_tokens` | `gen_ai.usage.output_tokens` |
| `tool_name` | `gen_ai.tool.name` |
| `tool_use_id` | `gen_ai.tool.call.id` |
| `trace.trace_id` | trace context `trace_id` |
| `trace.span_id` | trace context `span_id` |

MCP tools additionally map `tool_name`'s server component to `mcp.server.name` and its tool component
to `mcp.tool.name`; see `spec/comparison/tool-name-comparison.md` for each host's naming pattern.

### A.3 Verdict to finding attributes

| Verdict field | Attribute |
|---|---|
| `decision` | `security.decision` |
| `reason` | `security.rule.name` |
| `message` | `security.finding.message` |
| `transform[].path` | `security.remediation.target` |
| hook identity | `security.detector.name` |

---

## Annex B (informative) — Host coverage matrix

Derived from `spec/comparison/event-comparison.md` under the evidentiary basis of §2.3.

Legend: `=` equivalent boundary · `≈` present with divergent semantics · `—` not emitted.

| Core event | Claude Code | Codex | Gemini CLI | Cursor | Copilot CLI | Kiro | OpenClaw | Hermes |
|---|---|---|---|---|---|---|---|---|
| `SessionStart` | = | = | = | = | = | = | ≈ | = |
| `UserPromptSubmit` | = | = | = | = | = | = | ≈ | ≈ |
| `BeforeModelRequest` | — | — | = | — | — | — | ≈ | = |
| `AfterModelResponse` | — | — | ≈ | — | — | — | ≈ | = |
| `PreToolUse` | = | = | = | = | = | = | = | = |
| `PostToolUse` | = | = | = | = | = | = | = | = |
| `PostToolUseFailure` | = | ≈ | ≈ | = | = | — | ≈ | ≈ |
| `PermissionRequest` | = | = | ≈ | ≈ | = | — | ≈ | ≈ |
| `PermissionDenied` | = | — | — | — | — | — | — | — |
| `SubagentStart` | = | = | — | = | = | — | ≈ | = |
| `SubagentStop` | = | = | — | = | = | — | ≈ | = |
| `Stop` | = | = | = | = | = | = | ≈ | ≈ |
| `SessionEnd` | = | = | = | = | = | — | ≈ | = |
| **Exact (`=`)** | **11** | 9 | 7 | 9 | 9 | 5 | 2 | 8 |
| **Any boundary** | **11** | 10 | 10 | 10 | 10 | 5 | 12 | 12 |

Two readings are worth separating. By *exact* boundary, Claude Code leads at 11 of 13. By *any*
boundary, OpenClaw and Hermes Agent cover 12 of 13 — but predominantly with divergent control
semantics, which is precisely the fragmentation this specification exists to make visible rather
than to average away.

No host covers all thirteen under either reading.
