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

interface BreakpointMcpRuntime extends vscode.Disposable {
  readonly endpoint: string;

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
      "Failed to start the VS Code Breakpoint Tools server.",
    );

    logger.error(message, error);
    void vscode.window.showErrorMessage(message);
  });

  const disposable = vscode.Disposable.from(
    providerDisposable,
    definitionsChanged,
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

  const mcpServer = await createBreakpointMcpServer(
    McpServer as McpServerConstructor,
    context,
  );
  const httpServer = createServer(async (request, response) => {
    try {
      const transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(request, response);
    } catch (error) {
      await writeInternalServerError(response, error);
    }
  });

  const port = await listenOnLoopback(httpServer);
  const endpoint = `http://${MCP_HOST}:${port}`;

  return {
    endpoint,
    async dispose() {
      runtime = undefined;
      runtimePromise = undefined;

      await closeHttpServer(httpServer);
    },
    toServerDefinition() {
      return new vscode.McpHttpServerDefinition(
        vscode.l10n.t("VS Code Breakpoint Tools"),
        vscode.Uri.parse(endpoint),
        {},
        MCP_SERVER_VERSION,
      );
    },
  };
}

/**
 * 创建一个用于断点管理的 MCP Server。
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
 * 监听随机可用端口并返回端口号。
 *
 * @param server HTTP 服务器。
 * @returns 已绑定端口号。
 */
function listenOnLoopback(server: HttpServer): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, MCP_HOST, () => {
      const address = server.address();

      if (typeof address === "object" && address && "port" in address) {
        resolve(address.port);
        return;
      }

      reject(
        new Error(vscode.l10n.t("Failed to determine the MCP server port.")),
      );
    });
  });
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
