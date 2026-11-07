import test from "node:test";
import assert from "node:assert/strict";
import { workerDiscovery } from "../src/lib/plugin-trust-discovery.ts";

const did = "did:plc:fictionalpublisher0000000";

test("only the two fixed aggregator GET queries are issued", async () => {
  const calls = [];
  const fetcher = async (input, init) => {
    calls.push({ url: String(input), init });
    if (String(input).includes("getPackage"))
      return Response.json({
        did,
        slug: "freeform",
        handle: "fictional.example",
        cid: "bafyprofile",
        uri: "at://" + did + "/profile/freeform",
        profile: { name: "Freeform" },
        releaseHistoryComplete: true,
      });
    return Response.json({
      did,
      package: "freeform",
      cid: "bafyrelease",
      uri: "at://" + did + "/release/freeform:1.0.0",
      version: "1.0.0",
      release: { artifacts: { package: { checksum: "bafychecksum" } } },
      labels: [{ val: "listing-passed" }],
    });
  };
  const discovery = workerDiscovery(fetcher);
  const profile = await discovery.getPackage({ did, slug: "freeform" });
  assert.equal(profile.did, did);
  assert.equal(profile.slug, "freeform");
  assert.equal(profile.profile.name, "Freeform");
  assert.equal(profile.releaseHistoryComplete, true);
  const release = await discovery.getLatestRelease({ did, package: "freeform" });
  assert.equal(release.version, "1.0.0");
  assert.equal(release.package, "freeform");
  assert.equal(release.labels.length, 1);
  for (const call of calls) {
    assert.equal(new URL(call.url).origin, "https://registry.emdashcms.com");
    assert.equal(new URL(call.url).pathname.startsWith("/xrpc/com.emdashcms.experimental.aggregator."), true);
    assert.equal(call.init.method, "GET");
    assert.equal(call.init.redirect, "error");
    assert.ok(call.init.signal);
  }
  assert.equal(new URL(calls[0].url).searchParams.get("slug"), "freeform");
  assert.equal(new URL(calls[1].url).searchParams.get("package"), "freeform");
});

test("an oversized declared response is refused before parsing", async () => {
  const discovery = workerDiscovery(async () =>
    new Response("{}", {
      headers: { "content-length": String(600 * 1024) },
    }),
  );
  await assert.rejects(
    discovery.getPackage({ did, slug: "freeform" }),
    /too large/,
  );
});

test("an oversized streamed response is refused", async () => {
  const discovery = workerDiscovery(async () =>
    new Response("x".repeat(513 * 1024)),
  );
  await assert.rejects(
    discovery.getPackage({ did, slug: "freeform" }),
    /too large/,
  );
});

test("malformed JSON and non-object responses are refused", async () => {
  const invalid = workerDiscovery(async () => new Response("not json"));
  await assert.rejects(invalid.getPackage({ did, slug: "freeform" }));
  const array = workerDiscovery(async () => Response.json([]));
  await assert.rejects(
    array.getLatestRelease({ did, package: "freeform" }),
  );
});

test("a non-ok response is refused", async () => {
  const discovery = workerDiscovery(async () => new Response("no", { status: 503 }));
  await assert.rejects(discovery.getLatestRelease({ did, package: "freeform" }));
});
