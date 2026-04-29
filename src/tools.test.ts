import assert from "node:assert/strict";
import test from "node:test";
import { getToolDefinitions, getOperationFamily, listOperationMappings } from "./tools.js";
import { REST_TOOL_FAMILY_NAMES } from "./tool-families.js";

// ─── getToolDefinitions ───────────────────────────────────────────────────────

test("getToolDefinitions: includes nextcloud_rest_list_operations", () => {
  const defs = getToolDefinitions();
  assert.ok(defs.some((d) => d.name === "nextcloud_rest_list_operations"), "expected nextcloud_rest_list_operations");
});

test("getToolDefinitions: includes all REST family tools", () => {
  const defs = getToolDefinitions();
  const names = new Set(defs.map((d) => d.name));
  for (const family of REST_TOOL_FAMILY_NAMES) {
    assert.ok(names.has(family), `missing family tool ${family}`);
  }
});

test("getToolDefinitions: respects disabled tools filter", () => {
  const defs = getToolDefinitions(new Set(["nextcloud_webdav_rest"]));
  assert.ok(!defs.some((d) => d.name === "nextcloud_webdav_rest"), "nextcloud_webdav_rest should be excluded");
  assert.ok(defs.some((d) => d.name === "nextcloud_ocs_users_rest"), "nextcloud_ocs_users_rest should still be included");
});

test("getToolDefinitions: each tool has name, description, and inputSchema", () => {
  const defs = getToolDefinitions();
  for (const def of defs) {
    assert.ok(typeof def.name === "string" && def.name.length > 0);
    assert.ok(typeof def.description === "string" && def.description.length > 0);
    assert.ok(def.inputSchema && typeof def.inputSchema === "object");
  }
});

// ─── getOperationFamily ───────────────────────────────────────────────────────

test("getOperationFamily: returns family for known webdav operation", () => {
  const family = getOperationFamily("webdav.directory.list");
  assert.equal(family, "nextcloud_webdav_rest");
});

test("getOperationFamily: returns family for known ocs operation", () => {
  const family = getOperationFamily("ocs.users.list");
  assert.equal(family, "nextcloud_ocs_users_rest");
});

test("getOperationFamily: returns family for known caldav operation", () => {
  const family = getOperationFamily("caldav.calendars.list");
  assert.equal(family, "nextcloud_caldav_rest");
});

test("getOperationFamily: returns undefined for unknown operation", () => {
  const family = getOperationFamily("not.a.real.operation");
  assert.equal(family, undefined);
});

// ─── listOperationMappings ────────────────────────────────────────────────────

test("listOperationMappings: returns all operations when no family filter", () => {
  const mappings = listOperationMappings();
  assert.ok(mappings.length > 0, "expected operations");
});

test("listOperationMappings: returns sorted operations", () => {
  const mappings = listOperationMappings();
  for (let i = 1; i < mappings.length; i++) {
    assert.ok(
      mappings[i - 1].operationId.localeCompare(mappings[i].operationId) <= 0,
      `operations not sorted: ${mappings[i - 1].operationId} > ${mappings[i].operationId}`
    );
  }
});

test("listOperationMappings: family filter returns only matching family", () => {
  const mappings = listOperationMappings("nextcloud_webdav_rest");
  assert.ok(mappings.length > 0, "expected webdav operations");
  for (const m of mappings) {
    assert.equal(m.family, "nextcloud_webdav_rest");
  }
});

test("listOperationMappings: each mapping has required fields", () => {
  const mappings = listOperationMappings();
  for (const m of mappings) {
    assert.ok(typeof m.operationId === "string");
    assert.ok(typeof m.family === "string");
    assert.ok(typeof m.method === "string");
    assert.ok(typeof m.path === "string");
    assert.ok(Array.isArray(m.parameterNames));
  }
});

test("listOperationMappings: all operations are classified into a tool family", () => {
  const mappings = listOperationMappings();
  assert.ok(mappings.length > 0, `expected operations, got ${mappings.length}`);
  for (const mapping of mappings) {
    assert.ok(getOperationFamily(mapping.operationId), `no family for ${mapping.operationId}`);
  }
});
