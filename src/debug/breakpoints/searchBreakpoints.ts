import * as vscode from "vscode";
import * as z from "zod/v4";
import { createTextResult, McpServerLike } from "../../mcp/shared";
import {
  createBreakpointSearchText,
  listBreakpoints,
  BreakpointSearchInput,
} from "./shared";

/**
 * Register the search_breakpoints MCP tool.
 */
export function registerSearchBreakpointsTool(server: McpServerLike): void {
  server.registerTool(
    "search_breakpoints",
    {
      description: vscode.l10n.t(
        "Search breakpoints by query text, kind, or enabled state and return matching breakpoint snapshots.",
      ),
      inputSchema: z.object({
        query: z.string().min(1),
        kind: z.enum(["source", "function", "unknown"]).optional(),
        enabled: z.boolean().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }),
    },
    async (input: BreakpointSearchInput) => {
      const matches = searchBreakpoints(input);

      return createTextResult({
        count: matches.length,
        limit: input.limit ?? null,
        query: input.query,
        results: matches,
      });
    },
  );
}

/**
 * Search breakpoints using query and filter criteria.
 */
function searchBreakpoints(input: BreakpointSearchInput) {
  const normalizedQuery = input.query.trim().toLowerCase();
  const filteredSnapshots = listBreakpoints().filter((snapshot) => {
    if (input.kind && snapshot.kind !== input.kind) {
      return false;
    }

    if (
      typeof input.enabled === "boolean" &&
      snapshot.enabled !== input.enabled
    ) {
      return false;
    }

    return createBreakpointSearchText(snapshot).includes(normalizedQuery);
  });

  const limit = input.limit ?? filteredSnapshots.length;

  return filteredSnapshots.slice(0, limit);
}
