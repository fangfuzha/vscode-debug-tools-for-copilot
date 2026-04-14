import * as vscode from "vscode";
import { snapshotBreakpoint, type BreakpointSnapshot } from "./shared";

/**
 * Return a snapshot for every breakpoint currently registered in VS Code.
 */
export function listBreakpoints(): BreakpointSnapshot[] {
  return vscode.debug.breakpoints.map(snapshotBreakpoint);
}
