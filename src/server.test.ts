import assert from "node:assert/strict";
import test from "node:test";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { runToolWithArguments } from "./server.js";
import { getToolDefinitions, getOperationFamily, listOperationMappings } from "./tools.js";
import { REST_TOOL_FAMILY_NAMES } from "./tool-families.js";

const mockedApiClient = {
  async callRestByOperationId(operationId: string, parameters: Record<string, unknown>) {
    return {
      status: 200,
      url: `https://cloud.example.com/mock/${operationId}`,
      data: JSON.stringify({ ok: true, operationId, parameters }),
      headers: {}
    };
  }
};

// ─── operation registry ───────────────────────────────────────────────────────

test("all operations are classified into a tool family", () => {
  const mappings = listOperationMappings();
  assert.ok(mappings.length > 0, `expected operations, got ${mappings.length}`);
  for (const mapping of mappings) {
    assert.ok(getOperationFamily(mapping.operationId), `no family for ${mapping.operationId}`);
  }
});

// ─── nextcloud_rest_list_operations ──────────────────────────────────────────

test("nextcloud_rest_list_operations: returns bounded pages with correct structure", async () => {
  const text = await runToolWithArguments(
    "nextcloud_rest_list_operations",
    { family: "nextcloud_webdav_rest", limit: 3, offset: 0 },
    mockedApiClient,
    new Set()
  );
  const parsed = JSON.parse(text) as {
    total: number;
    count: number;
    offset: number;
    limit: number;
    operations: Array<{ family: string }>;
  };
  assert.equal(parsed.limit, 3);
  assert.equal(parsed.offset, 0);
  assert.ok(typeof parsed.total === "number" && parsed.total > 0);
  assert.ok(parsed.operations.every((op) => op.family === "nextcloud_webdav_rest"));
});

test("nextcloud_rest_list_operations: lists all operations when no family filter", async () => {
  const text = await runToolWithArguments("nextcloud_rest_list_operations", { limit: 100 }, mockedApiClient, new Set());
  const parsed = JSON.parse(text) as { total: number; count: number };
  assert.ok(parsed.total > 0);
});

test("nextcloud_rest_list_operations: offset beyond total returns empty operations", async () => {
  const text = await runToolWithArguments(
    "nextcloud_rest_list_operations",
    { family: "nextcloud_webdav_rest", limit: 10, offset: 10000 },
    mockedApiClient,
    new Set()
  );
  const parsed = JSON.parse(text) as { count: number; operations: unknown[] };
  assert.equal(parsed.count, 0);
  assert.equal(parsed.operations.length, 0);
});

// ─── REST family tools ────────────────────────────────────────────────────────

test("each REST family tool can execute at least one mapped operation", async () => {
  const definitions = getToolDefinitions().filter(
    (def) => def.name.endsWith("_rest") && def.name !== "nextcloud_rest_list_operations"
  );

  for (const definition of definitions) {
    const operation = listOperationMappings(definition.name as (typeof REST_TOOL_FAMILY_NAMES)[number])[0];
    assert.ok(operation, `no mapped operation for ${definition.name}`);
    const output = await runToolWithArguments(
      definition.name,
      { operationId: operation.operationId, parameters: {} },
      mockedApiClient,
      new Set()
    );
    const parsed = JSON.parse(output) as { operationId: string; family: string };
    assert.equal(parsed.operationId, operation.operationId);
    assert.equal(typeof parsed.family, "string");
  }
});

test("REST tool rejects operation from another family", async () => {
  const ocsOperation = listOperationMappings("nextcloud_ocs_users_rest")[0];
  await assert.rejects(
    () =>
      runToolWithArguments(
        "nextcloud_webdav_rest",
        { operationId: ocsOperation.operationId, parameters: {} },
        mockedApiClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

test("REST tool rejects missing operationId", async () => {
  await assert.rejects(
    () => runToolWithArguments("nextcloud_webdav_rest", { parameters: {} }, mockedApiClient, new Set()),
    (err) => err instanceof McpError
  );
});

test("REST tool rejects unknown operationId", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "nextcloud_webdav_rest",
        { operationId: "not.a.real.operation" },
        mockedApiClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

test("REST tool propagates McpError from API client", async () => {
  const operation = listOperationMappings("nextcloud_webdav_rest")[0];
  const failingClient = {
    async callRestByOperationId(): Promise<never> {
      throw new McpError(ErrorCode.InternalError, "Nextcloud unavailable");
    }
  };
  await assert.rejects(
    () =>
      runToolWithArguments(
        "nextcloud_webdav_rest",
        { operationId: operation.operationId, parameters: { path: "" } },
        failingClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

// ─── disabled tools ───────────────────────────────────────────────────────────

test("disabled tool returns McpError", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "nextcloud_rest_list_operations",
        {},
        mockedApiClient,
        new Set(["nextcloud_rest_list_operations"])
      ),
    (err) => err instanceof McpError
  );
});

test("disabled family tool returns McpError", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "nextcloud_webdav_rest",
        { operationId: listOperationMappings("nextcloud_webdav_rest")[0].operationId },
        mockedApiClient,
        new Set(["nextcloud_webdav_rest"])
      ),
    (err) => err instanceof McpError
  );
});

// ─── unknown tool ─────────────────────────────────────────────────────────────

test("unknown tool returns McpError", async () => {
  await assert.rejects(
    () => runToolWithArguments("not_a_real_tool", {}, mockedApiClient, new Set()),
    (err) => err instanceof McpError
  );
});

test("partially-matching tool name returns McpError", async () => {
  await assert.rejects(
    () => runToolWithArguments("nextcloud_webdav", {}, mockedApiClient, new Set()),
    (err) => err instanceof McpError
  );
});
