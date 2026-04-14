import * as vscode from "vscode";
import * as z from "zod/v4";
import {
  requestDebugSessionThreadAction,
  type DebugSessionToolInput,
} from "./shared";
import { McpServerLike } from "../../mcp/shared";

/**
 * Register the step_out_debug_session MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerStepOutDebugSessionTool(server: McpServerLike): void {
  server.registerTool(
    "step_out_debug_session",
    {
      description: vscode.l10n.t(
        "Step out of the current function and return to the caller.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
      }),
    },
    async (input: DebugSessionToolInput) =>
      requestDebugSessionThreadAction(
        "step_out_debug_session",
        "stepOut",
        input.sessionId,
      ),
  );
}
