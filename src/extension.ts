import * as vscode from "vscode";
import { registerBreakpointMcpSupport } from "./mcp/breakpointMcp";

/**
 * @description 插件激活回调函数
 * @param context 插件上下文
 */
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(registerBreakpointMcpSupport(context));
}

/**
 * 插件停用回调函数
 * @description 当插件被停用或者 VS Code 关闭时，会执行此函数。
 * 该函数的主要作用是清理插件在运行期间创建的资源，避免资源泄漏。
 */
export function deactivate() {
  console.log(vscode.l10n.t("Extension deactivated."));
}
