import assert from "node:assert/strict";
import test from "node:test";
import { NextcloudClient, createClient, __testing } from "./nextcloud-client.js";

const { normalizeNextcloudError } = __testing;

const testConfig = {
  url: "https://cloud.example.com",
  username: "alice",
  token: "test-app-password-token"
};

// ---------------------------------------------------------- NextcloudClient constructor

test("NextcloudClient: exposes baseUrl and username but not the token", () => {
  const client = new NextcloudClient(testConfig);
  assert.equal(client.baseUrl, testConfig.url);
  assert.equal(client.username, testConfig.username);
  assert.equal((client as unknown as Record<string, unknown>).token, undefined);
  assert.equal((client as unknown as Record<string, unknown>).password, undefined);
});

test("createClient: returns a NextcloudClient instance", () => {
  const client = createClient(testConfig);
  assert.ok(client instanceof NextcloudClient);
  assert.equal(client.baseUrl, testConfig.url);
  assert.equal(client.username, testConfig.username);
});

// ---------------------------------------------------------- normalizeNextcloudError

test("normalizeNextcloudError: passes through a plain Error unchanged", () => {
  const err = new Error("ECONNREFUSED");
  const result = normalizeNextcloudError(err);
  assert.ok(result instanceof Error);
  assert.ok(result.message.includes("ECONNREFUSED"));
});

test("normalizeNextcloudError: formats axios-style error with response status", () => {
  const axiosErr = Object.assign(new Error("Request failed with status code 404"), {
    isAxiosError: true,
    response: { status: 404, statusText: "Not Found" }
  });
  const result = normalizeNextcloudError(axiosErr);
  assert.ok(result instanceof Error);
  assert.ok(result.message.includes("404"));
  assert.ok(result.message.includes("Not Found"));
});

test("normalizeNextcloudError: uses message when no response is present", () => {
  const axiosErr = Object.assign(new Error("Network Error"), {
    isAxiosError: true,
    response: null
  });
  const result = normalizeNextcloudError(axiosErr);
  assert.ok(result instanceof Error);
  assert.ok(result.message.includes("Network Error"));
});

test("normalizeNextcloudError: wraps non-Error inputs", () => {
  const result = normalizeNextcloudError("plain string error");
  assert.ok(result instanceof Error);
  assert.ok(result.message.includes("plain string error"));
});

test("normalizeNextcloudError: handles null input", () => {
  const result = normalizeNextcloudError(null);
  assert.ok(result instanceof Error);
});

test("normalizeNextcloudError: handles undefined input", () => {
  const result = normalizeNextcloudError(undefined);
  assert.ok(result instanceof Error);
});
