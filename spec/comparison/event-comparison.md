# Hook Event Comparison

Verified: 2026-09-07 (Codex/Gemini/Cursor/Copilot columns); 2026-09-08 (Kiro/OpenClaw/Hermes Agent
columns, from `specs/kiro.md`, `specs/openclaw.md`, `specs/hermes-agent.md`). Canonical lifecycle
events are the reference rows; vendor columns preserve each product's documented event names.

Legend: `=` equivalent boundary, `≈` partial or different control semantics, `—` no documented equivalent.

| Canonical lifecycle event | Claude Code | OpenAI Codex | Gemini CLI | Cursor | GitHub Copilot CLI | Kiro | OpenClaw | Hermes Agent |
|---|---|---|---|---|---|---|---|---|
| `SessionStart` | `= SessionStart` | `= SessionStart` | `= SessionStart` | `= sessionStart` | `= sessionStart` | `= SessionStart` | `≈ session_start` (observe only) | `= on_session_start` |
| `Setup` | `= Setup` | — | — | — | — | — | — | — |
| `InstructionsLoaded` | `= InstructionsLoaded` | — | — | — | — | — | — | — |
| `UserPromptSubmit` | `= UserPromptSubmit` | `= UserPromptSubmit` | `= BeforeAgent` | `= beforeSubmitPrompt` | `= userPromptSubmitted` | `= UserPromptSubmit` | `≈ before_agent_run` (gate, fail-closed) | `≈ pre_llm_call` (per turn, context inject only) |
| `UserPromptExpansion` | `= UserPromptExpansion` | — | — | — | `≈ userPromptTransformed` | — | — | — |
| `MessageDisplay` | `= MessageDisplay` | — | — | `≈ afterAgentResponse` | — | — | — | `≈ reply_payload_sending` (cancel/modify outbound reply) |
| `ReasoningBlockCompleted` | — | — | — | `= afterAgentThought` | — | — | — | — |
| `BeforeModelRequest` | — | — | `= BeforeModel` | — | — | — | `≈ before_model_resolve` (before model resolution) | `= pre_api_request` (per provider attempt) |
| `AfterModelResponse` | — | — | `≈ AfterModel` (fires per response chunk) | — | — | — | `≈ model_call_ended`, `llm_output` | `= post_api_request` (per provider attempt) |
| `BeforeToolSelection` | — | — | `= BeforeToolSelection` | — | — | — | — | — |
| `PreToolUse` | `= PreToolUse` | `= PreToolUse` | `= BeforeTool` | `= preToolUse`; specialized pre-hooks | `= preToolUse` | `= PreToolUse` | `= before_tool_call` | `= pre_tool_call` |
| `PermissionRequest` | `= PermissionRequest` | `= PermissionRequest` | `≈ Notification[ToolPermission]` (observe only) | `≈ preToolUse(permission=ask)` | `= permissionRequest` | — (exit-code allow/block only) | `≈ before_tool_call{requireApproval}` (not a separate event) | `≈ pre_tool_call{action:"approve"}` (escalates, not a separate event) |
| `PermissionDenied` | `= PermissionDenied` | — | — | — | — | — | — | — |
| `PostToolUse` | `= PostToolUse` | `= PostToolUse` | `= AfterTool` | `= postToolUse`; specialized post-hooks | `= postToolUse` | `= PostToolUse` | `= after_tool_call` | `= post_tool_call` |
| `PostToolUseFailure` | `= PostToolUseFailure` | `≈ PostToolUse` | `≈ AfterTool` with error | `= postToolUseFailure` | `= postToolUseFailure` | — | `≈ after_tool_call` (error field) | `≈ post_tool_call` (`extra.error_type`/`error_message`) |
| `PostToolBatch` | `= PostToolBatch` | — | — | — | — | — | — | — |
| `Notification` | `= Notification` | — | `= Notification` | — | `= notification` | — | — | — |
| `SubagentStart` | `= SubagentStart` | `= SubagentStart` | — | `= subagentStart` | `= subagentStart` | — | `≈ subagent_spawned` (observe only) | `= subagent_start` |
| `SubagentStop` | `= SubagentStop` | `= SubagentStop` | — | `= subagentStop` | `= subagentStop` | — | `≈ subagent_ended` (observe only) | `= subagent_stop` |
| `TaskCreated` | `= TaskCreated` | — | — | — | — | — | — | — |
| `TaskCompleted` | `= TaskCompleted` | — | — | — | — | — | — | — |
| `TaskExecutionStarted` | — | — | — | — | — | `= Pre Task Execution` | — | — |
| `TaskExecutionCompleted` | — | — | — | — | — | `= Post Task Execution` | — | — |
| `Stop` | `= Stop` | `= Stop` | `= AfterAgent` | `= stop` | `= agentStop` | `= Stop` | `≈ agent_end` (observe); `before_agent_finalize` can force a revise pass | `≈ post_llm_call` (observe only) |
| `StopFailure` | `= StopFailure` | — | — | — | `≈ errorOccurred` | — | — | — |
| `TurnInterrupted` | — | `= Interrupt` | — | — | — | — | — | — |
| `TeammateIdle` | `= TeammateIdle` | — | — | — | — | — | — | — |
| `ConfigChange` | `= ConfigChange` | — | — | — | — | — | `≈ session:patch` (internal, config/model-selection persistence) | — |
| `CwdChanged` | `= CwdChanged` | — | — | — | — | — | — | — |
| `DirectoryAdded` | `= DirectoryAdded` | — | — | — | — | — | — | — |
| `FileChanged` | `= FileChanged` | — | — | `≈ afterFileEdit`, `afterTabFileEdit` | — | `≈ PostFileSave`, `PostFileCreate`, `PostFileDelete` | — | — |
| `WorktreeCreate` | `= WorktreeCreate` | — | — | — | — | — | — | — |
| `WorktreeRemove` | `= WorktreeRemove` | — | — | — | — | — | — | — |
| `PreCompact` | `= PreCompact` | `= PreCompact` | `≈ PreCompress` | `= preCompact` | `≈ preCompact` (notification only) | — | `≈ session:compact:before` / `before_compaction` | `≈ session:compress` (gateway-only, observe) |
| `PostCompact` | `= PostCompact` | `= PostCompact` | — | — | — | — | `≈ session:compact:after` / `after_compaction` | — |
| `PreModelSwitch` | `= PreModelSwitch` | — | — | — | — | — | — | — |
| `PostModelSwitch` | `= PostModelSwitch` | — | — | — | — | — | — | — |
| `Elicitation` | `= Elicitation` | — | — | — | `≈ notification` elicitation dialog | — | — | — |
| `ElicitationResult` | `= ElicitationResult` | — | — | — | — | — | — | — |
| `SessionEnd` | `= SessionEnd` | `= SessionEnd` | `= SessionEnd` | `= sessionEnd` | `= sessionEnd` | — | `≈ session_end`, `gateway_stop` | `= on_session_finalize` |
| `NetworkAccessRequest` | `≈ Notification[permission_prompt]` (delayed, non-blocking); policy control via sandbox settings | `= PermissionRequest` (managed-network approval) | — | — | `≈ permissionRequest` (`requestSandboxBypass: true`; can deny, but cannot pre-approve) | — | — | — |

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
