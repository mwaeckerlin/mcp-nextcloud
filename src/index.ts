#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getConfig } from './config.js';
import { createClient } from './nextcloud-client.js';
import { allTools } from './tools/index.js';

type ZodRawShape = Record<string, z.ZodTypeAny>;

async function main() {
  const config = getConfig();
  const client = createClient(config);

  const server = new McpServer({
    name: 'mcp-nextcloud',
    version: '1.0.0',
  });

  for (const tool of allTools) {
    const schema = tool.inputSchema as ZodRawShape;
    const hasSchema = Object.keys(schema).length > 0;

    if (hasSchema) {
      server.tool(
        tool.name,
        tool.description,
        schema,
        async (args) => {
          try {
            const result = await tool.handler(client, args as never);
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: 'text' as const, text: `Error: ${message}` }],
              isError: true,
            };
          }
        }
      );
    } else {
      server.tool(
        tool.name,
        tool.description,
        async () => {
          try {
            const result = await tool.handler(client, {} as never);
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              content: [{ type: 'text' as const, text: `Error: ${message}` }],
              isError: true,
            };
          }
        }
      );
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
