import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../../mcp/shared";
import {
  addDebugWatchExpression,
  clearDebugWatchExpressions,
  evaluateDebugWatchExpressions,
  listDebugWatchExpressions,
  removeDebugWatchExpression,
} from "../watchExpressionStore";

/**
 * Register the list_debug_watch_expressions MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerListDebugWatchExpressionsTool(
  server: McpServerLike,
): void {
  server.registerTool(
    "list_debug_watch_expressions",
    {
      description: vscode.l10n.t(
        "List watch expressions managed by this extension.",
      ),
      inputSchema: z.object({}),
    },
    async () => {
      const watchExpressions = listDebugWatchExpressions();

      return createTextResult({
        count: watchExpressions.length,
        watchExpressions,
      });
    },
  );
}

/**
 * Register the add_debug_watch_expression MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerAddDebugWatchExpressionTool(
  server: McpServerLike,
): void {
  server.registerTool(
    "add_debug_watch_expression",
    {
      description: vscode.l10n.t(
        "Add a watch expression managed by this extension.",
      ),
      inputSchema: z.object({
        expression: z.string().min(1),
      }),
    },
    async (input) => {
      const typedInput = input as { expression: string };

      return createTextResult({
        watchExpression: addDebugWatchExpression(typedInput.expression),
        watchExpressions: listDebugWatchExpressions(),
      });
    },
  );
}

/**
 * Register the remove_debug_watch_expression MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerRemoveDebugWatchExpressionTool(
  server: McpServerLike,
): void {
  server.registerTool(
    "remove_debug_watch_expression",
    {
      description: vscode.l10n.t(
        "Remove a watch expression managed by this extension.",
      ),
      inputSchema: z.object({
        watchExpressionId: z.string().min(1),
      }),
    },
    async (input) => {
      const typedInput = input as { watchExpressionId: string };

      return createTextResult({
        removed: removeDebugWatchExpression(typedInput.watchExpressionId),
        watchExpressions: listDebugWatchExpressions(),
      });
    },
  );
}

/**
 * Register the clear_debug_watch_expressions MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerClearDebugWatchExpressionsTool(
  server: McpServerLike,
): void {
  server.registerTool(
    "clear_debug_watch_expressions",
    {
      description: vscode.l10n.t(
        "Clear all watch expressions managed by this extension.",
      ),
      inputSchema: z.object({}),
    },
    async () =>
      createTextResult({
        removedCount: clearDebugWatchExpressions(),
        watchExpressions: listDebugWatchExpressions(),
      }),
  );
}

/**
 * Register the evaluate_debug_watch_expressions MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerEvaluateDebugWatchExpressionsTool(
  server: McpServerLike,
): void {
  server.registerTool(
    "evaluate_debug_watch_expressions",
    {
      description: vscode.l10n.t(
        "Evaluate all extension-managed watch expressions in the selected debug session.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
        threadId: z.number().int().positive().optional(),
        frameId: z.number().int().positive().optional(),
      }),
    },
    async (input) =>
      evaluateDebugWatchExpressions(
        input as { sessionId?: string; threadId?: number; frameId?: number },
      ),
  );
}
