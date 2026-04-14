import * as path from "node:path";

import * as vscode from "vscode";
import * as z from "zod/v4";

import { createTextResult, type McpServerLike } from "./breakpointTools/shared";
import {
  findLaunchConfigurationByName,
  startDebugLaunchConfiguration,
} from "./debugWorkbench/launchConfigurations";
import {
  type DebugScopeSnapshot,
  type DebugStackFrameSnapshot,
  type DebugVariableSnapshot,
} from "./debugWorkbench/shared";
import {
  resolveDebugSession,
  resolveDebugThreadId,
  snapshotDebugSession,
} from "./debugSessionTools/shared";

const DEBUG_INSTRUCTIONS_URI = "debugmcp://docs/debug_instructions";

const TROUBLESHOOTING_LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "java",
  "csharp",
  "go",
  "rust",
  "php",
  "ruby",
] as const;

type CompatibilityLanguage = (typeof TROUBLESHOOTING_LANGUAGES)[number];

type GetVariablesValuesInput = {
  scope?: "local" | "global" | "all";
};

type StartDebuggingInput = {
  fileFullPath: string;
  workingDirectory: string;
  testName?: string;
  configurationName?: string;
  noDebug?: boolean;
};

/**
 * Register DebugMCP-compatible tools and documentation resources.
 *
 * @param server MCP server instance.
 */
export function registerDebugCompatibilitySupport(server: McpServerLike): void {
  registerGetDebugInstructionsTool(server);
  registerGetVariablesValuesTool(server);
  registerStartDebuggingTool(server);
  registerDebugDocumentationResources(server);
}

/**
 * Register the DebugMCP-compatible get_debug_instructions tool.
 *
 * @param server MCP server instance.
 */
function registerGetDebugInstructionsTool(server: McpServerLike): void {
  server.registerTool(
    "get_debug_instructions",
    {
      description: vscode.l10n.t(
        "Get the debugging guide with step-by-step instructions for effective debugging.",
      ),
      inputSchema: z.object({}),
    },
    async () => ({
      content: [
        {
          type: "text" as const,
          text: getDebugInstructionsMarkdown(),
        },
      ],
    }),
  );
}

/**
 * Register the DebugMCP-compatible get_variables_values tool.
 *
 * @param server MCP server instance.
 */
function registerGetVariablesValuesTool(server: McpServerLike): void {
  server.registerTool(
    "get_variables_values",
    {
      description: vscode.l10n.t(
        "Inspect variable values at the current execution point.",
      ),
      inputSchema: z.object({
        scope: z.enum(["local", "global", "all"]).optional(),
      }),
    },
    async (input) => getVariablesValues(input as GetVariablesValuesInput),
  );
}

/**
 * Register the DebugMCP-compatible start_debugging tool.
 *
 * @param server MCP server instance.
 */
function registerStartDebuggingTool(server: McpServerLike): void {
  server.registerTool(
    "start_debugging",
    {
      description: vscode.l10n.t(
        "Start a debug session for a code file, optionally using a named launch configuration or a test name.",
      ),
      inputSchema: z
        .object({
          fileFullPath: z.string().min(1),
          workingDirectory: z.string().min(1),
          testName: z.string().min(1).optional(),
          configurationName: z.string().min(1).optional(),
          noDebug: z.boolean().optional(),
        })
        .refine(
          (input) =>
            Boolean(input.fileFullPath) && Boolean(input.workingDirectory),
          {
            message: "fileFullPath and workingDirectory are required.",
          },
        ),
    },
    async (input) => startDebugging(input as StartDebuggingInput),
  );
}

/**
 * Register DebugMCP-style debugging documentation resources.
 *
 * @param server MCP server instance.
 */
function registerDebugDocumentationResources(server: McpServerLike): void {
  server.registerResource(
    "Debugging Instructions Guide",
    DEBUG_INSTRUCTIONS_URI,
    {
      description: vscode.l10n.t("Step-by-step instructions for debugging."),
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: getDebugInstructionsMarkdown(),
        },
      ],
    }),
  );

  for (const language of TROUBLESHOOTING_LANGUAGES) {
    server.registerResource(
      `${language} Debugging Tips`,
      `debugmcp://docs/troubleshooting/${language}`,
      {
        description: vscode.l10n.t("Debugging tips specific to {0}.", language),
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: getTroubleshootingMarkdown(language),
          },
        ],
      }),
    );
  }
}

/**
 * Return the DebugMCP-compatible generic debugging guide.
 *
 * @returns Markdown-formatted guide.
 */
function getDebugInstructionsMarkdown(): string {
  return `# Debugging Instructions Guide

Use these steps when debugging with VS Code Debug Tools for Copilot:

1. Set at least one breakpoint before starting a debug session.
2. Prefer \`start_debugging\` for a direct file or test entrypoint.
3. Prefer a named launch configuration when the workspace already defines one.
4. Pause the session before reading call stacks, scopes, or variables.
5. Use \`get_variables_values\`, \`list_debug_call_stack\`, and \`list_debug_scopes\` to inspect state.
6. Use \`evaluate_debug_expression\` only after you have a paused frame.

Root-cause reminders:
- Do not stop at a symptom.
- Trace the value back to the point where it first became incorrect.
- Re-run the session with breakpoints moved closer to the source when needed.

Compatibility notes:
- Copilot can use the \`get_debug_instructions\` tool directly.
- MCP-compatible clients can read this guide from the \`debugmcp://docs/debug_instructions\` resource.
`;
}

/**
 * Return language-specific troubleshooting guidance.
 *
 * @param language Programming language key.
 * @returns Markdown-formatted guide.
 */
function getTroubleshootingMarkdown(language: CompatibilityLanguage): string {
  const contentByLanguage: Record<CompatibilityLanguage, string> = {
    python: vscode.l10n.t(`# Python Debugging Tips

- Make sure the Python extension is installed and the correct interpreter is selected.
- For tests, prefer a launch configuration that uses your test runner explicitly.
- If the script starts but breakpoints are skipped, check source path mappings and virtual environment activation.
`),
    javascript: vscode.l10n.t(`# JavaScript Debugging Tips

- Use a Node-compatible debug type such as \`pwa-node\`.
- Make sure the file you launch is runnable JavaScript or is loaded through a transpilation setup.
- Verify \`cwd\`, \`program\`, and source maps when breakpoints do not bind.
`),
    typescript: vscode.l10n.t(`# TypeScript Debugging Tips

- Prefer a Node-based debug configuration that understands transpiled output or source maps.
- If you debug the source file directly, confirm that your runtime can execute TypeScript.
- Check \`outFiles\` and source maps when breakpoints land in compiled output instead of source.
`),
    java: vscode.l10n.t(`# Java Debugging Tips

- Make sure the Java language support extension is installed.
- Prefer a launch configuration that resolves the correct main class or test class.
- If the debugger cannot attach, verify the project structure and classpath resolution.
`),
    csharp: vscode.l10n.t(`# C# Debugging Tips

- Make sure the C# / .NET debugging extension is installed.
- Open the solution or project root so the debugger can resolve the build output.
- If the session fails to start, confirm that the target project builds successfully first.
`),
    go: vscode.l10n.t(`# Go Debugging Tips

- Make sure the Go extension is installed and configured.
- Verify that the current workspace contains a runnable Go module or package.
- If breakpoints are skipped, confirm that the binary was built with matching source paths.
`),
    rust: vscode.l10n.t(`# Rust Debugging Tips

- Make sure your Rust debug extension and debugger backend are installed.
- Prefer a debug configuration that launches the compiled binary with matching symbols.
- If the session stops in unexpected locations, check build profile and debug symbol generation.
`),
    php: vscode.l10n.t(`# PHP Debugging Tips

- Make sure the PHP debugger extension is installed and configured.
- Verify the PHP interpreter path and any remote or container mappings.
- If breakpoints do not bind, confirm that the web server or CLI entrypoint matches the launched file.
`),
    ruby: vscode.l10n.t(`# Ruby Debugging Tips

- Make sure the Ruby debugger extension is installed.
- Confirm that the selected Ruby version matches the project runtime.
- If execution starts but breakpoints are skipped, check bundler setup and source mapping.
`),
  };

  return contentByLanguage[language];
}

/**
 * Start a compatibility debug session using DebugMCP-style inputs.
 *
 * @param input Debug start request.
 * @returns Start result payload.
 */
async function startDebugging(input: StartDebuggingInput): Promise<unknown> {
  const autoLaunchConfigName = "Default Configuration";

  if (
    input.configurationName &&
    input.configurationName !== autoLaunchConfigName
  ) {
    try {
      const namedConfiguration = await findLaunchConfigurationByName(
        input.configurationName,
      );

      if (namedConfiguration.kind === "compound") {
        return startDebugLaunchConfiguration({
          workspaceFolderPath: namedConfiguration.workspaceFolderPath,
          launchName: namedConfiguration.name,
          noDebug: input.noDebug,
        });
      }

      return startDebugLaunchConfiguration({
        workspaceFolderPath: namedConfiguration.workspaceFolderPath,
        launchConfiguration: namedConfiguration.configuration as Record<
          string,
          unknown
        >,
        noDebug: input.noDebug,
      });
    } catch {
      // Fall through to the auto-generated DebugMCP-style configuration.
    }
  }

  const debugConfiguration = createDefaultDebugConfig(
    input.fileFullPath,
    input.workingDirectory,
    input.testName,
  );

  return startDebugLaunchConfiguration({
    launchConfiguration: debugConfiguration,
    noDebug: input.noDebug,
  });
}

/**
 * Collect variable values for the current paused debug frame.
 *
 * @param input Compatibility scope selector.
 * @returns A text result payload.
 */
async function getVariablesValues(
  input: GetVariablesValuesInput,
): Promise<unknown> {
  const session = resolveDebugSession();
  const resolvedFrameContext = await resolveDebugFrameContext(session);
  const scopesResponse = await session.customRequest("scopes", {
    frameId: resolvedFrameContext.frameId,
  });
  const scopes = Array.isArray(scopesResponse?.scopes)
    ? scopesResponse.scopes
    : [];

  const selectedScopes = scopes
    .filter(isDebugScopeSnapshot)
    .filter((scope: DebugScopeSnapshot) =>
      shouldIncludeScope(scope.name, input.scope ?? "all"),
    );

  const resolvedScopes = await Promise.all(
    selectedScopes.map(async (scope: DebugScopeSnapshot) => ({
      ...scope,
      variables: await loadVariablesForScope(session, scope.variablesReference),
    })),
  );

  return createTextResult({
    session: snapshotDebugSession(session),
    threadId: resolvedFrameContext.threadId,
    frameId: resolvedFrameContext.frameId,
    scope: input.scope ?? "all",
    count: resolvedScopes.reduce(
      (total, scope) => total + scope.variables.length,
      0,
    ),
    scopes: resolvedScopes,
  });
}

/**
 * Resolve a frame and thread for the current debug session.
 *
 * @param session Debug session.
 * @returns Resolved frame context.
 */
async function resolveDebugFrameContext(
  session: vscode.DebugSession,
): Promise<{ frameId: number; threadId: number }> {
  const activeStackItem = vscode.debug.activeStackItem;

  if (
    activeStackItem instanceof vscode.DebugStackFrame &&
    activeStackItem.session.id === session.id
  ) {
    return {
      frameId: activeStackItem.frameId,
      threadId: activeStackItem.threadId,
    };
  }

  const threadId = await resolveDebugThreadId(session);
  const stackTraceResponse = await session.customRequest("stackTrace", {
    threadId,
    startFrame: 0,
    levels: 1,
  });
  const stackFrames = Array.isArray(stackTraceResponse?.stackFrames)
    ? stackTraceResponse.stackFrames
    : [];

  if (!stackFrames.length || !isDebugStackFrameSnapshot(stackFrames[0])) {
    throw new Error(
      vscode.l10n.t(
        "Unable to determine a stack frame for the selected debug session.",
      ),
    );
  }

  return {
    frameId: stackFrames[0].id,
    threadId,
  };
}

/**
 * Load variables for a specific scope.
 *
 * @param session Debug session.
 * @param variablesReference DAP variables reference.
 * @returns Variable snapshots.
 */
async function loadVariablesForScope(
  session: vscode.DebugSession,
  variablesReference: number,
): Promise<DebugVariableSnapshot[]> {
  if (variablesReference <= 0) {
    return [];
  }

  const variablesResponse = await session.customRequest("variables", {
    variablesReference,
  });
  const variables = Array.isArray(variablesResponse?.variables)
    ? variablesResponse.variables
    : [];

  return variables.filter(isDebugVariableSnapshot).map(
    (variable: DebugVariableSnapshot): DebugVariableSnapshot => ({
      name: variable.name,
      value: variable.value,
      type: variable.type,
      evaluateName: variable.evaluateName,
      variablesReference: variable.variablesReference,
      namedVariables: variable.namedVariables,
      indexedVariables: variable.indexedVariables,
      valueChanged: variable.valueChanged,
    }),
  );
}

/**
 * Determine whether a scope should be included in the result.
 *
 * @param scopeName Debug scope name.
 * @param requestedScope Requested compatibility scope.
 * @returns Whether the scope matches.
 */
function shouldIncludeScope(
  scopeName: string,
  requestedScope: "local" | "global" | "all",
): boolean {
  const normalizedScopeName = scopeName.toLowerCase();

  if (requestedScope === "all") {
    return true;
  }

  if (requestedScope === "global") {
    return normalizedScopeName.includes("global");
  }

  return !normalizedScopeName.includes("global");
}

/**
 * Detect a programming language from a source file path.
 *
 * @param fileFullPath Source file path.
 * @returns Detected language key.
 */
function detectLanguageFromFilePath(fileFullPath: string): string {
  const extension = path.extname(fileFullPath).toLowerCase();

  const languageMap: Record<string, string> = {
    ".py": "python",
    ".js": "node",
    ".ts": "node",
    ".jsx": "node",
    ".tsx": "node",
    ".java": "java",
    ".cs": "coreclr",
    ".cpp": "cppdbg",
    ".cc": "cppdbg",
    ".c": "cppdbg",
    ".go": "go",
    ".rs": "lldb",
    ".php": "php",
    ".rb": "ruby",
  };

  return languageMap[extension] ?? "python";
}

/**
 * Create a default debug configuration based on the current file.
 *
 * @param fileFullPath Source file path.
 * @param workingDirectory Working directory chosen by the caller.
 * @param testName Optional test name.
 * @returns A VS Code debug configuration.
 */
function createDefaultDebugConfig(
  fileFullPath: string,
  workingDirectory: string,
  testName?: string,
): vscode.DebugConfiguration {
  const detectedLanguage = detectLanguageFromFilePath(fileFullPath);
  const cwd = path.dirname(fileFullPath) || workingDirectory;

  if (testName && detectedLanguage !== "coreclr") {
    return createTestDebugConfig(detectedLanguage, fileFullPath, cwd, testName);
  }

  const configs: Record<string, vscode.DebugConfiguration> = {
    python: {
      type: "python",
      request: "launch",
      name: "DebugMCP Python Launch",
      program: fileFullPath,
      console: "integratedTerminal",
      cwd,
      env: {},
      stopOnEntry: false,
    },
    node: {
      type: "pwa-node",
      request: "launch",
      name: "DebugMCP Node.js Launch",
      program: fileFullPath,
      console: "integratedTerminal",
      cwd,
      env: {},
      stopOnEntry: false,
    },
    java: {
      type: "java",
      request: "launch",
      name: "DebugMCP Java Launch",
      mainClass: path.basename(fileFullPath, path.extname(fileFullPath)),
      console: "integratedTerminal",
      cwd,
    },
    coreclr: {
      type: "coreclr",
      request: "launch",
      name: "DebugMCP .NET Launch",
      program: fileFullPath,
      console: "integratedTerminal",
      cwd,
      stopAtEntry: false,
    },
    cppdbg: {
      type: "cppdbg",
      request: "launch",
      name: "DebugMCP C++ Launch",
      program: fileFullPath.replace(/\.(cpp|cc|c)$/, ".exe"),
      cwd,
      console: "integratedTerminal",
    },
    go: {
      type: "go",
      request: "launch",
      name: "DebugMCP Go Launch",
      mode: "debug",
      program: fileFullPath,
      cwd,
    },
  };

  return configs[detectedLanguage] ?? configs.python;
}

/**
 * Create a test-focused debug configuration.
 *
 * @param language Detected language.
 * @param fileFullPath Source file path.
 * @param cwd Working directory.
 * @param testName Target test name.
 * @returns A VS Code debug configuration.
 */
function createTestDebugConfig(
  language: string,
  fileFullPath: string,
  cwd: string,
  testName: string,
): vscode.DebugConfiguration {
  const fileName = path.basename(fileFullPath);
  const baseName = path.basename(fileFullPath, path.extname(fileFullPath));

  switch (language) {
    case "python":
      return {
        type: "python",
        request: "launch",
        name: `DebugMCP Python Test: ${testName}`,
        module: "unittest",
        args: [formatPythonTestName(fileFullPath, testName), "-v"],
        console: "integratedTerminal",
        cwd,
        env: {},
        stopOnEntry: false,
        justMyCode: false,
        purpose: ["debug-test"],
      };

    case "node":
      if (fileName.includes(".test.") || fileName.includes(".spec.")) {
        return {
          type: "pwa-node",
          request: "launch",
          name: `DebugMCP Jest Test: ${testName}`,
          program: "${workspaceFolder}/node_modules/.bin/jest",
          args: ["--testNamePattern", testName, "--runInBand", fileFullPath],
          console: "integratedTerminal",
          cwd,
          env: {},
          stopOnEntry: false,
        };
      }

      return {
        type: "pwa-node",
        request: "launch",
        name: `DebugMCP Mocha Test: ${testName}`,
        program: "${workspaceFolder}/node_modules/.bin/mocha",
        args: ["--grep", testName, fileFullPath],
        console: "integratedTerminal",
        cwd,
        env: {},
        stopOnEntry: false,
      };

    case "java":
      return {
        type: "java",
        request: "launch",
        name: `DebugMCP JUnit Test: ${testName}`,
        mainClass: baseName,
        args: ["--tests", `${baseName}.${testName}`],
        console: "integratedTerminal",
        cwd,
      };

    case "coreclr":
      return {
        type: "coreclr",
        request: "launch",
        name: `DebugMCP .NET Test: ${testName}`,
        program: "dotnet",
        args: [
          "test",
          "--filter",
          `FullyQualifiedName~${testName}`,
          "--no-build",
        ],
        console: "integratedTerminal",
        cwd,
        stopAtEntry: false,
      };

    default:
      return {
        type: language,
        request: "launch",
        name: `DebugMCP Launch (test filtering not supported for ${language})`,
        program: fileFullPath,
        console: "integratedTerminal",
        cwd,
        stopOnEntry: false,
      };
  }
}

/**
 * Format a Python test name so unittest can resolve it.
 *
 * @param fileFullPath Python file path.
 * @param testName Test name provided by the caller.
 * @returns Qualified unittest name.
 */
function formatPythonTestName(fileFullPath: string, testName: string): string {
  const moduleName = path.basename(fileFullPath, ".py");

  return testName.includes(".")
    ? `${moduleName}.${testName}`
    : `${moduleName}.${testName}`;
}

/**
 * Check whether a DAP stack frame is valid.
 *
 * @param frame Candidate stack frame.
 * @returns True when the frame looks like a stack frame snapshot.
 */
function isDebugStackFrameSnapshot(
  frame: unknown,
): frame is DebugStackFrameSnapshot {
  return (
    Boolean(frame) &&
    typeof frame === "object" &&
    !Array.isArray(frame) &&
    typeof (frame as DebugStackFrameSnapshot).id === "number"
  );
}

/**
 * Check whether a DAP scope is valid.
 *
 * @param scope Candidate scope.
 * @returns True when the scope looks like a DAP scope.
 */
function isDebugScopeSnapshot(scope: unknown): scope is DebugScopeSnapshot {
  return (
    Boolean(scope) &&
    typeof scope === "object" &&
    !Array.isArray(scope) &&
    typeof (scope as DebugScopeSnapshot).name === "string" &&
    typeof (scope as DebugScopeSnapshot).variablesReference === "number"
  );
}

/**
 * Check whether a DAP variable is valid.
 *
 * @param variable Candidate variable.
 * @returns True when the variable looks like a DAP variable.
 */
function isDebugVariableSnapshot(
  variable: unknown,
): variable is DebugVariableSnapshot {
  return (
    Boolean(variable) &&
    typeof variable === "object" &&
    !Array.isArray(variable) &&
    typeof (variable as DebugVariableSnapshot).name === "string" &&
    typeof (variable as DebugVariableSnapshot).value === "string" &&
    typeof (variable as DebugVariableSnapshot).variablesReference === "number"
  );
}
