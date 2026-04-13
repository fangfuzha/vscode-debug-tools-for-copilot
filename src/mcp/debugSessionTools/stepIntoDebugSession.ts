import * as vscode from "vscode";
import * as z from "zod/v4";
import {
  requestDebugSessionThreadAction,
  type DebugSessionToolInput,
} from "./shared";
import { McpServerLike } from "../breakpointTools/shared";

/**
 * Register the step_into_debug_session MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerStepIntoDebugSessionTool(server: McpServerLike): void {
  server.registerTool(
    "step_into_debug_session",
    {
      description: vscode.l10n.t(
        "Execute the current line and step into the called function if one is invoked.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
      }),
    },
    async (input: DebugSessionToolInput) =>
      requestDebugSessionThreadAction(
        "step_into_debug_session",
        "stepIn",
        input.sessionId,
      ),
  );
}
