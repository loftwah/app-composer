import test from "node:test";
import assert from "node:assert/strict";
import { auditPublication } from "../scripts/audit-publication.mjs";
const canary = "synthetic-opaque-" + "remote-publication-canary";
const response = (text, status = 200, type = "text/html") =>
  new Response(text, { status, headers: { "content-type": type } });
for (const status of [200, 403, 404, 410])
  test("secret body fails regardless of HTTP " + status, async () => {
    const result = await auditPublication("https://example.test", {
      values: [canary],
      fetcher: async (url) =>
        response(url.pathname === "/" ? "shell" : canary, status),
    });
    assert.equal(result.ok, false);
    assert.ok(result.records.some((item) => item.outcome === "exposed"));
    assert.equal(JSON.stringify(result).includes(canary), false);
  });
test("clean absent paths and harmless public asset pass", async () => {
  const result = await auditPublication("https://example.test", {
    values: [],
    fetcher: async (url) =>
      url.pathname === "/"
        ? response('<script src="/app.js"></script>')
        : url.pathname === "/app.js"
          ? response("const value=42", 200, "text/javascript")
          : response("", 404),
  });
  assert.equal(result.ok, true);
  assert.ok(
    result.records.some((item) => item.outcome === "sampled public asset"),
  );
});
test("HTML fallback is explicitly inconclusive, and sampled asset leaks fail", async () => {
  const clean = await auditPublication("https://example.test", {
    values: [],
    fetcher: async () => response("shell"),
  });
  assert.equal(clean.ok, true);
  assert.ok(
    clean.records.every((item) => item.outcome.includes("local artifact")),
  );
  const leaked = await auditPublication("https://example.test", {
    values: [canary],
    fetcher: async (url) =>
      url.pathname === "/"
        ? response('<script src="/app.js"></script>')
        : url.pathname === "/app.js"
          ? response(canary)
          : response("", 404),
  });
  assert.equal(leaked.ok, false);
});
test("network errors fail without logging error content", async () => {
  const result = await auditPublication("https://example.test", {
    fetcher: async () => {
      throw Error(canary);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes(canary), false);
});
