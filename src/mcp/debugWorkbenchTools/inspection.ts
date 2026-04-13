import * as vscode from "vscode";
import * as z from "zod/v4";
import { McpServerLike } from "../breakpointTools/shared";
import {
  type DebugEvaluateInput,
  type DebugScopesInput,
  type DebugStackTraceInput,
  type DebugVariablesInput,
} from "../debugWorkbench/shared";
import {
  evaluateDebugExpression,
  listDebugCallStack,
  listDebugScopes,
  listDebugVariables,
} from "../debugWorkbench/inspection";

/**
 * Register the list_debug_call_stack MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerListDebugCallStackTool(server: McpServerLike): void {
  server.registerTool(
    "list_debug_call_stack",
    {
      description: vscode.l10n.t(
        "List the call stack for a debug session or thread.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
        threadId: z.number().int().positive().optional(),
        startFrame: z.number().int().nonnegative().optional(),
        levels: z.number().int().positive().optional(),
      }),
    },
    async (input) => listDebugCallStack(input as DebugStackTraceInput),
  );
}

/**
 * Register the list_debug_scopes MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerListDebugScopesTool(server: McpServerLike): void {
  server.registerTool(
    "list_debug_scopes",
    {
      description: vscode.l10n.t(
        "List scopes for the active or selected debug stack frame.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
        threadId: z.number().int().positive().optional(),
        frameId: z.number().int().positive().optional(),
      }),
    },
    async (input) => listDebugScopes(input as DebugScopesInput),
  );
}

/**
 * Register the list_debug_variables MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerListDebugVariablesTool(server: McpServerLike): void {
  server.registerTool(
    "list_debug_variables",
    {
      description: vscode.l10n.t(
        "List children for a debug variables reference.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
        variablesReference: z.number().int().nonnegative(),
      }),
    },
    async (input) => listDebugVariables(input as DebugVariablesInput),
  );
}

/**
 * Register the evaluate_debug_expression MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerEvaluateDebugExpressionTool(server: McpServerLike): void {
  server.registerTool(
    "evaluate_debug_expression",
    {
      description: vscode.l10n.t(
        "Evaluate an expression in a debug session.",
      ),
      inputSchema: z.object({
        sessionId: z.string().min(1).optional(),
        expression: z.string().min(1),
        threadId: z.number().int().positive().optional(),
        frameId: z.number().int().positive().optional(),
        context: z.enum(["watch", "repl", "hover", "clipboard"]).optional(),
      }),
    },
    async (input) =>
      evaluateDebugExpression(input as DebugEvaluateInput),
  );
}
