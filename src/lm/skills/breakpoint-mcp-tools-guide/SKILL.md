---
name: breakpoint-mcp-tools-guide
description: "Use when the user asks how to use the breakpoint or debug-session MCP tools, which tool to choose, how to pass parameters, or how to inspect and manage VS Code breakpoints and debug controls through Copilot. 适用于询问如何使用断点或调试会话 MCP 工具、选择哪个工具、如何传参，以及如何通过 Copilot 检查和管理 VS Code 断点与调试控制。"
---

# Debug Tools for Copilot Guide

Use this skill when explaining or choosing the extension's breakpoint MCP tools.

For installation, configuration, and user-facing usage, see the main README first:

- 中文说明: [README.md](../../../../README.md)
- English guide: [README.en.md](../../../../README.en.md)

This skill only covers tool selection, parameter rules, and Copilot-side guidance after the extension has been configured.

## Tool selection

- `list_breakpoints`: use first when the current breakpoint state is unknown.
- `list_breakpoints_in_file`: use when the user wants every breakpoint in one specific file.
- `get_breakpoint_statistics`: use when the user needs a quick summary of the current breakpoint set.
- `search_breakpoints`: use when the user describes breakpoints by text, kind, enabled state, or needs filtering.
- `add_source_breakpoint`: use when adding a source breakpoint at a file and location.
- `add_function_breakpoint`: use when adding a function breakpoint by function name.
- `remove_breakpoint`: prefer `key`; otherwise use `functionName` for function breakpoints, or `filePath` + `line`, and `column` when needed for source breakpoints.
- `set_breakpoint_enabled`: prefer `key`; otherwise use `functionName` for function breakpoints, or `filePath` + `line`, and `column` when needed for source breakpoints.
- `update_breakpoint`: prefer `key`; otherwise use `functionName` for function breakpoints, or `filePath` + `line`, and `column` when needed for source breakpoints. Use this to change enabled state, condition, hit condition, or log message without recreating the breakpoint manually.
- `set_breakpoints_enabled_in_file`: use to enable or disable every source breakpoint in one file.
- `clear_breakpoints`: use to remove every breakpoint currently registered in VS Code.
- `list_debug_sessions`: use to enumerate the currently known debug sessions and their `sessionId` values.
- `list_debug_threads`: use to enumerate the threads known by a selected debug session.
- `pause_debug_session`: use to pause the active debug session.
- `continue_debug_session`: use to resume the active debug session.
- `step_over_debug_session`: use to step over the current line without entering functions.
- `step_into_debug_session`: use to step into the function called on the current line.
- `step_out_debug_session`: use to step out of the current function.
- `restart_debug_session`: use to stop and relaunch the selected debug session from its resolved configuration.
- `stop_debug_session`: use to stop the active debug session.
- `open_debug_source_file`: use to switch the active editor to a target source file before or during debugging.
- `list_debug_launch_configurations`: use to inspect `launch.json` entries that can be started later.
- `start_debug_launch_configuration`: use to start debugging from a launch configuration name or a raw configuration object.
- `list_debug_call_stack`: use to inspect the call stack for a selected session or thread.
- `list_debug_scopes`: use to inspect scopes for a selected stack frame.
- `list_debug_variables`: use to expand a variables reference returned by scopes or another variables call.
- `evaluate_debug_expression`: use to evaluate an expression in the selected debug context.
- `list_debug_watch_expressions`: use to inspect the extension-managed watch list.
- `add_debug_watch_expression`: use to add an expression to the extension-managed watch list.
- `remove_debug_watch_expression`: use to remove one extension-managed watch expression by id.
- `clear_debug_watch_expressions`: use to clear all extension-managed watch expressions.
- `evaluate_debug_watch_expressions`: use to evaluate all extension-managed watch expressions in the selected debug context.

## Parameter rules

- `filePath` may be absolute or workspace-relative.
- When a tool accepts `workspaceFolderPath`, prefer it for relative paths in multi-root workspaces.
- `functionName` applies only to function breakpoints.
- `line` and `column` are 1-based.
- `condition`, `hitCondition`, and `logMessage` may be set to `null` in `update_breakpoint` to clear the existing value.
- Resolve relative paths against the matching workspace folder; if no explicit `workspaceFolderPath` is provided, the extension will try to infer a unique workspace folder or return an ambiguity error.
- Do not invent parameters that are not present in the tool `inputSchema`.
- The debug-session tools accept an optional `sessionId`; if omitted, they act on the active debug session.
- Use `list_debug_sessions` first when you need to know which `sessionId` values are available.
- Use `list_debug_threads` after selecting a debug session when you need to know which thread ids are available.
- Use `restart_debug_session` for stop-and-relaunch behavior rather than adapter-specific restart requests.
- Use `open_debug_source_file` when you need to switch the active editor to the target source file before launching or stepping.
- Use `list_debug_launch_configurations` to inspect `.vscode/launch.json`; if multiple workspace folders contain the same config name, pass `workspaceFolderPath` when starting it.
- Use `start_debug_launch_configuration` with a raw configuration object when you already have the parsed launch entry from `list_debug_launch_configurations`.
- Use `list_debug_call_stack`, `list_debug_scopes`, `list_debug_variables`, and `evaluate_debug_expression` after pausing at a breakpoint or while stopped on a frame.
- Use the watch-expression tools when you want a reusable, extension-managed watch list; they do not read the native VS Code Watch panel.
- `list_debug_sessions` is best-effort and only reflects sessions the extension has observed after activation.

## Recommended workflow

1. Inspect the current state with `list_breakpoints` or `search_breakpoints`.
2. Use `key` when modifying an existing breakpoint if you already have it.
3. Use `update_breakpoint` when only breakpoint properties need to change.
4. Use `functionName` for function breakpoints when a stable `key` is unavailable.
5. Use file-based targeting only for source breakpoints when a stable `key` is unavailable.
6. If the user asks how to call a tool, explain the exact required fields and the matching rule.
7. For pause/continue/step/restart/stop requests, choose the matching debug-session tool instead of a breakpoint tool.
8. When the target debug session is ambiguous, call `list_debug_sessions` first and then pass the selected `sessionId`.
9. When you need a thread id for stepping within a selected session, call `list_debug_threads` first.
10. When the user asks for a reusable MCP configuration snippet for another client, direct them to the `Export MCP Configuration` command.

## Reference

- User guide: [README.md](../../../../README.md) / [README.en.md](../../../../README.en.md)
- 中文说明: [doc/mcp-tools.zh-cn.md](../../../../doc/mcp-tools.zh-cn.md)
- English guide: [doc/mcp-tools.en.md](../../../../doc/mcp-tools.en.md)
