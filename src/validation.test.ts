import assert from "node:assert/strict";
import test from "node:test";
import { listOperationMappings } from "./tools.js";
import { loadServerConfigFromEnv, validateOperationListArguments, validateRestCallArguments } from "./validation.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

// ─── loadServerConfigFromEnv ──────────────────────────────────────────────────

test("loadServerConfigFromEnv: accepts valid configuration", () => {
  const config = loadServerConfigFromEnv({
    NEXTCLOUD_TOKEN: "mytoken",
    NEXTCLOUD_URL: "https://cloud.example.com",
    NEXTCLOUD_USERNAME: "alice",
    MCP_NEXTCLOUD_HOST: "127.0.0.1",
    MCP_NEXTCLOUD_PORT: "4010",
    DISABLE_TOOLS: "nextcloud_webdav_rest,nextcloud_rest_misc"
  });
  assert.equal(config.nextcloudToken, "mytoken");
  assert.equal(config.nextcloudUrl, "https://cloud.example.com");
  assert.equal(config.nextcloudUsername, "alice");
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 4010);
  assert.ok(config.disabledTools.has("nextcloud_webdav_rest"));
  assert.ok(config.disabledTools.has("nextcloud_rest_misc"));
});

test("loadServerConfigFromEnv: defaults host to 0.0.0.0 and port to 4000", () => {
  const config = loadServerConfigFromEnv({
    NEXTCLOUD_TOKEN: "tok",
    NEXTCLOUD_URL: "https://cloud.example.com",
    NEXTCLOUD_USERNAME: "alice"
  });
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 4000);
  assert.equal(config.disabledTools.size, 0);
});

test("loadServerConfigFromEnv: throws when NEXTCLOUD_TOKEN is missing", () => {
  assert.throws(
    () => loadServerConfigFromEnv({ NEXTCLOUD_URL: "https://cloud.example.com", NEXTCLOUD_USERNAME: "alice" }),
    /NEXTCLOUD_TOKEN/
  );
});

test("loadServerConfigFromEnv: throws when NEXTCLOUD_TOKEN is blank", () => {
  assert.throws(
    () => loadServerConfigFromEnv({ NEXTCLOUD_TOKEN: "  ", NEXTCLOUD_URL: "https://cloud.example.com", NEXTCLOUD_USERNAME: "alice" }),
    /NEXTCLOUD_TOKEN/
  );
});

test("loadServerConfigFromEnv: throws when NEXTCLOUD_URL is missing", () => {
  assert.throws(
    () => loadServerConfigFromEnv({ NEXTCLOUD_TOKEN: "tok", NEXTCLOUD_USERNAME: "alice" }),
    /NEXTCLOUD_URL/
  );
});

test("loadServerConfigFromEnv: throws when NEXTCLOUD_USERNAME is missing", () => {
  assert.throws(
    () => loadServerConfigFromEnv({ NEXTCLOUD_TOKEN: "tok", NEXTCLOUD_URL: "https://cloud.example.com" }),
    /NEXTCLOUD_USERNAME/
  );
});

test("loadServerConfigFromEnv: throws when MCP_NEXTCLOUD_PORT is non-numeric", () => {
  assert.throws(
    () => loadServerConfigFromEnv({ NEXTCLOUD_TOKEN: "tok", NEXTCLOUD_URL: "https://cloud.example.com", NEXTCLOUD_USERNAME: "alice", MCP_NEXTCLOUD_PORT: "xyz" }),
    /MCP_NEXTCLOUD_PORT/
  );
});

test("loadServerConfigFromEnv: throws when MCP_NEXTCLOUD_PORT is 0", () => {
  assert.throws(
    () => loadServerConfigFromEnv({ NEXTCLOUD_TOKEN: "tok", NEXTCLOUD_URL: "https://cloud.example.com", NEXTCLOUD_USERNAME: "alice", MCP_NEXTCLOUD_PORT: "0" }),
    /MCP_NEXTCLOUD_PORT/
  );
});

test("loadServerConfigFromEnv: throws when MCP_NEXTCLOUD_PORT is 65536", () => {
  assert.throws(
    () => loadServerConfigFromEnv({ NEXTCLOUD_TOKEN: "tok", NEXTCLOUD_URL: "https://cloud.example.com", NEXTCLOUD_USERNAME: "alice", MCP_NEXTCLOUD_PORT: "65536" }),
    /MCP_NEXTCLOUD_PORT/
  );
});

// ─── validateOperationListArguments ──────────────────────────────────────────

test("validateOperationListArguments: defaults limit to 50 and offset to 0", () => {
  const parsed = validateOperationListArguments(undefined);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.family, undefined);
});

test("validateOperationListArguments: accepts valid family filter", () => {
  const parsed = validateOperationListArguments({ family: "nextcloud_webdav_rest" });
  assert.equal(parsed.family, "nextcloud_webdav_rest");
});

test("validateOperationListArguments: clamps limit above 100", () => {
  const parsed = validateOperationListArguments({ limit: 999 });
  assert.equal(parsed.limit, 100);
});

test("validateOperationListArguments: clamps limit below 1 to 1", () => {
  const parsed = validateOperationListArguments({ limit: 0 });
  assert.equal(parsed.limit, 1);
});

test("validateOperationListArguments: clamps offset above 10000", () => {
  const parsed = validateOperationListArguments({ offset: 99999 });
  assert.equal(parsed.offset, 10000);
});

test("validateOperationListArguments: rejects unknown family string", () => {
  assert.throws(
    () => validateOperationListArguments({ family: "nextcloud_nonexistent_rest" }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects non-number limit", () => {
  assert.throws(
    () => validateOperationListArguments({ limit: "ten" }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects negative offset", () => {
  assert.throws(
    () => validateOperationListArguments({ offset: -1 }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects non-integer offset", () => {
  assert.throws(
    () => validateOperationListArguments({ offset: 1.5 }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateOperationListArguments("not-an-object"),
    (err) => err instanceof McpError
  );
});

// ─── validateRestCallArguments ────────────────────────────────────────────────

test("validateRestCallArguments: accepts valid args in correct family", () => {
  const parsed = validateRestCallArguments("nextcloud_webdav_rest", {
    operationId: "webdav.directory.list",
    parameters: { path: "Documents/" }
  });
  assert.equal(parsed.operationId, "webdav.directory.list");
  assert.equal((parsed.parameters as { path: string }).path, "Documents/");
});

test("validateRestCallArguments: rejects missing operationId", () => {
  assert.throws(
    () => validateRestCallArguments("nextcloud_webdav_rest", { parameters: {} }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects empty operationId string", () => {
  assert.throws(
    () => validateRestCallArguments("nextcloud_webdav_rest", { operationId: "   " }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects unknown operationId", () => {
  assert.throws(
    () => validateRestCallArguments("nextcloud_webdav_rest", { operationId: "not.a.real.operation" }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects operationId from a different family", () => {
  const prOpId = listOperationMappings("nextcloud_ocs_users_rest")[0].operationId;
  assert.throws(
    () => validateRestCallArguments("nextcloud_webdav_rest", { operationId: prOpId, parameters: {} }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateRestCallArguments("nextcloud_webdav_rest", null),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: defaults limit when supported and missing", () => {
  const parsed = validateRestCallArguments("nextcloud_ocs_users_rest", {
    operationId: "ocs.users.list",
    parameters: {}
  });
  assert.equal((parsed.parameters as { limit?: number }).limit, 30);
});
