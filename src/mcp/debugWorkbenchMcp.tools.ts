/**
 * Aggregator for debug workbench MCP tool registrations.
 */
import * as vscode from "vscode";
import { McpServerLike } from "./breakpointTools/shared";
import { initializeRecentDebugConfigurationsStore } from "./debugWorkbench/recentDebugConfigurations";
import { initializeDebugWatchExpressionStore } from "./debugWorkbench/watchExpressionStore";
import {
  registerOpenDebugSourceFileTool,
  registerStartDebugLaunchConfigurationTool,
  registerListDebugLaunchConfigurationsTool,
} from "./debugWorkbenchTools/openAndLaunch";
import {
  registerEvaluateDebugExpressionTool,
  registerListDebugCallStackTool,
  registerListDebugScopesTool,
  registerListDebugVariablesTool,
} from "./debugWorkbenchTools/inspection";
import {
  registerAddDebugWatchExpressionTool,
  registerClearDebugWatchExpressionsTool,
  registerEvaluateDebugWatchExpressionsTool,
  registerListDebugWatchExpressionsTool,
  registerRemoveDebugWatchExpressionTool,
} from "./debugWorkbenchTools/watchExpressions";

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
