import * as vscode from "vscode";
import { normalizeWorkspacePath } from "./shared";
import type { DebugLaunchConfigurationSnapshot } from "./shared";

const RECENT_DEBUG_CONFIGURATIONS_STORAGE_KEY =
  "debugWorkbench.recentDebugConfigurations";

let recentDebugConfigurationsContext: vscode.ExtensionContext | undefined;
let recentDebugConfigurationsLoaded = false;
let recentDebugConfigurations = new Map<
  string,
  DebugLaunchConfigurationSnapshot
>();

/**
 * Initialize the recent debug configuration cache from storage.
 *
 * @param context Extension context used for persistence.
 */
export function initializeRecentDebugConfigurationsStore(
  context: vscode.ExtensionContext,
): void {
  recentDebugConfigurationsContext = context;

  if (recentDebugConfigurationsLoaded) {
    return;
  }

  recentDebugConfigurationsLoaded = true;

  const persisted = context.workspaceState.get<
    DebugLaunchConfigurationSnapshot[]
  >(RECENT_DEBUG_CONFIGURATIONS_STORAGE_KEY, []);

  recentDebugConfigurations = new Map(
    persisted.map((configuration) => [
      createRecentConfigurationKey(configuration),
      configuration,
    ]),
  );
}

/**
 * Create a stable key for a configuration snapshot.
 *
 * @param snapshot Debug configuration snapshot.
 * @returns Stable cache key.
 */
function createRecentConfigurationKey(
  snapshot: DebugLaunchConfigurationSnapshot,
): string {
  return [
    snapshot.origin,
    snapshot.kind,
    snapshot.name,
    snapshot.workspaceFolderPath
      ? normalizeWorkspacePath(snapshot.workspaceFolderPath)
      : "",
    snapshot.debugType ?? "",
  ].join("|");
}

/**
 * Persist the current recent-configuration cache.
 */
function persistRecentDebugConfigurations(): void {
  if (!recentDebugConfigurationsContext) {
    return;
  }

  const snapshots = listRecentDebugConfigurations();

  void recentDebugConfigurationsContext.workspaceState.update(
    RECENT_DEBUG_CONFIGURATIONS_STORAGE_KEY,
    snapshots,
  );
}

/**
 * Record a debug session configuration for later reuse.
 *
 * @param session Debug session to record.
 */
export function recordRecentDebugConfiguration(
  session: vscode.DebugSession,
): void {
  const configuration = session.configuration;
  const snapshot: DebugLaunchConfigurationSnapshot = {
    kind: "configuration",
    origin: "recentSession",
    name: configuration.name,
    workspaceFolderName: session.workspaceFolder?.name,
    workspaceFolderPath: session.workspaceFolder?.uri.fsPath,
    sourcePath: "[recent-session]",
    debugType: configuration.type,
    configuration: { ...configuration },
    debugSessionId: session.id,
  };

  recentDebugConfigurations.set(
    createRecentConfigurationKey(snapshot),
    snapshot,
  );
  persistRecentDebugConfigurations();
}

/**
 * Return the recent debug configurations tracked by the extension.
 *
 * @returns Recent debug configuration snapshots.
 */
export function listRecentDebugConfigurations(): DebugLaunchConfigurationSnapshot[] {
  return [...recentDebugConfigurations.values()];
}
