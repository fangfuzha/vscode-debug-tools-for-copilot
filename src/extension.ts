import * as vscode from "vscode";
import { promptAndApplyAgentConfigurations } from "./mcp/agentConfigurationManager";
import { registerBreakpointMcpSupport } from "./mcp/breakpointMcp";
import { getBreakpointMcpEndpoint } from "./mcp/breakpointMcp";

/**
 * @description 插件激活回调函数
 * @param context 插件上下文
 */
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(registerBreakpointMcpSupport(context));

  const configureAgentsCommand = vscode.commands.registerCommand(
    "debugtools.configureAgentConfigurations",
    async () => {
      try {
        const endpoint = await getBreakpointMcpEndpoint(context);

        const result = await promptAndApplyAgentConfigurations(endpoint);

        if (!result) {
          return;
        }

        vscode.window.showInformationMessage(
          vscode.l10n.t(
            "Configured {0} agent configuration(s) and removed {1}.",
            result.updatedAgents.length.toString(),
            result.removedAgents.length.toString(),
          ),
        );
      } catch (error) {
        console.error("Failed to configure agent MCP integrations.", error);
        void vscode.window.showErrorMessage(
          vscode.l10n.t(
            "Failed to configure agent MCP integrations: {0}",
            String(error),
          ),
        );
      }
    },
  );

  context.subscriptions.push(configureAgentsCommand);
}

/**
 * 插件停用回调函数
 * @description 当插件被停用或者 VS Code 关闭时，会执行此函数。
 * 该函数的主要作用是清理插件在运行期间创建的资源，避免资源泄漏。
 */
export function deactivate() {
  console.log(vscode.l10n.t("Extension deactivated."));
}
