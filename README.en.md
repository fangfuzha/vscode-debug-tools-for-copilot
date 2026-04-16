# VS Code Debug Tools for Copilot

A VS Code extension that exposes breakpoint and debug-workbench tools to Copilot Chat through a local MCP service.

## Features

- Registers a local MCP server named `VS Code Debug Tools for Copilot`
- Lets Copilot manage breakpoints in the current workspace
- Supports TypeScript development
- Includes tests and linting configuration

## Usage

### 1. Install and configure

After installing the extension, you need to configure your AI agent the first time you use it:

1. Open the Command Palette with `Ctrl+Shift+P`
2. Run `Configure AI Agent MCP`
3. In the picker, select the agents you want to configure (`Cline`, `Cursor`)
4. Confirm the selection, and the extension will update the corresponding configuration files
5. To inspect the current MCP endpoint, agent configuration, and debug state, run `Show MCP Diagnostics`

### 2. Use breakpoint tools in Copilot

Once configured, you can use the following breakpoint management actions in Copilot Chat:

- **List breakpoints**: ask Copilot to list all breakpoints in the current workspace
- **Add a breakpoint**: ask Copilot to add a breakpoint on line 10 or at function `foo`
- **Remove a breakpoint**: ask Copilot to remove the breakpoint on line 10
- **Enable or disable a breakpoint**: ask Copilot to disable the breakpoint on line 10
- **Debug control**: ask Copilot to start debugging or step through code

### 3. Tool reference

The extension provides a complete set of breakpoint and debug tools. See the following documentation for details:

- [Chinese tool documentation](doc/mcp-tools.zh-cn.md)
- [English tool documentation](doc/mcp-tools.en.md)

These documents include the full tool list, input structures, return values, matching rules, and path handling rules.

### 4. Launch configurations and multi-root workspaces

`start_debug_launch_configuration` supports configuration selection in multi-root workspaces.

- If only one workspace folder is open, you can start a configuration directly by `launchName` or a raw `launchConfiguration` object.
- If multiple workspace folders are open and different roots contain a launch configuration with the same name, pass `workspaceFolderPath` to identify the target workspace.
- `list_debug_launch_configurations` also accepts `workspaceFolderPath`, which lets you inspect the `launch.json` file for a specific workspace folder only.

## Development requirements

- Node.js 20.x or later
- VS Code 1.115.0 or later

## Build and run

1. **Install dependencies**

   In the project root, run:

   ```sh
   npm install
   ```

2. **Compile TypeScript**

   ```sh
   npm run compile
   ```

   Or use watch mode for automatic recompilation:

   ```sh
   npm run watch
   ```

3. **Debug the extension in VS Code**

   Focus the entry file, usually `src/extension.ts`, or the compiled file `out/extension.js`, then press **F5** to launch extension debugging. This opens a new VS Code window with the extension loaded. When debugging through the compiled JavaScript file, choose the `vscode extension development` debugger.

4. **Test the extension**

   In the newly opened VS Code window:
   - Open the Command Palette with `Ctrl+Shift+P`
   - Run the command that shows the welcome message
   - You should see the welcome notification

5. **Use the Copilot MCP breakpoint tools**

   The extension also ships with a Copilot skill:
   - [Breakpoint MCP Tools Guide](src/lm/skills/breakpoint-mcp-tools-guide/SKILL.md)

   The detailed tool documentation has been moved to the `doc/` directory:
   - [doc/mcp-tools.zh-cn.md](doc/mcp-tools.zh-cn.md): Chinese version
   - [doc/mcp-tools.en.md](doc/mcp-tools.en.md): English version

   These documents cover the complete tool list, input shapes, return values, matching rules, and path handling guidance.

6. **Run lint**

   ```sh
   npm run lint
   ```

7. **Run tests**

   ```sh
   npm test
   ```

## Project structure

```text
├── src/
│   └── extension.ts          # extension entry point
├── out/                      # compiled output
├── package.json              # project configuration and dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md                 # project documentation
```

## Packaging and release

1. **Install the vsce tool**

   ```sh
   npm install -g vsce
   ```

2. **Package the extension**

   ```sh
   vsce package
   ```

3. **Publish to the Marketplace**

   ```sh
   vsce publish
   ```

## Development tips

- You need to recompile after code changes before they appear in the debug window
- You can use `npm run watch` to automatically recompile on file changes
- You can set breakpoints in the code while debugging

## Related resources

- [VS Code extension API](https://code.visualstudio.com/api)
- [VS Code extension samples](https://github.com/Microsoft/vscode-extension-samples)
