import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { publicFilmAsset } from "../src/lib/public-film-assets.ts";

const path = "/media-studio/demos/pippa-clip-workflow-20261115.mp4";
const bytes = await readFile(new URL("../public" + path, import.meta.url));
const digest =
  "12f4e3331a61d404ddfeaace4f525d3446926daee549836d50b01289a325f390";
const etag = '"pippa-test"';

// A small in-memory stand-in for Cloudflare's range-capable cache, used only to
// exercise the existing transport against the real committed film bytes.
class FixedLengthStream extends TransformStream {
  constructor() {
    super();
  }
}
const previous = globalThis.FixedLengthStream;
globalThis.FixedLengthStream = FixedLengthStream;
const assets = {
  async fetch() {
    return new Response(bytes, {
      headers: {
        "content-type": "video/mp4",
        "content-length": String(bytes.length),
        etag,
      },
    });
  },
};
let cached;
const cache = {
  async put(_key, response) {
    cached = new Uint8Array(await response.arrayBuffer());
  },
  async match(request) {
    if (!cached) return undefined;
    const match = /^bytes=(\d+)-(\d*)$/.exec(
      request.headers.get("range") || "",
    );
    if (!match) return undefined;
    const start = Number(match[1]);
    if (start >= cached.length)
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${cached.length}` },
      });
    const end = Math.min(
      match[2] ? Number(match[2]) : cached.length - 1,
      cached.length - 1,
    );
    return new Response(cached.slice(start, end + 1), {
      status: 206,
      headers: {
        "content-type": "video/mp4",
        "content-range": `bytes ${start}-${end}/${cached.length}`,
        "content-length": String(end - start + 1),
        etag,
      },
    });
  },
};
const storage = {
  async open() {
    return cache;
  },
};

test("the allowlisted Pippa film metadata matches its committed bytes", () => {
  assert.equal(bytes.length, 597299);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), digest);
});
test("Pippa video responds with seekable and unsatisfiable ranges", async () => {
  const response = await publicFilmAsset(
    new Request("https://composer.loftwah.com" + path, {
      headers: { range: "bytes=0-1023" },
    }),
    assets,
    storage,
  );
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(
    response.headers.get("content-range"),
    `bytes 0-1023/${bytes.length}`,
  );
  assert.deepEqual(
    new Uint8Array(await response.arrayBuffer()),
    new Uint8Array(bytes.subarray(0, 1024)),
  );
  const invalid = await publicFilmAsset(
    new Request("https://composer.loftwah.com" + path, {
      headers: { range: `bytes=${bytes.length}-` },
    }),
    assets,
    storage,
  );
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get("content-range"), `bytes */${bytes.length}`);
  assert.equal(
    await publicFilmAsset(
      new Request("https://composer.loftwah.com/not-public.mp4"),
      assets,
      storage,
    ),
    null,
  );
});
test.after(() => {
  globalThis.FixedLengthStream = previous;
});
