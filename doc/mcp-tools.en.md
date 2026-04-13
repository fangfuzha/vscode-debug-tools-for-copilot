# VS Code Debug Tools for Copilot

This document describes the MCP tools exposed by the extension under the `VS Code Debug Tools for Copilot` service. These tools allow Copilot Chat to inspect and control VS Code breakpoints, the active debug session, and common debug-workbench tasks in the current workspace.

Chinese version: [doc/mcp-tools.zh-cn.md](mcp-tools.zh-cn.md)

## Overview

The extension registers a local MCP server and exposes its definition through `vscode.lm.registerMcpServerDefinitionProvider`.

- Service name: `VS Code Debug Tools for Copilot`
- Provider ID: `fangfuzha.vscode-debug-tools-for-copilot`
- MCP server version: `0.5.0`

## Available tools

### `list_breakpoints`

- Input: `{}`
- Description: List every breakpoint currently registered in VS Code for the current workspace. This is a direct snapshot of the in-memory breakpoint set; it does not filter or sort the results.
- Output: an array of breakpoint snapshots, each of which can be reused as a stable reference in follow-up tool calls.

### `list_breakpoints_in_file`

- Input fields:
  - `filePath` (string, required): the file whose source breakpoints should be listed. It can be absolute or relative to the first workspace folder.
- Description: List all source breakpoints in one file.
- Output: the resolved file path, workspace-relative path, count, and matching breakpoint snapshots.

### `get_breakpoint_statistics`

- Input: `{}`
- Description: Summarize the current breakpoint set with total, enabled, disabled, and per-kind counts.
- Output: a statistics object that can be used to confirm bulk operations or to understand the current breakpoint mix.

### `add_source_breakpoint`

- Input fields:
  - `filePath` (string, required): the source file path to break on. It can be absolute or relative to the first workspace folder. An empty string is invalid.
  - `line` (integer, required): the target line number, counted from 1. Zero, negative numbers, and decimals are invalid.
  - `column` (integer, optional): the target column number, counted from 1. If omitted, the breakpoint defaults to column 1 on that line.
  - `enabled` (boolean, optional): whether the new breakpoint should be enabled immediately. Defaults to `true`.
  - `condition` (string, optional): a conditional expression. The breakpoint only stops when the expression evaluates to true.
  - `hitCondition` (string, optional): a hit-count condition. The breakpoint only stops after the specified hit count has been reached.
  - `logMessage` (string, optional): a log message for logpoints. If this field is provided, the breakpoint is typically used for logging instead of pausing.
- Description: Add a new source breakpoint at the specified file and location.
- Behavior: The breakpoint is added through `vscode.debug.addBreakpoints`, and the returned snapshot can be used later to modify or remove the same breakpoint via its stable `key`.

### `add_function_breakpoint`

- Input fields:
  - `functionName` (string, required): the function name to break on. It must not be empty.
  - `enabled` (boolean, optional): whether the new function breakpoint should be enabled immediately. Defaults to `true`.
  - `condition` (string, optional): a conditional expression. The breakpoint only stops when the expression evaluates to true.
  - `hitCondition` (string, optional): a hit-count condition. The breakpoint only stops after the specified hit count has been reached.
  - `logMessage` (string, optional): a log message for logpoints.
- Description: Add a new function breakpoint at the specified function name.
- Behavior: The breakpoint is added through `vscode.debug.addBreakpoints`, and the returned snapshot can be used later to modify or remove the same breakpoint via its stable `key`.

### `remove_breakpoint`

- Input fields:
  - `key` (string, optional): the stable breakpoint identifier. This is the preferred input because it matches the full breakpoint descriptor.
  - `filePath` (string, optional): the file containing the target breakpoint. Required when `key` is not provided.
  - `line` (integer, optional): the target line number, counted from 1. Required when `key` is not provided.
  - `column` (integer, optional): the target column number, counted from 1. This is useful when there are multiple breakpoints on the same line.
  - `functionName` (string, optional): the function name containing the target breakpoint. This can be used instead of `filePath` + `line` for function breakpoints.
- Description: Remove matching breakpoints either by stable `key` or by file path and line number.
- Matching rules:
  - If `key` is provided, it is used first and the full descriptor is matched.
  - If `functionName` is provided, it is used next and matches function breakpoints by name.
  - Otherwise, `filePath` and `line` are required.
  - `column` further narrows the match when there are multiple breakpoints on the same line.

### `set_breakpoint_enabled`

- Input fields:
  - `key` (string, optional): the stable breakpoint identifier. This is the preferred input because it matches the full breakpoint descriptor.
  - `filePath` (string, optional): the file containing the target breakpoint. Required when `key` is not provided.
  - `line` (integer, optional): the target line number, counted from 1. Required when `key` is not provided.
  - `column` (integer, optional): the target column number, counted from 1. This helps disambiguate breakpoints on the same line.
  - `functionName` (string, optional): the function name containing the target breakpoint. This can be used instead of `filePath` + `line` for function breakpoints.
  - `enabled` (boolean, required): the target state. `true` enables the breakpoint and `false` disables it.
- Description: Enable or disable matching breakpoints.
- Behavior: The existing breakpoints are removed and then re-added with the new enabled state. This preserves the location, condition, hit condition, and log message while changing only the enabled flag.

### `update_breakpoint`

- Input fields:
  - `key` (string, optional): the stable breakpoint identifier. This is the preferred input because it matches the full breakpoint descriptor.
  - `filePath` (string, optional): the file containing the target breakpoint. Required when `key` is not provided.
  - `line` (integer, optional): the target line number, counted from 1. Required when `key` is not provided.
  - `column` (integer, optional): the target column number, counted from 1. This helps disambiguate breakpoints on the same line.
  - `functionName` (string, optional): the function name containing the target breakpoint. This can be used instead of `filePath` + `line` for function breakpoints.
  - `enabled` (boolean, optional): the new enabled state.
  - `condition` (string | null, optional): a conditional expression. Pass `null` to clear the existing condition.
  - `hitCondition` (string | null, optional): a hit-count condition. Pass `null` to clear the existing hit condition.
  - `logMessage` (string | null, optional): a log message. Pass `null` to clear the existing log message.
- Description: Update matching breakpoints without changing their location or function name.
- Behavior: The tool removes the matching breakpoints and re-adds them with the requested property changes. Unspecified fields are preserved, and `null` clears the corresponding optional text field. If a matching breakpoint cannot be recreated, it is reported under `unsupported` and left unchanged.

### `add_function_breakpoint` and function breakpoints

- `functionName` applies only to `function` breakpoints.
- If you already have a `key`, prefer it. It is the safest way to target a breakpoint when multiple breakpoints share the same function name.
- If you only know the function name, `remove_breakpoint` and `set_breakpoint_enabled` will match function breakpoints by name.

### `clear_breakpoints`

- Input: `{}`
- Description: Remove every breakpoint currently registered in VS Code, regardless of type, file, or state.

### `set_breakpoints_enabled_in_file`

- Input fields:
  - `filePath` (string, required): the source file to update. It can be absolute or relative to the first workspace folder.
  - `enabled` (boolean, required): the target state. `true` enables every source breakpoint in that file; `false` disables them.
- Description: Enable or disable every source breakpoint in the specified file. This tool only affects `source` breakpoints; it does not change function breakpoints or unknown breakpoint types.

### `search_breakpoints`

- Input fields:
  - `query` (string, required): the search term. It is matched against the breakpoint type, enabled state, file path, workspace-relative path, condition, hit condition, log message, function name, and label.
  - `kind` (`source` | `function` | `unknown`, optional): filters by breakpoint type and only returns breakpoints of the selected kind.
  - `enabled` (boolean, optional): filters by enabled state. `true` returns enabled breakpoints only, `false` returns disabled breakpoints only.
  - `limit` (integer, optional, max 100): the maximum number of results to return. If omitted, all matches are returned.
- Description: Search breakpoints by query text, kind, and enabled state. This is the best tool to use when you know the breakpoint only by description and do not yet have its stable `key`.
- Output: matching breakpoint snapshots together with count and query metadata, so the result can be used for a follow-up modify or delete call.

### `list_debug_sessions`

- Input: `{}`
- Description: List the currently known debug sessions and return their `sessionId` values.
- Output: an array of session snapshots with the session id, name, type, workspace path, active flag, and the last known stopped thread id.
- Note: This is a best-effort result and does not guarantee coverage of sessions that already existed before the extension activated and were not active.

### `list_debug_threads`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
- Description: List the known threads for a selected debug session and return their `threadId` values.
- Output: an array of thread snapshots with the thread id, thread name, and basic session metadata.

### `pause_debug_session`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
- Description: Pause the active debug session and enter break mode.
- Behavior: This matches the VS Code debug toolbar pause button and only affects the active debug session.

### `continue_debug_session`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
- Description: Resume the active debug session until the next breakpoint or program exit.
- Behavior: This matches the VS Code debug toolbar continue button and only affects the active debug session.

### `step_over_debug_session`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
- Description: Execute the current line and step to the next line without entering functions.
- Behavior: This matches VS Code Step Over and only affects the active debug session.

### `step_into_debug_session`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
- Description: Execute the current line and step into the called function if one is invoked.
- Behavior: This matches VS Code Step Into and only affects the active debug session.

### `step_out_debug_session`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
- Description: Step out of the current function and return to the caller.
- Behavior: This matches VS Code Step Out and only affects the active debug session.

### `restart_debug_session`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
- Description: Restart the selected debug session from the beginning.
- Behavior: The tool stops the selected session and relaunches it with the session's resolved configuration, instead of relying on the debug adapter's custom restart request. If relaunching fails, the tool returns an error.

### `stop_debug_session`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
- Description: Stop the active debug session and end debugging.
- Behavior: This matches the VS Code debug toolbar stop button and only affects the active debug session.

### `open_debug_source_file`

- Input fields:
  - `filePath` (string, required): the source file path to focus. It can be absolute or relative to the first workspace folder.
  - `line` (integer, optional): the 1-based line number to focus.
  - `column` (integer, optional): the 1-based column number to focus.
- Description: Open a source file in the active editor and focus it so you can jump the debug context to the right code location.
- Output: the opened file path, workspace-relative path, line, column, and open result.

### `list_debug_launch_configurations`

- Input fields:
  - `workspaceFolderPath` (string, optional): only list `.vscode/launch.json` entries from one workspace folder. If omitted, all workspace folders are scanned.
- Description: List the static debug configurations and compounds from `launch.json`, plus the extension's recent-session cache collected while it was running. It does not actively enumerate every live result from dynamic `DebugConfigurationProvider`s.
- Output: an array of configuration snapshots with the name, kind, source file, workspace path, and raw configuration object; `recentSession` entries are only observation cache entries and are not a complete provider inventory.

### `start_debug_launch_configuration`

- Input fields:
  - `workspaceFolderPath` (string, optional): used to disambiguate same-named configurations across multiple workspace folders.
  - `launchName` (string, optional): the configuration or compound name to start.
  - `launchConfiguration` (object, optional): a raw configuration object returned by `list_debug_launch_configurations`; if provided, it is started directly.
  - `noDebug` (boolean, optional): start without debugging.
- Description: Start debugging from a `launch.json` entry or a raw configuration object.
- Output: the start result, the started session snapshot, and the workspace metadata that was used.

### `list_debug_call_stack`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
  - `threadId` (integer, optional): the target thread id. If omitted, the tool tries the selected thread or resolves one automatically.
  - `startFrame` (integer, optional): the first frame index to return, default `0`.
  - `levels` (integer, optional): the maximum number of frames to return, default `20`.
- Description: List the call stack for a selected thread, which is most useful when debugging is paused.
- Output: the thread id, session snapshot, frame count, and stack frame snapshots.

### `list_debug_scopes`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
  - `threadId` (integer, optional): the target thread id. If omitted, the tool tries to resolve it from the selected stack frame or call stack.
  - `frameId` (integer, optional): the stack frame id. If omitted, the tool tries to resolve it from the selected stack frame or call stack.
- Description: List the scopes for a stack frame, such as locals, parameters, and globals.
- Output: the thread id, frame id, scope count, and scope snapshots.

### `list_debug_variables`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
  - `variablesReference` (integer, required): the variables reference to expand, usually returned by `list_debug_scopes` or a parent variables request.
- Description: Expand a variables reference and list its children.
- Output: the variables reference, variable count, and variable snapshots.

### `evaluate_debug_expression`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
  - `expression` (string, required): the expression to evaluate.
  - `threadId` (integer, optional): the target thread id.
  - `frameId` (integer, optional): the target stack frame id.
  - `context` (string, optional): the evaluation context. Allowed values are `watch`, `repl`, `hover`, and `clipboard`.
- Description: Evaluate an expression in the selected debug context for quick inspection or ad-hoc checks.
- Output: the evaluation result, type, variables reference, and context metadata.

### `list_debug_watch_expressions`

- Input: `{}`
- Description: List the watch expressions maintained by the extension itself.
- Output: the watch expression array and count.

### `add_debug_watch_expression`

- Input fields:
  - `expression` (string, required): the expression to add to the watch list.
- Description: Add one expression to the extension-managed watch list so it can be refreshed later.
- Output: the created watch expression snapshot and the current watch list.

### `remove_debug_watch_expression`

- Input fields:
  - `watchExpressionId` (string, required): the watch expression id to remove.
- Description: Remove one watch expression from the extension-managed watch list.
- Output: whether the expression was removed and the updated watch list.

### `clear_debug_watch_expressions`

- Input: `{}`
- Description: Clear all watch expressions maintained by the extension.
- Output: the number of cleared expressions and the empty watch list.

### `evaluate_debug_watch_expressions`

- Input fields:
  - `sessionId` (string, optional): the target debug session id. If omitted, the active debug session is used.
  - `threadId` (integer, optional): the target thread id.
  - `frameId` (integer, optional): the target stack frame id.
- Description: Evaluate all extension-managed watch expressions in one selected debug context.
- Output: per-expression evaluation results, error messages, and context metadata.

## Breakpoint snapshot format

Each returned breakpoint snapshot may include:

- `key`: a stable identifier that can be reused to target the same breakpoint in later tool calls.
- `kind`: the breakpoint type, always one of `source`, `function`, or `unknown`.
- `enabled`: whether the breakpoint is currently enabled.
- `condition`: the conditional expression, if any.
- `hitCondition`: the hit-count condition, if any.
- `logMessage`: the log message, if any.
- `filePath`: the absolute file path for source breakpoints only.
- `workspaceRelativePath`: the path relative to the current workspace for source breakpoints only. This is often better for UI display.
- `line`: the source breakpoint line number, counted from 1.
- `column`: the source breakpoint column number, counted from 1.
- `functionName`: the function name for function breakpoints only.
- `label`: the breakpoint label or constructor name for unknown breakpoint types only.

## Debug session control notes

- The debug-session tools accept an optional `sessionId`; if omitted, they act on the active debug session.
- If `sessionId` is invalid, the tools return an error instead of guessing a target session.
- Select a session first, then call `list_debug_threads` when you need the thread ids for stepping.
- The extension activates on `onDebug` to start tracking as early as possible, but historical sessions can still be missed.
- They correspond to the common VS Code debug toolbar controls rather than breakpoint management actions.
- `list_debug_launch_configurations` only reads `.vscode/launch.json` files from the workspace; configurations provided by other dynamic providers are not enumerated automatically.
- `list_debug_call_stack`, `list_debug_scopes`, `list_debug_variables`, and `evaluate_debug_expression` are best used while debugging is paused.
- Watch expressions are managed by the extension itself instead of reading the native VS Code Watch panel directly.
- `list_debug_launch_configurations` only guarantees `.vscode/launch.json` entries plus the extension's observed recent configurations; if a dynamic provider configuration has never been observed by the extension, it will not appear.
- Do not treat `list_debug_launch_configurations` as a complete enumeration of all currently available dynamic provider configurations. It is only a best-effort view.

## Stable `key` generation

The `key` is a stable identifier generated by:

1. encoding the breakpoint descriptor object as JSON
2. converting the JSON string to Base64URL

The descriptor includes the fields that define breakpoint identity, such as `kind`, `filePath`, `line`, `column`, `functionName`, `condition`, `hitCondition`, `logMessage`, and `label`. That means breakpoints with the same location and settings will produce the same stable `key`, which makes follow-up edits and deletes reliable.

## File path handling

- `filePath` can be either absolute or relative to the first workspace folder.
- If the workspace is not open, relative paths are rejected because there is no base folder to resolve against.
- Paths are normalized for comparison, and on Windows normalization also converts to lowercase to avoid mismatches caused by case differences.
- For automation, absolute paths are preferred unless you intentionally want workspace-relative behavior.

## Notes

- The MCP tools operate directly on the VS Code debugger breakpoint set.
- Relative paths are resolved against the first workspace folder only; multiple workspace folders are not searched automatically.
- If no matching breakpoints are found, the tools return an empty result set.
- If the input itself is invalid, the tool throws an error instead of returning an empty result.
