/**
 * Aggregator for individual Breakpoint MCP tool registrations.
 *
 * This module does not implement tool behavior itself.
 * It imports each tool's registration function and invokes them
 * so the runtime entrypoint can register the full set of tools
 * on a single MCP server instance.
 */
import { registerListBreakpointsTool } from "./breakpointTools/listBreakpoints";
import { registerAddSourceBreakpointTool } from "./breakpointTools/addSourceBreakpoint";
import { registerAddFunctionBreakpointTool } from "./breakpointTools/addFunctionBreakpoint";
import { registerRemoveBreakpointTool } from "./breakpointTools/removeBreakpoint";
import { registerSetBreakpointEnabledTool } from "./breakpointTools/setBreakpointEnabled";
import { registerClearBreakpointsTool } from "./breakpointTools/clearBreakpoints";
import { registerSetBreakpointsEnabledInFileTool } from "./breakpointTools/setBreakpointsEnabledInFile";
import { registerSearchBreakpointsTool } from "./breakpointTools/searchBreakpoints";
import { registerUpdateBreakpointTool } from "./breakpointTools/updateBreakpoint";
import { registerListBreakpointsInFileTool } from "./breakpointTools/listBreakpointsInFile";
import { registerBreakpointStatisticsTool } from "./breakpointTools/getBreakpointStatistics";
import { McpServerLike } from "./breakpointTools/shared";

/**
 * Register all breakpoint tools on the MCP server.
 *
 * @param server MCP server instance.
 */
export function registerBreakpointTools(server: McpServerLike): void {
  registerListBreakpointsTool(server);
  registerListBreakpointsInFileTool(server);
  registerBreakpointStatisticsTool(server);
  registerAddSourceBreakpointTool(server);
  registerAddFunctionBreakpointTool(server);
  registerRemoveBreakpointTool(server);
  registerSetBreakpointEnabledTool(server);
  registerUpdateBreakpointTool(server);
  registerClearBreakpointsTool(server);
  registerSetBreakpointsEnabledInFileTool(server);
  registerSearchBreakpointsTool(server);
}
