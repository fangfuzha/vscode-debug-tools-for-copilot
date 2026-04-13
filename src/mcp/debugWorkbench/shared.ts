import * as vscode from "vscode";
import { normalizeFilePath } from "../breakpointTools/shared";

/**
 * Snapshot of a discoverable debug launch configuration.
 */
export interface DebugLaunchConfigurationSnapshot {
  kind: "configuration" | "compound";
  origin: "launchJson" | "recentSession";
  name: string;
  workspaceFolderName?: string;
  workspaceFolderPath?: string;
  sourcePath: string;
  debugType?: string;
  debugSessionId?: string;
  configuration?: Record<string, unknown>;
  compound?: Record<string, unknown>;
}

/**
 * Common debug-session selector input.
 */
export interface DebugSessionToolInput {
  sessionId?: string;
}

/**
 * Input for starting a debug launch configuration.
 */
export interface StartDebugLaunchConfigurationInput {
  workspaceFolderPath?: string;
  launchName?: string;
  launchConfiguration?: Record<string, unknown>;
  noDebug?: boolean;
}

/**
 * Input for opening a debug source file.
 */
export interface OpenDebugSourceFileInput {
  filePath: string;
  line?: number;
  column?: number;
}

/**
 * Input for reading a stack trace.
 */
export interface DebugStackTraceInput extends DebugSessionToolInput {
  threadId?: number;
  startFrame?: number;
  levels?: number;
}

/**
 * Input for reading scopes.
 */
export interface DebugScopesInput extends DebugSessionToolInput {
  threadId?: number;
  frameId?: number;
}

/**
 * Input for reading variables.
 */
export interface DebugVariablesInput extends DebugSessionToolInput {
  variablesReference: number;
}

/**
 * Input for evaluating expressions.
 */
export interface DebugEvaluateInput extends DebugSessionToolInput {
  expression: string;
  threadId?: number;
  frameId?: number;
  context?: "watch" | "repl" | "hover" | "clipboard";
}

/**
 * Input for evaluating watch expressions.
 */
export interface DebugWatchEvaluationInput extends DebugSessionToolInput {
  threadId?: number;
  frameId?: number;
}

/**
 * Stored watch expression snapshot.
 */
export interface DebugWatchExpressionSnapshot {
  id: string;
  expression: string;
}

/**
 * Result of evaluating a watch expression.
 */
export interface DebugWatchEvaluationSnapshot {
  id: string;
  expression: string;
  success: boolean;
  result?: string;
  type?: string;
  variablesReference?: number;
  message?: string;
}

/**
 * Snapshot of a debug stack frame.
 */
export interface DebugStackFrameSnapshot {
  id: number;
  name: string;
  threadId: number;
  sourceName?: string;
  sourcePath?: string;
  line?: number;
  column?: number;
  presentationHint?: string;
  canRestart?: boolean;
}

/**
 * Snapshot of a debug scope.
 */
export interface DebugScopeSnapshot {
  name: string;
  variablesReference: number;
  expensive: boolean;
  namedVariables?: number;
  indexedVariables?: number;
  presentationHint?: string;
}

/**
 * Snapshot of a debug variable.
 */
export interface DebugVariableSnapshot {
  name: string;
  value: string;
  type?: string;
  evaluateName?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  valueChanged?: boolean;
}

/**
 * Normalize a workspace path for comparison.
 *
 * @param filePath Path to normalize.
 * @returns Normalized comparison key.
 */
export function normalizeWorkspacePath(filePath: string): string {
  const normalizedPath = normalizeFilePath(filePath);

  return process.platform === "win32"
    ? normalizedPath.toLowerCase()
    : normalizedPath;
}

/**
 * Resolve a workspace folder by absolute path when provided.
 *
 * @param workspaceFolderPath Workspace folder path.
 * @returns The matching workspace folder or the first workspace folder.
 */
export function resolveWorkspaceFolder(
  workspaceFolderPath?: string,
): vscode.WorkspaceFolder | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

  if (!workspaceFolderPath) {
    return workspaceFolders[0];
  }

  const normalizedTargetPath = normalizeWorkspacePath(workspaceFolderPath);

  return workspaceFolders.find(
    (workspaceFolder) =>
      normalizeWorkspacePath(workspaceFolder.uri.fsPath) === normalizedTargetPath,
  );
}
