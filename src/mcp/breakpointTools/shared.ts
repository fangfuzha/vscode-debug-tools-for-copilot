import * as path from "node:path";
import * as vscode from "vscode";
import * as z from "zod/v4";

export type BreakpointKind = "source" | "function" | "unknown";

export interface BreakpointSnapshot {
  key: string;
  kind: BreakpointKind;
  enabled: boolean;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
  filePath?: string;
  workspaceRelativePath?: string;
  line?: number;
  column?: number;
  functionName?: string;
  label?: string;
}

export interface BreakpointSearchInput {
  query: string;
  kind?: BreakpointKind;
  enabled?: boolean;
  limit?: number;
}

export interface BreakpointModificationInput {
  key?: string;
  filePath?: string;
  line?: number;
  column?: number;
  functionName?: string;
}

/**
 * Breakpoint update fields that can be changed without moving the breakpoint.
 */
export interface BreakpointUpdateInput extends BreakpointModificationInput {
  enabled?: boolean;
  condition?: string | null;
  hitCondition?: string | null;
  logMessage?: string | null;
}

export interface SetBreakpointsEnabledInFileInput {
  filePath: string;
  enabled: boolean;
}

export interface McpServerLike {
  registerTool<TInput = unknown>(
    name: string,
    options: { description: string; inputSchema: z.ZodTypeAny },
    handler: (input: TInput, ctx: unknown) => Promise<unknown> | unknown,
  ): void;
  registerResource(
    name: string,
    uriOrTemplate: string,
    config: { description: string; mimeType: string },
    readCallback: (uri: URL) => Promise<unknown> | unknown,
  ): void;
}

/**
 * Normalize a workspace-relative or absolute path to an absolute file path.
 */
export function resolveFilePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    throw new Error(
      vscode.l10n.t(
        "A workspace folder is required when using a relative file path.",
      ),
    );
  }

  return path.normalize(path.resolve(workspaceFolder.uri.fsPath, filePath));
}

/**
 * Normalize a file path for platform-specific comparison.
 */
export function normalizeFilePath(filePath: string): string {
  const normalizedPath = path.normalize(filePath);

  return process.platform === "win32"
    ? normalizedPath.toLowerCase()
    : normalizedPath;
}

/**
 * Trim optional text and return undefined for empty values.
 */
export function normalizeOptionalText(
  value: string | undefined,
): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

/**
 * Create a searchable text representation for a breakpoint snapshot.
 */
export function createBreakpointSearchText(
  snapshot: BreakpointSnapshot,
): string {
  return [
    snapshot.kind,
    snapshot.enabled ? "enabled" : "disabled",
    snapshot.condition,
    snapshot.hitCondition,
    snapshot.logMessage,
    snapshot.filePath,
    snapshot.workspaceRelativePath,
    snapshot.functionName,
    snapshot.label,
    snapshot.line?.toString(),
    snapshot.column?.toString(),
  ]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    )
    .join(" ")
    .toLowerCase();
}

/**
 * Create a stable breakpoint key from a descriptor object.
 */
export function createBreakpointKey(
  descriptor: Record<string, unknown>,
): string {
  return Buffer.from(JSON.stringify(descriptor)).toString("base64url");
}

/**
 * Parse a stable breakpoint key into its descriptor object.
 */
export function parseBreakpointKey(
  key: string,
): Record<string, unknown> | undefined {
  try {
    const decoded = Buffer.from(key, "base64url").toString("utf8");

    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Wrap tool result payloads in MCP text response format.
 */
export function createTextResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

/**
 * Create a stable descriptor object from a breakpoint instance.
 */
export function describeBreakpoint(
  breakpoint: vscode.Breakpoint,
): Record<string, unknown> {
  if (breakpoint instanceof vscode.SourceBreakpoint) {
    return {
      kind: "source",
      filePath: normalizeFilePath(breakpoint.location.uri.fsPath),
      line: breakpoint.location.range.start.line + 1,
      column: breakpoint.location.range.start.character + 1,
      condition: normalizeOptionalText(breakpoint.condition),
      hitCondition: normalizeOptionalText(breakpoint.hitCondition),
      logMessage: normalizeOptionalText(breakpoint.logMessage),
    };
  }

  if (breakpoint instanceof vscode.FunctionBreakpoint) {
    return {
      kind: "function",
      functionName: breakpoint.functionName,
      condition: normalizeOptionalText(breakpoint.condition),
      hitCondition: normalizeOptionalText(breakpoint.hitCondition),
      logMessage: normalizeOptionalText(breakpoint.logMessage),
    };
  }

  return {
    kind: "unknown",
    label: breakpoint.constructor.name,
  };
}

/**
 * Convert a breakpoint instance into a stable snapshot object.
 */
export function snapshotBreakpoint(
  breakpoint: vscode.Breakpoint,
): BreakpointSnapshot {
  if (breakpoint instanceof vscode.SourceBreakpoint) {
    const filePath = breakpoint.location.uri.fsPath;
    const workspaceRelativePath = vscode.workspace.asRelativePath(
      breakpoint.location.uri,
      false,
    );

    return {
      key: createBreakpointKey({
        kind: "source",
        filePath: normalizeFilePath(filePath),
        line: breakpoint.location.range.start.line + 1,
        column: breakpoint.location.range.start.character + 1,
        condition: normalizeOptionalText(breakpoint.condition),
        hitCondition: normalizeOptionalText(breakpoint.hitCondition),
        logMessage: normalizeOptionalText(breakpoint.logMessage),
      }),
      kind: "source",
      enabled: breakpoint.enabled,
      condition: normalizeOptionalText(breakpoint.condition),
      hitCondition: normalizeOptionalText(breakpoint.hitCondition),
      logMessage: normalizeOptionalText(breakpoint.logMessage),
      filePath,
      workspaceRelativePath,
      line: breakpoint.location.range.start.line + 1,
      column: breakpoint.location.range.start.character + 1,
    };
  }

  if (breakpoint instanceof vscode.FunctionBreakpoint) {
    return {
      key: createBreakpointKey({
        kind: "function",
        functionName: breakpoint.functionName,
        condition: normalizeOptionalText(breakpoint.condition),
        hitCondition: normalizeOptionalText(breakpoint.hitCondition),
        logMessage: normalizeOptionalText(breakpoint.logMessage),
      }),
      kind: "function",
      enabled: breakpoint.enabled,
      condition: normalizeOptionalText(breakpoint.condition),
      hitCondition: normalizeOptionalText(breakpoint.hitCondition),
      logMessage: normalizeOptionalText(breakpoint.logMessage),
      functionName: breakpoint.functionName,
    };
  }

  return {
    key: createBreakpointKey({
      kind: "unknown",
      label: breakpoint.constructor.name,
    }),
    kind: "unknown",
    enabled: breakpoint.enabled,
    condition: normalizeOptionalText(breakpoint.condition),
    hitCondition: normalizeOptionalText(breakpoint.hitCondition),
    logMessage: normalizeOptionalText(breakpoint.logMessage),
    label: breakpoint.constructor.name,
  };
}

/**
 * Return a snapshot for every breakpoint currently registered in VS Code.
 */
export function listBreakpoints(): BreakpointSnapshot[] {
  return vscode.debug.breakpoints.map(snapshotBreakpoint);
}

/**
 * Find all source breakpoints inside a specific file.
 */
export function findSourceBreakpointsInFile(
  filePath: string,
): vscode.SourceBreakpoint[] {
  const targetFilePath = normalizeFilePath(resolveFilePath(filePath));

  return vscode.debug.breakpoints.filter(
    (breakpoint): breakpoint is vscode.SourceBreakpoint =>
      breakpoint instanceof vscode.SourceBreakpoint &&
      normalizeFilePath(breakpoint.location.uri.fsPath) === targetFilePath,
  );
}

/**
 * Find breakpoints that match the provided search criteria.
 */
export function findMatchingBreakpoints(
  input: BreakpointModificationInput,
): vscode.Breakpoint[] {
  if (input.key) {
    const targetDescriptor = parseBreakpointKey(input.key);

    if (!targetDescriptor) {
      throw new Error(vscode.l10n.t("The provided breakpoint key is invalid."));
    }

    const targetKey = createBreakpointKey(targetDescriptor);

    return vscode.debug.breakpoints.filter((breakpoint) => {
      return createBreakpointKey(describeBreakpoint(breakpoint)) === targetKey;
    });
  }

  if (input.functionName) {
    return vscode.debug.breakpoints.filter(
      (breakpoint): breakpoint is vscode.FunctionBreakpoint =>
        breakpoint instanceof vscode.FunctionBreakpoint &&
        breakpoint.functionName === input.functionName,
    );
  }

  if (!input.filePath || !input.line) {
    throw new Error(
      vscode.l10n.t(
        "Either key, functionName, or filePath + line must be provided to identify a breakpoint.",
      ),
    );
  }

  const targetFilePath = normalizeFilePath(resolveFilePath(input.filePath));
  const targetLine = input.line;
  const targetColumn = input.column;

  return vscode.debug.breakpoints.filter(
    (breakpoint): breakpoint is vscode.SourceBreakpoint => {
      if (!(breakpoint instanceof vscode.SourceBreakpoint)) {
        return false;
      }

      const breakpointFilePath = normalizeFilePath(
        breakpoint.location.uri.fsPath,
      );
      const breakpointLine = breakpoint.location.range.start.line + 1;
      const breakpointColumn = breakpoint.location.range.start.character + 1;

      if (
        breakpointFilePath !== targetFilePath ||
        breakpointLine !== targetLine
      ) {
        return false;
      }

      return typeof targetColumn === "number"
        ? breakpointColumn === targetColumn
        : true;
    },
  );
}

/**
 * Clone a breakpoint with a new enabled state for re-registration.
 */
export function cloneBreakpointWithEnabledState(
  breakpoint: vscode.Breakpoint,
  enabled: boolean,
): vscode.Breakpoint | undefined {
  if (breakpoint instanceof vscode.SourceBreakpoint) {
    return new vscode.SourceBreakpoint(
      new vscode.Location(
        breakpoint.location.uri,
        breakpoint.location.range.start,
      ),
      enabled,
      normalizeOptionalText(breakpoint.condition),
      normalizeOptionalText(breakpoint.hitCondition),
      normalizeOptionalText(breakpoint.logMessage),
    );
  }

  if (breakpoint instanceof vscode.FunctionBreakpoint) {
    return new vscode.FunctionBreakpoint(
      breakpoint.functionName,
      enabled,
      normalizeOptionalText(breakpoint.condition),
      normalizeOptionalText(breakpoint.hitCondition),
      normalizeOptionalText(breakpoint.logMessage),
    );
  }

  return undefined;
}

/**
 * Clone a breakpoint while updating its editable properties.
 */
export function cloneBreakpointWithUpdatedState(
  breakpoint: vscode.Breakpoint,
  input: BreakpointUpdateInput,
): vscode.Breakpoint | undefined {
  const enabled = input.enabled ?? breakpoint.enabled;

  if (breakpoint instanceof vscode.SourceBreakpoint) {
    const condition =
      input.condition === undefined
        ? normalizeOptionalText(breakpoint.condition)
        : normalizeOptionalText(input.condition ?? undefined);
    const hitCondition =
      input.hitCondition === undefined
        ? normalizeOptionalText(breakpoint.hitCondition)
        : normalizeOptionalText(input.hitCondition ?? undefined);
    const logMessage =
      input.logMessage === undefined
        ? normalizeOptionalText(breakpoint.logMessage)
        : normalizeOptionalText(input.logMessage ?? undefined);

    return new vscode.SourceBreakpoint(
      new vscode.Location(
        breakpoint.location.uri,
        breakpoint.location.range.start,
      ),
      enabled,
      condition,
      hitCondition,
      logMessage,
    );
  }

  if (breakpoint instanceof vscode.FunctionBreakpoint) {
    const condition =
      input.condition === undefined
        ? normalizeOptionalText(breakpoint.condition)
        : normalizeOptionalText(input.condition ?? undefined);
    const hitCondition =
      input.hitCondition === undefined
        ? normalizeOptionalText(breakpoint.hitCondition)
        : normalizeOptionalText(input.hitCondition ?? undefined);
    const logMessage =
      input.logMessage === undefined
        ? normalizeOptionalText(breakpoint.logMessage)
        : normalizeOptionalText(input.logMessage ?? undefined);

    return new vscode.FunctionBreakpoint(
      breakpoint.functionName,
      enabled,
      condition,
      hitCondition,
      logMessage,
    );
  }

  return undefined;
}
