import * as vscode from "vscode";
import { createTextResult } from "../../mcp/shared";
import { recordRecentDebugConfiguration } from "../workbench/recentDebugConfigurations";

export interface DebugSessionSnapshot {
  id: string;
  name: string;
  type: string;
  workspaceFolderPath?: string;
  parentSessionId?: string;
  active: boolean;
  lastStoppedThreadId?: number;
}

interface TrackedDebugSessionState {
  session: vscode.DebugSession;
  lastStoppedThreadId?: number;
}

export interface DebugSessionToolInput {
  sessionId?: string;
}

const trackedDebugSessions = new Map<string, TrackedDebugSessionState>();

/**
 * Remember a debug session so it can be targeted by sessionId later.
 *
 * @param session Debug session to track.
 * @returns The tracked session state.
 */
function trackDebugSession(
  session: vscode.DebugSession,
): TrackedDebugSessionState {
  const existingState = trackedDebugSessions.get(session.id);

  if (existingState) {
    existingState.session = session;
    return existingState;
  }

  const trackedState: TrackedDebugSessionState = { session };

  trackedDebugSessions.set(session.id, trackedState);

  return trackedState;
}

/**
 * Remove a debug session from the local registry.
 *
 * @param sessionId Debug session identifier.
 */
function untrackDebugSession(sessionId: string): void {
  trackedDebugSessions.delete(sessionId);
}

/**
 * Update the last known stopped thread id for a tracked session.
 *
 * @param session Debug session to update.
 * @param threadId Debug protocol thread id.
 */
function rememberStoppedThread(
  session: vscode.DebugSession,
  threadId: number,
): void {
  const trackedState = trackDebugSession(session);

  trackedState.lastStoppedThreadId = threadId;
}

/**
 * Register listeners that keep the local debug-session registry up to date.
 *
 * @param context Extension context used to dispose listeners.
 * @returns Disposable handle for the registered listeners.
 */
export function registerDebugSessionTracking(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  const activeSession = vscode.debug.activeDebugSession;

  if (activeSession) {
    trackDebugSession(activeSession);
    recordRecentDebugConfiguration(activeSession);
  }

  const onDidStartDebugSessionDisposable = vscode.debug.onDidStartDebugSession(
    (session) => {
      trackDebugSession(session);
      recordRecentDebugConfiguration(session);
    },
  );
  const onDidChangeActiveDebugSessionDisposable =
    vscode.debug.onDidChangeActiveDebugSession((session) => {
      if (session) {
        trackDebugSession(session);
        recordRecentDebugConfiguration(session);
      }
    });
  const onDidTerminateDebugSessionDisposable =
    vscode.debug.onDidTerminateDebugSession((session) => {
      untrackDebugSession(session.id);
    });
  const trackerFactoryDisposable =
    vscode.debug.registerDebugAdapterTrackerFactory("*", {
      createDebugAdapterTracker(session: vscode.DebugSession) {
        trackDebugSession(session);

        return {
          onDidSendMessage(message: unknown) {
            if (
              typeof message !== "object" ||
              message === null ||
              !("event" in message)
            ) {
              return;
            }

            if ((message as { event?: unknown }).event !== "stopped") {
              return;
            }

            const body = (message as { body?: { threadId?: unknown } }).body;

            if (typeof body?.threadId === "number") {
              rememberStoppedThread(session, body.threadId);
            }
          },
        };
      },
    });

  const disposable = vscode.Disposable.from(
    onDidStartDebugSessionDisposable,
    onDidChangeActiveDebugSessionDisposable,
    onDidTerminateDebugSessionDisposable,
    trackerFactoryDisposable,
  );

  context.subscriptions.push(disposable);

  return disposable;
}

/**
 * Capture a stable snapshot of a debug session.
 *
 * @param session Debug session to snapshot.
 * @returns Serializable debug session snapshot.
 */
export function snapshotDebugSession(
  session: vscode.DebugSession,
): DebugSessionSnapshot {
  const trackedState = trackedDebugSessions.get(session.id);
  const activeSession = vscode.debug.activeDebugSession;

  return {
    id: session.id,
    name: session.name,
    type: session.type,
    workspaceFolderPath: session.workspaceFolder?.uri.fsPath,
    parentSessionId: session.parentSession?.id,
    active: activeSession?.id === session.id,
    lastStoppedThreadId: trackedState?.lastStoppedThreadId,
  };
}

/**
 * Return the currently known debug sessions.
 *
 * @returns Debug session snapshots.
 */
export function listDebugSessions(): DebugSessionSnapshot[] {
  const sessions = new Map<string, vscode.DebugSession>();

  for (const trackedState of trackedDebugSessions.values()) {
    sessions.set(trackedState.session.id, trackedState.session);
  }

  const activeSession = vscode.debug.activeDebugSession;

  if (activeSession) {
    sessions.set(activeSession.id, activeSession);
  }

  return [...sessions.values()].map(snapshotDebugSession);
}

/**
 * Resolve a debug session by id or fall back to the active debug session.
 *
 * @param sessionId Optional debug session id.
 * @returns The resolved debug session.
 */
export function resolveDebugSession(sessionId?: string): vscode.DebugSession {
  if (sessionId) {
    const trackedState = trackedDebugSessions.get(sessionId);

    if (trackedState) {
      return trackedState.session;
    }

    const activeSession = vscode.debug.activeDebugSession;

    if (activeSession?.id === sessionId) {
      trackDebugSession(activeSession);

      return activeSession;
    }

    throw new Error(
      vscode.l10n.t("No debug session was found for sessionId {0}.", sessionId),
    );
  }

  const activeSession = vscode.debug.activeDebugSession;

  if (!activeSession) {
    throw new Error(vscode.l10n.t("No active debug session is available."));
  }

  trackDebugSession(activeSession);

  return activeSession;
}

/**
 * Resolve a paused debug thread id for the selected session.
 *
 * @param session Debug session to inspect.
 * @returns The resolved thread id.
 */
export async function resolveDebugThreadId(
  session: vscode.DebugSession,
): Promise<number> {
  const trackedState = trackedDebugSessions.get(session.id);

  if (typeof trackedState?.lastStoppedThreadId === "number") {
    return trackedState.lastStoppedThreadId;
  }

  if (vscode.debug.activeDebugSession?.id === session.id) {
    const activeStackItem = vscode.debug.activeStackItem;

    if (activeStackItem && activeStackItem.session.id === session.id) {
      return activeStackItem.threadId;
    }
  }

  const threadResponse = await session.customRequest("threads");
  const threads = Array.isArray(threadResponse?.threads)
    ? threadResponse.threads
    : [];

  if (threads.length === 1 && typeof threads[0]?.id === "number") {
    return threads[0].id;
  }

  throw new Error(
    vscode.l10n.t(
      "Unable to determine a thread for the selected debug session. Pause the session first or target a session with a known stopped thread.",
    ),
  );
}

/**
 * Try to resolve a paused thread id, but allow the caller to fall back when no thread is known yet.
 *
 * @param session Debug session to inspect.
 * @returns A known thread id or undefined.
 */
async function tryResolveDebugThreadId(
  session: vscode.DebugSession,
): Promise<number | undefined> {
  try {
    return await resolveDebugThreadId(session);
  } catch {
    return undefined;
  }
}

/**
 * Send a DAP request to a selected debug session.
 *
 * @param actionLabel Debug action being requested.
 * @param request DAP request name.
 * @param sessionId Optional debug session id.
 * @param args Optional request arguments.
 * @returns A text result describing the requested action.
 */
export async function requestDebugSessionAction(
  actionLabel: string,
  request: string,
  sessionId?: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const session = resolveDebugSession(sessionId);

  await session.customRequest(request, args);

  return createTextResult({
    action: actionLabel,
    request,
    session: snapshotDebugSession(session),
    status: "requested",
  });
}

/**
 * Send a DAP request that targets a specific debug thread.
 *
 * @param actionLabel Debug action being requested.
 * @param request DAP request name.
 * @param sessionId Optional debug session id.
 * @returns A text result describing the requested action.
 */
export async function requestDebugSessionThreadAction(
  actionLabel: string,
  request: "next" | "stepIn" | "stepOut",
  sessionId?: string,
): Promise<unknown> {
  const session = resolveDebugSession(sessionId);
  const threadId = await resolveDebugThreadId(session);

  await session.customRequest(request, { threadId });

  return createTextResult({
    action: actionLabel,
    request,
    session: snapshotDebugSession(session),
    threadId,
    status: "requested",
  });
}

/**
 * Send a pause request to the selected debug session.
 *
 * @param actionLabel Debug action being requested.
 * @param sessionId Optional debug session id.
 * @returns A text result describing the requested action.
 */
export async function pauseDebugSessionById(
  actionLabel: string,
  sessionId?: string,
): Promise<unknown> {
  const session = resolveDebugSession(sessionId);
  const threadId = await tryResolveDebugThreadId(session);
  const args = threadId ? { threadId } : undefined;

  await session.customRequest("pause", args);

  return createTextResult({
    action: actionLabel,
    request: "pause",
    session: snapshotDebugSession(session),
    threadId,
    status: "requested",
  });
}

/**
 * Send a continue request to the selected debug session.
 *
 * @param actionLabel Debug action being requested.
 * @param sessionId Optional debug session id.
 * @returns A text result describing the requested action.
 */
export async function continueDebugSessionById(
  actionLabel: string,
  sessionId?: string,
): Promise<unknown> {
  const session = resolveDebugSession(sessionId);
  const threadId = await tryResolveDebugThreadId(session);
  const args = threadId ? { threadId } : undefined;

  await session.customRequest("continue", args);

  return createTextResult({
    action: actionLabel,
    request: "continue",
    session: snapshotDebugSession(session),
    threadId,
    status: "requested",
  });
}

/**
 * Send a restart request to the selected debug session.
 *
 * @param actionLabel Debug action being requested.
 * @param sessionId Optional debug session id.
 * @returns A text result describing the requested action.
 */
export async function restartDebugSessionById(
  actionLabel: string,
  sessionId?: string,
): Promise<unknown> {
  const session = resolveDebugSession(sessionId);
  const sessionSnapshot = snapshotDebugSession(session);
  const workspaceFolder = session.workspaceFolder;

  await vscode.debug.stopDebugging(session);

  const restarted = await vscode.debug.startDebugging(
    workspaceFolder,
    session.configuration,
  );

  if (!restarted) {
    throw new Error(
      vscode.l10n.t("Failed to restart the selected debug session."),
    );
  }

  const restartedSession = vscode.debug.activeDebugSession;

  return createTextResult({
    action: actionLabel,
    request: "restart",
    restartedFrom: sessionSnapshot,
    restartedTo:
      restartedSession && restartedSession.id !== session.id
        ? snapshotDebugSession(restartedSession)
        : undefined,
    status: "requested",
  });
}

/**
 * Stop the selected debug session.
 *
 * @param actionLabel Debug action being requested.
 * @param sessionId Optional debug session id.
 * @returns A text result describing the requested action.
 */
export async function stopDebugSessionById(
  actionLabel: string,
  sessionId?: string,
): Promise<unknown> {
  const session = resolveDebugSession(sessionId);

  await vscode.debug.stopDebugging(session);

  return createTextResult({
    action: actionLabel,
    request: "stopDebugging",
    session: snapshotDebugSession(session),
    status: "requested",
  });
}
