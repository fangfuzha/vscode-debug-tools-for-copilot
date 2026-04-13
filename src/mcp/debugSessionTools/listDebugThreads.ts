import * as vscode from "vscode";
import * as z from "zod/v4";
import { resolveDebugSession, type DebugSessionToolInput } from "./shared";
import { createTextResult, McpServerLike } from "../breakpointTools/shared";

export interface DebugThreadSnapshot {
  id: number;
  name: string;
}

/**
 * Register the list_debug_threads MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerListDebugThreadsTool(server: McpServerLike): void {
  server.registerTool(
    "list_debug_threads",
    {
      description: vscode.l10n.t(
        "List the threads known by a selected debug session and return their thread ids.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
      }),
    },
    async (input: DebugSessionToolInput) => {
      const session = resolveDebugSession(input.sessionId);
      const threadResponse = await session.customRequest("threads");
      const threads: Array<{ id: number; name: string }> = Array.isArray(
        threadResponse?.threads,
      )
        ? threadResponse.threads.filter(
            (thread: unknown): thread is { id: number; name: string } => {
              return (
                typeof thread === "object" &&
                thread !== null &&
                typeof (thread as { id?: unknown }).id === "number" &&
                typeof (thread as { name?: unknown }).name === "string"
              );
            },
          )
        : [];

      return createTextResult({
        count: threads.length,
        session: {
          id: session.id,
          name: session.name,
          type: session.type,
        },
        threads,
      });
    },
  );
}
