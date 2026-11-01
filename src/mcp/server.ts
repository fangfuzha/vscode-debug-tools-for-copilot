/**
 * Runtime entrypoint for the Breakpoint MCP extension.
 *
 * This module is responsible for:
 * - creating the local HTTP server used by MCP transport,
 * - instantiating the MCP server runtime,
 * - registering the MCP server definition provider with VS Code,
 * - and delegating breakpoint and debug-session tool registration to the aggregators.
 */
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";

import * as vscode from "vscode";

import { logger } from "../logger";
import { registerBreakpointTools } from "./tools/breakpointMcp.tools";
import { registerDebugCompatibilitySupport } from "./tools/debugCompatibility";
import { registerDebugWorkbenchTools } from "./tools/debugWorkbenchMcp.tools";
import { registerDebugSessionTools } from "./tools/debugSessionMcp.tools";
import { registerDebugSessionTracking } from "../debug/sessions/shared";
import { DefaultBreakpointManager } from "../debug/breakpoints";
import { McpServerLike } from "./shared";

const MCP_HOST = "127.0.0.1";
const MCP_SERVER_NAME = "vscode-debug-tools-for-copilot";
const MCP_SERVER_VERSION = "0.5.0";
const MCP_PROVIDER_ID = "fangfuzha.vscode-debug-tools-for-copilot";

/** 端口设置项：vscodeDebugTools.mcpPort。 */
const CONFIG_SECTION = "vscodeDebugTools";
const PORT_SETTING_ID = "mcpPort";

/** 记录上次自动选中的端口，使端口在重启后尽量保持不变。 */
const REMEMBERED_PORT_KEY = "debugTools.selectedMcpPort";

/** 自动选端口时的候选区间。 */
const AUTO_PORT_MIN = 3001;
const AUTO_PORT_MAX = 3100;

/**
 * 端口的来源，用于诊断输出。
 *
 * - `setting`：用户在设置里显式指定；
 * - `remembered`：沿用上次自动选中的端口；
 * - `automatic`：本次新选出来的端口。
 */
export type McpPortSource = "setting" | "remembered" | "automatic";

interface BreakpointMcpRuntime extends vscode.Disposable {
  readonly endpoint: string;
  readonly port: number;
  readonly portSource: McpPortSource;

  toServerDefinition(): vscode.McpHttpServerDefinition;
}

type McpServerConstructor = new (options: {
  name: string;
  version: string;
}) => McpServerInstance;

interface McpServerInstance extends McpServerLike {
  connect(transport: unknown): Promise<unknown> | unknown;
}

let runtimePromise: Promise<BreakpointMcpRuntime> | undefined;
let runtime: BreakpointMcpRuntime | undefined;
let providerDisposable: vscode.Disposable | undefined;
let definitionsChanged: vscode.EventEmitter<void> | undefined;

/**
 * 注册断点 MCP 服务，并确保本地 HTTP 服务在后台启动。
 *
 * @param context 扩展上下文。
 * @returns 可释放的资源句柄。
 */
export function registerBreakpointMcpSupport(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  if (providerDisposable) {
    return providerDisposable;
  }

  definitionsChanged = new vscode.EventEmitter<void>();

  providerDisposable = vscode.lm.registerMcpServerDefinitionProvider(
    MCP_PROVIDER_ID,
    {
      onDidChangeMcpServerDefinitions: definitionsChanged.event,
      provideMcpServerDefinitions: async () => {
        const activeRuntime = await ensureBreakpointMcpRuntime(context);

        return [activeRuntime.toServerDefinition()];
      },
    },
  );

  registerDebugSessionTracking(context);

  void ensureBreakpointMcpRuntime(context).catch((error) => {
    const message = vscode.l10n.t(
      "Failed to start the VS Code Debug Tools for Copilot server.",
    );

    logger.error(message, error);
    void vscode.window.showErrorMessage(message);
  });

  const portSettingListener = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (
        !event.affectsConfiguration(`${CONFIG_SECTION}.${PORT_SETTING_ID}`)
      ) {
        return;
      }

      void restartBreakpointMcpRuntime(context);
    },
  );

  const disposable = vscode.Disposable.from(
    providerDisposable,
    definitionsChanged,
    portSettingListener,
  );
  context.subscriptions.push(disposable);

  return disposable;
}

/**
 * 获取或创建断点 MCP 运行时。
 *
 * @param context 扩展上下文。
 * @returns 断点 MCP 运行时。
 */
async function ensureBreakpointMcpRuntime(
  context: vscode.ExtensionContext,
): Promise<BreakpointMcpRuntime> {
  if (runtime) {
    return runtime;
  }

  if (!runtimePromise) {
    runtimePromise = createBreakpointMcpRuntime(context)
      .then((createdRuntime) => {
        runtime = createdRuntime;
        context.subscriptions.push(createdRuntime);
        return createdRuntime;
      })
      .catch((error) => {
        runtimePromise = undefined;
        throw error;
      });
  }

  return runtimePromise;
}

/**
 * 创建断点 MCP 运行时，包括本地 HTTP 服务器和 MCP 工具注册。
 *
 * @returns 断点 MCP 运行时。
 */
async function createBreakpointMcpRuntime(
  context: vscode.ExtensionContext,
): Promise<BreakpointMcpRuntime> {
  const [{ McpServer }, { NodeStreamableHTTPServerTransport }] =
    await Promise.all([
      import("@modelcontextprotocol/server"),
      import("@modelcontextprotocol/node"),
    ]);

  const httpServer = createServer(async (request, response) => {
    try {
      const mcpServer = await createBreakpointMcpServer(
        McpServer as McpServerConstructor,
        context,
      );
      const transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(request, response);
    } catch (error) {
      await writeInternalServerError(response, error);
    }
  });

  const { port, source: portSource } = await listenOnResolvedPort(
    httpServer,
    context,
  );
  const endpoint = `http://${MCP_HOST}:${port}`;

  // 绑定完成后保留一个长期错误处理器，避免运行期的 socket 错误变成未捕获异常。
  httpServer.on("error", (error) => {
    logger.error("MCP server error", error);
  });

  return {
    endpoint,
    port,
    portSource,
    async dispose() {
      runtime = undefined;
      runtimePromise = undefined;

      await closeHttpServer(httpServer);
    },
    toServerDefinition() {
      return new vscode.McpHttpServerDefinition(
        vscode.l10n.t("VS Code Debug Tools for Copilot"),
        vscode.Uri.parse(endpoint),
        {},
        MCP_SERVER_VERSION,
      );
    },
  };
}

/**
 * 为单个无状态 HTTP 请求创建一个用于断点管理的 MCP Server。
 *
 * @param McpServerClass MCP Server 构造函数。
 * @returns MCP Server 实例。
 */
async function createBreakpointMcpServer(
  McpServerClass: McpServerConstructor,
  context: vscode.ExtensionContext,
): Promise<McpServerInstance> {
  const server = new McpServerClass({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  // Create business logic managers
  const breakpointManager = new DefaultBreakpointManager();

  registerBreakpointTools(server, breakpointManager);
  registerDebugSessionTools(server);
  registerDebugWorkbenchTools(server, context);
  registerDebugCompatibilitySupport(server);

  return server;
}

/**
 * 向客户端返回内部错误。
 *
 * @param response HTTP 响应对象。
 * @param error 错误对象。
 * @returns 响应完成后的 Promise。
 */
async function writeInternalServerError(
  response: ServerResponse<IncomingMessage>,
  error: unknown,
): Promise<void> {
  logger.error("Internal MCP server error", error);

  if (!response.headersSent) {
    response.statusCode = 500;
    response.setHeader("content-type", "text/plain; charset=utf-8");
  }

  response.end(vscode.l10n.t("MCP server error"));
}

/**
 * 读取用户在设置里显式指定的端口。
 *
 * @returns 合法端口号；未配置或配置无效时返回 undefined。
 */
function getConfiguredPort(): number | undefined {
  const configured = vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<number>(PORT_SETTING_ID);

  if (typeof configured !== "number" || !Number.isInteger(configured)) {
    return undefined;
  }

  if (!isValidPort(configured)) {
    return undefined;
  }

  return configured;
}

/**
 * 判断端口号是否可用。
 *
 * @param port 端口号。
 * @returns 是否为合法端口号。
 */
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * 生成候选端口序列：随机起点 + 顺序递增。
 *
 * 随机起点避免总是抢占同一个端口，顺序递增保证占用冲突时按固定次序回退，
 * 不会在候选区间里来回跳。
 *
 * @returns 候选端口列表。
 */
function buildOrderedRandomCandidates(): number[] {
  const size = AUTO_PORT_MAX - AUTO_PORT_MIN + 1;
  const start = Math.floor(Math.random() * size);
  const candidates: number[] = [];

  for (let offset = 0; offset < size; offset++) {
    candidates.push(AUTO_PORT_MIN + ((start + offset) % size));
  }

  return candidates;
}

/**
 * 尝试在指定端口上监听，端口不可用时返回 false。
 *
 * @param server HTTP 服务器。
 * @param port 目标端口，0 表示由操作系统分配。
 * @returns 是否成功监听。
 */
function tryListen(server: HttpServer, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const onError = (error: Error & { code?: string }): void => {
      server.removeListener("listening", onListening);
      logger.warn(
        `MCP server port ${port} is unavailable: ${error.code ?? error.message}`,
      );
      resolve(false);
    };
    const onListening = (): void => {
      server.removeListener("error", onError);
      resolve(true);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, MCP_HOST);
  });
}

/**
 * 解析并绑定本地 MCP 服务监听的端口。
 *
 * 优先级：
 * 1. 用户在 `vscodeDebugTools.mcpPort` 中显式配置的端口；
 * 2. 上次成功绑定的端口（保存在 globalState），让端口尽量不频繁变化；
 * 3. 候选区间内的有序随机端口；
 * 4. 全部不可用时退回由操作系统分配。
 *
 * @param server HTTP 服务器。
 * @param context 扩展上下文，用于读取和保存端口状态。
 * @returns 已绑定的端口号及其来源。
 */
async function listenOnResolvedPort(
  server: HttpServer,
  context: vscode.ExtensionContext,
): Promise<{ port: number; source: McpPortSource }> {
  const configuredPort = getConfiguredPort();
  if (configuredPort !== undefined) {
    if (await tryListen(server, configuredPort)) {
      logger.info(`MCP server is listening on the configured port ${configuredPort}.`);
      return { port: configuredPort, source: "setting" };
    }

    logger.warn(
      `The configured MCP port ${configuredPort} is unavailable, falling back to automatic selection.`,
    );
  }

  const rememberedPort = context.globalState.get<number>(REMEMBERED_PORT_KEY);
  if (typeof rememberedPort === "number" && isValidPort(rememberedPort)) {
    if (await tryListen(server, rememberedPort)) {
      logger.info(`MCP server is reusing the previous port ${rememberedPort}.`);
      return { port: rememberedPort, source: "remembered" };
    }
  }

  for (const candidate of buildOrderedRandomCandidates()) {
    if (await tryListen(server, candidate)) {
      await context.globalState.update(REMEMBERED_PORT_KEY, candidate);
      logger.info(`MCP server selected the port ${candidate}.`);
      return { port: candidate, source: "automatic" };
    }
  }

  if (await tryListen(server, 0)) {
    const address = server.address();
    const port =
      typeof address === "object" && address && "port" in address
        ? address.port
        : 0;

    logger.warn(
      "No port in the automatic range was available, falling back to an OS assigned port.",
    );
    return { port, source: "automatic" };
  }

  throw new Error(vscode.l10n.t("Failed to determine the MCP server port."));
}

/**
 * Disable the registered breakpoint MCP provider and stop the runtime.
 */
export async function disableBreakpointMcpSupport(): Promise<void> {
  if (providerDisposable) {
    providerDisposable.dispose();
    providerDisposable = undefined;
  }

  if (definitionsChanged) {
    definitionsChanged.dispose();
    definitionsChanged = undefined;
  }

  await disposeBreakpointMcpRuntime();
}

/**
 * Returns whether the breakpoint MCP provider is currently enabled.
 */
export function isBreakpointMcpSupportEnabled(): boolean {
  return Boolean(providerDisposable);
}

async function disposeBreakpointMcpRuntime(): Promise<void> {
  if (runtime) {
    await runtime.dispose();
  }

  runtime = undefined;
  runtimePromise = undefined;
}

/**
 * 关闭 HTTP 服务器。
 *
 * @param server HTTP 服务器。
 * @returns 关闭完成后的 Promise。
 */
function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Restart the local MCP runtime so a changed port setting takes effect.
 *
 * @param context Extension context.
 */
export async function restartBreakpointMcpRuntime(
  context: vscode.ExtensionContext,
): Promise<void> {
  await disposeBreakpointMcpRuntime();
  await ensureBreakpointMcpRuntime(context);
  definitionsChanged?.fire();
}

/**
 * Return the current MCP endpoint together with the resolved port.
 *
 * @param context Extension context.
 * @returns The endpoint, the bound port, and where the port came from.
 */
export async function getBreakpointMcpEndpointInfo(
  context: vscode.ExtensionContext,
): Promise<{ endpoint: string; port: number; portSource: McpPortSource }> {
  const activeRuntime = await ensureBreakpointMcpRuntime(context);

  return {
    endpoint: activeRuntime.endpoint,
    port: activeRuntime.port,
    portSource: activeRuntime.portSource,
  };
}

/**
 * Return the current MCP endpoint.
 *
 * @param context Extension context.
 * @returns The active runtime endpoint.
 */
export async function getBreakpointMcpEndpoint(
  context: vscode.ExtensionContext,
): Promise<string> {
  const activeRuntime = await ensureBreakpointMcpRuntime(context);

  return activeRuntime.endpoint;
}
