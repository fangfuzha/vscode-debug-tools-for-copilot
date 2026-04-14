import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import {
  cloneBreakpointWithEnabledState,
  findSourceBreakpointsInFile,
  resolveFilePath,
  snapshotBreakpoint,
  SetBreakpointsEnabledInFileInput,
} from "./shared";

/**
 * Register the set_breakpoints_enabled_in_file MCP tool.
 */
export function registerSetBreakpointsEnabledInFileTool(
  server: McpServerLike,
): void {
  server.registerTool(
    "set_breakpoints_enabled_in_file",
    {
      description: vscode.l10n.t(
        "Enable or disable every source breakpoint in a specific file.",
      ),
      inputSchema: z.object({
        filePath: z.string().min(1),
        enabled: z.boolean(),
      }),
    },
    async (input: SetBreakpointsEnabledInFileInput) => {
      const matches = findSourceBreakpointsInFile(input.filePath);

      if (matches.length === 0) {
        return createTextResult({
          enabled: input.enabled,
          filePath: resolveFilePath(input.filePath),
          updated: [],
          updatedCount: 0,
        });
      }

      const updatedBreakpoints = matches
        .map((breakpoint) =>
          cloneBreakpointWithEnabledState(breakpoint, input.enabled),
        )
        .filter((breakpoint): breakpoint is vscode.Breakpoint =>
          Boolean(breakpoint),
        );

      vscode.debug.removeBreakpoints(matches);
      vscode.debug.addBreakpoints(updatedBreakpoints);

      return createTextResult({
        enabled: input.enabled,
        filePath: resolveFilePath(input.filePath),
        updated: updatedBreakpoints.map(snapshotBreakpoint),
        updatedCount: updatedBreakpoints.length,
      });
    },
  );
}
