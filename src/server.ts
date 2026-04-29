import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { NextcloudClient } from "./nextcloud-client.js";
import { fileTools, handleFileTool } from "./tools/files.js";
import { shareTools, handleShareTool } from "./tools/sharing.js";
import { userTools, handleUserTool } from "./tools/users.js";
import { activityTools, handleActivityTool } from "./tools/activities.js";

export function createServer(client: NextcloudClient): Server {
  const server = new Server(
    { name: "mcp-nextcloud", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  const allTools = [...fileTools, ...shareTools, ...userTools, ...activityTools];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (fileTools.some((t) => t.name === name)) {
        return await handleFileTool(client, name, args ?? {});
      }
      if (shareTools.some((t) => t.name === name)) {
        return await handleShareTool(client, name, args ?? {});
      }
      if (userTools.some((t) => t.name === name)) {
        return await handleUserTool(client, name, args ?? {});
      }
      if (activityTools.some((t) => t.name === name)) {
        return await handleActivityTool(client, name, args ?? {});
      }

      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export function getConfig(): { url: string; token: string } {
  const url = process.env["NEXTCLOUD_URL"];
  const token = process.env["NEXTCLOUD_TOKEN"];

  if (!url) {
    throw new Error(
      "NEXTCLOUD_URL environment variable is required. " +
        "Set it to your Nextcloud instance URL (e.g. https://cloud.example.com)"
    );
  }
  if (!token) {
    throw new Error(
      "NEXTCLOUD_TOKEN environment variable is required. " +
        "Generate an app password in Nextcloud: Settings → Security → App passwords"
    );
  }

  // Validate URL format to prevent token leakage via SSRF
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("NEXTCLOUD_URL must use http or https protocol");
  }

  return { url, token };
}

export async function startServer(): Promise<void> {
  const config = getConfig();
  const client = new NextcloudClient(config);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("MCP Nextcloud server running on stdio\n");
}

// Validate Zod schema helper used by tools
export function validateArgs<T>(schema: z.ZodType<T>, args: unknown): T {
  return schema.parse(args);
}
