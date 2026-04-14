import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import { findMatchingBreakpoints, snapshotBreakpoint } from "./shared";

/**
 * Register the remove_breakpoint MCP tool.
 */
export function registerRemoveBreakpointTool(server: McpServerLike): void {
  server.registerTool(
    "remove_breakpoint",
    {
      description: vscode.l10n.t(
        "Remove a breakpoint by its stable key, by source file path and line number, or by function name. Line and column values are 1-based.",
      ),
      inputSchema: z.object({
        key: z.string().min(1).optional(),
        filePath: z.string().min(1).optional(),
        line: z.number().int().positive().optional(),
        column: z.number().int().positive().optional(),
        functionName: z.string().min(1).optional(),
      }),
    },
    async (input: {
      key?: string;
      filePath?: string;
      line?: number;
      column?: number;
      functionName?: string;
    }) => {
      const matches = findMatchingBreakpoints(input);
      vscode.debug.removeBreakpoints(matches);

      return createTextResult({
        removed: matches.map(snapshotBreakpoint),
        removedCount: matches.length,
      });
    },
  );
}
