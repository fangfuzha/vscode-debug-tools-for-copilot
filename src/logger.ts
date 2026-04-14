import * as vscode from "vscode";

const OUTPUT_CHANNEL_NAME = "VS Code Debug Tools";
const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);

/**
 * 返回当前时间的 ISO 8601 字符串表示。
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 将任意错误值格式化为可读字符串。
 *
 * @param error - 需要格式化的错误对象或任意值
 * @returns 可写入输出通道的错误描述字符串
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

/**
 * 生成带时间戳和日志级别前缀的日志行字符串。
 *
 * @param level - 日志级别，如 INFO、WARN、ERROR、DEBUG
 * @param message - 日志消息文本
 */
function formatLine(level: string, message: string): string {
  return `[${formatTimestamp()}] [${level}] ${message}`;
}

/**
 * 简单的日志记录器，输出到 VS Code 的输出通道。
 */
export const logger = {
  /**
   * 输出普通信息日志。
   */
  info(message: string, error?: unknown) {
    outputChannel.appendLine(
      formatLine("INFO", error ? `${message}: ${formatError(error)}` : message),
    );
  },

  /**
   * 输出警告日志。
   */
  warn(message: string, error?: unknown) {
    outputChannel.appendLine(
      formatLine("WARN", error ? `${message}: ${formatError(error)}` : message),
    );
  },

  /**
   * 输出错误日志。
   */
  error(message: string, error?: unknown) {
    outputChannel.appendLine(
      formatLine(
        "ERROR",
        error ? `${message}: ${formatError(error)}` : message,
      ),
    );
  },

  /**
   * 输出调试日志。
   */
  debug(message: string, error?: unknown) {
    outputChannel.appendLine(
      formatLine(
        "DEBUG",
        error ? `${message}: ${formatError(error)}` : message,
      ),
    );
  },

  /**
   * 显示输出通道，可选择保持当前焦点。
   */
  show(preserveFocus = false) {
    outputChannel.show(preserveFocus);
  },
};
