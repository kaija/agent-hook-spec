# Tool Name Comparison

Verified: 2026-09-07. Values below are names exposed to tool-hook matchers or payloads.

| Capability | Claude Code | OpenAI Codex | Gemini CLI | Cursor | GitHub Copilot CLI |
|---|---|---|---|---|---|
| Shell | `Bash`, `PowerShell` | `Bash` | `run_shell_command` | `Shell` | `bash`, `powershell`; Claude alias `Bash` |
| Read file | `Read` | runtime function name | `read_file`, `read_many_files` | `Read` | `view`; Claude alias `Read` |
| Create file | `Write` | `apply_patch` or runtime function name | `write_file` | `Write` | `create`; Claude alias `Write` |
| Edit file | `Edit`, `Write` | `apply_patch`; aliases `Edit`, `Write` | `replace`, `write_file` | `Write` | `edit`, `str_replace_editor`, `apply_patch`; alias `Edit` |
| Text search | `Grep` | runtime function name | `grep_search` | `Grep` | `grep`, `rg`; Claude alias `Grep` |
| File glob | `Glob` | runtime function name | `glob` | not separately documented | `glob`; Claude alias `Glob` |
| Web fetch | `WebFetch` | hosted path is not exposed to hooks | `web_fetch` | not listed as a hook matcher value | `web_fetch`; Claude alias `WebFetch` |
| Web search | `WebSearch` | hosted path is not exposed to hooks | `google_web_search` | not listed as a hook matcher value | runtime-specific; Claude alias `WebSearch` when mapped |
| Ask user | `AskUserQuestion` | runtime function name | `ask_user` | agent UI, no matcher value documented | `ask_user`; alias `AskUserQuestion` |
| Subagent/task | `Agent`, `Workflow` | `spawn_agent` also matches `Agent` | no direct built-in equivalent documented | `Task` | `task`; Claude alias `Agent` (`Task` also accepted) |
| MCP tool | `mcp__<server>__<tool>` | `mcp__<server>__<tool>` | `mcp_<server>_<tool>` | `MCP:<tool_name>` | runtime tool name; no public naming pattern documented |

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
