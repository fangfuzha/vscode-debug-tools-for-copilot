import * as vscode from "vscode";
import { disposeMcpDiagnostics, showMcpDiagnostics } from "./mcp/diagnostics";
import { showMcpConfigurationExport } from "./mcp/exportConfiguration";
import { registerBreakpointMcpSupport } from "./mcp/server";
import { logger } from "./logger";

/**
 * @description 插件激活回调函数
 * @param context 插件上下文
 */
export function activate(context: vscode.ExtensionContext) {
  logger.info(vscode.l10n.t("Extension activated."));
  logger.logSystemInfo();
  logger.logEnvironment();

  context.subscriptions.push(registerBreakpointMcpSupport(context));
  registerCommands(context);
}

function registerCommands(context: vscode.ExtensionContext) {
  const showDiagnosticsCommand = vscode.commands.registerCommand(
    "debugtools.show-mcp-diagnostics",
    async () => {
      await showMcpDiagnostics(context);
    },
  );

  const exportConfigurationCommand = vscode.commands.registerCommand(
    "debugtools.export-mcp-configuration",
    async () => {
      await showMcpConfigurationExport(context);
    },
  );

  context.subscriptions.push(
    showDiagnosticsCommand,
    exportConfigurationCommand,
  );
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
