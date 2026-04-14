import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import { snapshotBreakpoint } from "./shared";

/**
 * Register the clear_breakpoints MCP tool.
 */
export function registerClearBreakpointsTool(server: McpServerLike): void {
  server.registerTool(
    "clear_breakpoints",
    {
      description: vscode.l10n.t(
        "Remove every breakpoint currently registered in VS Code.",
      ),
      inputSchema: z.object({}),
    },
    async () => {
      const allBreakpoints = [...vscode.debug.breakpoints];
      vscode.debug.removeBreakpoints(allBreakpoints);

      return createTextResult({
        removed: allBreakpoints.map(snapshotBreakpoint),
        removedCount: allBreakpoints.length,
      });
    },
  );
}
