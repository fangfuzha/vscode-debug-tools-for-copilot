import * as vscode from "vscode";
import * as z from "zod/v4";
import { pauseDebugSessionById, type DebugSessionToolInput } from "./shared";
import { McpServerLike } from "../../mcp/shared";

/**
 * Register the pause_debug_session MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerPauseDebugSessionTool(server: McpServerLike): void {
  server.registerTool(
    "pause_debug_session",
    {
      description: vscode.l10n.t(
        "Pause the active debug session and enter break mode.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
      }),
    },
    async (input: DebugSessionToolInput) =>
      pauseDebugSessionById("pause_debug_session", input.sessionId),
  );
}
