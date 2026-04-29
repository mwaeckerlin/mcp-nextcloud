import assert from "node:assert/strict";
import test from "node:test";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { runToolWithArguments } from "./server.js";
import { NextcloudClient } from "./nextcloud-client.js";
import type { ProxyResponse } from "./nextcloud-client.js";

const testConfig = {
  url: "https://cloud.example.com",
  username: "alice",
  token: "test-app-password-token"
};

function makeClient(overrideFn?: (method: string, path: string) => Promise<ProxyResponse>): NextcloudClient {
  const client = new NextcloudClient(testConfig);
  if (overrideFn) {
    client.request = overrideFn;
  }
  return client;
}

const mockResponse: ProxyResponse = {
  status: 200,
  headers: { "content-type": "text/plain" },
  body: "hello"
};

// ---------------------------------------------------------- nextcloud_request

test("nextcloud_request: returns JSON-stringified ProxyResponse on success", async () => {
  const client = makeClient(async () => mockResponse);
  const output = await runToolWithArguments("nextcloud_request", { method: "GET", path: "/status.php" }, client);
  const parsed = JSON.parse(output) as ProxyResponse;
  assert.equal(parsed.status, 200);
  assert.equal(parsed.body, "hello");
});

test("nextcloud_request: passes method and path to client.request", async () => {
  let capturedMethod = "";
  let capturedPath = "";
  const client = makeClient(async (method, path) => {
    capturedMethod = method;
    capturedPath = path;
    return mockResponse;
  });

  await runToolWithArguments("nextcloud_request", { method: "GET", path: "/remote.php/dav/files/alice/" }, client);

  assert.equal(capturedMethod, "GET");
  assert.equal(capturedPath, "/remote.php/dav/files/alice/");
});

test("nextcloud_request: throws McpError when method is missing", async () => {
  const client = makeClient();
  await assert.rejects(
    () => runToolWithArguments("nextcloud_request", { path: "/status.php" }, client),
    (err) => err instanceof McpError && err.code === ErrorCode.InvalidParams
  );
});

test("nextcloud_request: throws McpError when path is missing", async () => {
  const client = makeClient();
  await assert.rejects(
    () => runToolWithArguments("nextcloud_request", { method: "GET" }, client),
    (err) => err instanceof McpError && err.code === ErrorCode.InvalidParams
  );
});

test("nextcloud_request: defaults response_encoding to text", async () => {
  let capturedEncoding: string | undefined;
  const client = makeClient(async (_method, _path, _body, _headers, encoding) => {
    capturedEncoding = encoding;
    return mockResponse;
  });

  await runToolWithArguments("nextcloud_request", { method: "GET", path: "/status.php" }, client);
  assert.equal(capturedEncoding, "text");
});

test("nextcloud_request: passes base64 encoding through", async () => {
  let capturedEncoding: string | undefined;
  const client = makeClient(async (_method, _path, _body, _headers, encoding) => {
    capturedEncoding = encoding;
    return mockResponse;
  });

  await runToolWithArguments(
    "nextcloud_request",
    { method: "GET", path: "/remote.php/dav/files/alice/img.png", response_encoding: "base64" },
    client
  );
  assert.equal(capturedEncoding, "base64");
});

// ---------------------------------------------------------- unknown tool

test("unknown tool throws McpError with InvalidParams", async () => {
  const client = makeClient();
  await assert.rejects(
    () => runToolWithArguments("not_a_tool", {}, client),
    (err) => err instanceof McpError && err.code === ErrorCode.InvalidParams
  );
});
