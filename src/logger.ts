import * as vscode from "vscode";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static instance: Logger | undefined;
  private readonly outputChannel: vscode.LogOutputChannel;
  private logLevel = LogLevel.INFO;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel(
      vscode.l10n.t("VS Code Debug Tools"),
      { log: true },
    );
  }

  public static getInstance(): Logger {
    Logger.instance ??= new Logger();
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.message}${error.stack ? `\nStack: ${error.stack}` : ""}`;
    }

    if (typeof error === "undefined") {
      return "undefined";
    }

    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }

  private formatMessage(message: string, error?: unknown): string {
    return error === undefined
      ? message
      : `${message}: ${this.formatError(error)}`;
  }

  public debug(message: string, error?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.outputChannel.debug(this.formatMessage(message, error));
    }
  }

  public info(message: string, error?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.outputChannel.info(this.formatMessage(message, error));
    }
  }

  public warn(message: string, error?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.outputChannel.warn(this.formatMessage(message, error));
    }
  }

  public error(message: string, error?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.outputChannel.error(this.formatMessage(message, error));
    }
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level set to ${LogLevel[level]}`);
  }

  public logSystemInfo(): void {
    this.info("=== System Information ===");
    this.info(`VS Code Version: ${vscode.version}`);
    this.info(`Platform: ${process.platform}`);
    this.info(`Architecture: ${process.arch}`);
    this.info(`Node.js Version: ${process.version}`);
    this.info(`Extension Host PID: ${process.pid}`);
    this.info("=== End System Information ===");
  }

  public logEnvironment(): void {
    this.info("=== Environment Variables ===");
    this.info(`HOME: ${process.env.HOME ?? "undefined"}`);
    this.info(`USERPROFILE: ${process.env.USERPROFILE ?? "undefined"}`);
    this.info(`APPDATA: ${process.env.APPDATA ?? "undefined"}`);
    this.info(`PATH: ${process.env.PATH?.substring(0, 200) ?? "undefined"}...`);
    this.info("=== End Environment Variables ===");
  }

  public show(preserveFocus = false): void {
    this.outputChannel.show(preserveFocus);
  }
}

export const logger = Logger.getInstance();
