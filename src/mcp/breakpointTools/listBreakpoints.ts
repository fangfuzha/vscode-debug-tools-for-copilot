import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, snapshotBreakpoint, McpServerLike } from "./shared";

/**
 * Register the list_breakpoints MCP tool.
 */
export function registerListBreakpointsTool(server: McpServerLike): void {
  server.registerTool(
    "list_breakpoints",
    {
      description: vscode.l10n.t(
        "List all VS Code breakpoints in the current workspace and return a stable key for each item.",
      ),
      inputSchema: z.object({}),
    },
    async () => createTextResult(listBreakpoints()),
  );
}

/**
 * Return a snapshot for every breakpoint currently registered in VS Code.
 */
function listBreakpoints(): unknown {
  return vscode.debug.breakpoints.map(snapshotBreakpoint);
}
