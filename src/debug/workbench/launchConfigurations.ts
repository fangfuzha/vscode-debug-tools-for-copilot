import * as vscode from "vscode";
import { createTextResult } from "../../mcp/shared";
import { listRecentDebugConfigurations } from "./recentDebugConfigurations";
import {
  normalizeWorkspacePath,
  resolveWorkspaceFolder,
  type DebugLaunchConfigurationSnapshot,
  type StartDebugLaunchConfigurationInput,
} from "./shared";

/**
 * Strip comments and trailing commas from JSONC text.
 *
 * @param text JSONC text.
 * @returns Sanitized JSON text.
 */
function sanitizeJsonc(text: string): string {
  const withoutBom = text.replace(/^\uFEFF/, "");
  let result = "";
  let index = 0;
  let inString = false;
  let stringDelimiter = "";
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (index < withoutBom.length) {
    const currentCharacter = withoutBom[index];
    const nextCharacter = withoutBom[index + 1];

    if (inLineComment) {
      if (currentCharacter === "\n") {
        inLineComment = false;
        result += currentCharacter;
      }

      index += 1;
      continue;
    }

    if (inBlockComment) {
      if (currentCharacter === "*" && nextCharacter === "/") {
        inBlockComment = false;
        index += 2;
        continue;
      }

      index += 1;
      continue;
    }

    if (inString) {
      result += currentCharacter;

      if (escaped) {
        escaped = false;
      } else if (currentCharacter === "\\") {
        escaped = true;
      } else if (currentCharacter === stringDelimiter) {
        inString = false;
      }

      index += 1;
      continue;
    }

    if (currentCharacter === '"' || currentCharacter === "'") {
      inString = true;
      stringDelimiter = currentCharacter;
      result += currentCharacter;
      index += 1;
      continue;
    }

    if (currentCharacter === "/" && nextCharacter === "/") {
      inLineComment = true;
      index += 2;
      continue;
    }

    if (currentCharacter === "/" && nextCharacter === "*") {
      inBlockComment = true;
      index += 2;
      continue;
    }

    result += currentCharacter;
    index += 1;
  }

  return result.replace(/,\s*([}\]])/g, "$1");
}

/**
 * Parse launch.json text into a JSON object.
 *
 * @param text Launch.json text.
 * @param sourcePath Source file path used in error messages.
 * @returns Parsed JSON object.
 */
function parseLaunchJson(
  text: string,
  sourcePath: string,
): Record<string, unknown> {
  const sanitizedText = sanitizeJsonc(text);

  try {
    const parsed = JSON.parse(sanitizedText) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error();
    }

    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(
      vscode.l10n.t("Failed to parse launch.json at {0}.", sourcePath),
    );
  }
}

/**
 * Read launch.json from a workspace folder.
 *
 * @param workspaceFolder Workspace folder.
 * @returns The parsed launch.json object or undefined when the file does not exist.
 */
async function readLaunchJson(
  workspaceFolder: vscode.WorkspaceFolder,
): Promise<Record<string, unknown> | undefined> {
  const launchJsonUri = vscode.Uri.joinPath(
    workspaceFolder.uri,
    ".vscode",
    "launch.json",
  );

  try {
    await vscode.workspace.fs.stat(launchJsonUri);
  } catch {
    return undefined;
  }

  const fileContent = await vscode.workspace.fs.readFile(launchJsonUri);
  const text = Buffer.from(fileContent).toString("utf8");

  return parseLaunchJson(text, launchJsonUri.fsPath);
}

/**
 * Convert a raw configuration entry to a serializable snapshot.
 *
 * @param workspaceFolder Workspace folder owning the configuration.
 * @param sourcePath launch.json path.
 * @param kind Entry kind.
 * @param value Raw configuration value.
 * @returns Snapshot or undefined when the entry is not a valid object.
 */
function createLaunchConfigurationSnapshot(
  workspaceFolder: vscode.WorkspaceFolder,
  sourcePath: string,
  kind: "configuration" | "compound",
  value: unknown,
): DebugLaunchConfigurationSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : undefined;

  if (!name) {
    return undefined;
  }

  return {
    kind,
    origin: "launchJson",
    name,
    workspaceFolderName: workspaceFolder.name,
    workspaceFolderPath: workspaceFolder.uri.fsPath,
    sourcePath,
    ...(kind === "configuration"
      ? { configuration: record }
      : { compound: record }),
  };
}

/**
 * List debug launch configurations and compounds from launch.json files.
 *
 * @param workspaceFolderPath Optional workspace folder path filter.
 * @returns Launch configuration snapshots.
 */
export async function listDebugLaunchConfigurations(
  workspaceFolderPath?: string,
): Promise<DebugLaunchConfigurationSnapshot[]> {
  const workspaceFolders = workspaceFolderPath
    ? [resolveWorkspaceFolder(workspaceFolderPath)].filter(
        (workspaceFolder): workspaceFolder is vscode.WorkspaceFolder =>
          Boolean(workspaceFolder),
      )
    : (vscode.workspace.workspaceFolders ?? []);

  const snapshots: DebugLaunchConfigurationSnapshot[] = [];

  for (const workspaceFolder of workspaceFolders) {
    const launchJson = await readLaunchJson(workspaceFolder);

    if (!launchJson) {
      continue;
    }

    const sourcePath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      ".vscode",
      "launch.json",
    ).fsPath;

    const configurations = Array.isArray(launchJson.configurations)
      ? launchJson.configurations
      : [];
    const compounds = Array.isArray(launchJson.compounds)
      ? launchJson.compounds
      : [];

    for (const configuration of configurations) {
      const snapshot = createLaunchConfigurationSnapshot(
        workspaceFolder,
        sourcePath,
        "configuration",
        configuration,
      );

      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    for (const compound of compounds) {
      const snapshot = createLaunchConfigurationSnapshot(
        workspaceFolder,
        sourcePath,
        "compound",
        compound,
      );

      if (snapshot) {
        snapshots.push(snapshot);
      }
    }
  }

  for (const recentConfiguration of listRecentDebugConfigurations()) {
    if (
      workspaceFolderPath &&
      !matchesWorkspaceFolderPath(
        recentConfiguration.workspaceFolderPath,
        workspaceFolderPath,
      )
    ) {
      continue;
    }

    snapshots.push(recentConfiguration);
  }

  return dedupeLaunchConfigurations(snapshots);
}

/**
 * Remove duplicate launch configuration snapshots.
 *
 * @param snapshots Candidate snapshots.
 * @returns Deduplicated snapshots.
 */
function dedupeLaunchConfigurations(
  snapshots: DebugLaunchConfigurationSnapshot[],
): DebugLaunchConfigurationSnapshot[] {
  const seen = new Set<string>();

  return snapshots.filter((snapshot) => {
    const key = [
      snapshot.origin,
      snapshot.kind,
      snapshot.name,
      snapshot.workspaceFolderPath ?? "",
      snapshot.debugType ?? "",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * Compare two workspace folder paths using the same normalization rules as debug workbench helpers.
 *
 * @param leftPath First path.
 * @param rightPath Second path.
 * @returns Whether the paths represent the same workspace folder.
 */
function matchesWorkspaceFolderPath(
  leftPath: string | undefined,
  rightPath: string,
): boolean {
  if (!leftPath) {
    return false;
  }

  return normalizeWorkspacePath(leftPath) === normalizeWorkspacePath(rightPath);
}

/**
 * Find a launch configuration snapshot by name.
 *
 * @param launchName Launch configuration or compound name.
 * @param workspaceFolderPath Optional workspace folder path filter.
 * @returns A matching launch configuration snapshot.
 */
export async function findLaunchConfigurationByName(
  launchName: string,
  workspaceFolderPath?: string,
): Promise<DebugLaunchConfigurationSnapshot> {
  const snapshots = await listDebugLaunchConfigurations(workspaceFolderPath);
  const matches = snapshots.filter((snapshot) => snapshot.name === launchName);

  if (matches.length === 0) {
    throw new Error(
      vscode.l10n.t("No debug configuration named {0} was found.", launchName),
    );
  }

  if (matches.length > 1) {
    throw new Error(
      vscode.l10n.t(
        "Multiple debug configurations named {0} were found. Specify workspaceFolderPath to disambiguate.",
        launchName,
      ),
    );
  }

  return matches[0];
}

/**
 * Start a debug session from a launch configuration or raw configuration object.
 *
 * @param input Launch start input.
 * @returns Result payload.
 */
export async function startDebugLaunchConfiguration(
  input: StartDebugLaunchConfigurationInput,
): Promise<unknown> {
  let workspaceFolder = resolveWorkspaceFolder(input.workspaceFolderPath);

  if (input.workspaceFolderPath && !workspaceFolder) {
    throw new Error(
      vscode.l10n.t(
        "The workspace folder {0} was not found.",
        input.workspaceFolderPath,
      ),
    );
  }

  if (!workspaceFolder && !input.launchConfiguration) {
    throw new Error(
      vscode.l10n.t(
        "A workspace folder is required when starting a debug configuration by name.",
      ),
    );
  }

  let nameOrConfiguration: string | vscode.DebugConfiguration;

  if (input.launchConfiguration) {
    nameOrConfiguration =
      input.launchConfiguration as vscode.DebugConfiguration;
  } else if (input.launchName) {
    const snapshot = await findLaunchConfigurationByName(
      input.launchName,
      input.workspaceFolderPath,
    );

    if (!workspaceFolder && snapshot.workspaceFolderPath) {
      workspaceFolder = resolveWorkspaceFolder(snapshot.workspaceFolderPath);
    }

    nameOrConfiguration =
      snapshot.kind === "compound"
        ? snapshot.name
        : (snapshot.configuration as vscode.DebugConfiguration);
  } else {
    throw new Error(
      vscode.l10n.t(
        "Either launchName or launchConfiguration must be provided.",
      ),
    );
  }

  const debugSessionStarted = await vscode.debug.startDebugging(
    workspaceFolder,
    nameOrConfiguration,
    input.noDebug ? { noDebug: true } : undefined,
  );

  if (!debugSessionStarted) {
    throw new Error(
      vscode.l10n.t("Failed to start the selected debug configuration."),
    );
  }

  const startedSession = vscode.debug.activeDebugSession;

  return createTextResult({
    started: true,
    startedSession: startedSession
      ? { id: startedSession.id, name: startedSession.name }
      : undefined,
    workspaceFolderPath: workspaceFolder?.uri.fsPath,
    workspaceFolderName: workspaceFolder?.name,
  });
}
