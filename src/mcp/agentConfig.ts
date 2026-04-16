import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";
import {
  createMcpServerConfiguration,
  getAgentConfigurationTargets,
  SERVER_ENTRY_NAME,
  type AgentConfigurationTarget,
  type AgentServerConfiguration,
} from "./clientRegistry";

/**
 * Runtime state for one agent configuration target.
 */
export interface AgentTargetState {
  target: AgentConfigurationTarget;
  configured: boolean;
  entryName?: string;
}

/**
 * Result of synchronizing agent configuration files.
 */
export interface AgentConfigurationSyncResult {
  updatedAgents: string[];
  removedAgents: string[];
  skippedAgents: string[];
  createdFiles: string[];
}

/**
 * Quick pick item representing one agent configuration target.
 */
interface AgentConfigurationPickItem extends vscode.QuickPickItem {
  targetId: string;
}

const LEGACY_ENTRY_NAME = "debugmcp";

/**
 * Show the second-level agent picker and apply the user's selection.
 *
 * Existing configured agents are pre-checked. Unchecking an already configured
 * agent removes its entry from the corresponding config file after confirmation.
 *
 * @param endpoint Current MCP endpoint, for example `http://127.0.0.1:3001/mcp`.
 * @returns A summary of the write/remove operation, or undefined when cancelled.
 */
export async function promptAndApplyAgentConfigurations(
  endpoint: string,
): Promise<AgentConfigurationSyncResult | undefined> {
  const agentStates = await inspectAgentTargets();
  const selectedAgentIds = await showAgentSelectionQuickPick(agentStates);

  if (!selectedAgentIds) {
    return undefined;
  }

  return syncAgentConfigurations(endpoint, selectedAgentIds);
}

/**
 * Refresh all currently configured agent files to the latest MCP endpoint.
 *
 * This keeps already configured clients in sync during extension startup without
 * touching unconfigured clients.
 *
 * @param endpoint Current MCP endpoint, for example `http://127.0.0.1:3001/mcp`.
 * @returns A summary of the refreshed configurations, or undefined when no configured agents are present.
 */
export async function refreshConfiguredAgentConfigurations(
  endpoint: string,
): Promise<AgentConfigurationSyncResult | undefined> {
  const agentStates = await inspectAgentTargets();
  const configuredAgentIds = agentStates
    .filter((state) => state.configured)
    .map((state) => state.target.id);

  if (configuredAgentIds.length === 0) {
    return undefined;
  }

  return syncAgentConfigurations(endpoint, configuredAgentIds);
}

/**
 * Synchronize supported agent configuration files according to the selected agents.
 *
 * Agents included in `selectedAgentIds` are written or updated. Agents that are
 * currently configured but not selected are removed.
 *
 * @param endpoint Current MCP endpoint, for example `http://127.0.0.1:3001/mcp`.
 * @param selectedAgentIds Selected agent identifiers from the picker.
 * @returns A summary of which agent files were updated, removed, or skipped.
 */
export async function syncAgentConfigurations(
  endpoint: string,
  selectedAgentIds: Iterable<string>,
): Promise<AgentConfigurationSyncResult> {
  const selectedSet = new Set(selectedAgentIds);
  const result: AgentConfigurationSyncResult = {
    updatedAgents: [],
    removedAgents: [],
    skippedAgents: [],
    createdFiles: [],
  };

  for (const target of getAgentConfigurationTargets()) {
    const shouldBeConfigured = selectedSet.has(target.id);

    try {
      const fileExists = fs.existsSync(target.configPath);

      if (!fileExists && !shouldBeConfigured) {
        continue;
      }

      const rootConfig = fileExists ? readJsonFile(target.configPath) : {};

      if (rootConfig === undefined) {
        result.skippedAgents.push(target.id);
        continue;
      }

      const serverContainer = ensureRecord(rootConfig, target.serverFieldName);
      const entryName = getManagedEntryName(serverContainer);

      if (shouldBeConfigured) {
        const managedEntryName = entryName ?? SERVER_ENTRY_NAME;
        const existingEntry = serverContainer[managedEntryName] as
          | Partial<AgentServerConfiguration>
          | undefined;
        const nextEntry = createMcpServerConfiguration(endpoint, existingEntry);

        if (isSameAgentServerConfiguration(existingEntry, nextEntry)) {
          continue;
        }

        serverContainer[managedEntryName] = nextEntry;

        if (!fileExists) {
          ensureParentDirectory(target.configPath);
          result.createdFiles.push(target.id);
        }

        writeJsonFile(target.configPath, rootConfig);
        result.updatedAgents.push(target.id);
        continue;
      }

      if (!entryName) {
        continue;
      }

      delete serverContainer[entryName];

      if (Object.keys(serverContainer).length === 0) {
        delete rootConfig[target.serverFieldName];
      }

      if (Object.keys(rootConfig).length === 0) {
        fs.unlinkSync(target.configPath);
      } else {
        writeJsonFile(target.configPath, rootConfig);
      }

      result.removedAgents.push(target.id);
    } catch {
      result.skippedAgents.push(target.id);
    }
  }

  return result;
}

/**
 * Inspect the current configuration state of all supported agent targets.
 *
 * @returns Agent states used to pre-check the picker.
 */
export async function inspectAgentTargets(): Promise<AgentTargetState[]> {
  return getAgentConfigurationTargets().map((target) => {
    const rootConfig = readJsonFile(target.configPath);

    if (!rootConfig) {
      return {
        target,
        configured: false,
      };
    }

    const serverContainer = rootConfig[target.serverFieldName];

    if (
      !serverContainer ||
      typeof serverContainer !== "object" ||
      Array.isArray(serverContainer)
    ) {
      return {
        target,
        configured: false,
      };
    }

    const managedEntryName = getManagedEntryName(
      serverContainer as Record<string, unknown>,
    );

    return {
      target,
      configured: Boolean(managedEntryName),
      entryName: managedEntryName,
    };
  });
}

/**
 * Show a multi-select picker that acts as the confirmation screen.
 *
 * @param agentStates Current agent configuration state.
 * @returns The selected agent identifiers, or undefined when cancelled.
 */
async function showAgentSelectionQuickPick(
  agentStates: AgentTargetState[],
): Promise<Set<string> | undefined> {
  const quickPick = vscode.window.createQuickPick<AgentConfigurationPickItem>();
  const selectedAgentIds = new Set<string>();

  quickPick.title = vscode.l10n.t("Configure AI Agent MCP");
  quickPick.placeholder = vscode.l10n.t(
    "Check the agents to configure. Unchecked configured agents will be removed when you confirm.",
  );
  quickPick.canSelectMany = true;
  quickPick.ignoreFocusOut = true;
  quickPick.items = agentStates.map((state) => ({
    label: state.target.displayName,
    description: state.configured
      ? vscode.l10n.t("Currently configured")
      : vscode.l10n.t("Not configured"),
    detail: state.target.configPath,
    picked: state.configured,
    targetId: state.target.id,
  }));

  for (const state of agentStates) {
    if (state.configured) {
      selectedAgentIds.add(state.target.id);
    }
  }

  quickPick.selectedItems = quickPick.items.filter((item) => item.picked);

  return new Promise<Set<string> | undefined>((resolve) => {
    let settled = false;

    const settle = (value: Set<string> | undefined): void => {
      if (settled) {
        return;
      }

      settled = true;
      quickPick.dispose();
      resolve(value);
    };

    quickPick.onDidChangeSelection((items) => {
      selectedAgentIds.clear();

      for (const item of items) {
        selectedAgentIds.add(item.targetId);
      }
    });

    quickPick.onDidAccept(() => {
      settle(new Set(selectedAgentIds));
    });

    quickPick.onDidHide(() => {
      settle(undefined);
    });

    quickPick.show();
  });
}
/**
 * Read and parse a JSON configuration file.
 *
 * @param filePath Configuration file path.
 * @returns Parsed JSON object or undefined when parsing fails.
 */
function readJsonFile(filePath: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Write a JSON configuration file using stable formatting.
 *
 * @param filePath Configuration file path.
 * @param content JSON object to persist.
 */
function writeJsonFile(
  filePath: string,
  content: Record<string, unknown>,
): void {
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

/**
 * Ensure the parent directory for a file exists.
 *
 * @param filePath Target file path.
 */
function ensureParentDirectory(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * Ensure a nested object property exists and is a plain object.
 *
 * @param root Root JSON object.
 * @param key Nested property name.
 * @returns The nested object.
 */
function ensureRecord(
  root: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const currentValue = root[key];

  if (
    !currentValue ||
    typeof currentValue !== "object" ||
    Array.isArray(currentValue)
  ) {
    const nextValue: Record<string, unknown> = {};
    root[key] = nextValue;

    return nextValue;
  }

  return currentValue as Record<string, unknown>;
}

/**
 * Check whether an existing server entry already matches the target configuration.
 *
 * @param existingEntry Existing server entry from the configuration file.
 * @param nextEntry Normalized server entry that would be written.
 * @returns Whether the existing entry already matches the target configuration.
 */
function isSameAgentServerConfiguration(
  existingEntry: Partial<AgentServerConfiguration> | undefined,
  nextEntry: AgentServerConfiguration,
): boolean {
  if (!existingEntry) {
    return false;
  }

  const existingRecord = existingEntry as Record<string, unknown>;
  const existingKeys = Object.keys(existingRecord);
  const nextKeys = Object.keys(nextEntry);

  if (existingKeys.length !== nextKeys.length) {
    return false;
  }

  return nextKeys.every((key) => {
    const existingValue = existingRecord[key];
    const nextValue = nextEntry[key as keyof AgentServerConfiguration];

    if (Array.isArray(nextValue)) {
      return (
        Array.isArray(existingValue) &&
        existingValue.length === nextValue.length &&
        existingValue.every((item, index) => item === nextValue[index])
      );
    }

    return existingValue === nextValue;
  });
}

/**
 * Decide which existing entry name should be treated as managed by this extension.
 *
 * @param serverContainer The MCP server container object inside the config file.
 * @returns The entry name that should be updated or removed.
 */
function getManagedEntryName(
  serverContainer: Record<string, unknown>,
): string | undefined {
  if (LEGACY_ENTRY_NAME in serverContainer) {
    return LEGACY_ENTRY_NAME;
  }

  if (SERVER_ENTRY_NAME in serverContainer) {
    return SERVER_ENTRY_NAME;
  }

  return undefined;
}
