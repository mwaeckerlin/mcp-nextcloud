import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import { NextcloudApiClient } from "./nextcloud-api-client.js";
import { getOperationFamily, getToolDefinitions, listOperationMappings } from "./tools.js";
import { isToolDisabled, loadDisabledToolsFromEnv } from "./disabled-tools.js";
import { isHttpToolName, loadGatewayConfig, validateHttpToolArguments } from "./commands.js";
import { isReadonlyRpcToolName, runReadonlyRpcToolWithArguments } from "./readonly-rpc-tools.js";

type ApiClient = Pick<NextcloudApiClient, "callRestByOperationId">;

function respondJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function createApiClient(nextcloudUrl: string, username: string, token: string): ApiClient {
  return new NextcloudApiClient(nextcloudUrl, username, token);
}

export async function runToolWithArguments(
  toolName: string,
  toolArguments: unknown,
  apiClient: ApiClient,
  disabledTools: ReadonlySet<string>
): Promise<string> {
  if (isToolDisabled(toolName, disabledTools)) {
    throw new McpError(ErrorCode.InvalidParams, `Tool disabled by DISABLE_TOOLS: ${toolName}`);
  }

  if (isHttpToolName(toolName)) {
    const { family, limit, offset } = validateHttpToolArguments(toolName, toolArguments);
    const allMappings = listOperationMappings(family);
    const mappings = allMappings.slice(offset, offset + limit);
    return JSON.stringify(
      {
        total: allMappings.length,
        count: mappings.length,
        offset,
        limit,
        operations: mappings
      },
      null,
      2
    );
  }

  if (isReadonlyRpcToolName(toolName)) {
    const responseText = await runReadonlyRpcToolWithArguments(toolName, toolArguments, apiClient);
    const parsed = JSON.parse(responseText) as { operationId: string };
    return JSON.stringify(
      {
        family: getOperationFamily(parsed.operationId),
        ...parsed
      },
      null,
      2
    );
  }

  throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${toolName}`);
}

function createMcpServer(apiClient: ApiClient, disabledTools: ReadonlySet<string>): Server {
  const server = new Server(
    { name: "mcp-nextcloud", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getToolDefinitions(disabledTools) }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;

    try {
      const output = await runToolWithArguments(toolName, request.params.arguments, apiClient, disabledTools);
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
  apiClient: ApiClient,
  disabledTools: ReadonlySet<string>
): Promise<void> {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (requestUrl.pathname === "/healthz" && request.method === "GET") {
    respondJson(response, 200, { ok: true, status: "ready" });
    return;
  }

  if (requestUrl.pathname !== "/") {
    respondJson(response, 404, { error: "not_found", message: "Unknown endpoint" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer(apiClient, disabledTools);

  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } finally {
    await transport.close();
    await server.close();
  }
}

export async function main(): Promise<void> {
  const config = loadGatewayConfig();
  const disabledTools = loadDisabledToolsFromEnv();
  const apiClient = createApiClient(config.nextcloudUrl, config.nextcloudUsername, config.nextcloudToken);

  const httpServer = createServer((request, response) => {
    void handleMcpHttpRequest(request, response, apiClient, disabledTools).catch((error: unknown) => {
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
