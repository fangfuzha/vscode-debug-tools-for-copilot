import * as vscode from "vscode";
import { createTextResult } from "../../mcp/shared";
import {
  getWorkspaceRelativePath,
  resolveFilePath,
} from "../breakpoints/shared";
import type { OpenDebugSourceFileInput } from "./shared";

/**
 * Open a source file and focus it in the active editor.
 *
 * @param input File path and optional line/column.
 * @returns Result payload for the opened editor.
 */
export async function openDebugSourceFile(
  input: OpenDebugSourceFileInput,
): Promise<unknown> {
  const resolvedFilePath = resolveFilePath(
    input.filePath,
    input.workspaceFolderPath,
  );
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(resolvedFilePath),
  );
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
  });
  const targetLine = Math.max(1, input.line ?? 1);
  const targetColumn = Math.max(1, input.column ?? 1);
  const targetRange = new vscode.Range(
    targetLine - 1,
    targetColumn - 1,
    targetLine - 1,
    targetColumn - 1,
  );

  editor.selection = new vscode.Selection(targetRange.start, targetRange.end);
  editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);

  return createTextResult({
    filePath: resolvedFilePath,
    workspaceRelativePath: getWorkspaceRelativePath(resolvedFilePath),
    line: targetLine,
    column: targetColumn,
    opened: true,
  });
}
