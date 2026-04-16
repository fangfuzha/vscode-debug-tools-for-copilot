import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import {
  normalizeOptionalText,
  resolveFilePath,
  snapshotBreakpoint,
} from "./shared";

/**
 * Register the add_source_breakpoint MCP tool.
 */
export function registerAddSourceBreakpointTool(server: McpServerLike): void {
  server.registerTool(
    "add_source_breakpoint",
    {
      description: vscode.l10n.t(
        "Add a source breakpoint for a file path and line number. Line and column values are 1-based.",
      ),
      inputSchema: z.object({
        filePath: z.string().min(1),
        workspaceFolderPath: z.string().min(1).optional(),
        line: z.number().int().positive(),
        column: z.number().int().positive().optional(),
        enabled: z.boolean().optional(),
        condition: z.string().trim().min(1).optional(),
        hitCondition: z.string().trim().min(1).optional(),
        logMessage: z.string().trim().min(1).optional(),
      }),
    },
    async (input: {
      filePath: string;
      workspaceFolderPath?: string;
      line: number;
      column?: number;
      enabled?: boolean;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }) => {
      const location = new vscode.Location(
        vscode.Uri.file(
          resolveFilePath(input.filePath, input.workspaceFolderPath),
        ),
        new vscode.Position(input.line - 1, (input.column ?? 1) - 1),
      );

      const breakpoint = new vscode.SourceBreakpoint(
        location,
        input.enabled ?? true,
        normalizeOptionalText(input.condition),
        normalizeOptionalText(input.hitCondition),
        normalizeOptionalText(input.logMessage),
      );

      vscode.debug.addBreakpoints([breakpoint]);

      return createTextResult({ added: [snapshotBreakpoint(breakpoint)] });
    },
  );
}
