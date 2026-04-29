import assert from "node:assert/strict";
import test from "node:test";
import { isHttpToolName, loadGatewayConfig, validateHttpToolArguments, isRestToolFamilyName } from "./commands.js";

// ─── isHttpToolName ───────────────────────────────────────────────────────────

test("isHttpToolName: true for nextcloud_rest_list_operations", () => {
  assert.equal(isHttpToolName("nextcloud_rest_list_operations"), true);
});

test("isHttpToolName: false for REST family tool names", () => {
  assert.equal(isHttpToolName("nextcloud_webdav_rest"), false);
  assert.equal(isHttpToolName("nextcloud_ocs_users_rest"), false);
});

test("isHttpToolName: false for completely unknown names", () => {
  assert.equal(isHttpToolName("not_a_tool"), false);
  assert.equal(isHttpToolName(""), false);
});

// ─── loadGatewayConfig ────────────────────────────────────────────────────────

test("loadGatewayConfig: reads port correctly", () => {
  const config = loadGatewayConfig({
    NEXTCLOUD_TOKEN: "tok",
    NEXTCLOUD_URL: "https://cloud.example.com",
    NEXTCLOUD_USERNAME: "alice",
    MCP_NEXTCLOUD_PORT: "4020"
  });
  assert.equal(config.port, 4020);
  assert.equal(config.nextcloudToken, "tok");
});

test("loadGatewayConfig: defaults port to 4000 and host to 0.0.0.0", () => {
  const config = loadGatewayConfig({
    NEXTCLOUD_TOKEN: "tok",
    NEXTCLOUD_URL: "https://cloud.example.com",
    NEXTCLOUD_USERNAME: "alice"
  });
  assert.equal(config.port, 4000);
  assert.equal(config.host, "0.0.0.0");
});

test("loadGatewayConfig: throws when NEXTCLOUD_URL is missing", () => {
  assert.throws(() => loadGatewayConfig({ NEXTCLOUD_TOKEN: "tok", NEXTCLOUD_USERNAME: "alice" }), /NEXTCLOUD_URL/);
});

test("loadGatewayConfig: throws when MCP_NEXTCLOUD_PORT is non-numeric", () => {
  assert.throws(
    () => loadGatewayConfig({ NEXTCLOUD_TOKEN: "tok", NEXTCLOUD_URL: "https://cloud.example.com", NEXTCLOUD_USERNAME: "alice", MCP_NEXTCLOUD_PORT: "abc" }),
    /MCP_NEXTCLOUD_PORT/
  );
});

test("loadGatewayConfig: throws when MCP_NEXTCLOUD_PORT is out of range", () => {
  assert.throws(
    () => loadGatewayConfig({ NEXTCLOUD_TOKEN: "tok", NEXTCLOUD_URL: "https://cloud.example.com", NEXTCLOUD_USERNAME: "alice", MCP_NEXTCLOUD_PORT: "0" }),
    /MCP_NEXTCLOUD_PORT/
  );
  assert.throws(
    () => loadGatewayConfig({ NEXTCLOUD_TOKEN: "tok", NEXTCLOUD_URL: "https://cloud.example.com", NEXTCLOUD_USERNAME: "alice", MCP_NEXTCLOUD_PORT: "65536" }),
    /MCP_NEXTCLOUD_PORT/
  );
});

// ─── validateHttpToolArguments ────────────────────────────────────────────────

test("validateHttpToolArguments: clamps limit above 100", () => {
  const parsed = validateHttpToolArguments("nextcloud_rest_list_operations", { limit: 500, offset: 0 });
  assert.equal(parsed.limit, 100);
});

test("validateHttpToolArguments: clamps offset above 10000", () => {
  const parsed = validateHttpToolArguments("nextcloud_rest_list_operations", { limit: 10, offset: 20000 });
  assert.equal(parsed.offset, 10000);
});

test("validateHttpToolArguments: accepts undefined arguments and applies defaults", () => {
  const parsed = validateHttpToolArguments("nextcloud_rest_list_operations", undefined);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 0);
});

test("validateHttpToolArguments: rejects non-number limit", () => {
  assert.throws(() => validateHttpToolArguments("nextcloud_rest_list_operations", { limit: "ten" }));
});

test("validateHttpToolArguments: rejects negative offset", () => {
  assert.throws(() => validateHttpToolArguments("nextcloud_rest_list_operations", { offset: -1 }));
});

// ─── isRestToolFamilyName ─────────────────────────────────────────────────────

test("isRestToolFamilyName: true for all defined family names", () => {
  assert.equal(isRestToolFamilyName("nextcloud_webdav_rest"), true);
  assert.equal(isRestToolFamilyName("nextcloud_caldav_rest"), true);
  assert.equal(isRestToolFamilyName("nextcloud_carddav_rest"), true);
  assert.equal(isRestToolFamilyName("nextcloud_ocs_users_rest"), true);
  assert.equal(isRestToolFamilyName("nextcloud_ocs_groups_rest"), true);
  assert.equal(isRestToolFamilyName("nextcloud_ocs_apps_rest"), true);
  assert.equal(isRestToolFamilyName("nextcloud_ocs_shares_rest"), true);
  assert.equal(isRestToolFamilyName("nextcloud_rest_misc"), true);
});

test("isRestToolFamilyName: false for non-family names", () => {
  assert.equal(isRestToolFamilyName("nextcloud_rest_list_operations"), false);
  assert.equal(isRestToolFamilyName(""), false);
  assert.equal(isRestToolFamilyName("gitea_issues_rest"), false);
});
