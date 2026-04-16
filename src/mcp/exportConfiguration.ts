import * as vscode from "vscode";

import {
  getMcpConfigurationExportProfiles,
  type McpConfigurationExportProfile,
} from "./clientRegistry";
import { getBreakpointMcpEndpoint } from "./server";

/**
 * Quick pick item for an MCP export profile.
 */
interface McpConfigurationExportPickItem extends vscode.QuickPickItem {
  profileId: string;
}

/**
 * Show a reusable MCP configuration export for the currently running server.
 *
 * @param context Extension context used to resolve the active MCP endpoint.
 */
export async function showMcpConfigurationExport(
  context: vscode.ExtensionContext,
): Promise<void> {
  try {
    const endpoint = await getBreakpointMcpEndpoint(context);
    const profile = await pickMcpConfigurationExportProfile();

    if (!profile) {
      return;
    }

    const documentText = `${JSON.stringify(profile.buildDocument(endpoint), null, 2)}\n`;
    const document = await vscode.workspace.openTextDocument({
      language: "json",
      content: documentText,
    });

    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false,
    });
    await vscode.env.clipboard.writeText(documentText);
  } catch (error) {
    const message = vscode.l10n.t(
      "Failed to export MCP configuration: {0}",
      String(error),
    );

    void vscode.window.showErrorMessage(message);
  }
}

/**
 * Present the available MCP export profiles to the user.
 *
 * @returns The selected export profile, or undefined when cancelled.
 */
async function pickMcpConfigurationExportProfile(): Promise<
  McpConfigurationExportProfile | undefined
> {
  const profiles = getMcpConfigurationExportProfiles();
  const selectedProfile = await vscode.window.showQuickPick(
    profiles.map(
      (profile) =>
        ({
          label: profile.displayName,
          description: profile.filePathHint,
          detail: profile.description,
          profileId: profile.id,
        }) satisfies McpConfigurationExportPickItem,
    ),
    {
      title: vscode.l10n.t("Export MCP Configuration"),
      placeHolder: vscode.l10n.t("Choose a configuration profile to export."),
      canPickMany: false,
      ignoreFocusOut: true,
    },
  );

  if (!selectedProfile) {
    return undefined;
  }

  return profiles.find((profile) => profile.id === selectedProfile.profileId);
}
