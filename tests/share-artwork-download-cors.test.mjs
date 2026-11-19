// Focused CORS response proof for the public artwork download handoff (#477).
// Fictional fixtures only: no network, provider, credential or database.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GET } from "../src/pages/api/share-artwork-download.ts";
import {
  publicShareArtwork,
  artworkRevision,
} from "../src/lib/share-catalogue-asset.ts";

const ASSET_ID = "atlas-04-composer-family";
const STUDIO_ORIGIN = "https://media.loftwah.com";
const CATALOGUE_ORIGIN = "https://woodhouse.loftwah.com";
const PREVIEW = `${CATALOGUE_ORIGIN}/campaign/${ASSET_ID}-preview.png`;
const ORIGINAL = `${CATALOGUE_ORIGIN}/campaign/${ASSET_ID}-original.png`;
const SHARE = `${CATALOGUE_ORIGIN}/share/${ASSET_ID}/`;
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

const asset = {
  id: ASSET_ID,
  project: "composer",
  visibility: "public",
  title: "A finish catches light",
  alt: "A machined block catching warm light.",
  credit: "Woodhouse · GPT Image 2.6 via Fal",
  thumbnailUrl: PREVIEW,
  previewUrl: PREVIEW,
  shareUrl: SHARE,
  original: {
    url: ORIGINAL,
    label: "Original",
    width: 307,
    height: 384,
    sha256: "a".repeat(64),
    version: "v1",
  },
  formats: [],
  versions: [],
  reviewedAt: "2026-11-18",
};

function downloadUrl(revision) {
  const query = new URLSearchParams({ id: ASSET_ID, file: "0", revision });
  return new URL(`https://composer.loftwah.com/api/share-artwork-download?${query}`);
}

function catalogueResponse(status, body = {}) {
  return new Response(status === 200 ? JSON.stringify(body) : "", {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(input) {
  const url = typeof input === "string" ? input : input.url;
  if (url.startsWith(`${CATALOGUE_ORIGIN}/api/v1/assets/`))
    return Promise.resolve(catalogueResponse(200, { version: 1, asset }));
  if (url === ORIGINAL || url === PREVIEW)
    return Promise.resolve(new Response(PNG, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-length": String(PNG.byteLength),
      },
    }));
  return Promise.resolve(new Response("", { status: 404 }));
}

async function currentRevision() {
  const result = await publicShareArtwork(ASSET_ID, { fetch: stubFetch });
  assert.equal(result.status, 200);
  return artworkRevision(result.artwork);
}

async function call(revision, origin, fetchImpl = stubFetch, index = "0") {
  const url = downloadUrl(revision);
  url.searchParams.set("file", index);
  const request = origin
    ? new Request(url, { headers: { origin } })
    : new Request(url);
  const previous = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await GET({ url, request, params: {} });
  } finally {
    globalThis.fetch = previous;
  }
}

function assertStudioCors(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("access-control-allow-origin"), STUDIO_ORIGIN);
  assert.equal(response.headers.get("vary"), "Origin");
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
}

function assertNoCors(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("vary"), "Origin");
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
}

test("only the exact Studio origin can read a successful download", async () => {
  const revision = await currentRevision();
  assertStudioCors(await call(revision, STUDIO_ORIGIN), 200);
});

test("absent, wrong and lookalike origins get no CORS and nothing reflected", async () => {
  const revision = await currentRevision();
  for (const origin of [
    null,
    "https://evil.example",
    "http://media.loftwah.com",
    "https://media.loftwah.com.evil.example",
  ]) {
    assertNoCors(await call(revision, origin), 200);
  }
});

test("a stale revision 409 still carries Studio-only CORS", async () => {
  const stale = "f".repeat(64);
  assertStudioCors(await call(stale, STUDIO_ORIGIN), 409);
  assertNoCors(await call(stale, "https://evil.example"), 409);
});

test("the existing public gate 404 still carries Studio-only CORS", async () => {
  const revision = await currentRevision();
  const gatedFetch = (input) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.startsWith(`${CATALOGUE_ORIGIN}/api/v1/assets/`))
      return Promise.resolve(catalogueResponse(404));
    return stubFetch(input);
  };
  assertStudioCors(await call(revision, STUDIO_ORIGIN, gatedFetch), 404);
  assertNoCors(await call(revision, "https://evil.example", gatedFetch), 404);
});

test("other rendition indexes do not opt in to CORS", async () => {
  const response = await call(await currentRevision(), STUDIO_ORIGIN, stubFetch, "1");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("the handoff is a native reference link and keeps the manual instructions", () => {
  const source = readFileSync(
    new URL("../src/components/ShareArtworkDetail.astro", import.meta.url),
    "utf8",
  );
  assert.match(source, /https:\/\/media\.loftwah\.com\/tools\/images#\$\{new URLSearchParams/);
  assert.match(source, /'composer-artwork': artwork\.assetId, revision/);
  assert.match(source, /href=\{studioToolsUrl\}/);
  assert.match(source, /Open in Studio Image Tools/);
  assert.doesNotMatch(source, /fetch\(studioToolsUrl/, "the fragment is a reference, not a fetch");
  for (const kept of [
    "Load Composer artwork",
    "Make 4 social sizes",
    "credited post text (TXT)",
    "Library → Import from Woodhouse Share",
    "Open Media Studio",
  ]) {
    assert.ok(source.includes(kept), `keeps: ${kept}`);
  }
});

// ---- Bounded download diagnostic wire contract (#477 section 3) ----

const FAILURE_HEADER = "x-composer-artwork-failure";
const REQUEST_HEADER = "x-composer-artwork-request";
const EXPOSED_HEADERS = "X-Composer-Artwork-Failure, X-Composer-Artwork-Request";
const ALLOWED_STAGES = new Set([
  "invalid-request",
  "artwork-unavailable",
  "revision-changed",
  "catalogue-unavailable",
  "file-unavailable",
  "file-timeout",
  "file-rejected",
]);
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function assertFailure(response, status, stage, copy) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get(FAILURE_HEADER), stage);
  assert.ok(ALLOWED_STAGES.has(stage), `allowed stage: ${stage}`);
  assert.match(response.headers.get(REQUEST_HEADER) ?? "", UUID_V4);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const text = await response.text();
  if (copy) assert.ok(text.includes(copy), `kept recovery copy: ${copy}`);
  return text;
}

function originalOverride(original) {
  return (input) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.startsWith(`${CATALOGUE_ORIGIN}/api/v1/assets/`))
      return Promise.resolve(catalogueResponse(200, { version: 1, asset }));
    if (url === ORIGINAL || url === PREVIEW)
      return typeof original === "function" ? original() : Promise.resolve(original);
    return stubFetch(input);
  };
}

function catalogueFailure(status) {
  return (input) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.startsWith(`${CATALOGUE_ORIGIN}/api/v1/assets/`))
      return Promise.resolve(catalogueResponse(status));
    return stubFetch(input);
  };
}

async function captureWarn(fn) {
  const previous = console.warn;
  const logs = [];
  console.warn = (...args) => { logs.push(args); };
  try {
    return { value: await fn(), logs };
  } finally {
    console.warn = previous;
  }
}

test("successful download carries neither diagnostic header and logs nothing", async () => {
  const { value: response, logs } = await captureWarn(async () =>
    call(await currentRevision(), STUDIO_ORIGIN));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get(FAILURE_HEADER), null);
  assert.equal(response.headers.get(REQUEST_HEADER), null);
  assert.equal(logs.length, 0);
});

test("invalid request is 400 invalid-request with a bounded reference", async () => {
  await assertFailure(await call("not-a-sha", STUDIO_ORIGIN), 400, "invalid-request");
});

test("public gate 404 keeps artwork-unavailable, status and recovery copy", async () => {
  const response = await call(await currentRevision(), STUDIO_ORIGIN, catalogueFailure(404));
  await assertFailure(response, 404, "artwork-unavailable", "no longer public");
});

test("stale revision 409 keeps revision-changed, status and recovery copy", async () => {
  const response = await call("f".repeat(64), STUDIO_ORIGIN);
  await assertFailure(response, 409, "revision-changed", "Reopen the artwork page");
});

test("catalogue failure is 503 catalogue-unavailable without leaking the upstream status body", async () => {
  const response = await call(await currentRevision(), STUDIO_ORIGIN, catalogueFailure(500));
  await assertFailure(response, 503, "catalogue-unavailable", "temporarily unavailable");
});

test("unexpected original response is 502 file-unavailable", async () => {
  const response = await call(await currentRevision(), STUDIO_ORIGIN,
    originalOverride(new Response("", { status: 503 })));
  await assertFailure(response, 502, "file-unavailable", "still has an image link");
});

test("original transport failure is 502 file-unavailable with retry copy", async () => {
  const response = await call(await currentRevision(), STUDIO_ORIGIN,
    originalOverride(() => Promise.reject(new TypeError("network down"))));
  await assertFailure(response, 502, "file-unavailable", "Try again.");
});

test("signal timeout alone is 504 file-timeout with retry copy", async () => {
  const response = await call(await currentRevision(), STUDIO_ORIGIN,
    originalOverride(() => Promise.reject(new DOMException("timed out", "TimeoutError"))));
  await assertFailure(response, 504, "file-timeout", "Try again.");
});

test("successful original with invalid content type is 502 file-rejected", async () => {
  const response = await call(await currentRevision(), STUDIO_ORIGIN,
    originalOverride(new Response(PNG, {
      status: 200,
      headers: { "content-type": "text/plain", "content-length": String(PNG.byteLength) },
    })));
  await assertFailure(response, 502, "file-rejected", "still has an image link");
});

test("successful original with invalid length is 502 file-rejected", async () => {
  const response = await call(await currentRevision(), STUDIO_ORIGIN,
    originalOverride(new Response(PNG, {
      status: 200,
      headers: { "content-type": "image/png", "content-length": "0" },
    })));
  await assertFailure(response, 502, "file-rejected");
});

test("the two diagnostic headers are exposed only to the Studio origin on file=0", async () => {
  const stale = "f".repeat(64);
  const studio = await call(stale, STUDIO_ORIGIN);
  await assertFailure(studio, 409, "revision-changed");
  assert.equal(studio.headers.get("access-control-allow-origin"), STUDIO_ORIGIN);
  assert.equal(studio.headers.get("access-control-expose-headers"), EXPOSED_HEADERS);
  assert.equal(studio.headers.get("vary"), "Origin");
  assert.equal(studio.headers.get("access-control-allow-credentials"), null);
  assert.equal(studio.headers.get("access-control-allow-methods"), null);
  assert.equal(studio.headers.get("access-control-max-age"), null);

  for (const origin of [null, "https://evil.example", "http://media.loftwah.com",
    "https://media.loftwah.com.evil.example"]) {
    const other = await call(stale, origin);
    assert.equal(other.headers.get("access-control-allow-origin"), null);
    assert.equal(other.headers.get("access-control-expose-headers"), null);
  }

  const otherIndex = await call(stale, STUDIO_ORIGIN, stubFetch, "1");
  assert.equal(otherIndex.headers.get("access-control-allow-origin"), null);
  assert.equal(otherIndex.headers.get("access-control-expose-headers"), null);
});

test("preview and index failures also carry bounded diagnostic headers", async () => {
  for (const index of ["preview", "1"]) {
    const response = await call("f".repeat(64), null, stubFetch, index);
    await assertFailure(response, 409, "revision-changed");
  }
});

test("each failure gets a distinct bounded UUID reference", async () => {
  const stale = "f".repeat(64);
  const first = await call(stale, STUDIO_ORIGIN);
  const second = await call(stale, STUDIO_ORIGIN);
  assert.match(first.headers.get(REQUEST_HEADER) ?? "", UUID_V4);
  assert.match(second.headers.get(REQUEST_HEADER) ?? "", UUID_V4);
  assert.notEqual(first.headers.get(REQUEST_HEADER), second.headers.get(REQUEST_HEADER));
});

test("failure logging carries only stage, reference and integer status", async () => {
  const revision = await currentRevision();
  const { value: response, logs } = await captureWarn(async () =>
    call(revision, STUDIO_ORIGIN, originalOverride(new Response(PNG, {
      status: 200,
      headers: { "content-type": "text/plain", "content-length": String(PNG.byteLength) },
    }))));
  await assertFailure(response, 502, "file-rejected");
  assert.equal(logs.length, 1);
  const line = logs[0][0];
  const entry = JSON.parse(line);
  assert.deepEqual(Object.keys(entry).sort(), ["request", "stage", "status"]);
  assert.equal(entry.stage, "file-rejected");
  assert.equal(entry.status, 502);
  assert.equal(entry.request, response.headers.get(REQUEST_HEADER));
  for (const leak of [ORIGINAL, PREVIEW, ASSET_ID, revision, "text/plain", "image/png"]) {
    assert.ok(!line.includes(leak), `log omits ${leak}`);
  }
});
