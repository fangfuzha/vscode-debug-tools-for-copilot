import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import {
  findSourceBreakpointsInFile,
  getWorkspaceRelativePath,
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
        workspaceFolderPath: z.string().min(1).optional(),
      }),
    },
    async (input: { filePath: string; workspaceFolderPath?: string }) => {
      const resolvedFilePath = resolveFilePath(
        input.filePath,
        input.workspaceFolderPath,
      );
      const breakpoints = findSourceBreakpointsInFile(
        input.filePath,
        input.workspaceFolderPath,
      ).map(snapshotBreakpoint);

      return createTextResult({
        filePath: resolvedFilePath,
        workspaceRelativePath: getWorkspaceRelativePath(resolvedFilePath),
        count: breakpoints.length,
        results: breakpoints,
      });
    },
  );
}
