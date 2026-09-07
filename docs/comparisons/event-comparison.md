# Hook Event Comparison

Verified: 2026-09-07. Claude Code event names are the reference rows.

Legend: `=` equivalent boundary, `≈` partial or different control semantics, `—` no documented equivalent.

| Claude Code | OpenAI Codex | Gemini CLI | Cursor | GitHub Copilot CLI |
|---|---|---|---|---|
| `SessionStart` | `= SessionStart` | `= SessionStart` | `= sessionStart` | `= sessionStart` |
| `Setup` | — | — | — | — |
| `InstructionsLoaded` | — | — | — | — |
| `UserPromptSubmit` | `= UserPromptSubmit` | `= BeforeAgent` | `= beforeSubmitPrompt` | `= userPromptSubmitted` |
| `UserPromptExpansion` | — | — | — | `≈ userPromptTransformed` |
| `MessageDisplay` | — | — | `≈ afterAgentThought`, `afterAgentResponse` | — |
| `PreToolUse` | `= PreToolUse` | `= BeforeTool` | `= preToolUse`; specialized pre-hooks | `= preToolUse` |
| `PermissionRequest` | `= PermissionRequest` | `≈ Notification[ToolPermission]` (observe only) | `≈ preToolUse(permission=ask)` | `= permissionRequest` |
| `PermissionDenied` | — | — | — | — |
| `PostToolUse` | `= PostToolUse` | `= AfterTool` | `= postToolUse`; specialized post-hooks | `= postToolUse` |
| `PostToolUseFailure` | `≈ PostToolUse` | `≈ AfterTool` with error | `= postToolUseFailure` | `= postToolUseFailure` |
| `PostToolBatch` | — | — | — | — |
| `Notification` | — | `= Notification` | — | `= notification` |
| `SubagentStart` | `= SubagentStart` | — | `= subagentStart` | `= subagentStart` |
| `SubagentStop` | `= SubagentStop` | — | `= subagentStop` | `= subagentStop` |
| `TaskCreated` | — | — | — | — |
| `TaskCompleted` | — | — | — | — |
| `Stop` | `= Stop` | `= AfterAgent` | `= stop` | `= agentStop` |
| `StopFailure` | — | — | — | `≈ errorOccurred` |
| `TeammateIdle` | — | — | — | — |
| `ConfigChange` | — | — | — | — |
| `CwdChanged` | — | — | — | — |
| `DirectoryAdded` | — | — | — | — |
| `FileChanged` | — | — | `≈ afterFileEdit`, `afterTabFileEdit` | — |
| `WorktreeCreate` | — | — | — | — |
| `WorktreeRemove` | — | — | — | — |
| `PreCompact` | `= PreCompact` | `≈ PreCompress` | `= preCompact` | `≈ preCompact` (notification only) |
| `PostCompact` | `= PostCompact` | — | — | — |
| `PreModelSwitch` | — | `≈ BeforeModel` (per call, not switch) | — | — |
| `PostModelSwitch` | — | `≈ AfterModel` (per call, not switch) | — | — |
| `Elicitation` | — | — | — | `≈ notification` elicitation dialog |
| `ElicitationResult` | — | — | — | — |
| `SessionEnd` | `= SessionEnd` | `= SessionEnd` | `= sessionEnd` | `= sessionEnd` |

## Sources

- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [OpenAI Codex hooks](https://developers.openai.com/codex/hooks/)
- [Gemini CLI hooks](https://geminicli.com/docs/hooks/reference/)
- [Cursor hooks](https://cursor.com/docs/hooks)
- [GitHub Copilot hooks](https://docs.github.com/en/copilot/reference/hooks-reference)
