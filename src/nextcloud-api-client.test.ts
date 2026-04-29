import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNextcloudError, redactSecrets, __testing } from "./nextcloud-api-client.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

const { normalizeNextcloudError: norm, redactSecrets: redact } = __testing;

// ── redactSecrets ─────────────────────────────────────────────────────────────

test("redactSecrets: redacts Basic auth credentials", () => {
  const result = redact("Authorization: Basic dXNlcjpwYXNzd29yZA==");
  assert.ok(!result.includes("dXNlcjpwYXNzd29yZA=="), "credentials should be redacted");
  assert.ok(result.includes("[redacted]"), "should contain [redacted]");
});

test("redactSecrets: leaves unrelated strings alone", () => {
  const result = redact("hello world, no credentials here");
  assert.equal(result, "hello world, no credentials here");
});

test("redactSecrets: handles empty string", () => {
  assert.equal(redact(""), "");
});

// ── normalizeNextcloudError ───────────────────────────────────────────────────

test("normalizeNextcloudError: returns McpError for Error instance", () => {
  const err = norm(new Error("network failure"));
  assert.ok(err instanceof McpError);
  assert.equal(err.code, ErrorCode.InternalError);
  assert.ok(err.message.includes("network failure"));
});

test("normalizeNextcloudError: returns McpError for object with message field", () => {
  const err = norm({ message: "connection refused" });
  assert.ok(err instanceof McpError);
  assert.ok(err.message.includes("connection refused"));
});

test("normalizeNextcloudError: returns McpError for string error", () => {
  const err = norm("some error string");
  assert.ok(err instanceof McpError);
  assert.ok(err.message.includes("some error string"));
});

test("normalizeNextcloudError: handles null input", () => {
  const err = norm(null);
  assert.ok(err instanceof McpError);
  assert.equal(err.code, ErrorCode.InternalError);
});

test("normalizeNextcloudError: handles undefined input", () => {
  const err = norm(undefined);
  assert.ok(err instanceof McpError);
  assert.equal(err.code, ErrorCode.InternalError);
});

test("normalizeNextcloudError: redacts Basic credentials from message", () => {
  const err = norm(new Error("Authorization: Basic dXNlcjpwYXNzd29yZA=="));
  assert.ok(!err.message.includes("dXNlcjpwYXNzd29yZA=="), "credentials must not appear in error");
});

// ── module exports ────────────────────────────────────────────────────────────

test("normalizeNextcloudError exported from module", () => {
  assert.equal(typeof normalizeNextcloudError, "function");
});

test("redactSecrets exported from module", () => {
  assert.equal(typeof redactSecrets, "function");
});
