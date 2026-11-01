import * as os from "node:os";
import * as path from "node:path";

import * as vscode from "vscode";

/**
 * MCP server configuration persisted to agent config files.
 */
export interface AgentServerConfiguration {
  autoApprove: string[];
  disabled: boolean;
  timeout: number;
  type: string;
  url: string;
}

/**
 * Reusable MCP configuration export profile.
 */
export interface McpConfigurationExportProfile {
  id: string;
  displayName: string;
  description: string;
  filePathHint?: string;
  buildDocument(endpoint: string): Record<string, unknown>;
}

export const SERVER_ENTRY_NAME = "vscode-debug-tools-for-copilot";

const DEFAULT_TIMEOUT_SECONDS = 180;

const mcpConfigurationExportProfiles = new Map<
  string,
  McpConfigurationExportProfile
>();

/**
 * Register a reusable MCP configuration export profile.
 *
 * @param profile MCP configuration export profile to register.
 */
export function registerMcpConfigurationExportProfile(
  profile: McpConfigurationExportProfile,
): void {
  mcpConfigurationExportProfiles.set(profile.id, profile);
}

/**
 * Return the reusable MCP configuration export profiles.
 *
 * @returns Registered export profiles.
 */
export function getMcpConfigurationExportProfiles(): McpConfigurationExportProfile[] {
  return [...mcpConfigurationExportProfiles.values()];
}

/**
 * Create the standard MCP server configuration block.
 *
 * @param endpoint Current MCP endpoint.
 * @returns The normalized server configuration.
 */
export function createMcpServerConfiguration(
  endpoint: string,
): AgentServerConfiguration {
  return {
    autoApprove: [],
    disabled: false,
    timeout: DEFAULT_TIMEOUT_SECONDS,
    type: "streamableHttp",
    url: endpoint,
  };
}

/**
 * Create a top-level JSON object containing the managed server entry.
 *
 * @param endpoint Current MCP endpoint.
 * @returns A reusable MCP server-entry document.
 */
export function createMcpServerEntryDocument(
  endpoint: string,
): Record<string, unknown> {
  return {
    [SERVER_ENTRY_NAME]: createMcpServerConfiguration(endpoint),
  };
}

/**
 * Create a top-level JSON object using a wrapper field such as `servers` or `mcpServers`.
 *
 * @param endpoint Current MCP endpoint.
 * @param wrapperFieldName Top-level wrapper field name.
 * @returns A reusable MCP configuration wrapper document.
 */
export function createWrappedMcpConfigurationDocument(
  endpoint: string,
  wrapperFieldName: "servers" | "mcpServers",
): Record<string, unknown> {
  return {
    [wrapperFieldName]: createMcpServerEntryDocument(endpoint),
  };
}

/**
 * Resolve the directory that stores per-user agent configuration files.
 *
 * @returns The config base path for the current operating system.
 */
function getConfigBasePath(): string {
  const userHome = os.homedir();

  switch (os.platform()) {
    case "win32":
      return process.env.APPDATA ?? path.join(userHome, "AppData", "Roaming");
    case "darwin":
      return path.join(userHome, "Library", "Application Support");
    case "linux":
      return process.env.XDG_CONFIG_HOME ?? path.join(userHome, ".config");
    default:
      return process.env.APPDATA ?? path.join(userHome, "AppData", "Roaming");
  }
}

/**
 * Register the built-in reusable MCP export profiles.
 */
function registerBuiltInMcpConfigurationExportProfiles(): void {
  const configBasePath = getConfigBasePath();

  registerMcpConfigurationExportProfile({
    id: "generic-entry",
    displayName: vscode.l10n.t("Generic MCP server entry"),
    description: vscode.l10n.t(
      "Copy a client-neutral server entry that can be embedded into any MCP-compatible configuration.",
    ),
    buildDocument: createMcpServerEntryDocument,
  });

  registerMcpConfigurationExportProfile({
    id: "vscode-mcp-json",
    displayName: vscode.l10n.t("VS Code mcp.json"),
    description: vscode.l10n.t(
      "Copy a JSON document that uses the VS Code servers wrapper.",
    ),
    filePathHint: path.join(configBasePath, "Code", "User", "mcp.json"),
    buildDocument: (endpoint: string) =>
      createWrappedMcpConfigurationDocument(endpoint, "servers"),
  });

  registerMcpConfigurationExportProfile({
    id: "mcpServers-wrapper",
    displayName: vscode.l10n.t("mcpServers wrapper"),
    description: vscode.l10n.t(
      "Copy a JSON document that uses the common mcpServers wrapper.",
    ),
    buildDocument: (endpoint: string) =>
      createWrappedMcpConfigurationDocument(endpoint, "mcpServers"),
  });
}

registerBuiltInMcpConfigurationExportProfiles();
