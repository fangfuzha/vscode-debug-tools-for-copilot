import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import { listBreakpoints } from "./shared";

/**
 * Register the get_breakpoint_statistics MCP tool.
 */
export function registerBreakpointStatisticsTool(server: McpServerLike): void {
  server.registerTool(
    "get_breakpoint_statistics",
    {
      description: vscode.l10n.t(
        "Summarize the current breakpoint set with totals and per-kind counts.",
      ),
      inputSchema: z.object({}),
    },
    async () => createTextResult(createBreakpointStatistics()),
  );
}

/**
 * Build breakpoint counts for the current in-memory breakpoint set.
 */
function createBreakpointStatistics() {
  const breakpoints = listBreakpoints();
  const createBucket = () => ({ total: 0, enabled: 0, disabled: 0 });
  const byKind = {
    source: createBucket(),
    function: createBucket(),
    unknown: createBucket(),
  };

  for (const breakpoint of breakpoints) {
    const bucket = byKind[breakpoint.kind];

    bucket.total += 1;

    if (breakpoint.enabled) {
      bucket.enabled += 1;
    } else {
      bucket.disabled += 1;
    }
  }

  const enabled = breakpoints.filter((breakpoint) => breakpoint.enabled).length;

  return {
    total: breakpoints.length,
    enabled,
    disabled: breakpoints.length - enabled,
    byKind,
  };
}
