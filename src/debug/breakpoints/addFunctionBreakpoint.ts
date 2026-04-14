import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import { normalizeOptionalText, snapshotBreakpoint } from "./shared";

/**
 * Register the add_function_breakpoint MCP tool.
 */
export function registerAddFunctionBreakpointTool(server: McpServerLike): void {
  server.registerTool(
    "add_function_breakpoint",
    {
      description: vscode.l10n.t(
        "Add a function breakpoint for a function name. Function name is required and breakpoint properties use the same 1-based and optional condition rules as source breakpoints.",
      ),
      inputSchema: z.object({
        functionName: z.string().min(1),
        enabled: z.boolean().optional(),
        condition: z.string().trim().min(1).optional(),
        hitCondition: z.string().trim().min(1).optional(),
        logMessage: z.string().trim().min(1).optional(),
      }),
    },
    async (input: {
      functionName: string;
      enabled?: boolean;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }) => {
      const breakpoint = new vscode.FunctionBreakpoint(
        input.functionName,
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
