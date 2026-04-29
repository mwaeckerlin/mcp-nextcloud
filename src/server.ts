import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import { NextcloudClient } from "./nextcloud-client.js";
import { loadConfig } from "./config.js";

const TOOL_DEFINITIONS = [
  {
    name: "nextcloud_request",
    description: `Make an authenticated HTTP request to the Nextcloud server and return the response.
All Nextcloud credentials are kept server-side; the caller only provides the path and payload.

Common path prefixes (base URL is returned in the result):
  /remote.php/dav/files/<username>/             — WebDAV file operations
  /remote.php/dav/calendars/<username>/         — CalDAV calendar operations
  /remote.php/dav/addressbooks/users/<username>/ — CardDAV contacts
  /ocs/v2.php/                                  — OCS REST API (users, apps, shares …)

For OCS calls add query string: ?format=json and header OCS-APIREQUEST: true
WebDAV directory listings need method PROPFIND and header Depth: 1`,
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "PROPFIND", "MKCOL", "MOVE", "COPY", "REPORT", "HEAD", "OPTIONS"],
          description: "HTTP method"
        },
        path: {
          type: "string",
          description: "Request path relative to the Nextcloud base URL, e.g. \"/remote.php/dav/files/alice/Documents/\""
        },
        body: {
          type: "string",
          description: "Request body (text, XML, JSON, iCal, vCard …)"
        },
        headers: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Additional HTTP headers (key/value pairs)"
        },
        response_encoding: {
          type: "string",
          enum: ["text", "base64"],
          description: "Encoding for the response body. Use \"base64\" for binary files. Defaults to \"text\"."
        }
      },
      required: ["method", "path"]
    }
  }
] as const;

function respondJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

export async function runToolWithArguments(toolName: string, toolArguments: unknown, client: NextcloudClient): Promise<string> {
  if (toolName === "nextcloud_request") {
    const args = toolArguments as Record<string, unknown>;
    const method = args.method;
    const path = args.path;

    if (typeof method !== "string" || typeof path !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "nextcloud_request requires method (string) and path (string)");
    }

    const body = typeof args.body === "string" ? args.body : undefined;
    const headers =
      args.headers !== null && typeof args.headers === "object" && !Array.isArray(args.headers)
        ? (args.headers as Record<string, string>)
        : undefined;
    const responseEncoding = args.response_encoding === "base64" ? "base64" : "text";

    const result = await client.request(method, path, body, headers, responseEncoding);
    return JSON.stringify(result, null, 2);
  }

  throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${toolName}`);
}

function createMcpServer(client: NextcloudClient): Server {
  const server = new Server(
    { name: "mcp-nextcloud", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFINITIONS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    try {
      const output = await runToolWithArguments(toolName, request.params.arguments, client);
      return { content: [{ type: "text", text: output }] };
    } catch (error: unknown) {
      if (error instanceof McpError && error.code === ErrorCode.InvalidParams) {
        throw error;
      }

      const message =
        error instanceof McpError ? error.message : error instanceof Error ? error.message : String(error);

      return {
        isError: true,
        content: [{ type: "text", text: message }]
      };
    }
  });

  return server;
}

async function handleMcpHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  client: NextcloudClient,
  mcpAuthToken: string | undefined
): Promise<void> {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (requestUrl.pathname === "/healthz" && request.method === "GET") {
    respondJson(response, 200, { ok: true, status: "ready" });
    return;
  }

  if (mcpAuthToken !== undefined) {
    const authHeader = request.headers["authorization"];
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    const queryToken = requestUrl.searchParams.get("token") ?? undefined;
    const providedToken = bearerToken ?? queryToken;

    if (providedToken !== mcpAuthToken) {
      respondJson(response, 401, { error: "unauthorized", message: "Valid MCP_AUTH_TOKEN required" });
      return;
    }
  }

  if (requestUrl.pathname !== "/") {
    respondJson(response, 404, { error: "not_found", message: "Unknown endpoint" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer(client);

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } finally {
    await transport.close();
    await server.close();
  }
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const client = new NextcloudClient(config);

  if (config.mcpAuthToken) {
    console.error("MCP authentication enabled via MCP_AUTH_TOKEN");
  }

  const httpServer = createServer((request, response) => {
    void handleMcpHttpRequest(request, response, client, config.mcpAuthToken).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`HTTP request handling failed: ${message}`);

      if (!response.headersSent) {
        respondJson(response, 500, { error: "internal_error", message: "Internal server error" });
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(config.port, config.host, () => resolve());
  });

  console.error(`MCP Nextcloud listening on http://${config.host}:${config.port}`);
}

const entryPoint = process.argv[1];
const isDirectRun = typeof entryPoint === "string" && pathToFileURL(entryPoint).href === import.meta.url;

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to start server: ${message}`);
    process.exit(1);
  });
}
