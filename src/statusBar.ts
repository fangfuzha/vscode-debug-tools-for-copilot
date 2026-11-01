import * as vscode from "vscode";

import { logger } from "./logger";

/**
 * 状态栏菜单里各命令的本地化标题。
 *
 * 键是命令 ID，值是返回本地化标题的函数。命令清单本身从 package.json 的
 * `contributes.commands` 读取，所以状态栏里列出的命令和扩展实际贡献的命令保持一致；
 * 这里只需要补充各命令的运行时标题。
 */
const localizedCommandTitles = new Map<string, () => string>([
  [
    "debugtools.show-mcp-diagnostics",
    () => vscode.l10n.t("Show MCP Diagnostics"),
  ],
  [
    "debugtools.export-mcp-configuration",
    () => vscode.l10n.t("Export MCP Configuration"),
  ],
]);

/**
 * 扩展贡献的一条命令。
 */
interface ContributedCommand {
  command: string;
  label: string;
  description?: string;
}

/**
 * 注册状态栏入口，点击后列出扩展贡献的所有命令。
 *
 * @param context 扩展上下文，用于读取扩展清单。
 * @returns 释放状态栏条目与命令的句柄。
 */
export function registerExtensionStatusBar(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  const showCommandsCommand = vscode.commands.registerCommand(
    "debugtools.show-command-menu",
    async () => {
      await showCommandMenu(context);
    },
  );

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.text = "$(debugtools-debug-agent)";
  statusBarItem.tooltip = vscode.l10n.t(
    "VS Code Debug Tools for Copilot commands",
  );
  statusBarItem.command = "debugtools.show-command-menu";
  statusBarItem.show();

  return vscode.Disposable.from(showCommandsCommand, statusBarItem);
}

/**
 * 弹出命令菜单并执行用户选中的命令。
 *
 * @param context 扩展上下文，用于读取扩展清单。
 */
async function showCommandMenu(
  context: vscode.ExtensionContext,
): Promise<void> {
  const commands = getContributedCommands(context);

  if (commands.length === 0) {
    void vscode.window.showInformationMessage(
      vscode.l10n.t("This extension does not contribute any command."),
    );
    return;
  }

  const selected = await vscode.window.showQuickPick(
    commands.map((command) => ({
      label: command.label,
      description: command.description,
      command: command.command,
    })),
    {
      title: vscode.l10n.t("VS Code Debug Tools for Copilot commands"),
      placeHolder: vscode.l10n.t("Choose a command to run."),
      canPickMany: false,
      ignoreFocusOut: true,
    },
  );

  if (!selected) {
    return;
  }

  await vscode.commands.executeCommand(selected.command);
}

/**
 * 读取扩展清单里贡献的命令。
 *
 * @param context 扩展上下文。
 * @returns 命令清单，标题与分类均已本地化。
 */
export function getContributedCommands(
  context: vscode.ExtensionContext,
): ContributedCommand[] {
  const manifest = context.extension.packageJSON as {
    contributes?: {
      commands?: { command?: unknown; title?: unknown; category?: unknown }[];
    };
  };

  const contributed = manifest.contributes?.commands;

  if (!Array.isArray(contributed)) {
    return [];
  }

  return contributed.map((entry) => {
    const command = readString(entry.command);
    const title = readString(entry.title);
    const category = readString(entry.category);

    return {
      command,
      label:
        localizedCommandTitles.get(command)?.() ??
        stripManifestPlaceholder(title),
      description: category
        ? vscode.l10n.t(stripManifestPlaceholder(category))
        : undefined,
    };
  });
}

/**
 * 读取字符串字段，非字符串一律按空串处理。
 *
 * 扩展宿主交给扩展的 packageJSON 是扩展描述对象，其 contributes 已经被 VS Code 的
 * 清单本地化层改写过，字段结构不保证和 package.json 原文一致，这里不能假定类型。
 *
 * @param value 字段值。
 * @returns 字符串值，非字符串时返回空串。
 */
function readString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value !== undefined && value !== null) {
    logger.warn(
      `Unexpected non-string manifest value: ${typeof value} (${JSON.stringify(value)?.slice(0, 80)})`,
    );
  }

  return "";
}

/**
 * 去掉清单里的 %占位符% 包装，保留键名本身。
 *
 * @param value 清单里的原始值。
 * @returns 去掉占位符后的字符串。
 */
function stripManifestPlaceholder(value: unknown): string {
  const text = readString(value);

  return text.replace(/^%(.+)%$/, "$1");
}
