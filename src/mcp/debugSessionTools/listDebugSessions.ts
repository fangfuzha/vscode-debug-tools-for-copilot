import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../breakpointTools/shared";
import { listDebugSessions } from "./shared";

/**
 * Register the list_debug_sessions MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerListDebugSessionsTool(server: McpServerLike): void {
  server.registerTool(
    "list_debug_sessions",
    {
      description: vscode.l10n.t(
        "List the currently known debug sessions and return their session ids.",
      ),
      inputSchema: z.object({}),
    },
    async () => {
      const sessions = listDebugSessions();

      return createTextResult({
        count: sessions.length,
        sessions,
      });
    },
  );
}
