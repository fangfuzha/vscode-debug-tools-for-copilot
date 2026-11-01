# VS Code Debug Tools for Copilot

Let Copilot drive your VS Code breakpoints and debug sessions directly. The extension ships a local MCP service, so the AI can list, add, and modify breakpoints, start and step through debugging, and inspect call stacks and variables — without you clicking through the debugger by hand.

中文说明: [README.md](README.md)

## Features

- **Breakpoint management**: add source and function breakpoints, remove them, enable or disable them, change conditions, hit counts, and log messages, batch toggle every breakpoint in a file, search breakpoints by keyword, type, or state, summarize them, and clear them all.
- **Debug session control**: start a `launch.json` configuration, continue, pause, step into/over/out, restart, stop, and list the current debug sessions and threads.
- **Debug state inspection**: view the call stack, scopes, and variables, and evaluate expressions in the `watch` / `repl` / `hover` context.
- **Watch expressions**: maintain an extension-managed watch list and evaluate it in bulk.
- **Multi-root workspace support**: paths may be absolute or workspace-relative, and `workspaceFolderPath` pins down the target folder when several roots are open.
- **DebugMCP-compatible entry points**: extra tools such as `get_debug_instructions`, `start_debugging`, and `get_variables_values` for clients that expect that calling style.

## How it works

1. On activation the extension starts an HTTP MCP server bound to the loopback address `127.0.0.1`, so it never listens beyond your own machine. The port stays as stable as possible: on restart the extension reuses the port from the previous session, and `vscodeDebugTools.mcpPort` can pin it to a fixed value.
2. The server is registered with VS Code through the `mcpServerDefinitionProviders` contribution point, which is where `VS Code Debug Tools for Copilot` in the MCP server list comes from.
3. Every MCP tool is backed by the official VS Code debug and breakpoint APIs, so all actions apply to the workspace you currently have open, and new breakpoints show up in the editor gutter as usual.
4. The extension never rewrites a third-party client's configuration file. To connect another MCP client, run `Export MCP Configuration` and paste the result into that client.

In short: VS Code still provides all the debugging power; the AI only issues the commands over MCP.

## Installation

Search for "VS Code Debug Tools for Copilot" in the VS Code Marketplace and install it. VS Code 1.144.0 or later is required.

## Configuration

### Copilot Chat (built-in integration)

Copilot Chat talks to this extension through VS Code's native MCP integration, so no extra configuration is needed:

1. Open Copilot Chat and click the tool picker (the tools icon above the chat input).
2. Check `VS Code Debug Tools for Copilot` in the list.
3. The breakpoint and debug tools are now callable from your conversations.

You can also run `MCP: List Servers` from the Command Palette to confirm that the server is registered.

### Other MCP clients

The extension never rewrites a third-party client's configuration file. Run `Export MCP Configuration` from the Command Palette and paste the generated JSON into the target client's MCP settings:

1. Press `Ctrl+Shift+P`, then run `Export MCP Configuration`.
2. Pick a shape: a generic server entry, the VS Code `mcp.json` layout (`servers` wrapper), or the common `mcpServers` wrapper.
3. The snippet is copied to the clipboard and opened in a temporary JSON document — paste it into your client.

The service address looks like `http://127.0.0.1:<port>`. The extension keeps the port as stable as it can: on restart it reuses the port from the previous session. If you need a fixed address, set `vscodeDebugTools.mcpPort` to a specific port (`0` lets the extension choose one).

### Inspecting state and exporting configuration

- The debug icon on the right side of the status bar is this extension's entry point: click it to list every command the extension provides, then pick one to run.
- `Show MCP Diagnostics` writes the current endpoint, the port and where it came from, breakpoint count, debug session count, and more to the "VS Code Debug Tools" output channel, with a shortcut to copy the endpoint.
- `Export MCP Configuration` generates a reusable JSON snippet in one of three shapes: a generic server entry, the VS Code `mcp.json` layout (`servers` wrapper), or the common `mcpServers` wrapper — useful for any other MCP-compatible client.

## Usage

Just describe what you need in Copilot Chat, for example:

- Breakpoints
  - "List all breakpoints in the current workspace"
  - "Add a breakpoint on line 42 of `src/app.ts`"
  - "Add a breakpoint on the `handleRequest` function with the condition `user.role === 'admin'`"
  - "Disable the breakpoint on line 42" / "Disable every breakpoint in this file" / "Clear all breakpoints"
- Debug control
  - "Start the `Run Extension` launch configuration"
  - "Continue" / "Pause" / "Step over" / "Step into" / "Stop debugging"
- Debug inspection
  - "Show me the current call stack and local variables"
  - "Evaluate `payload.items.length` in the debug context"

Adding a breakpoint returns a stable identifier (`key`) for it. Prefer that `key` when removing or updating breakpoints later, since it avoids ambiguity between same-named functions or several breakpoints on one line.

## Tool reference

Breakpoints

| Tool | Purpose |
| --- | --- |
| `list_breakpoints` | List every breakpoint |
| `list_breakpoints_in_file` | List the breakpoints in one file |
| `get_breakpoint_statistics` | Summarize totals, enabled counts, and type distribution |
| `search_breakpoints` | Search breakpoints by keyword, type, or enabled state |
| `add_source_breakpoint` | Add a source breakpoint at a file and line |
| `add_function_breakpoint` | Add a function breakpoint by function name |
| `remove_breakpoint` | Remove a breakpoint |
| `set_breakpoint_enabled` | Enable or disable a breakpoint |
| `update_breakpoint` | Change a breakpoint's state, condition, hit count, or log message |
| `set_breakpoints_enabled_in_file` | Batch enable/disable all source breakpoints in a file |
| `clear_breakpoints` | Remove every breakpoint |

Debug sessions

| Tool | Purpose |
| --- | --- |
| `list_debug_sessions` | List the current debug sessions |
| `list_debug_threads` | List the threads of a session |
| `pause_debug_session` | Pause debugging |
| `continue_debug_session` | Resume execution |
| `step_over_debug_session` | Step over the current line |
| `step_into_debug_session` | Step into the called function |
| `step_out_debug_session` | Step out of the current function |
| `restart_debug_session` | Restart a debug session |
| `stop_debug_session` | Stop debugging |

Workbench and inspection

| Tool | Purpose |
| --- | --- |
| `open_debug_source_file` | Open and focus a source file in the editor |
| `list_debug_launch_configurations` | List the configurations in `launch.json` |
| `start_debug_launch_configuration` | Start debugging by name or raw configuration |
| `list_debug_call_stack` | Inspect the call stack |
| `list_debug_scopes` | Inspect the scopes of a stack frame |
| `list_debug_variables` | Expand a variables reference |
| `evaluate_debug_expression` | Evaluate an expression in a debug context |
| `list_debug_watch_expressions` | List watch expressions |
| `add_debug_watch_expression` | Add a watch expression |
| `remove_debug_watch_expression` | Remove a watch expression |
| `clear_debug_watch_expressions` | Clear all watch expressions |
| `evaluate_debug_watch_expressions` | Evaluate all watch expressions |

DebugMCP-compatible entry points

| Tool | Purpose |
| --- | --- |
| `get_debug_instructions` | Return a Markdown debugging guide |
| `start_debugging` | Start debugging, generating a default configuration per language |
| `get_variables_values` | Read the scope variables of the current paused frame |

For the full input, output, and matching rules of every tool, see:

- [Chinese tool documentation](doc/mcp-tools.zh-cn.md)
- [English tool documentation](doc/mcp-tools.en.md)

The extension also ships a Copilot skill (`VS Code Debug Tools Guide`) that teaches Copilot which tool to pick and how to pass parameters.

## Multi-root workspaces and path rules

- File paths may be absolute or relative to a workspace folder.
- In a multi-root workspace, pass `workspaceFolderPath` together with relative paths. Without it the extension tries to infer a single matching workspace folder and returns an ambiguity error when several candidates exist.
- `list_debug_launch_configurations` and `start_debug_launch_configuration` also need `workspaceFolderPath` when different roots contain launch configurations with the same name.
- `list_debug_launch_configurations` only reads `.vscode/launch.json` from the workspace; configurations supplied by a dynamic `DebugConfigurationProvider` are not enumerated.
- The debug session tools all accept an optional `sessionId` and act on the active session when it is omitted. An invalid `sessionId` produces an error instead of a guess.

## Troubleshooting

- **The tools don't show up in Copilot**: make sure `VS Code Debug Tools for Copilot` is checked in the tool picker, then run `Show MCP Diagnostics` and read the endpoint and any errors in the output channel.
- **A client reports it cannot connect**: run `Show MCP Diagnostics` to read the current endpoint, then run `Export MCP Configuration` and copy the address again. If the client still points at an old port, pin `vscodeDebugTools.mcpPort` in the settings so the address stops changing.
- **A launch configuration cannot be found**: make sure it is defined in the workspace's `.vscode/launch.json`. Configurations from dynamic providers never appear in the list.
- **The call stack or variables come back empty**: those tools are meant for a paused program. Hit a breakpoint or run `Pause Debugging` first.

## Debugging

- Runtime logs and diagnostics are written to the **"VS Code Debug Tools"** output channel (View → Output → select that channel).
- To debug the extension itself, open this project in VS Code, put the cursor on `src/extension.ts`, and press **F5** to start an Extension Development Host. `npm run watch` recompiles automatically on save.
- The vendored upstream reference lives in `third_party/DebugMCP` (a submodule pointing at [microsoft/DebugMCP](https://github.com/microsoft/DebugMCP)). Run `git submodule update --remote third_party/DebugMCP` to move it to the latest upstream commit; CI also refreshes that pointer every day.
- The same tasks can be run from the terminal (Node.js 22 or later is required):

  ```sh
  npm install     # install dependencies
  npm run compile # compile TypeScript
  npm run watch   # recompile on change
  npm run lint    # lint the sources
  ```

- UI strings live in two layers: `package.nls.json` backs the `%placeholder%` entries in `package.json` (command titles, the extension display name, …), while `l10n/bundle.l10n.json` backs the `vscode.l10n.t(...)` calls in the sources. Run `npm run l10n` after changing any `vscode.l10n.t(...)` call to regenerate the runtime master bundle.
- Translation workflow: `npm run l10n:xlf` packs both layers into a single XLIFF (written to `l10n-xlf/`). The file your translator returns must keep the `target-language` attribute on `<file>` and carry a `<target>` for every `<trans-unit>`. `npm run l10n:import` imports it back, places each file where it belongs (`package.nls.<locale>.json` in the extension root, `bundle.l10n.<locale>.json` in `l10n/`), reports the entries that came back without a translation, and finally runs `npm run l10n:check` to verify the key sets.
- To add a language, drop `package.nls.<locale>.json` in the extension root and `bundle.l10n.<locale>.json` in `l10n/`.

## Related resources

- [Use MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
- [VS Code debug API](https://code.visualstudio.com/api/references/vscode-api)
- [Model Context Protocol](https://modelcontextprotocol.io/)
