import * as vscode from "vscode";
import * as z from "zod/v4";
import { continueDebugSessionById, type DebugSessionToolInput } from "./shared";
import { McpServerLike } from "../../mcp/shared";

/**
 * Register the continue_debug_session MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerContinueDebugSessionTool(server: McpServerLike): void {
  server.registerTool(
    "continue_debug_session",
    {
      description: vscode.l10n.t(
        "Resume the active debug session until the next breakpoint or program exit.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
      }),
    },
    async (input: DebugSessionToolInput) =>
      continueDebugSessionById("continue_debug_session", input.sessionId),
  );
}
