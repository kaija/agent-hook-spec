# Claude Code hook JSON contracts (current implementation)

> Source of truth: Anthropic’s [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks). This document was researched on 2026-09-07. The official reference describes event-specific JSON contracts; it does not publish a single downloadable JSON Schema document. This is a description of Claude Code as implemented today, not the proposed cross-agent specification.

The executable [derived JSON Schema bundle](schema/claude-code-hook.schema.json) is Draft 2020-12.
Use `#/$defs/requestsByEvent/<EventName>` for incoming payloads and
`#/$defs/responsesByEvent/<EventName>` for the corresponding JSON response. It permits additional
properties so new Claude Code fields and MCP server-defined tool shapes remain valid.

## Transport and common envelopes

Command hooks receive the request JSON on standard input. On exit code `0`, stdout may be either plain text (where an event accepts it) or one JSON object. HTTP hooks receive the same request as a `POST` body with `Content-Type: application/json`; a `2xx` JSON-object response uses the same response contract. An HTTP non-`2xx`, connection error, or timeout is normally non-blocking.

Every request contains `session_id`, `transcript_path`, `cwd`, and `hook_event_name`, plus the event fields below. It can also contain:

| Field | When present |
| --- | --- |
| `prompt_id` | After the first user input; correlates work in one user prompt. |
| `scratchpad_dir` | Runtime-created per-session scratchpad directory. Observed on `SessionStart`, `InstructionsLoaded`, and `SessionEnd`; it is not present on every event. |
| `permission_mode` | Events for which the active permission mode is applicable. |
| `effort` | Tool-use-context events when the current model supports effort; shape: `{ "level": "low" | "medium" | "high" | "xhigh" | "max" }`. |
| `agent_id`, `agent_type` | The hook runs inside a subagent, or the session uses `--agent`. |

All JSON responses accept the universal fields below, although some events deliberately discard them.

| Field | Meaning |
| --- | --- |
| `continue` | Defaults to `true`; `false` stops processing where the event honors it. |
| `stopReason` | User-facing explanation for `continue: false`. |
| `systemMessage` | User-facing warning/message where the event honors it. |
| `terminalSequence` | Allow-listed terminal control sequence (notification, title, or bell). |
| `hookSpecificOutput` | Object for event-specific results. Its `hookEventName` must equal the event name. |

Use either structured JSON on stdout with a successful exit or exit-code-only signaling. Exit `2` is the usual command-hook block signal; other nonzero exit codes are ordinarily non-blocking. `WorktreeCreate` is the exception: any failure aborts creation. Output strings are limited to 10,000 characters.

## Event contracts

Each request below inherits the common envelope. “No control” means the hook is suitable for logging or side effects, not for changing the lifecycle operation.

| Event | Request-specific fields | Response / effect |
| --- | --- | --- |
| `SessionStart` | `source`: `startup`, `resume`, `clear`, `compact`, or `fork`; optional `model`, `agent_type`, `session_title`. Resumed/forked sessions can add `seconds_since_last_response`, `context_tokens`, `prompt_cache_likely_expired`, `estimated_cache_write_usd`. | Plain stdout adds context. `hookSpecificOutput`: `additionalContext`, `initialUserMessage` (noninteractive), `sessionTitle`, `watchPaths`, `reloadSkills`. |
| `Setup` | `trigger`: `init` or `maintenance`. | No control; output is discarded. Has `CLAUDE_ENV_FILE`. |
| `InstructionsLoaded` | `file_path`, `memory_type` (`User`, `Project`, `Local`, `Managed`), `load_reason`; optional `globs`, `trigger_file_path`, `parent_file_path`. | No control; output is discarded. |
| `UserPromptSubmit` | `prompt`. | Top-level `decision: "block"` with `reason`; `hookSpecificOutput`: `additionalContext`, `sessionTitle`, `suppressOriginalPrompt`. Plain stdout can add context. |
| `UserPromptExpansion` | `expansion_type` (`slash_command` or `mcp_prompt`), `command_name`, `command_args`, `command_source`, `prompt`. | Top-level `decision: "block"` with `reason`; `hookSpecificOutput.additionalContext`. |
| `MessageDisplay` | `turn_id`, `message_id`, `index`, `final`, `delta`. | `hookSpecificOutput.displayContent` replaces only the rendered text batch. No lifecycle control. |
| `PreToolUse` | `tool_name`, `tool_input`, `tool_use_id`. `tool_input` is tool-specific; file paths for `Read`, `Edit`, and `Write` are absolute. | `hookSpecificOutput`: `permissionDecision` (`allow`, `deny`, `ask`, `defer`), `permissionDecisionReason`, `updatedInput` (full replacement object), `additionalContext`. |
| `PermissionRequest` | `tool_name`, `tool_input`, optional `permission_suggestions`; intentionally no `tool_use_id`. | `hookSpecificOutput.decision`: `behavior` (`allow` or `deny`), optional `updatedInput`, `updatedPermissions`, `message`, `interrupt`. |
| `PermissionDenied` | `tool_name`, `tool_input`, `tool_use_id`, `reason`. | `hookSpecificOutput.retry: true` asks the model to retry when the auto-mode classifier supplied a verdict. |
| `PostToolUse` | `tool_name`, `tool_input`, structured `tool_response`, `tool_use_id`, optional `duration_ms`. | Top-level `decision: "block"` / `reason`; `hookSpecificOutput`: `additionalContext`, `classifierContext`, `updatedToolOutput`, or `updatedMCPToolOutput`. Rewrites what Claude sees, not the already-completed effect. |
| `PostToolUseFailure` | `tool_name`, `tool_input`, `tool_use_id`, `error`, optional `is_interrupt`, `duration_ms`. | `hookSpecificOutput.additionalContext`; can also use top-level `decision: "block"` / `reason`. |
| `PostToolBatch` | `tool_calls`: array of `{ tool_name, tool_input, tool_use_id, tool_response }`. Here `tool_response` is serialized model-visible result content, unlike `PostToolUse`. | `hookSpecificOutput.additionalContext`; top-level `decision: "block"` / `reason` or `continue: false` stops before the next model call. |
| `Notification` | `message`, optional `title`, `notification_type`. | No control; `terminalSequence` still works. |
| `SubagentStart` | `agent_id`, `agent_type`. | `hookSpecificOutput.additionalContext` is injected before the subagent’s first prompt. Cannot block spawning. |
| `SubagentStop` | `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message`, `background_tasks`, `session_crons`. | Top-level `decision: "block"` / `reason` keeps the subagent running; `hookSpecificOutput.additionalContext` gives non-error feedback. |
| `TaskCreated` | `task_id`, `task_subject`, optional `task_description`, `teammate_name`, `team_name` (deprecated). | Exit `2` or top-level `decision: "block"` / `reason` deletes and rejects task creation. `continue: false` is ignored. |
| `TaskCompleted` | Same task fields as `TaskCreated`. | Exit `2` prevents completion. `continue: false` / `stopReason` stops a teammate only when finishing its turn; it is ignored for a `TaskUpdate`-initiated completion. |
| `Stop` | `stop_hook_active`, `last_assistant_message`, `background_tasks`, `session_crons`. | Top-level `decision: "block"` / `reason` continues the main agent; `hookSpecificOutput.additionalContext` supplies non-error feedback. Claude Code overrides after eight consecutive blocks. |
| `StopFailure` | `error` (`rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, or `unknown`), optional `error_details`, `last_assistant_message`. | No control; `terminalSequence` excepted. |
| `TeammateIdle` | `teammate_name`, `team_name` (deprecated). | Exit `2` returns feedback and keeps the teammate working; `continue: false` / `stopReason` stops it entirely. |
| `ConfigChange` | `source` (`user_settings`, `project_settings`, `local_settings`, `policy_settings`, or `skills`), optional `file_path`. | Exit `2` or top-level `decision: "block"` prevents new configuration from applying. `reason` is accepted but not displayed. |
| `CwdChanged` | `old_cwd`, `new_cwd`. | `watchPaths` replaces the dynamic file-watch list; `systemMessage` is honored. Cannot block the change. |
| `DirectoryAdded` | `directory` (absolute), `source` (`slash_command` or `register_repo_root`). | Cannot block. `systemMessage` is delivered as next-turn context for `/add-dir`; debug-log only for SDK registration. |
| `FileChanged` | `file_path` (absolute), `event` (`change`, `add`, or `unlink`). | `watchPaths` replaces the dynamic file-watch list; `systemMessage` is honored. Cannot block the change. |
| `WorktreeCreate` | `name` (worktree slug). | Command hook: last non-empty stdout line is the directory path. HTTP hook: `hookSpecificOutput.worktreePath`. A missing/invalid path or any failure fails creation. |
| `WorktreeRemove` | `worktree_path` (absolute). | No control; output is discarded. |
| `PreCompact` | `trigger` (`manual` or `auto`), `custom_instructions` (string or `null`). | Exit `2` or top-level `decision: "block"` blocks compaction. `systemMessage` and `continue` are discarded. |
| `PostCompact` | `trigger`, `compact_summary`. | No control; output cannot affect the completed compaction. |
| `PreModelSwitch` | `from_model`, `to_model`, `requested_model` (string or `null`), `source` (`command`, `picker`, `sdk`), `context_tokens`, `prompt_cache_warm`, `cache_ttl`, `estimated_cache_write_usd`, `pricing`. | Exit `2` or top-level `decision: "block"` cancels. `hookSpecificOutput`: `permissionDecision` (`allow`, `deny`, `ask`) and `permissionDecisionReason`. No `defer`, `updatedInput`, or `additionalContext`. |
| `PostModelSwitch` | Same schema as `PreModelSwitch`; `source` additionally allows `auto` and `resume`. | Plain stdout or `hookSpecificOutput.additionalContext` is delivered with the next model request. Cannot block. |
| `SessionEnd` | `reason`: `clear`, `resume`, `logout`, `prompt_input_exit`, or `other`. | No control; output is discarded. |
| `Elicitation` | `mcp_server_name`, `message`, optional `mode` (`form` or `url`), `url`, `elicitation_id`, `requested_schema`. | `hookSpecificOutput`: `action` (`accept`, `decline`, `cancel`), and `content` for an accept. Exit `2` denies without surfacing stderr. |
| `ElicitationResult` | `mcp_server_name`, `action`, optional `mode`, `elicitation_id`, `content`. | `hookSpecificOutput.action` and `content` override the user response. Exit `2` changes the effective action to `decline`. |

## Important tool payload distinctions

`PreToolUse` and `PermissionRequest` carry a tool-specific `tool_input`. `PostToolUse` carries that same input plus the tool’s structured `tool_response`. `PostToolBatch` instead provides the serialized result content that the model receives.

For `PreToolUse`, common built-in examples include:

```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite",
    "timeout": 120000,
    "run_in_background": false
  },
  "tool_use_id": "toolu_..."
}
```

The documented `Bash` / `PowerShell` fields are `command`, optional `description`, optional `timeout`, and optional `run_in_background`. `Write` uses absolute `file_path` and `content`; `Edit`, `Read`, `Glob`, `Grep`, web, Agent, `AskUserQuestion`, and MCP tools each have their own argument object. Validate `tool_input` according to `tool_name`, rather than treating it as a fixed schema.

## Structured response examples

Block a tool call before it executes:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Destructive command blocked by policy"
  }
}
```

Replace an already-completed tool result before Claude receives it:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "updatedToolOutput": {
      "stdout": "[redacted]",
      "stderr": "",
      "interrupted": false,
      "isImage": false
    }
  }
}
```

## Hook-type availability

`SessionStart` and `Setup` allow only `command` and `mcp_tool`. The 13 lifecycle/control events `PermissionDenied`, `PermissionRequest`, `PostToolBatch`, `PostToolUse`, `PostToolUseFailure`, `PreToolUse`, `Stop`, `SubagentStop`, `TaskCompleted`, `TaskCreated`, `TeammateIdle`, `UserPromptExpansion`, and `UserPromptSubmit` support all of `command`, `http`, `mcp_tool`, `prompt`, and `agent`. The remaining events support `command`, `http`, and `mcp_tool` but not `prompt` or `agent`.

Prompt and agent hooks do not return the command-hook response envelope. Their evaluator returns:

```json
{ "ok": true, "reason": "Explanation when false", "impossible": false }
```

`ok: false` is interpreted by the individual event; notably it denies `PreToolUse`, continues `Stop` / `SubagentStop` unless `impossible: true`, and ends the turn for `PostToolBatch`, `UserPromptSubmit`, and `UserPromptExpansion`.

## References

- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)
- [Agent SDK hook guide](https://code.claude.com/docs/en/agent-sdk/hooks)
