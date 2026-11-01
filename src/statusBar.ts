import * as vscode from "vscode";

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
  statusBarItem.text = "$(debug-alt)";
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
function getContributedCommands(
  context: vscode.ExtensionContext,
): ContributedCommand[] {
  const manifest = context.extension.packageJSON as {
    contributes?: {
      commands?: { command: string; title: string; category?: string }[];
    };
  };

  const contributed = manifest.contributes?.commands ?? [];

  return contributed.map((entry) => ({
    command: entry.command,
    label:
      localizedCommandTitles.get(entry.command)?.() ??
      stripManifestPlaceholder(entry.title),
    description: entry.category
      ? vscode.l10n.t(stripManifestPlaceholder(entry.category))
      : undefined,
  }));
}

/**
 * 去掉清单里的 %占位符% 包装，保留键名本身。
 *
 * @param value 清单里的原始字符串。
 * @returns 去掉占位符后的字符串。
 */
function stripManifestPlaceholder(value: string): string {
  return value.replace(/^%(.+)%$/, "$1");
}
