import assert from "node:assert/strict";
import test from "node:test";
import { parseDisabledTools, loadDisabledToolsFromEnv, isToolDisabled } from "./disabled-tools.js";

// ─── parseDisabledTools ───────────────────────────────────────────────────────

test("parseDisabledTools: parses comma-separated list", () => {
  const set = parseDisabledTools("nextcloud_webdav_rest,nextcloud_ocs_rest");
  assert.ok(set.has("nextcloud_webdav_rest"));
  assert.ok(set.has("nextcloud_ocs_rest"));
  assert.equal(set.size, 2);
});

test("parseDisabledTools: trims whitespace around entries", () => {
  const set = parseDisabledTools("  nextcloud_webdav_rest , nextcloud_ocs_rest  ");
  assert.ok(set.has("nextcloud_webdav_rest"));
  assert.ok(set.has("nextcloud_ocs_rest"));
});

test("parseDisabledTools: handles whitespace-only string", () => {
  const set = parseDisabledTools("   ");
  assert.equal(set.size, 0);
});

test("parseDisabledTools: handles empty string", () => {
  const set = parseDisabledTools("");
  assert.equal(set.size, 0);
});

test("parseDisabledTools: handles newline-separated entries", () => {
  const set = parseDisabledTools("nextcloud_webdav_rest\nnextcloud_ocs_rest");
  assert.ok(set.has("nextcloud_webdav_rest"));
  assert.ok(set.has("nextcloud_ocs_rest"));
});

test("parseDisabledTools: ignores duplicate entries", () => {
  const set = parseDisabledTools("nextcloud_webdav_rest,nextcloud_webdav_rest");
  assert.equal(set.size, 1);
});

// ─── loadDisabledToolsFromEnv ─────────────────────────────────────────────────

test("loadDisabledToolsFromEnv: reads DISABLE_TOOLS env variable", () => {
  const set = loadDisabledToolsFromEnv({ DISABLE_TOOLS: "nextcloud_webdav_rest" });
  assert.ok(set.has("nextcloud_webdav_rest"));
});

test("loadDisabledToolsFromEnv: returns empty set when DISABLE_TOOLS not set", () => {
  const set = loadDisabledToolsFromEnv({});
  assert.equal(set.size, 0);
});

// ─── isToolDisabled ───────────────────────────────────────────────────────────

test("isToolDisabled: returns true when tool is in the set", () => {
  const set = new Set(["nextcloud_webdav_rest"]);
  assert.equal(isToolDisabled("nextcloud_webdav_rest", set), true);
});

test("isToolDisabled: returns false when tool is not in the set", () => {
  const set = new Set(["nextcloud_webdav_rest"]);
  assert.equal(isToolDisabled("nextcloud_ocs_rest", set), false);
});

test("isToolDisabled: returns false for empty set", () => {
  assert.equal(isToolDisabled("nextcloud_webdav_rest", new Set()), false);
});
