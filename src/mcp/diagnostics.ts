import * as vscode from "vscode";

import {
  getBreakpointMcpEndpointInfo,
  isBreakpointMcpSupportEnabled,
} from "./server";
import { listBreakpoints } from "../debug/breakpoints/shared";
import { listDebugSessions } from "../debug/sessions/shared";
import { listRecentDebugConfigurations } from "../debug/workbench/recentDebugConfigurations";
import { listDebugWatchExpressions } from "../debug/workbench/watchExpressionStore";

let diagnosticsOutputChannel: vscode.OutputChannel | undefined;

/**
 * Show a diagnostics report for the MCP runtime, debug state, and agent config targets.
 *
 * @param context Extension context used to resolve the active MCP endpoint.
 */
export async function showMcpDiagnostics(
  context: vscode.ExtensionContext,
): Promise<void> {
  try {
    const { endpoint, port, portSource } = await getBreakpointMcpEndpointInfo(
      context,
    );
    const diagnosticsOutput = getDiagnosticsOutputChannel();
    const diagnostics = {
      endpoint,
      port,
      portSource,
      runtimeEnabled: isBreakpointMcpSupportEnabled(),
      breakpointCount: listBreakpoints().length,
      debugSessionCount: listDebugSessions().length,
      recentDebugConfigurationCount: listRecentDebugConfigurations().length,
      watchExpressionCount: listDebugWatchExpressions().length,
    };

    diagnosticsOutput.clear();
    diagnosticsOutput.appendLine(
      vscode.l10n.t("VS Code Debug Tools for Copilot diagnostics"),
    );
    diagnosticsOutput.appendLine(JSON.stringify(diagnostics, null, 2));
    diagnosticsOutput.show(true);

    const copyEndpointLabel = vscode.l10n.t("Copy Endpoint");
    const exportConfigurationLabel = vscode.l10n.t("Export MCP Configuration");
    const selection = await vscode.window.showInformationMessage(
      vscode.l10n.t("MCP diagnostics were written to the output channel."),
      copyEndpointLabel,
      exportConfigurationLabel,
    );

    if (selection === copyEndpointLabel) {
      await vscode.env.clipboard.writeText(endpoint);
      return;
    }

    if (selection === exportConfigurationLabel) {
      await vscode.commands.executeCommand(
        "debugtools.export-mcp-configuration",
      );
    }
  } catch (error) {
    const message = vscode.l10n.t(
      "Failed to generate MCP diagnostics: {0}",
      String(error),
    );

    void vscode.window.showErrorMessage(message);
  }
}

/**
 * Dispose the diagnostics output channel if it has been created.
 */
export function disposeMcpDiagnostics(): void {
  diagnosticsOutputChannel?.dispose();
  diagnosticsOutputChannel = undefined;
}

/**
 * Return the shared diagnostics output channel.
 *
 * @returns The diagnostics output channel.
 */
function getDiagnosticsOutputChannel(): vscode.OutputChannel {
  if (!diagnosticsOutputChannel) {
    diagnosticsOutputChannel = vscode.window.createOutputChannel(
      vscode.l10n.t("VS Code Debug Tools"),
    );
  }

  return diagnosticsOutputChannel;
}
