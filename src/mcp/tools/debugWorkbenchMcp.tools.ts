/**
 * Aggregator for debug workbench MCP tool registrations.
 */
import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../shared";
import { initializeRecentDebugConfigurationsStore } from "../../debug/workbench/recentDebugConfigurations";
import { initializeDebugWatchExpressionStore } from "../../debug/workbench/watchExpressionStore";
import {
  registerOpenDebugSourceFileTool,
  registerStartDebugLaunchConfigurationTool,
  registerListDebugLaunchConfigurationsTool,
} from "../../debug/workbench/tools/openAndLaunch";
import {
  listDebugCallStack,
  listDebugScopes,
  listDebugVariables,
  evaluateDebugExpression,
} from "../../debug/workbench/inspection";
import {
  registerAddDebugWatchExpressionTool,
  registerClearDebugWatchExpressionsTool,
  registerEvaluateDebugWatchExpressionsTool,
  registerListDebugWatchExpressionsTool,
  registerRemoveDebugWatchExpressionTool,
} from "../../debug/workbench/tools/watchExpressions";

/**
 * Register all debug workbench tools on the MCP server.
 *
 * @param server MCP server instance.
 * @param context Extension context used to initialize persistence stores.
 */
export function registerDebugWorkbenchTools(
  server: McpServerLike,
  context: vscode.ExtensionContext,
): void {
  initializeRecentDebugConfigurationsStore(context);
  initializeDebugWatchExpressionStore(context);

  registerOpenDebugSourceFileTool(server);
  registerListDebugLaunchConfigurationsTool(server);
  registerStartDebugLaunchConfigurationTool(server);
  registerListDebugCallStackTool(server);
  registerListDebugScopesTool(server);
  registerListDebugVariablesTool(server);
  registerEvaluateDebugExpressionTool(server);
  registerListDebugWatchExpressionsTool(server);
  registerAddDebugWatchExpressionTool(server);
  registerRemoveDebugWatchExpressionTool(server);
  registerClearDebugWatchExpressionsTool(server);
  registerEvaluateDebugWatchExpressionsTool(server);
}

/**
 * Register the list_debug_call_stack MCP tool.
 */
function registerListDebugCallStackTool(server: McpServerLike): void {
  server.registerTool(
    "list_debug_call_stack",
    {
      description: vscode.l10n.t("List the call stack for a debug session."),
      inputSchema: z.object({
        sessionId: z.string().optional().describe("Debug session ID"),
        threadId: z.number().optional().describe("Thread ID"),
      }),
    },
    async (input: { sessionId?: string; threadId?: number }) =>
      createTextResult(
        await listDebugCallStack({
          sessionId: input.sessionId,
          threadId: input.threadId,
        }),
      ),
  );
}

/**
 * Register the list_debug_scopes MCP tool.
 */
function registerListDebugScopesTool(server: McpServerLike): void {
  server.registerTool(
    "list_debug_scopes",
    {
      description: vscode.l10n.t(
        "List the scopes available in the current debug context.",
      ),
      inputSchema: z.object({
        sessionId: z.string().optional().describe("Debug session ID"),
        frameId: z.number().optional().describe("Stack frame ID"),
        threadId: z.number().optional().describe("Thread ID"),
      }),
    },
    async (input: {
      sessionId?: string;
      frameId?: number;
      threadId?: number;
    }) =>
      createTextResult(
        await listDebugScopes({
          sessionId: input.sessionId,
          frameId: input.frameId,
          threadId: input.threadId,
        }),
      ),
  );
}

/**
 * Register the list_debug_variables MCP tool.
 */
function registerListDebugVariablesTool(server: McpServerLike): void {
  server.registerTool(
    "list_debug_variables",
    {
      description: vscode.l10n.t("List variables in a debug scope."),
      inputSchema: z.object({
        variablesReference: z.number().describe("Variables reference ID"),
        sessionId: z.string().optional().describe("Debug session ID"),
        frameId: z.number().optional().describe("Stack frame ID"),
        threadId: z.number().optional().describe("Thread ID"),
      }),
    },
    async (input: {
      variablesReference: number;
      sessionId?: string;
      frameId?: number;
      threadId?: number;
    }) =>
      createTextResult(
        await listDebugVariables({
          variablesReference: input.variablesReference,
          sessionId: input.sessionId,
        }),
      ),
  );
}

/**
 * Register the evaluate_debug_expression MCP tool.
 */
function registerEvaluateDebugExpressionTool(server: McpServerLike): void {
  server.registerTool(
    "evaluate_debug_expression",
    {
      description: vscode.l10n.t(
        "Evaluate an expression in the debug context.",
      ),
      inputSchema: z.object({
        expression: z.string().describe("Expression to evaluate"),
        sessionId: z.string().optional().describe("Debug session ID"),
        frameId: z.number().optional().describe("Stack frame ID"),
        threadId: z.number().optional().describe("Thread ID"),
      }),
    },
    async (input: {
      expression: string;
      sessionId?: string;
      frameId?: number;
      threadId?: number;
    }) =>
      createTextResult(
        await evaluateDebugExpression({
          expression: input.expression,
          sessionId: input.sessionId,
          frameId: input.frameId,
          context: "repl",
        }),
      ),
  );
}
