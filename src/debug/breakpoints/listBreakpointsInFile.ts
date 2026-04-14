import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import {
  findSourceBreakpointsInFile,
  resolveFilePath,
  snapshotBreakpoint,
} from "./shared";

/**
 * Register the list_breakpoints_in_file MCP tool.
 */
export function registerListBreakpointsInFileTool(server: McpServerLike): void {
  server.registerTool(
    "list_breakpoints_in_file",
    {
      description: vscode.l10n.t(
        "List all source breakpoints in a specific file and return their snapshots.",
      ),
      inputSchema: z.object({
        filePath: z.string().min(1),
      }),
    },
    async (input: { filePath: string }) => {
      const resolvedFilePath = resolveFilePath(input.filePath);
      const breakpoints = findSourceBreakpointsInFile(input.filePath).map(
        snapshotBreakpoint,
      );

      return createTextResult({
        filePath: resolvedFilePath,
        workspaceRelativePath: vscode.workspace.asRelativePath(
          vscode.Uri.file(resolvedFilePath),
          false,
        ),
        count: breakpoints.length,
        results: breakpoints,
      });
    },
  );
}
