import * as vscode from "vscode";
import { promptAndApplyAgentConfigurations } from "./mcp/agentConfig";
import { disposeMcpDiagnostics, showMcpDiagnostics } from "./mcp/diagnostics";
import {
  registerBreakpointMcpSupport,
  getBreakpointMcpEndpoint,
} from "./mcp/server";
import { logger } from "./logger";

/**
 * @description 插件激活回调函数
 * @param context 插件上下文
 */
export function activate(context: vscode.ExtensionContext) {
  logger.info(vscode.l10n.t("Extension activated."));

  // 只在调试模式下显示测试日志
  if (vscode.debug.activeDebugSession) {
    logger.error("测试错误级别日志 - 应该显示为红色");
    logger.warn("测试警告级别日志 - 应该显示为橙色");
    logger.info("测试信息级别日志 - 应该显示为蓝色");
    logger.debug("测试调试级别日志 - 应该显示为灰色");
  }

  context.subscriptions.push(registerBreakpointMcpSupport(context));
  registerCommands(context);
}

function registerCommands(context: vscode.ExtensionContext) {
  const configureAgentsCommand = vscode.commands.registerCommand(
    "debugtools.add-mcp-to-agent",
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
        logger.error("Failed to configure agent MCP integrations.", error);
        void vscode.window.showErrorMessage(
          vscode.l10n.t(
            "Failed to configure agent MCP integrations: {0}",
            String(error),
          ),
        );
      }
    },
  );

  const showDiagnosticsCommand = vscode.commands.registerCommand(
    "debugtools.show-mcp-diagnostics",
    async () => {
      await showMcpDiagnostics(context);
    },
  );

  context.subscriptions.push(configureAgentsCommand, showDiagnosticsCommand);
}

/**
 * 插件停用回调函数
 * @description 当插件被停用或者 VS Code 关闭时，会执行此函数。
 * 该函数的主要作用是清理插件在运行期间创建的资源，避免资源泄漏。
 */
export function deactivate() {
  disposeMcpDiagnostics();
  logger.info(vscode.l10n.t("Extension deactivated."));
}
