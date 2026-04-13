import * as vscode from "vscode";
import { createTextResult } from "../breakpointTools/shared";
import {
  type DebugEvaluateInput,
  type DebugScopesInput,
  type DebugStackFrameSnapshot,
  type DebugStackTraceInput,
  type DebugScopeSnapshot,
  type DebugVariableSnapshot,
  type DebugVariablesInput,
} from "./shared";
import {
  resolveDebugSession,
  resolveDebugThreadId,
  snapshotDebugSession,
} from "../debugSessionTools/shared";

/**
 * Resolve a debug stack frame context from the active stack item or a thread.
 *
 * @param session Debug session.
 * @param frameId Optional frame identifier.
 * @param threadId Optional thread identifier.
 * @returns Resolved thread and frame identifiers.
 */
async function resolveDebugFrameContext(
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
 * Request a call stack from a debug session.
 *
 * @param input Debug call stack input.
 * @returns Result payload.
 */
export async function listDebugCallStack(
  input: DebugStackTraceInput,
): Promise<unknown> {
  const session = resolveDebugSession(input.sessionId);
  const threadId = input.threadId ?? (await resolveDebugThreadId(session));
  const stackTraceResponse = await session.customRequest("stackTrace", {
    threadId,
    startFrame: input.startFrame ?? 0,
    levels: input.levels ?? 20,
  });
  const stackFrames = Array.isArray(stackTraceResponse?.stackFrames)
    ? stackTraceResponse.stackFrames
    : [];

  return createTextResult({
    session: snapshotDebugSession(session),
    threadId,
    count: stackFrames.length,
    stackFrames: stackFrames
      .filter(
        (frame: unknown): frame is Record<string, unknown> =>
          Boolean(frame) && typeof frame === "object" && !Array.isArray(frame),
      )
      .map((frame: Record<string, unknown>): DebugStackFrameSnapshot => {
        const source = frame.source as Record<string, unknown> | undefined;

        return {
          id: typeof frame.id === "number" ? frame.id : 0,
          name: typeof frame.name === "string" ? frame.name : "",
          threadId,
          sourceName:
            typeof source?.name === "string" ? source.name : undefined,
          sourcePath:
            typeof source?.path === "string" ? source.path : undefined,
          line: typeof frame.line === "number" ? frame.line : undefined,
          column: typeof frame.column === "number" ? frame.column : undefined,
          presentationHint:
            typeof frame.presentationHint === "string"
              ? frame.presentationHint
              : undefined,
          canRestart:
            typeof frame.canRestart === "boolean"
              ? frame.canRestart
              : undefined,
        };
      }),
  });
}

/**
 * Request scopes for a debug stack frame.
 *
 * @param input Debug scopes input.
 * @returns Result payload.
 */
export async function listDebugScopes(
  input: DebugScopesInput,
): Promise<unknown> {
  const session = resolveDebugSession(input.sessionId);
  const resolvedFrameContext = await resolveDebugFrameContext(
    session,
    input.frameId,
    input.threadId,
  );
  const scopesResponse = await session.customRequest("scopes", {
    frameId: resolvedFrameContext.frameId,
  });
  const scopes = Array.isArray(scopesResponse?.scopes)
    ? scopesResponse.scopes
    : [];

  return createTextResult({
    session: snapshotDebugSession(session),
    threadId: resolvedFrameContext.threadId,
    frameId: resolvedFrameContext.frameId,
    count: scopes.length,
    scopes: scopes
      .filter(
        (scope: unknown): scope is Record<string, unknown> =>
          Boolean(scope) && typeof scope === "object" && !Array.isArray(scope),
      )
      .map(
        (scope: Record<string, unknown>): DebugScopeSnapshot => ({
          name: typeof scope.name === "string" ? scope.name : "",
          variablesReference:
            typeof scope.variablesReference === "number"
              ? scope.variablesReference
              : 0,
          expensive: Boolean(scope.expensive),
          namedVariables:
            typeof scope.namedVariables === "number"
              ? scope.namedVariables
              : undefined,
          indexedVariables:
            typeof scope.indexedVariables === "number"
              ? scope.indexedVariables
              : undefined,
          presentationHint:
            typeof scope.presentationHint === "string"
              ? scope.presentationHint
              : undefined,
        }),
      ),
  });
}

/**
 * Request variables from a debug session.
 *
 * @param input Debug variables input.
 * @returns Result payload.
 */
export async function listDebugVariables(
  input: DebugVariablesInput,
): Promise<unknown> {
  const session = resolveDebugSession(input.sessionId);
  const variablesResponse = await session.customRequest("variables", {
    variablesReference: input.variablesReference,
  });
  const variables = Array.isArray(variablesResponse?.variables)
    ? variablesResponse.variables
    : [];

  return createTextResult({
    session: snapshotDebugSession(session),
    variablesReference: input.variablesReference,
    count: variables.length,
    variables: variables
      .filter(
        (variable: unknown): variable is Record<string, unknown> =>
          Boolean(variable) &&
          typeof variable === "object" &&
          !Array.isArray(variable),
      )
      .map(
        (variable: Record<string, unknown>): DebugVariableSnapshot => ({
          name: typeof variable.name === "string" ? variable.name : "",
          value: typeof variable.value === "string" ? variable.value : "",
          type: typeof variable.type === "string" ? variable.type : undefined,
          evaluateName:
            typeof variable.evaluateName === "string"
              ? variable.evaluateName
              : undefined,
          variablesReference:
            typeof variable.variablesReference === "number"
              ? variable.variablesReference
              : 0,
          namedVariables:
            typeof variable.namedVariables === "number"
              ? variable.namedVariables
              : undefined,
          indexedVariables:
            typeof variable.indexedVariables === "number"
              ? variable.indexedVariables
              : undefined,
          valueChanged:
            typeof variable.valueChanged === "boolean"
              ? variable.valueChanged
              : undefined,
        }),
      ),
  });
}

/**
 * Evaluate an expression in a debug session.
 *
 * @param input Debug evaluate input.
 * @returns Result payload.
 */
export async function evaluateDebugExpression(
  input: DebugEvaluateInput,
): Promise<unknown> {
  const session = resolveDebugSession(input.sessionId);
  const evaluateArguments: Record<string, unknown> = {
    expression: input.expression,
    context: input.context ?? "repl",
  };

  if (typeof input.frameId === "number") {
    evaluateArguments.frameId = input.frameId;
  } else {
    const activeStackItem = vscode.debug.activeStackItem;

    if (
      activeStackItem instanceof vscode.DebugStackFrame &&
      activeStackItem.session.id === session.id
    ) {
      evaluateArguments.frameId = activeStackItem.frameId;
    }
  }

  const evaluationResponse = (await session.customRequest(
    "evaluate",
    evaluateArguments,
  )) as Record<string, unknown>;

  return createTextResult({
    session: snapshotDebugSession(session),
    expression: input.expression,
    success: typeof evaluationResponse.result === "string",
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
}
