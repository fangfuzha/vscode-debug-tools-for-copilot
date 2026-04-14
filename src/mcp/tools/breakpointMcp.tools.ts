/**
 * Aggregator for individual Breakpoint MCP tool registrations.
 *
 * This module does not implement tool behavior itself.
 * It imports each tool's registration function and invokes them
 * so the runtime entrypoint can register the full set of tools
 * on a single MCP server instance.
 */
import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../shared";
import { BreakpointManager } from "../../debug/breakpoints";

/**
 * Register all breakpoint tools on the MCP server.
 *
 * @param server MCP server instance.
 * @param breakpointManager Breakpoint manager instance.
 */
export function registerBreakpointTools(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  registerListBreakpointsTool(server, breakpointManager);
  registerListBreakpointsInFileTool(server, breakpointManager);
  registerBreakpointStatisticsTool(server, breakpointManager);
  registerAddSourceBreakpointTool(server, breakpointManager);
  registerAddFunctionBreakpointTool(server, breakpointManager);
  registerRemoveBreakpointTool(server, breakpointManager);
  registerSetBreakpointEnabledTool(server, breakpointManager);
  registerUpdateBreakpointTool(server, breakpointManager);
  registerClearBreakpointsTool(server, breakpointManager);
  registerSetBreakpointsEnabledInFileTool(server, breakpointManager);
  registerSearchBreakpointsTool(server, breakpointManager);
}

/**
 * Register the list_breakpoints MCP tool.
 */
function registerListBreakpointsTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "list_breakpoints",
    {
      description: vscode.l10n.t(
        "List all VS Code breakpoints in the current workspace and return a stable key for each item.",
      ),
      inputSchema: z.object({}),
    },
    async () => createTextResult(breakpointManager.listBreakpoints()),
  );
}

/**
 * Register the list_breakpoints_in_file MCP tool.
 */
function registerListBreakpointsInFileTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "list_breakpoints_in_file",
    {
      description: vscode.l10n.t("List all breakpoints in a specific file."),
      inputSchema: z.object({
        filePath: z
          .string()
          .describe("Path to the file to list breakpoints for"),
      }),
    },
    async (input: { filePath: string }) => {
      const allBreakpoints = breakpointManager.listBreakpoints();
      const fileBreakpoints = allBreakpoints.filter(
        (bp) => bp.filePath === input.filePath,
      );
      return createTextResult(fileBreakpoints);
    },
  );
}

/**
 * Register the get_breakpoint_statistics MCP tool.
 */
function registerBreakpointStatisticsTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "get_breakpoint_statistics",
    {
      description: vscode.l10n.t(
        "Get statistics about breakpoints in the current workspace.",
      ),
      inputSchema: z.object({}),
    },
    async () => createTextResult(breakpointManager.getBreakpointStatistics()),
  );
}

/**
 * Register the add_source_breakpoint MCP tool.
 */
function registerAddSourceBreakpointTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "add_source_breakpoint",
    {
      description: vscode.l10n.t(
        "Add a source breakpoint at a specific location in a file.",
      ),
      inputSchema: z.object({
        filePath: z.string().describe("Path to the file"),
        line: z.number().describe("Line number (1-based)"),
        column: z
          .number()
          .optional()
          .describe("Column number (1-based, optional)"),
      }),
    },
    async (input: { filePath: string; line: number; column?: number }) =>
      createTextResult(
        await breakpointManager.addSourceBreakpoint(
          input.filePath,
          input.line,
          input.column,
        ),
      ),
  );
}

/**
 * Register the add_function_breakpoint MCP tool.
 */
function registerAddFunctionBreakpointTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "add_function_breakpoint",
    {
      description: vscode.l10n.t(
        "Add a function breakpoint for a specific function name.",
      ),
      inputSchema: z.object({
        functionName: z.string().describe("Name of the function to break on"),
      }),
    },
    async (input: { functionName: string }) =>
      createTextResult(
        await breakpointManager.addFunctionBreakpoint(input.functionName),
      ),
  );
}

/**
 * Register the remove_breakpoint MCP tool.
 */
function registerRemoveBreakpointTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "remove_breakpoint",
    {
      description: vscode.l10n.t("Remove a breakpoint by its key."),
      inputSchema: z.object({
        key: z.string().describe("Breakpoint key returned by list_breakpoints"),
      }),
    },
    async (input: { key: string }) => {
      await breakpointManager.removeBreakpoint(input.key);
      return createTextResult({ success: true });
    },
  );
}

/**
 * Register the set_breakpoint_enabled MCP tool.
 */
function registerSetBreakpointEnabledTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "set_breakpoint_enabled",
    {
      description: vscode.l10n.t("Enable or disable a specific breakpoint."),
      inputSchema: z.object({
        key: z.string().describe("Breakpoint key"),
        enabled: z.boolean().describe("Whether to enable the breakpoint"),
      }),
    },
    async (input: { key: string; enabled: boolean }) =>
      createTextResult(
        await breakpointManager.updateBreakpoint(input.key, {
          enabled: input.enabled,
        }),
      ),
  );
}

/**
 * Register the update_breakpoint MCP tool.
 */
function registerUpdateBreakpointTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "update_breakpoint",
    {
      description: vscode.l10n.t(
        "Update breakpoint properties like condition, hit count, or log message.",
      ),
      inputSchema: z.object({
        key: z.string().describe("Breakpoint key"),
        enabled: z
          .boolean()
          .optional()
          .describe("Enable or disable the breakpoint"),
        condition: z
          .string()
          .nullable()
          .optional()
          .describe("Condition expression"),
        hitCondition: z
          .string()
          .nullable()
          .optional()
          .describe("Hit count condition"),
        logMessage: z.string().nullable().optional().describe("Log message"),
      }),
    },
    async (input: {
      key: string;
      enabled?: boolean;
      condition?: string | null;
      hitCondition?: string | null;
      logMessage?: string | null;
    }) =>
      createTextResult(
        await breakpointManager.updateBreakpoint(input.key, input),
      ),
  );
}

/**
 * Register the clear_breakpoints MCP tool.
 */
function registerClearBreakpointsTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "clear_breakpoints",
    {
      description: vscode.l10n.t(
        "Remove all breakpoints in the current workspace.",
      ),
      inputSchema: z.object({}),
    },
    async () => {
      await breakpointManager.clearBreakpoints();
      return createTextResult({ success: true });
    },
  );
}

/**
 * Register the set_breakpoints_enabled_in_file MCP tool.
 */
function registerSetBreakpointsEnabledInFileTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "set_breakpoints_enabled_in_file",
    {
      description: vscode.l10n.t(
        "Enable or disable all breakpoints in a specific file.",
      ),
      inputSchema: z.object({
        filePath: z.string().describe("Path to the file"),
        enabled: z
          .boolean()
          .describe("Whether to enable breakpoints in the file"),
      }),
    },
    async (input: { filePath: string; enabled: boolean }) => {
      await breakpointManager.setBreakpointsEnabledInFile(
        input.filePath,
        input.enabled,
      );
      return createTextResult({ success: true });
    },
  );
}

/**
 * Register the search_breakpoints MCP tool.
 */
function registerSearchBreakpointsTool(
  server: McpServerLike,
  breakpointManager: BreakpointManager,
): void {
  server.registerTool(
    "search_breakpoints",
    {
      description: vscode.l10n.t(
        "Search for breakpoints matching specific criteria.",
      ),
      inputSchema: z.object({
        query: z.string().describe("Search query"),
        kind: z
          .enum(["source", "function", "unknown"])
          .optional()
          .describe("Breakpoint kind filter"),
        enabled: z.boolean().optional().describe("Enabled status filter"),
        limit: z.number().optional().describe("Maximum number of results"),
      }),
    },
    async (input: {
      query: string;
      kind?: "source" | "function" | "unknown";
      enabled?: boolean;
      limit?: number;
    }) =>
      createTextResult(breakpointManager.searchBreakpoints(input.query, input)),
  );
}
