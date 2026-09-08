# Tool Name Comparison

[`spec/proposal.md`](../proposal.md) does **not** standardize tool names — that is an explicit
non-goal (§1.4), because tool argument and result schemas are host- and server-specific. Nothing in
the vendor columns below is canonical, and a hook MUST validate `tool_input` by `tool_name` rather
than as a fixed schema (§4.3).

The **AITF class** column is the one canonical annotation, and it exists for a specific reason.
AITF's *AI Data Retrieval* class (OCSF 6005) has no lifecycle event of its own: retrieval happens
through tools, so it is observable only at `PreToolUse` / `PostToolUse` (proposal.md §3.1). A hook
or telemetry pipeline that needs to distinguish retrieval from mutation must therefore classify by
tool name, and this column is that classification. Rows in bold are retrieval — the ones that can
carry untrusted content into the agent's context.

Every row is exported as OCSF 6003 *AI Tool Execution* per [proposal.md Annex A.1](../proposal.md#annex-a-normative--telemetry-mapping);
the class named here is the additional classification that row carries.

Verified: 2026-09-07 (Codex/Gemini/Cursor/Copilot columns); 2026-09-08 (Kiro/OpenClaw/Hermes Agent
columns, from `specs/kiro.md` §4.4, `specs/openclaw.md` §4.4, `specs/hermes-agent.md` §4.4). Values
below are names exposed to tool-hook matchers or payloads.

| Capability | AITF class | Claude Code | OpenAI Codex | Gemini CLI | Cursor | GitHub Copilot CLI | Kiro | OpenClaw | Hermes Agent |
|---|---|---|---|---|---|---|---|---|---|
| Shell | Tool Execution (6003) | `Bash`, `PowerShell` | `Bash` | `run_shell_command` | `Shell` | `bash`, `powershell`; Claude alias `Bash` | `execute_bash`; alias `shell`; category `shell` | `exec` | `terminal` |
| Read file | **Data Retrieval (6005)** | `Read` | runtime function name | `read_file`, `read_many_files` | `Read` | `view`; Claude alias `Read` | `fs_read`; alias `read`; category `read` | not documented | `read_file` |
| Create file | Tool Execution (6003) | `Write` | `apply_patch` or runtime function name | `write_file` | `Write` | `create`; Claude alias `Write` | `fs_write`; alias `write`; category `write` | not documented | `write_file` |
| Edit file | Tool Execution (6003) | `Edit`, `Write` | `apply_patch`; aliases `Edit`, `Write` | `replace`, `write_file` | `Write` | `edit`, `str_replace_editor`, `apply_patch`; alias `Edit` | `fs_write`; alias `write` (no separate edit tool) | `apply_patch` | `patch` |
| Text search | **Data Retrieval (6005)** | `Grep` | runtime function name | `grep_search` | `Grep` | `grep`, `rg`; Claude alias `Grep` | not documented | not documented | not documented |
| File glob | **Data Retrieval (6005)** | `Glob` | runtime function name | `glob` | not separately documented | `glob`; Claude alias `Glob` | not documented | not documented | not documented |
| Web fetch | **Data Retrieval (6005)** | `WebFetch` | hosted path is not exposed to hooks | `web_fetch` | not listed as a hook matcher value | `web_fetch`; Claude alias `WebFetch` | not documented as a matcher tool name (category `web`; `permissions.rules` category `web_fetch` is a separate, non-hook system) | not documented | not documented |
| Web search | **Data Retrieval (6005)** | `WebSearch` | hosted path is not exposed to hooks | `google_web_search` | not listed as a hook matcher value | runtime-specific; Claude alias `WebSearch` when mapped | not documented as a matcher tool name (category `web`; `permissions.rules` category `web_search` is a separate, non-hook system) | not documented | not documented |
| Ask user | Tool Execution (6003) | `AskUserQuestion` | runtime function name | `ask_user` | agent UI, no matcher value documented | `ask_user`; alias `AskUserQuestion` | not documented | not documented | not documented |
| Subagent/task | Delegation (9002) | `Agent`, `Workflow` | `spawn_agent` also matches `Agent` | no direct built-in equivalent documented | `Task` | `task`; Claude alias `Agent` (`Task` also accepted) | not documented as a matcher tool name (`permissions.rules` category `subagent` is a separate, non-hook system) | not documented as a matcher value (`subagent_spawned`/`subagent_ended` are separate lifecycle events, not a tool name) | `delegate_task` |
| MCP tool | tool-defined | `mcp__<server>__<tool>` | `mcp__<server>__<tool>` | `mcp_<server>_<tool>` | `MCP:<tool_name>` | runtime tool name; no public naming pattern documented | `@server/tool`; whole-server match `@server`; source prefix `@mcp` (all MCP tools) | not documented (only `exec`, `apply_patch` shown as canonical tool IDs) | not documented (no `mcp__server__tool` convention described) |

## Tool name versus command value

`curl`, `wget`, and `nc` are normally **not tool names**. They are executables inside a shell tool's input.

| Agent | Tool field | Command field example |
|---|---|---|
| Claude Code | `tool_name: "Bash"` | `tool_input.command: "curl https://example.com"` |
| OpenAI Codex | `tool_name: "Bash"` | `tool_input.command: "curl https://example.com"` |
| Gemini CLI | `tool_name: "run_shell_command"` | `tool_input.command: "curl https://example.com"` |
| Cursor `preToolUse` | tool type `Shell` | tool input contains `curl https://example.com` |
| Cursor `beforeShellExecution` | not a tool field; separate event | matcher/input is the full command string |
| GitHub Copilot CLI | `toolName: "bash"` | `toolArgs.command: "curl https://example.com"` |

To detect outbound commands consistently, normalize the shell-tool category first, then inspect the command value. Matching only `WebFetch` misses network access performed through `curl`, package managers, scripts, or MCP tools.

## Sources

- [Claude Code tool input schemas](https://code.claude.com/docs/en/hooks#pretooluse-input)
- [OpenAI Codex tool coverage](https://developers.openai.com/codex/hooks/)
- [Gemini CLI tools](https://geminicli.com/docs/reference/tools/)
- [Cursor matcher values](https://cursor.com/docs/hooks#matcher-configuration)
- [GitHub Copilot tool names](https://docs.github.com/en/copilot/reference/hooks-reference#tool-names-for-hook-matching)
- [Kiro hooks](https://kiro.dev/docs/hooks/types/) (`specs/kiro.md`)
- [OpenClaw plugin hooks](https://docs.openclaw.ai/plugins/hooks) (`specs/openclaw.md`)
- [Hermes Agent hooks](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/hooks.md) (`specs/hermes-agent.md`)
