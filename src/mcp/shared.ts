import * as z from "zod/v4";

export interface McpServerLike {
  registerTool<TInput = unknown>(
    name: string,
    options: { description: string; inputSchema: z.ZodTypeAny },
    handler: (input: TInput, ctx: unknown) => Promise<unknown> | unknown,
  ): void;
  registerResource(
    name: string,
    uriOrTemplate: string,
    config: { description: string; mimeType: string },
    readCallback: (uri: URL) => Promise<unknown> | unknown,
  ): void;
}

/**
 * Wrap tool result payloads in MCP text response format.
 */
export function createTextResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
