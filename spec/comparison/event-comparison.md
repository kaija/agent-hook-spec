# Hook Event Comparison

**This table is the canonical event registry** referenced by [`spec/proposal.md`](../proposal.md) §3.
The canonical column and the **Tier** column are normative; every vendor column is descriptive and
preserves that product's own documented event names.

| Tier | Meaning |
|---|---|
| **Core** | A conforming host MUST emit this event (proposal.md §3.1). 13 rows. |
| Extended | A host MAY emit this event; if it does, it MUST use the canonical name and payload (§3.2). 28 rows. |

The registry is open. A new canonical event requires a documented boundary, at least one shipping
implementation, and a row here. Events outside the registry are namespaced `x-<vendor>/` (§3.3) and
are not listed. Per-host Core coverage is summarised in [proposal.md Annex B](../proposal.md#annex-b-informative--host-coverage-matrix).

Verified: 2026-09-07 (Codex/Gemini/Cursor/Copilot columns); 2026-09-08 (Kiro/OpenClaw/Hermes Agent
columns, from `specs/kiro.md`, `specs/openclaw.md`, `specs/hermes-agent.md`). Coverage is derived from
each host's published documentation, not from conformance runs; where a host publishes a §13
declaration, that declaration supersedes this table (proposal.md §2.3).

Legend: `=` equivalent boundary, `≈` partial or different control semantics, `—` no documented equivalent.

| Canonical lifecycle event | Tier | Claude Code | OpenAI Codex | Gemini CLI | Cursor | GitHub Copilot CLI | Kiro | OpenClaw | Hermes Agent |
|---|---|---|---|---|---|---|---|---|---|
| `SessionStart` | **Core** | `= SessionStart` | `= SessionStart` | `= SessionStart` | `= sessionStart` | `= sessionStart` | `= SessionStart` | `≈ session_start` (observe only) | `= on_session_start` |
| `Setup` | Extended | `= Setup` | — | — | — | — | — | — | — |
| `InstructionsLoaded` | Extended | `= InstructionsLoaded` | — | — | — | — | — | — | — |
| `UserPromptSubmit` | **Core** | `= UserPromptSubmit` | `= UserPromptSubmit` | `= BeforeAgent` | `= beforeSubmitPrompt` | `= userPromptSubmitted` | `= UserPromptSubmit` | `≈ before_agent_run` (gate, fail-closed) | `≈ pre_llm_call` (per turn, context inject only) |
| `UserPromptExpansion` | Extended | `= UserPromptExpansion` | — | — | — | `≈ userPromptTransformed` | — | — | — |
| `MessageDisplay` | Extended | `= MessageDisplay` | — | — | `≈ afterAgentResponse` | — | — | — | `≈ reply_payload_sending` (cancel/modify outbound reply) |
| `ReasoningBlockCompleted` | Extended | — | — | — | `= afterAgentThought` | — | — | — | — |
| `BeforeModelRequest` | **Core** | — | — | `= BeforeModel` | — | — | — | `≈ before_model_resolve` (before model resolution) | `= pre_api_request` (per provider attempt) |
| `AfterModelResponse` | **Core** | — | — | `≈ AfterModel` (fires per response chunk) | — | — | — | `≈ model_call_ended`, `llm_output` | `= post_api_request` (per provider attempt) |
| `BeforeToolSelection` | Extended | — | — | `= BeforeToolSelection` | — | — | — | — | — |
| `PreToolUse` | **Core** | `= PreToolUse` | `= PreToolUse` | `= BeforeTool` | `= preToolUse`; specialized pre-hooks | `= preToolUse` | `= PreToolUse` | `= before_tool_call` | `= pre_tool_call` |
| `PermissionRequest` | **Core** | `= PermissionRequest` | `= PermissionRequest` | `≈ Notification[ToolPermission]` (observe only) | `≈ preToolUse(permission=ask)` | `= permissionRequest` | — (exit-code allow/block only) | `≈ before_tool_call{requireApproval}` (not a separate event) | `≈ pre_tool_call{action:"approve"}` (escalates, not a separate event) |
| `PermissionDenied` | **Core** | `= PermissionDenied` | — | — | — | — | — | — | — |
| `PostToolUse` | **Core** | `= PostToolUse` | `= PostToolUse` | `= AfterTool` | `= postToolUse`; specialized post-hooks | `= postToolUse` | `= PostToolUse` | `= after_tool_call` | `= post_tool_call` |
| `PostToolUseFailure` | **Core** | `= PostToolUseFailure` | `≈ PostToolUse` | `≈ AfterTool` with error | `= postToolUseFailure` | `= postToolUseFailure` | — | `≈ after_tool_call` (error field) | `≈ post_tool_call` (`extra.error_type`/`error_message`) |
| `PostToolBatch` | Extended | `= PostToolBatch` | — | — | — | — | — | — | — |
| `Notification` | Extended | `= Notification` | — | `= Notification` | — | `= notification` | — | — | — |
| `SubagentStart` | **Core** | `= SubagentStart` | `= SubagentStart` | — | `= subagentStart` | `= subagentStart` | — | `≈ subagent_spawned` (observe only) | `= subagent_start` |
| `SubagentStop` | **Core** | `= SubagentStop` | `= SubagentStop` | — | `= subagentStop` | `= subagentStop` | — | `≈ subagent_ended` (observe only) | `= subagent_stop` |
| `TaskCreated` | Extended | `= TaskCreated` | — | — | — | — | — | — | — |
| `TaskCompleted` | Extended | `= TaskCompleted` | — | — | — | — | — | — | — |
| `TaskExecutionStarted` | Extended | — | — | — | — | — | `= Pre Task Execution` | — | — |
| `TaskExecutionCompleted` | Extended | — | — | — | — | — | `= Post Task Execution` | — | — |
| `Stop` | **Core** | `= Stop` | `= Stop` | `= AfterAgent` | `= stop` | `= agentStop` | `= Stop` | `≈ agent_end` (observe); `before_agent_finalize` can force a revise pass | `≈ post_llm_call` (observe only) |
| `StopFailure` | Extended | `= StopFailure` | — | — | — | `≈ errorOccurred` | — | — | — |
| `TurnInterrupted` | Extended | — | `= Interrupt` | — | — | — | — | — | — |
| `TeammateIdle` | Extended | `= TeammateIdle` | — | — | — | — | — | — | — |
| `ConfigChange` | Extended | `= ConfigChange` | — | — | — | — | — | `≈ session:patch` (internal, config/model-selection persistence) | — |
| `CwdChanged` | Extended | `= CwdChanged` | — | — | — | — | — | — | — |
| `DirectoryAdded` | Extended | `= DirectoryAdded` | — | — | — | — | — | — | — |
| `FileChanged` | Extended | `= FileChanged` | — | — | `≈ afterFileEdit`, `afterTabFileEdit` | — | `≈ PostFileSave`, `PostFileCreate`, `PostFileDelete` | — | — |
| `WorktreeCreate` | Extended | `= WorktreeCreate` | — | — | — | — | — | — | — |
| `WorktreeRemove` | Extended | `= WorktreeRemove` | — | — | — | — | — | — | — |
| `PreCompact` | Extended | `= PreCompact` | `= PreCompact` | `≈ PreCompress` | `= preCompact` | `≈ preCompact` (notification only) | — | `≈ session:compact:before` / `before_compaction` | `≈ session:compress` (gateway-only, observe) |
| `PostCompact` | Extended | `= PostCompact` | `= PostCompact` | — | — | — | — | `≈ session:compact:after` / `after_compaction` | — |
| `PreModelSwitch` | Extended | `= PreModelSwitch` | — | — | — | — | — | — | — |
| `PostModelSwitch` | Extended | `= PostModelSwitch` | — | — | — | — | — | — | — |
| `Elicitation` | Extended | `= Elicitation` | — | — | — | `≈ notification` elicitation dialog | — | — | — |
| `ElicitationResult` | Extended | `= ElicitationResult` | — | — | — | — | — | — | — |
| `SessionEnd` | **Core** | `= SessionEnd` | `= SessionEnd` | `= SessionEnd` | `= sessionEnd` | `= sessionEnd` | — | `≈ session_end`, `gateway_stop` | `= on_session_finalize` |
| `NetworkAccessRequest` | Extended | `≈ Notification[permission_prompt]` (delayed, non-blocking); policy control via sandbox settings | `= PermissionRequest` (managed-network approval) | — | — | `≈ permissionRequest` (`requestSandboxBypass: true`; can deny, but cannot pre-approve) | — | — | — |

`NetworkAccessRequest` compares a runtime hook boundary, not whether a product can enforce a network
policy. Claude Code supports domain allow/deny lists and interactive approval for new domains, but its
`PermissionRequest` hook does not run for a sandboxed command's network request. The observable hook is
the delayed, non-blocking `Notification[permission_prompt]` event instead.

## Sources

- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code sandboxing](https://code.claude.com/docs/en/sandboxing)
- [OpenAI Codex hooks](https://developers.openai.com/codex/hooks/)
- [Gemini CLI hooks](https://geminicli.com/docs/hooks/reference/)
- [Cursor hooks](https://cursor.com/docs/hooks)
- [GitHub Copilot hooks](https://docs.github.com/en/copilot/reference/hooks-reference)
- [Kiro hooks](https://kiro.dev/docs/hooks/) (`specs/kiro.md`)
- [OpenClaw internal hooks](https://docs.openclaw.ai/automation/hooks), [plugin hooks](https://docs.openclaw.ai/plugins/hooks) (`specs/openclaw.md`)
- [Hermes Agent hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks) (`specs/hermes-agent.md`)
