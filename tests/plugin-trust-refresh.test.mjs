import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  refreshPluginTrust,
  registryFetch,
} from "../scripts/plugin-trust-refresh.mjs";
const snapshot = JSON.parse(
  readFileSync(
    new URL("../src/data/plugin-trust-20261025.json", import.meta.url),
    "utf8",
  ),
);
const date = new Date("2026-10-25T13:00:00Z");
function discovery(changes = {}) {
  return {
    async getPackage({ did, slug }) {
      const p = snapshot.packages.find((p) => p.did === did && p.slug === slug);
      return {
        did,
        slug,
        cid: p.profileCid,
        uri: p.profileUri,
        handle: p.handle,
        releaseHistoryComplete: p.historyComplete,
        profile: {
          name: p.name,
          license: p.license,
          security: [{ email: "fictional@example.test" }],
          extensions: {
            "com.emdashcms.experimental.package.profileExtension": {
              repository: p.repository,
              releasePolicy: { requireProvenance: p.requireProvenance },
            },
          },
        },
        ...changes.profile,
      };
    },
    async getLatestRelease({ did, package: slug }) {
      const p = snapshot.packages.find((p) => p.did === did && p.slug === slug);
      return {
        did,
        package: slug,
        version: p.version,
        cid: p.releaseCid,
        uri: p.releaseUri,
        indexedAt: p.indexedAt,
        labels: p.labels,
        release: {
          artifacts: { package: { checksum: p.checksum } },
          requires: { "env:emdash": p.requires },
        },
        ...changes.release,
      };
    },
  };
}
test("refresh uses fixed identities, preserves exact byte inspection and never mutates source input", async () => {
  const before = JSON.stringify(snapshot);
  const result = await refreshPluginTrust(snapshot, discovery(), date);
  assert.equal(result.observedAt, date.toISOString());
  assert.equal(JSON.stringify(snapshot), before);
  assert.ok(result.packages.every((p) => !p.refreshFailed));
  assert.deepEqual(
    result.packages[0].inspection,
    snapshot.packages[0].inspection,
  );
});
test("changed release drops old artifact evidence and malformed/mismatched/unavailable records retain failed observation", async () => {
  const changed = await refreshPluginTrust(
    snapshot,
    discovery({ release: { cid: "b" + "a".repeat(30) } }),
    date,
  );
  assert.ok(
    changed.packages.every((p) => p.inspection === null && !p.refreshFailed),
  );
  for (const client of [
    discovery({ profile: { did: "did:web:impostor.test" } }),
    discovery({ release: { release: null } }),
    {
      getPackage: async () => {
        throw Error("PRIVATE_REMOTE_CANARY");
      },
    },
  ]) {
    const failed = await refreshPluginTrust(snapshot, client, date);
    assert.ok(failed.packages.every((p) => p.refreshFailed));
    assert.equal(
      failed.packages[0].releaseCid,
      snapshot.packages[0].releaseCid,
    );
    assert.equal(
      JSON.stringify(failed).includes("PRIVATE_REMOTE_CANARY"),
      false,
    );
  }
});
test("discovery transport bounds targets, methods, redirects, time and bytes before use", async () => {
  let calls = 0;
  const fetcher = async (_input, init) => {
    calls++;
    assert.equal(init.redirect, "error");
    assert.ok(init.signal);
    return new Response("{}");
  };
  for (const url of [
    "https://attacker.test/xrpc/test",
    "http://registry.emdashcms.com/xrpc/test",
    "https://registry.emdashcms.com/private",
  ])
    await assert.rejects(registryFetch(url, {}, fetcher), /refused/);
  await assert.rejects(
    registryFetch(
      "https://registry.emdashcms.com/xrpc/test",
      { method: "POST" },
      fetcher,
    ),
    /refused/,
  );
  assert.equal(calls, 0);
  assert.equal(
    (
      await registryFetch(
        "https://registry.emdashcms.com/xrpc/test",
        { method: "get" },
        fetcher,
      )
    ).status,
    200,
  );
  await assert.rejects(
    registryFetch(
      "https://registry.emdashcms.com/xrpc/test",
      {},
      async () => new Response(new Uint8Array(512 * 1024 + 1)),
    ),
    /too large/,
  );
});
