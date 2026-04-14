import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import {
  cloneBreakpointWithUpdatedState,
  findMatchingBreakpoints,
  snapshotBreakpoint,
  type BreakpointUpdateInput,
} from "./shared";

/**
 * Register the update_breakpoint MCP tool.
 */
export function registerUpdateBreakpointTool(server: McpServerLike): void {
  server.registerTool(
    "update_breakpoint",
    {
      description: vscode.l10n.t(
        "Update an existing breakpoint's enabled state, condition, hit condition, or log message without changing its location or function name. Line and column values are 1-based.",
      ),
      inputSchema: z
        .object({
          key: z.string().min(1).optional(),
          filePath: z.string().min(1).optional(),
          line: z.number().int().positive().optional(),
          column: z.number().int().positive().optional(),
          functionName: z.string().min(1).optional(),
          enabled: z.boolean().optional(),
          condition: z.string().trim().min(1).nullable().optional(),
          hitCondition: z.string().trim().min(1).nullable().optional(),
          logMessage: z.string().trim().min(1).nullable().optional(),
        })
        .refine(
          (value) =>
            value.enabled !== undefined ||
            value.condition !== undefined ||
            value.hitCondition !== undefined ||
            value.logMessage !== undefined,
          {
            message: "At least one editable breakpoint field must be provided.",
          },
        ),
    },
    async (input: BreakpointUpdateInput) => {
      const matches = findMatchingBreakpoints(input);
      const supportedUpdates = matches
        .map((breakpoint) => ({
          breakpoint,
          updated: cloneBreakpointWithUpdatedState(breakpoint, input),
        }))
        .filter(
          (
            entry,
          ): entry is {
            breakpoint: vscode.Breakpoint;
            updated: vscode.Breakpoint;
          } => Boolean(entry.updated),
        );
      const unsupportedBreakpoints = matches.filter(
        (breakpoint) =>
          !supportedUpdates.some((entry) => entry.breakpoint === breakpoint),
      );

      if (supportedUpdates.length === 0) {
        return createTextResult({
          updated: [],
          updatedCount: 0,
          unsupported: unsupportedBreakpoints.map(snapshotBreakpoint),
          unsupportedCount: unsupportedBreakpoints.length,
        });
      }

      vscode.debug.removeBreakpoints(
        supportedUpdates.map((entry) => entry.breakpoint),
      );
      vscode.debug.addBreakpoints(
        supportedUpdates.map((entry) => entry.updated),
      );

      return createTextResult({
        updated: supportedUpdates.map((entry) =>
          snapshotBreakpoint(entry.updated),
        ),
        updatedCount: supportedUpdates.length,
        unsupported: unsupportedBreakpoints.map(snapshotBreakpoint),
        unsupportedCount: unsupportedBreakpoints.length,
      });
    },
  );
}
