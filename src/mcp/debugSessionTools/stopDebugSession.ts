import * as vscode from "vscode";
import * as z from "zod/v4";
import { stopDebugSessionById, type DebugSessionToolInput } from "./shared";
import { McpServerLike } from "../breakpointTools/shared";

/**
 * Register the stop_debug_session MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerStopDebugSessionTool(server: McpServerLike): void {
  server.registerTool(
    "stop_debug_session",
    {
      description: vscode.l10n.t(
        "Stop the active debug session and end debugging.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
      }),
    },
    async (input: DebugSessionToolInput) =>
      stopDebugSessionById("stop_debug_session", input.sessionId),
  );
}
