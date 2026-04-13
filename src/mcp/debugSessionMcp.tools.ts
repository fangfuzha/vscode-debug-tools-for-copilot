/**
 * Aggregator for individual debug session MCP tool registrations.
 */
import { registerListDebugThreadsTool } from "./debugSessionTools/listDebugThreads";
import { registerListDebugSessionsTool } from "./debugSessionTools/listDebugSessions";
import { registerContinueDebugSessionTool } from "./debugSessionTools/continueDebugSession";
import { registerPauseDebugSessionTool } from "./debugSessionTools/pauseDebugSession";
import { registerRestartDebugSessionTool } from "./debugSessionTools/restartDebugSession";
import { registerStepIntoDebugSessionTool } from "./debugSessionTools/stepIntoDebugSession";
import { registerStepOutDebugSessionTool } from "./debugSessionTools/stepOutDebugSession";
import { registerStepOverDebugSessionTool } from "./debugSessionTools/stepOverDebugSession";
import { registerStopDebugSessionTool } from "./debugSessionTools/stopDebugSession";
import { McpServerLike } from "./breakpointTools/shared";

/**
 * Register all debug session tools on the MCP server.
 *
 * @param server MCP server instance.
 */
export function registerDebugSessionTools(server: McpServerLike): void {
  registerListDebugSessionsTool(server);
  registerListDebugThreadsTool(server);
  registerPauseDebugSessionTool(server);
  registerContinueDebugSessionTool(server);
  registerStepOverDebugSessionTool(server);
  registerStepIntoDebugSessionTool(server);
  registerStepOutDebugSessionTool(server);
  registerRestartDebugSessionTool(server);
  registerStopDebugSessionTool(server);
}
