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
    "Make a social kit on this device.",
    "Make 4 social sizes",
    "credited post text (TXT)",
    "Library → Import from Woodhouse Share",
    "Open Media Studio",
  ]) {
    assert.ok(source.includes(kept), `keeps: ${kept}`);
  }
});
