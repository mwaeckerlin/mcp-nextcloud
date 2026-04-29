import assert from "node:assert/strict";
import test from "node:test";
import { classifyOperationToFamily, getRestToolFamilies, REST_TOOL_FAMILY_NAMES } from "./tool-families.js";
import { loadNextcloudOperations } from "./nextcloud-operations.js";

// ─── REST_TOOL_FAMILY_NAMES ───────────────────────────────────────────────────

test("REST_TOOL_FAMILY_NAMES: contains all expected Nextcloud families", () => {
  const names = new Set(REST_TOOL_FAMILY_NAMES);
  assert.ok(names.has("nextcloud_webdav_rest"));
  assert.ok(names.has("nextcloud_caldav_rest"));
  assert.ok(names.has("nextcloud_carddav_rest"));
  assert.ok(names.has("nextcloud_ocs_users_rest"));
  assert.ok(names.has("nextcloud_ocs_groups_rest"));
  assert.ok(names.has("nextcloud_ocs_apps_rest"));
  assert.ok(names.has("nextcloud_ocs_shares_rest"));
  assert.ok(names.has("nextcloud_rest_misc"));
});

// ─── classifyOperationToFamily ────────────────────────────────────────────────

test("classifyOperationToFamily: webdav operations go to nextcloud_webdav_rest", () => {
  const ops = loadNextcloudOperations().filter((op) => op.tags.includes("webdav"));
  assert.ok(ops.length > 0, "expected webdav operations");
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.equal(family, "nextcloud_webdav_rest", `expected nextcloud_webdav_rest for ${op.operationId}`);
  }
});

test("classifyOperationToFamily: caldav operations go to nextcloud_caldav_rest", () => {
  const ops = loadNextcloudOperations().filter((op) => op.tags.includes("caldav"));
  assert.ok(ops.length > 0, "expected caldav operations");
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.equal(family, "nextcloud_caldav_rest", `expected nextcloud_caldav_rest for ${op.operationId}`);
  }
});

test("classifyOperationToFamily: carddav operations go to nextcloud_carddav_rest", () => {
  const ops = loadNextcloudOperations().filter((op) => op.tags.includes("carddav"));
  assert.ok(ops.length > 0, "expected carddav operations");
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.equal(family, "nextcloud_carddav_rest", `expected nextcloud_carddav_rest for ${op.operationId}`);
  }
});

test("classifyOperationToFamily: ocs-users operations go to nextcloud_ocs_users_rest", () => {
  const ops = loadNextcloudOperations().filter((op) => op.tags.includes("ocs-users"));
  assert.ok(ops.length > 0, "expected ocs-users operations");
  for (const op of ops) {
    assert.equal(classifyOperationToFamily(op), "nextcloud_ocs_users_rest");
  }
});

test("classifyOperationToFamily: ocs-groups operations go to nextcloud_ocs_groups_rest", () => {
  const ops = loadNextcloudOperations().filter((op) => op.tags.includes("ocs-groups"));
  assert.ok(ops.length > 0, "expected ocs-groups operations");
  for (const op of ops) {
    assert.equal(classifyOperationToFamily(op), "nextcloud_ocs_groups_rest");
  }
});

test("classifyOperationToFamily: ocs-apps operations go to nextcloud_ocs_apps_rest", () => {
  const ops = loadNextcloudOperations().filter((op) => op.tags.includes("ocs-apps"));
  assert.ok(ops.length > 0, "expected ocs-apps operations");
  for (const op of ops) {
    assert.equal(classifyOperationToFamily(op), "nextcloud_ocs_apps_rest");
  }
});

test("classifyOperationToFamily: ocs-shares operations go to nextcloud_ocs_shares_rest", () => {
  const ops = loadNextcloudOperations().filter((op) => op.tags.includes("ocs-shares"));
  assert.ok(ops.length > 0, "expected ocs-shares operations");
  for (const op of ops) {
    assert.equal(classifyOperationToFamily(op), "nextcloud_ocs_shares_rest");
  }
});

test("classifyOperationToFamily: all operations are classified into a valid family", () => {
  const ops = loadNextcloudOperations();
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.ok(REST_TOOL_FAMILY_NAMES.includes(family), `invalid family '${family}' for ${op.operationId}`);
  }
});

// ─── getRestToolFamilies ──────────────────────────────────────────────────────

test("getRestToolFamilies: returns an entry for each family name", () => {
  const families = getRestToolFamilies();
  const familyNames = new Set(families.map((f) => f.name));
  for (const name of REST_TOOL_FAMILY_NAMES) {
    assert.ok(familyNames.has(name), `missing family ${name}`);
  }
});

test("getRestToolFamilies: each family has a non-empty description", () => {
  const families = getRestToolFamilies();
  for (const family of families) {
    assert.ok(typeof family.description === "string" && family.description.length > 0, `empty description for ${family.name}`);
  }
});
