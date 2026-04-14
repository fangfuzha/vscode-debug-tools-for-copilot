import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../../mcp/shared";
import {
  type OpenDebugSourceFileInput,
  type StartDebugLaunchConfigurationInput,
} from "../shared";
import { openDebugSourceFile } from "../sourceFile";
import {
  listDebugLaunchConfigurations,
  startDebugLaunchConfiguration,
} from "../launchConfigurations";

/**
 * Register the open_debug_source_file MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerOpenDebugSourceFileTool(server: McpServerLike): void {
  server.registerTool(
    "open_debug_source_file",
    {
      description: vscode.l10n.t(
        "Open a source file in the active editor and focus it.",
      ),
      inputSchema: z.object({
        filePath: z.string().min(1),
        line: z.number().int().positive().optional(),
        column: z.number().int().positive().optional(),
      }),
    },
    async (input) => openDebugSourceFile(input as OpenDebugSourceFileInput),
  );
}

/**
 * Register the list_debug_launch_configurations MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerListDebugLaunchConfigurationsTool(
  server: McpServerLike,
): void {
  server.registerTool(
    "list_debug_launch_configurations",
    {
      description: vscode.l10n.t(
        "List debug configurations and compounds from launch.json files in the workspace.",
      ),
      inputSchema: z.object({
        workspaceFolderPath: z.string().min(1).optional(),
      }),
    },
    async (input) => {
      const typedInput = input as { workspaceFolderPath?: string };
      const configurations = await listDebugLaunchConfigurations(
        typedInput.workspaceFolderPath,
      );

      return createTextResult({
        count: configurations.length,
        configurations,
      });
    },
  );
}

/**
 * Register the start_debug_launch_configuration MCP tool.
 *
 * @param server MCP server instance.
 */
export function registerStartDebugLaunchConfigurationTool(
  server: McpServerLike,
): void {
  server.registerTool(
    "start_debug_launch_configuration",
    {
      description: vscode.l10n.t(
        "Start debugging from a named launch configuration or from a raw configuration object.",
      ),
      inputSchema: z
        .object({
          workspaceFolderPath: z.string().min(1).optional(),
          launchName: z.string().min(1).optional(),
          launchConfiguration: z.record(z.string(), z.unknown()).optional(),
          noDebug: z.boolean().optional(),
        })
        .refine(
          (input) =>
            Boolean(input.launchName) || Boolean(input.launchConfiguration),
          {
            message:
              "Either launchName or launchConfiguration must be provided.",
          },
        ),
    },
    async (input) =>
      startDebugLaunchConfiguration(
        input as StartDebugLaunchConfigurationInput,
      ),
  );
}
