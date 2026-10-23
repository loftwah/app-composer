import test from "node:test";
import assert from "node:assert/strict";
import { manageMiniapps } from "../src/lib/miniapp-admin.mjs";
import {
  shareCardReceipt,
  shareCardSnapshot,
} from "../src/lib/miniapp-share-card.mjs";
const origin = "https://composer.loftwah.com",
  revision = "a".repeat(40),
  sha = "b".repeat(64);
const image = {
  path: "/brand/generated/profile-" + sha + ".png",
  sha256: sha,
  type: "image/png",
  width: 1200,
  height: 630,
  alt: "A fictional creator profile",
};
const snapshot = {
  version: 1,
  profile: {
    id: "https://showcase.loftwah.com/",
    revision: sha,
    name: "Fictional creator",
    handle: "fictional",
    description: "A public bio",
    shareImage: origin + "/showcase" + image.path,
  },
  approved: image,
  previous: {
    shareImage: "https://showcase.loftwah.com/brand/manual.jpg",
    approved: null,
  },
};
const receipt = {
  format: "linkarooie.share-card",
  version: 1,
  profile: { id: snapshot.profile.id, revision: sha },
  image,
  text: {
    name: snapshot.profile.name,
    handle: snapshot.profile.handle,
    description: snapshot.profile.description,
  },
  preset: { id: "typography", version: 1 },
  renderer: {
    id: "launch-kit-profile",
    version: "1.0.0",
    font: "Space Grotesk Latin 20261018",
    fontSha256:
      "61d00a1c57fcd7d4826c7a69cd85b61d15d133d5471d3c9c4731d70193d9f71f",
  },
};
function fixture(result = snapshot, status = 200) {
  const calls = [];
  return {
    calls,
    runtime: {
      PUBLIC_ORIGIN: origin,
      SHOWCASE_OWNER_TOKEN: "fictional-token",
      SHOWCASE: {
        async fetch(request) {
          calls.push(request);
          return request.url.endsWith("/build.json")
            ? Response.json({ app: "showcase", revision, dataVersion: 1 })
            : Response.json(result, { status });
        },
      },
    },
  };
}
function invoke(
  f,
  input,
  {
    role = 50,
    method = input.operation === "snapshot" ? "GET" : "POST",
    headers = { Origin: origin, "X-EmDash-Request": "1" },
  } = {},
) {
  return manageMiniapps(
    {
      user: { id: "fictional", role },
      input: { app: "showcase", action: "share-card", ...input },
      request: new Request(
        origin + "/_emdash/api/plugins/composer-miniapps/read",
        { method, headers },
      ),
    },
    f.runtime,
    { showcase: revision },
  );
}
test("native profile image read verifies exact source before owner dispatch and strips unrelated fields", async () => {
  const f = fixture({ ...snapshot, privateExtra: "excluded" }),
    result = await invoke(f, { operation: "snapshot" });
  assert.deepEqual(result, { ok: true, ...snapshot });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].headers.get("Authorization"), null);
  assert.equal(
    f.calls[1].headers.get("Authorization"),
    "Bearer fictional-token",
  );
  assert.equal(new URL(f.calls[1].url).pathname, "/showcase/api/share-card");
});
test("profile image mutations preserve expected revision, publish only explicit receipt and retain manual rollback", async () => {
  for (const operation of ["adopt", "rollback"]) {
    const f = fixture(),
      result = await invoke(f, {
        operation,
        expectedRevision: sha,
        ...(operation === "adopt" ? { receipt } : {}),
      });
    assert.equal(result.ok, true);
    assert.deepEqual(await f.calls[1].json(), {
      action: operation,
      expectedRevision: sha,
      ...(operation === "adopt" ? { receipt } : {}),
    });
    assert.equal(result.previous.shareImage, snapshot.previous.shareImage);
  }
});
test("role, method, origin and invalid receipt deny dispatch before credentials", async () => {
  for (const options of [
    { role: 20 },
    { method: "GET" },
    {
      headers: { Origin: "https://untrusted.invalid", "X-EmDash-Request": "1" },
    },
    { headers: { Origin: origin } },
  ]) {
    const f = fixture();
    assert.equal(
      (
        await invoke(
          f,
          { operation: "adopt", expectedRevision: sha, receipt },
          options,
        )
      ).ok,
      false,
    );
    assert.equal(f.calls.length, 0);
  }
  for (const patch of [
    { operation: "unknown" },
    { operation: "adopt", expectedRevision: "stale", receipt },
    {
      operation: "adopt",
      expectedRevision: sha,
      receipt: {
        ...receipt,
        image: { ...image, path: "https://untrusted.invalid/a.png" },
      },
    },
    { app: "guestbook", operation: "snapshot" },
  ]) {
    const f = fixture();
    assert.equal((await invoke(f, patch)).ok, false);
    assert.equal(f.calls.length, 0);
  }
});
test("stale and uncertain publication responses never report publication success", async () => {
  for (const status of [409, 500]) {
    const f = fixture({ ok: false }, status),
      result = await invoke(f, {
        operation: "adopt",
        expectedRevision: sha,
        receipt,
      });
    assert.equal(result.ok, false);
    assert.equal(result.code, status === 409 ? "CONFLICT" : "UNCONFIRMED");
    assert.equal(f.calls.length, 2);
  }
});
test("malformed snapshots and active asset paths cannot escape the bounded contract", () => {
  for (const value of [
    { ...snapshot, profile: { ...snapshot.profile, revision: "bad" } },
    { ...snapshot, approved: { ...image, type: "image/jpeg" } },
    {
      ...snapshot,
      previous: { shareImage: "javascript:alert(1)", approved: null },
    },
  ])
    assert.throws(() => shareCardSnapshot(value));
  assert.throws(() =>
    shareCardReceipt({ ...receipt, image: { ...image, width: 1 } }),
  );
});
