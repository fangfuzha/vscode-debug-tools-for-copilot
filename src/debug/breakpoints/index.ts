import { BreakpointSnapshot } from "./shared";
import { listBreakpoints } from "./listBreakpoints";

/**
 * Interface for breakpoint management operations.
 */
export interface BreakpointManager {
  /**
   * List all breakpoints in the current workspace.
   */
  listBreakpoints(): BreakpointSnapshot[];

  /**
   * Add a source breakpoint at the specified location.
   */
  addSourceBreakpoint(
    filePath: string,
    line: number,
    column?: number,
  ): Promise<BreakpointSnapshot>;

  /**
   * Add a function breakpoint for the specified function.
   */
  addFunctionBreakpoint(functionName: string): Promise<BreakpointSnapshot>;

  /**
   * Remove a breakpoint by its key.
   */
  removeBreakpoint(key: string): Promise<void>;

  /**
   * Update an existing breakpoint.
   */
  updateBreakpoint(
    key: string,
    updates: {
      enabled?: boolean;
      condition?: string | null;
      hitCondition?: string | null;
      logMessage?: string | null;
    },
  ): Promise<BreakpointSnapshot>;

  /**
   * Set all breakpoints in a file to enabled or disabled.
   */
  setBreakpointsEnabledInFile(
    filePath: string,
    enabled: boolean,
  ): Promise<void>;

  /**
   * Clear all breakpoints.
   */
  clearBreakpoints(): Promise<void>;

  /**
   * Search for breakpoints matching the query.
   */
  searchBreakpoints(
    query: string,
    options?: {
      kind?: "source" | "function" | "unknown";
      enabled?: boolean;
      limit?: number;
    },
  ): BreakpointSnapshot[];

  /**
   * Get breakpoint statistics.
   */
  getBreakpointStatistics(): {
    total: number;
    enabled: number;
    disabled: number;
    source: number;
    function: number;
  };
}

/**
 * Default implementation of the BreakpointManager interface.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export class DefaultBreakpointManager implements BreakpointManager {
  listBreakpoints(): BreakpointSnapshot[] {
    return listBreakpoints();
  }

  async addSourceBreakpoint(
    _filePath: string,
    _line: number,
    _column?: number,
  ): Promise<BreakpointSnapshot> {
    // Implementation will be moved from addSourceBreakpoint.ts
    throw new Error("Not implemented yet");
  }

  async addFunctionBreakpoint(
    _functionName: string,
  ): Promise<BreakpointSnapshot> {
    // Implementation will be moved from addFunctionBreakpoint.ts
    throw new Error("Not implemented yet");
  }

  async removeBreakpoint(_key: string): Promise<void> {
    // Implementation will be moved from removeBreakpoint.ts
    throw new Error("Not implemented yet");
  }

  async updateBreakpoint(
    _key: string,
    _updates: {
      enabled?: boolean;
      condition?: string | null;
      hitCondition?: string | null;
      logMessage?: string | null;
    },
  ): Promise<BreakpointSnapshot> {
    // Implementation will be moved from updateBreakpoint.ts
    throw new Error("Not implemented yet");
  }

  async setBreakpointsEnabledInFile(
    _filePath: string,
    _enabled: boolean,
  ): Promise<void> {
    // Implementation will be moved from setBreakpointsEnabledInFile.ts
    throw new Error("Not implemented yet");
  }

  async clearBreakpoints(): Promise<void> {
    // Implementation will be moved from clearBreakpoints.ts
    throw new Error("Not implemented yet");
  }

  searchBreakpoints(
    _query: string,
    _options?: {
      kind?: "source" | "function" | "unknown";
      enabled?: boolean;
      limit?: number;
    },
  ): BreakpointSnapshot[] {
    // Implementation will be moved from searchBreakpoints.ts
    throw new Error("Not implemented yet");
  }

  getBreakpointStatistics(): {
    total: number;
    enabled: number;
    disabled: number;
    source: number;
    function: number;
  } {
    // Implementation will be moved from getBreakpointStatistics.ts
    throw new Error("Not implemented yet");
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
