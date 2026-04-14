/**
 * Aggregator for individual debug session MCP tool registrations.
 */
import { registerListDebugThreadsTool } from "../../debug/sessions/listDebugThreads";
import { registerListDebugSessionsTool } from "../../debug/sessions/listDebugSessions";
import { registerContinueDebugSessionTool } from "../../debug/sessions/continueDebugSession";
import { registerPauseDebugSessionTool } from "../../debug/sessions/pauseDebugSession";
import { registerRestartDebugSessionTool } from "../../debug/sessions/restartDebugSession";
import { registerStepIntoDebugSessionTool } from "../../debug/sessions/stepIntoDebugSession";
import { registerStepOutDebugSessionTool } from "../../debug/sessions/stepOutDebugSession";
import { registerStepOverDebugSessionTool } from "../../debug/sessions/stepOverDebugSession";
import { registerStopDebugSessionTool } from "../../debug/sessions/stopDebugSession";
import { McpServerLike } from "../shared";

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
