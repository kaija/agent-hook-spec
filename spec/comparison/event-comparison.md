# Hook Event Comparison

Verified: 2026-09-07 (Codex/Gemini/Cursor/Copilot columns); 2026-09-08 (Kiro/OpenClaw/Hermes Agent
columns, from `specs/kiro.md`, `specs/openclaw.md`, `specs/hermes-agent.md`). Claude Code event
names are the reference rows.

Legend: `=` equivalent boundary, `≈` partial or different control semantics, `—` no documented equivalent.

| Claude Code | OpenAI Codex | Gemini CLI | Cursor | GitHub Copilot CLI | Kiro | OpenClaw | Hermes Agent |
|---|---|---|---|---|---|---|---|
| `SessionStart` | `= SessionStart` | `= SessionStart` | `= sessionStart` | `= sessionStart` | `= SessionStart` | `≈ session_start` (observe only) | `= on_session_start` |
| `Setup` | — | — | — | — | — | — | — |
| `InstructionsLoaded` | — | — | — | — | — | — | — |
| `UserPromptSubmit` | `= UserPromptSubmit` | `= BeforeAgent` | `= beforeSubmitPrompt` | `= userPromptSubmitted` | `= UserPromptSubmit` | `≈ before_agent_run` (gate, fail-closed) | `≈ pre_llm_call` (per turn, context inject only) |
| `UserPromptExpansion` | — | — | — | `≈ userPromptTransformed` | — | — | — |
| `MessageDisplay` | — | — | `≈ afterAgentThought`, `afterAgentResponse` | — | — | — | `≈ reply_payload_sending` (cancel/modify outbound reply) |
| `PreToolUse` | `= PreToolUse` | `= BeforeTool` | `= preToolUse`; specialized pre-hooks | `= preToolUse` | `= PreToolUse` | `= before_tool_call` | `= pre_tool_call` |
| `PermissionRequest` | `= PermissionRequest` | `≈ Notification[ToolPermission]` (observe only) | `≈ preToolUse(permission=ask)` | `= permissionRequest` | — (exit-code allow/block only) | `≈ before_tool_call{requireApproval}` (not a separate event) | `≈ pre_tool_call{action:"approve"}` (escalates, not a separate event) |
| `PermissionDenied` | — | — | — | — | — | — | — |
| `PostToolUse` | `= PostToolUse` | `= AfterTool` | `= postToolUse`; specialized post-hooks | `= postToolUse` | `= PostToolUse` | `= after_tool_call` | `= post_tool_call` |
| `PostToolUseFailure` | `≈ PostToolUse` | `≈ AfterTool` with error | `= postToolUseFailure` | `= postToolUseFailure` | — | `≈ after_tool_call` (error field) | `≈ post_tool_call` (`extra.error_type`/`error_message`) |
| `PostToolBatch` | — | — | — | — | — | — | — |
| `Notification` | — | `= Notification` | — | `= notification` | — | — | — |
| `SubagentStart` | `= SubagentStart` | — | `= subagentStart` | `= subagentStart` | — | `≈ subagent_spawned` (observe only) | `= subagent_start` |
| `SubagentStop` | `= SubagentStop` | — | `= subagentStop` | `= subagentStop` | — | `≈ subagent_ended` (observe only) | `= subagent_stop` |
| `TaskCreated` | — | — | — | — | `≈ PreTaskExec` (spec-task start, not a team task) | — | — |
| `TaskCompleted` | — | — | — | — | `≈ PostTaskExec` (spec-task done, not a team task) | — | — |
| `Stop` | `= Stop` | `= AfterAgent` | `= stop` | `= agentStop` | `= Stop` | `≈ agent_end` (observe); `before_agent_finalize` can force a revise pass | `≈ post_llm_call` (observe only) |
| `StopFailure` | — | — | — | `≈ errorOccurred` | — | — | — |
| `TeammateIdle` | — | — | — | — | — | — | — |
| `ConfigChange` | — | — | — | — | — | `≈ session:patch` (internal, config/model-selection persistence) | — |
| `CwdChanged` | — | — | — | — | — | — | — |
| `DirectoryAdded` | — | — | — | — | — | — | — |
| `FileChanged` | — | — | `≈ afterFileEdit`, `afterTabFileEdit` | — | `≈ PostFileSave`, `PostFileCreate`, `PostFileDelete` | — | — |
| `WorktreeCreate` | — | — | — | — | — | — | — |
| `WorktreeRemove` | — | — | — | — | — | — | — |
| `PreCompact` | `= PreCompact` | `≈ PreCompress` | `= preCompact` | `≈ preCompact` (notification only) | — | `≈ session:compact:before` / `before_compaction` | `≈ session:compress` (gateway-only, observe) |
| `PostCompact` | `= PostCompact` | — | — | — | — | `≈ session:compact:after` / `after_compaction` | — |
| `PreModelSwitch` | — | `≈ BeforeModel` (per call, not switch) | — | — | — | `≈ before_model_resolve` (per call, not switch) | `≈ pre_api_request` (per provider attempt, not switch) |
| `PostModelSwitch` | — | `≈ AfterModel` (per call, not switch) | — | — | — | `≈ model_call_ended`, `llm_output` (per call, not switch) | `≈ post_api_request` (per provider attempt, not switch) |
| `Elicitation` | — | — | — | `≈ notification` elicitation dialog | — | — | — |
| `ElicitationResult` | — | — | — | — | — | — | — |
| `SessionEnd` | `= SessionEnd` | `= SessionEnd` | `= sessionEnd` | `= sessionEnd` | — | `≈ session_end`, `gateway_stop` | `= on_session_finalize` |

## Sources

- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [OpenAI Codex hooks](https://developers.openai.com/codex/hooks/)
- [Gemini CLI hooks](https://geminicli.com/docs/hooks/reference/)
- [Cursor hooks](https://cursor.com/docs/hooks)
- [GitHub Copilot hooks](https://docs.github.com/en/copilot/reference/hooks-reference)
- [Kiro hooks](https://kiro.dev/docs/hooks/) (`specs/kiro.md`)
- [OpenClaw internal hooks](https://docs.openclaw.ai/automation/hooks), [plugin hooks](https://docs.openclaw.ai/plugins/hooks) (`specs/openclaw.md`)
- [Hermes Agent hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks) (`specs/hermes-agent.md`)
