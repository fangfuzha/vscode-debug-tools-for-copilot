import * as vscode from "vscode";
import { createTextResult } from "../../mcp/shared";
import {
  resolveDebugSession,
  resolveDebugThreadId,
  snapshotDebugSession,
} from "../sessions/shared";
import type {
  DebugWatchEvaluationInput,
  DebugWatchEvaluationSnapshot,
  DebugWatchExpressionSnapshot,
} from "./shared";

const WATCH_EXPRESSIONS_STORAGE_KEY = "debugWorkbench.watchExpressions";

let watchExpressionsContext: vscode.ExtensionContext | undefined;
let watchExpressionsLoaded = false;
let watchExpressions = new Map<string, string>();
let watchExpressionSequence = 0;

/**
 * Initialize the watch-expression store from extension storage.
 *
 * @param context Extension context used for persistence.
 */
export function initializeDebugWatchExpressionStore(
  context: vscode.ExtensionContext,
): void {
  watchExpressionsContext = context;

  if (watchExpressionsLoaded) {
    return;
  }

  watchExpressionsLoaded = true;

  const persisted = context.workspaceState.get<DebugWatchExpressionSnapshot[]>(
    WATCH_EXPRESSIONS_STORAGE_KEY,
    [],
  );

  watchExpressions = new Map(
    persisted.map((item) => [item.id, item.expression]),
  );

  const numericSuffixes = persisted
    .map((item) => Number(item.id.replace(/^watch-/, "")))
    .filter((value) => Number.isFinite(value));

  watchExpressionSequence = numericSuffixes.length
    ? Math.max(...numericSuffixes)
    : 0;
}

/**
 * Persist the current watch-expression state.
 */
function persistWatchExpressions(): void {
  if (!watchExpressionsContext) {
    return;
  }

  const snapshots = listDebugWatchExpressions();

  void watchExpressionsContext.workspaceState.update(
    WATCH_EXPRESSIONS_STORAGE_KEY,
    snapshots,
  );
}

/**
 * Add a watch expression to the extension-managed watch list.
 *
 * @param expression Watch expression.
 * @returns The created watch expression snapshot.
 */
export function addDebugWatchExpression(
  expression: string,
): DebugWatchExpressionSnapshot {
  const trimmedExpression = expression.trim();
  const watchExpressionId = `watch-${++watchExpressionSequence}`;

  watchExpressions.set(watchExpressionId, trimmedExpression);
  persistWatchExpressions();

  return {
    id: watchExpressionId,
    expression: trimmedExpression,
  };
}

/**
 * List the extension-managed watch expressions.
 *
 * @returns Watch expression snapshots.
 */
export function listDebugWatchExpressions(): DebugWatchExpressionSnapshot[] {
  return [...watchExpressions.entries()].map(([id, expression]) => ({
    id,
    expression,
  }));
}

/**
 * Remove a watch expression by id.
 *
 * @param watchExpressionId Watch expression id.
 * @returns Whether the watch expression was removed.
 */
export function removeDebugWatchExpression(watchExpressionId: string): boolean {
  const removed = watchExpressions.delete(watchExpressionId);

  if (removed) {
    persistWatchExpressions();
  }

  return removed;
}

/**
 * Clear all extension-managed watch expressions.
 *
 * @returns Number of removed watch expressions.
 */
export function clearDebugWatchExpressions(): number {
  const removedCount = watchExpressions.size;

  watchExpressions.clear();
  persistWatchExpressions();

  return removedCount;
}

/**
 * Resolve a watch-expression evaluation context.
 *
 * @param session Debug session to inspect.
 * @param frameId Optional frame identifier.
 * @param threadId Optional thread identifier.
 * @returns Resolved thread and frame identifiers.
 */
async function resolveWatchExpressionFrameContext(
  session: vscode.DebugSession,
  frameId?: number,
  threadId?: number,
): Promise<{ frameId: number; threadId: number }> {
  if (typeof frameId === "number") {
    return {
      frameId,
      threadId: threadId ?? (await resolveDebugThreadId(session)),
    };
  }

  const activeStackItem = vscode.debug.activeStackItem;

  if (
    activeStackItem instanceof vscode.DebugStackFrame &&
    activeStackItem.session.id === session.id
  ) {
    return {
      frameId: activeStackItem.frameId,
      threadId: activeStackItem.threadId,
    };
  }

  const resolvedThreadId = threadId ?? (await resolveDebugThreadId(session));
  const stackTraceResponse = await session.customRequest("stackTrace", {
    threadId: resolvedThreadId,
    startFrame: 0,
    levels: 1,
  });
  const stackFrames = Array.isArray(stackTraceResponse?.stackFrames)
    ? stackTraceResponse.stackFrames
    : [];

  if (stackFrames.length === 0 || typeof stackFrames[0]?.id !== "number") {
    throw new Error(
      vscode.l10n.t(
        "Unable to determine a stack frame for the selected debug session.",
      ),
    );
  }

  return {
    frameId: stackFrames[0].id,
    threadId: resolvedThreadId,
  };
}

/**
 * Evaluate the extension-managed watch expressions in a selected debug session.
 *
 * @param input Debug session input.
 * @returns Result payload.
 */
export async function evaluateDebugWatchExpressions(
  input: DebugWatchEvaluationInput,
): Promise<unknown> {
  const session = resolveDebugSession(input.sessionId);
  const frameContext = await resolveWatchExpressionFrameContext(
    session,
    input.frameId,
    input.threadId,
  );
  const evaluations: DebugWatchEvaluationSnapshot[] = [];

  for (const watchExpression of listDebugWatchExpressions()) {
    try {
      const evaluationResponse = (await session.customRequest("evaluate", {
        expression: watchExpression.expression,
        context: "watch",
        frameId: frameContext.frameId,
      })) as Record<string, unknown>;

      evaluations.push({
        id: watchExpression.id,
        expression: watchExpression.expression,
        success: true,
        result:
          typeof evaluationResponse.result === "string"
            ? evaluationResponse.result
            : undefined,
        type:
          typeof evaluationResponse.type === "string"
            ? evaluationResponse.type
            : undefined,
        variablesReference:
          typeof evaluationResponse.variablesReference === "number"
            ? evaluationResponse.variablesReference
            : undefined,
      });
    } catch (error) {
      evaluations.push({
        id: watchExpression.id,
        expression: watchExpression.expression,
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return createTextResult({
    session: snapshotDebugSession(session),
    threadId: frameContext.threadId,
    frameId: frameContext.frameId,
    count: evaluations.length,
    evaluations,
  });
}
