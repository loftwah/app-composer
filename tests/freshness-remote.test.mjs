import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  exitCodeFor,
  formatReport,
  inspectRemoteFreshness,
} from "../scripts/freshness.mjs";

const localReport = {
  kind: "app-composer.dependency-freshness",
  contract: 1,
  reviewed: "2026-11-06",
  runtime: [
    { name: "node", current: "22.23.4", supported: ">=22.23.4 <23", status: "ok" },
    { name: "pnpm", current: "12.8.1", supported: "12.8.1", status: "ok" },
  ],
  packages: [
    {
      name: "alpha",
      kind: "dependencies",
      declared: "1.2.0",
      locked: "1.2.0",
      current: "1.2.0",
      supported: "^1.2.0",
      reviewed: "1.2.0",
      note: null,
      status: "ok",
    },
    {
      name: "@scope/beta",
      kind: "dependencies",
      declared: "2.0.0",
      locked: "2.0.0",
      current: "2.0.0",
      supported: "^2.0.0",
      reviewed: "2.0.0",
      note: null,
      status: "ok",
    },
    {
      name: "gamma",
      kind: "devDependencies",
      declared: "3.0.0",
      locked: "3.0.0",
      current: "3.0.0",
      supported: "^3.0.0",
      reviewed: "3.0.0",
      note: null,
      status: "ok",
    },
  ],
  summary: { ok: 5, drift: 0, unknown: 0, unresolved: 0 },
  status: "ok",
};

async function startRegistry(handler) {
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      handler(request, response, body);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function packageHandler(versions, { advisories = {}, requests = [] } = {}) {
  return (request, response, body) => {
    requests.push({ url: request.url, method: request.method, headers: request.headers, body });
    if (request.url === "/-/npm/v1/security/advisories/bulk") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(advisories));
      return;
    }
    const name = decodeURIComponent(request.url.replace(/\/latest$/, "").slice(1));
    const entry = versions[name];
    if (!entry) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not found" }));
      return;
    }
    if (typeof entry === "string") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(entry);
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(entry));
  };
}

test("--remote reports compatible, feature, breaking and advisory signals", async (t) => {
  const requests = [];
  const registry = await startRegistry(
    packageHandler(
      {
        alpha: { name: "alpha", version: "1.2.1" },
        "@scope/beta": { name: "@scope/beta", version: "2.1.0" },
        gamma: { name: "gamma", version: "4.0.0" },
      },
      {
        requests,
        advisories: {
          alpha: [
            {
              id: 42,
              severity: "high",
              title: "Test advisory",
              url: "https://example.test/advisory",
              vulnerable_versions: "<=1.2.0",
            },
          ],
        },
      },
    ),
  );
  t.after(() => registry.close());
  const report = await inspectRemoteFreshness({
    report: localReport,
    registry: registry.url,
    retries: 0,
  });
  assert.equal(report.mode, "remote");
  assert.equal(report.status, "security");
  assert.equal(report.registry, registry.url);
  assert.match(report.checkedAt, /^\d{4}-\d\d-\d\dT/);
  assert.equal(report.packages[0].remote.classification, "security-urgent");
  assert.equal(report.packages[0].remote.advisory.title, "Test advisory");
  assert.equal(report.packages[1].remote.classification, "feature-opportunity");
  assert.equal(report.packages[2].remote.classification, "breaking-major");
  assert.deepEqual(
    {
      current: report.summary.current,
      patch: report.summary.compatiblePatch,
      feature: report.summary.featureOpportunity,
      breaking: report.summary.breakingMajor,
      security: report.summary.securityUrgent,
      unknown: report.summary.unknown,
    },
    { current: 0, patch: 0, feature: 1, breaking: 1, security: 1, unknown: 0 },
  );
  assert.equal(exitCodeFor(report), 4);
  assert.match(formatReport(report), /1 security/);
  assert.equal(requests.filter((entry) => entry.method === "GET").length, 3);
  assert.equal(requests.filter((entry) => entry.method === "POST").length, 1);
  const advisory = requests.find((entry) => entry.method === "POST");
  assert.deepEqual(JSON.parse(advisory.body), {
    alpha: ["1.2.0"],
    "@scope/beta": ["2.0.0"],
    gamma: ["3.0.0"],
  });
  for (const request of requests) {
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers.cookie, undefined);
  }
});

test("malformed registry responses become unknown without throwing", async (t) => {
  const registry = await startRegistry(
    packageHandler({
      alpha: "{not json",
      "@scope/beta": [],
      gamma: { name: "some-other-package", version: "3.0.1" },
    }),
  );
  t.after(() => registry.close());
  const report = await inspectRemoteFreshness({
    report: localReport,
    registry: registry.url,
    retries: 0,
  });
  assert.equal(report.status, "unknown");
  assert.equal(report.summary.unknown, 3);
  assert.equal(report.packages[0].remote.latest, null);
  assert.match(report.packages[0].remote.reason, /not valid JSON/);
  assert.match(report.packages[1].remote.reason, /not a JSON object/);
  assert.match(report.packages[2].remote.reason, /named "some-other-package"/);
  assert.equal(exitCodeFor(report), 0);
});

test("an unreachable registry becomes unknown with a bounded reason", async () => {
  const registry = await startRegistry(() => {});
  await registry.close();
  const report = await inspectRemoteFreshness({
    report: localReport,
    registry: registry.url,
    retries: 0,
    timeoutMs: 200,
  });
  assert.equal(report.status, "unknown");
  assert.equal(report.summary.unknown, 3);
  assert.match(report.packages[0].remote.reason, /unreachable|ECONNREFUSED|fetch failed/i);
  assert.equal(exitCodeFor(report), 0);
});

test("unexpected versions and older dist-tags never invent latest", async (t) => {
  const registry = await startRegistry(
    packageHandler({
      alpha: { name: "alpha", version: "not-a-version" },
      "@scope/beta": { name: "@scope/beta", version: "1.9.0" },
      gamma: { name: "gamma", version: "3.0.1" },
    }),
  );
  t.after(() => registry.close());
  const report = await inspectRemoteFreshness({
    report: localReport,
    registry: registry.url,
    retries: 0,
  });
  assert.equal(report.status, "unknown");
  assert.match(report.packages[0].remote.reason, /unsupported version/);
  assert.equal(report.packages[0].remote.latest, null);
  assert.equal(report.packages[1].remote.classification, "unknown");
  assert.match(report.packages[1].remote.reason, /older than the locked/);
  assert.equal(report.packages[2].remote.classification, "compatible-patch");
  assert.equal(report.packages[2].remote.latest, "3.0.1");
});

test("a transient registry error is retried within the fixed bound", async (t) => {
  let attempts = 0;
  const registry = await startRegistry((request, response) => {
    if (request.url === "/-/npm/v1/security/advisories/bulk") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
      return;
    }
    attempts += 1;
    if (attempts === 1) {
      response.writeHead(503, { "content-type": "text/plain" });
      response.end("try again");
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    const names = { "/alpha/latest": "alpha", "/@scope%2Fbeta/latest": "@scope/beta", "/gamma/latest": "gamma" };
    response.end(JSON.stringify({ name: names[request.url], version: "1.2.0" }));
  });
  t.after(() => registry.close());
  const report = await inspectRemoteFreshness({
    report: { ...localReport, packages: [localReport.packages[0]] },
    registry: registry.url,
    retries: 1,
    retryDelayMs: 1,
  });
  assert.equal(attempts, 2);
  assert.equal(report.packages[0].remote.classification, "current");
});
