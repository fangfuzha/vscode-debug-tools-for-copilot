import * as vscode from "vscode";
import * as z from "zod/v4";
import {
  requestDebugSessionThreadAction,
  type DebugSessionToolInput,
} from "./shared";
import { McpServerLike } from "../../mcp/shared";

/**
 * Register the step_over_debug_session MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerStepOverDebugSessionTool(server: McpServerLike): void {
  server.registerTool(
    "step_over_debug_session",
    {
      description: vscode.l10n.t(
        "Execute the current line and step to the next line without entering functions.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
      }),
    },
    async (input: DebugSessionToolInput) =>
      requestDebugSessionThreadAction(
        "step_over_debug_session",
        "next",
        input.sessionId,
      ),
  );
}
