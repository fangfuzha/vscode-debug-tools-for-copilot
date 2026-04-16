import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import {
  cloneBreakpointWithEnabledState,
  findMatchingBreakpoints,
  snapshotBreakpoint,
} from "./shared";

/**
 * Register the set_breakpoint_enabled MCP tool.
 */
export function registerSetBreakpointEnabledTool(server: McpServerLike): void {
  server.registerTool(
    "set_breakpoint_enabled",
    {
      description: vscode.l10n.t(
        "Enable or disable a breakpoint by its stable key, by source file path and line number, or by function name. Line and column values are 1-based.",
      ),
      inputSchema: z.object({
        key: z.string().min(1).optional(),
        filePath: z.string().min(1).optional(),
        workspaceFolderPath: z.string().min(1).optional(),
        line: z.number().int().positive().optional(),
        column: z.number().int().positive().optional(),
        functionName: z.string().min(1).optional(),
        enabled: z.boolean(),
      }),
    },
    async (input: {
      key?: string;
      filePath?: string;
      workspaceFolderPath?: string;
      line?: number;
      column?: number;
      functionName?: string;
      enabled: boolean;
    }) => {
      const matches = findMatchingBreakpoints(input);
      const updatedBreakpoints = matches
        .map((breakpoint) =>
          cloneBreakpointWithEnabledState(breakpoint, input.enabled),
        )
        .filter((breakpoint): breakpoint is vscode.Breakpoint =>
          Boolean(breakpoint),
        );

      if (updatedBreakpoints.length === 0) {
        return createTextResult({
          updated: [],
          updatedCount: 0,
        });
      }

      vscode.debug.removeBreakpoints(matches);
      vscode.debug.addBreakpoints(updatedBreakpoints);

      return createTextResult({
        updated: updatedBreakpoints.map(snapshotBreakpoint),
        updatedCount: updatedBreakpoints.length,
      });
    },
  );
}
