import assert from "node:assert/strict";
import test from "node:test";
import { loadNextcloudOperations } from "./nextcloud-operations.js";

test("loadNextcloudOperations: returns a non-empty array of operations", () => {
  const ops = loadNextcloudOperations();
  assert.ok(ops.length > 0, `expected operations, got ${ops.length}`);
});

test("loadNextcloudOperations: all operations have required fields", () => {
  const ops = loadNextcloudOperations();
  const validMethods = new Set(["GET", "POST", "PUT", "DELETE", "PROPFIND", "MKCOL", "MOVE", "COPY", "REPORT", "HEAD"]);
  for (const op of ops) {
    assert.ok(typeof op.operationId === "string" && op.operationId.length > 0, `missing operationId: ${JSON.stringify(op)}`);
    assert.ok(validMethods.has(op.method), `invalid method ${op.method} for ${op.operationId}`);
    assert.ok(typeof op.path === "string" && op.path.startsWith("/"), `invalid path for ${op.operationId}`);
    assert.ok(Array.isArray(op.tags) && op.tags.length > 0, `tags not array or empty for ${op.operationId}`);
    assert.ok(Array.isArray(op.parameterNames), `parameterNames not array for ${op.operationId}`);
  }
});

test("loadNextcloudOperations: operation IDs are unique", () => {
  const ops = loadNextcloudOperations();
  const ids = new Set<string>();
  for (const op of ops) {
    assert.ok(!ids.has(op.operationId), `duplicate operationId: ${op.operationId}`);
    ids.add(op.operationId);
  }
});

test("loadNextcloudOperations: operations are sorted by operationId", () => {
  const ops = loadNextcloudOperations();
  for (let i = 1; i < ops.length; i++) {
    assert.ok(
      ops[i - 1].operationId.localeCompare(ops[i].operationId) <= 0,
      `operations not sorted: ${ops[i - 1].operationId} > ${ops[i].operationId}`
    );
  }
});

test("loadNextcloudOperations: contains operations from all expected tags", () => {
  const ops = loadNextcloudOperations();
  const tagSet = new Set(ops.flatMap((op) => op.tags));
  assert.ok(tagSet.has("webdav"), "expected tag 'webdav'");
  assert.ok(tagSet.has("caldav"), "expected tag 'caldav'");
  assert.ok(tagSet.has("carddav"), "expected tag 'carddav'");
  assert.ok(tagSet.has("ocs-users"), "expected tag 'ocs-users'");
  assert.ok(tagSet.has("ocs-groups"), "expected tag 'ocs-groups'");
  assert.ok(tagSet.has("ocs-apps"), "expected tag 'ocs-apps'");
  assert.ok(tagSet.has("ocs-shares"), "expected tag 'ocs-shares'");
});

test("loadNextcloudOperations: contains key WebDAV operations", () => {
  const ops = loadNextcloudOperations();
  const ids = new Set(ops.map((op) => op.operationId));
  assert.ok(ids.has("webdav.directory.list"), "expected webdav.directory.list");
  assert.ok(ids.has("webdav.file.download"), "expected webdav.file.download");
  assert.ok(ids.has("webdav.file.upload"), "expected webdav.file.upload");
  assert.ok(ids.has("webdav.file.delete"), "expected webdav.file.delete");
  assert.ok(ids.has("webdav.file.move"), "expected webdav.file.move");
  assert.ok(ids.has("webdav.file.copy"), "expected webdav.file.copy");
  assert.ok(ids.has("webdav.directory.create"), "expected webdav.directory.create");
});

test("loadNextcloudOperations: contains key OCS operations", () => {
  const ops = loadNextcloudOperations();
  const ids = new Set(ops.map((op) => op.operationId));
  assert.ok(ids.has("ocs.users.list"), "expected ocs.users.list");
  assert.ok(ids.has("ocs.user.get"), "expected ocs.user.get");
  assert.ok(ids.has("ocs.user.create"), "expected ocs.user.create");
  assert.ok(ids.has("ocs.groups.list"), "expected ocs.groups.list");
  assert.ok(ids.has("ocs.apps.list"), "expected ocs.apps.list");
  assert.ok(ids.has("ocs.shares.list"), "expected ocs.shares.list");
  assert.ok(ids.has("ocs.capabilities.get"), "expected ocs.capabilities.get");
});

test("loadNextcloudOperations: contains key CalDAV operations", () => {
  const ops = loadNextcloudOperations();
  const ids = new Set(ops.map((op) => op.operationId));
  assert.ok(ids.has("caldav.calendars.list"), "expected caldav.calendars.list");
  assert.ok(ids.has("caldav.events.list"), "expected caldav.events.list");
  assert.ok(ids.has("caldav.event.create"), "expected caldav.event.create");
  assert.ok(ids.has("caldav.event.delete"), "expected caldav.event.delete");
});

test("loadNextcloudOperations: contains key CardDAV operations", () => {
  const ops = loadNextcloudOperations();
  const ids = new Set(ops.map((op) => op.operationId));
  assert.ok(ids.has("carddav.addressbooks.list"), "expected carddav.addressbooks.list");
  assert.ok(ids.has("carddav.contacts.list"), "expected carddav.contacts.list");
  assert.ok(ids.has("carddav.contact.create"), "expected carddav.contact.create");
  assert.ok(ids.has("carddav.contact.delete"), "expected carddav.contact.delete");
});

test("loadNextcloudOperations: webdav operations have expected paths", () => {
  const ops = loadNextcloudOperations();
  const webdav = ops.filter((op) => op.tags.includes("webdav"));
  for (const op of webdav) {
    assert.ok(
      op.path.includes("/remote.php/dav/files/{username}/"),
      `expected WebDAV path prefix for ${op.operationId}`
    );
  }
});

test("loadNextcloudOperations: ocs operations have expected path prefix", () => {
  const ops = loadNextcloudOperations();
  const ocs = ops.filter((op) => op.tags.some((t) => t.startsWith("ocs")));
  for (const op of ocs) {
    assert.ok(op.path.startsWith("/ocs/v2.php/"), `expected OCS path prefix for ${op.operationId}`);
  }
});
