import * as vscode from "vscode";
import * as z from "zod/v4";
import { restartDebugSessionById, type DebugSessionToolInput } from "./shared";
import { McpServerLike } from "../breakpointTools/shared";

/**
 * Register the restart_debug_session MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerRestartDebugSessionTool(server: McpServerLike): void {
  server.registerTool(
    "restart_debug_session",
    {
      description: vscode.l10n.t(
        "Restart the active debug session from the beginning.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
      }),
    },
    async (input: DebugSessionToolInput) =>
      restartDebugSessionById("restart_debug_session", input.sessionId),
  );
}
