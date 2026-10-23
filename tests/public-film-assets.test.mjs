import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { publicFilmAsset } from "../src/lib/public-film-assets.ts";
import { demoFilms } from "../src/lib/platform-demo.ts";

// Labelled Node stream contract double, not native workerd evidence. The
// admitted runtime diagnostic separately proves the real FixedLengthStream.
const originalFixedLengthStream = globalThis.FixedLengthStream;
globalThis.FixedLengthStream = class {
  constructor(expected) {
    let count = 0;
    const stream = new TransformStream({
      transform(chunk, controller) {
        count += chunk.byteLength;
        if (count > expected) throw Error("Fixed length overflow");
        controller.enqueue(chunk);
      },
      flush() {
        if (count !== expected) throw Error("Fixed length underflow");
      },
    });
    this.readable = stream.readable;
    this.writable = stream.writable;
  }
};
test.after(() => {
  if (originalFixedLengthStream === undefined)
    delete globalThis.FixedLengthStream;
  else globalThis.FixedLengthStream = originalFixedLengthStream;
});

const ready = demoFilms.filter((film) => film.status === "ready");
const film = ready[0],
  path = film.video.href;
const bytes = readFileSync(new URL("../public" + path, import.meta.url));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const etag = '"fixture-' + film.video.sha256 + '"';
const modified = "Fri, 23 Oct 2026 12:00:00 GMT";
const request = (range, headers = {}, method = "GET", selected = path) =>
  new Request("https://composer.loftwah.com" + selected, {
    method,
    headers: { ...(range === undefined ? {} : { Range: range }), ...headers },
  });

// Labelled Cache API/Assets doubles: only tests collect bytes to model native
// cache storage. Production delegates range slicing and streaming to workerd.
function fixture(options = {}) {
  const calls = [],
    lookups = [],
    puts = [],
    stats = { cancelled: 0, chunks: 0 },
    tasks = [];
  let stored;
  const partial = (req, body, headers) => {
    if (
      [headers.get("etag"), "W/" + headers.get("etag")].includes(
        req.headers.get("if-none-match"),
      )
    )
      return new Response(null, {
        status: 304,
        headers: { ETag: headers.get("etag") },
      });
    const parts = req.headers.get("range").match(/^bytes=(\d*)-(\d*)$/);
    const suffix = parts[1] === "";
    const start = suffix
      ? Math.max(0, body.length - Number(parts[2]))
      : Number(parts[1]);
    const end =
      suffix || parts[2] === ""
        ? body.length - 1
        : Math.min(Number(parts[2]), body.length - 1);
    if (
      start >= body.length ||
      end < start ||
      (suffix && Number(parts[2]) === 0)
    )
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": "bytes */" + body.length },
      });
    const selected = body.subarray(start, end + 1);
    const responseHeaders = new Headers(headers);
    responseHeaders.set(
      "Content-Range",
      `bytes ${start}-${end}/${body.length}`,
    );
    responseHeaders.set("Content-Length", String(selected.length));
    return new Response(selected, { status: 206, headers: responseHeaders });
  };
  const cache = {
    async put(key, response) {
      puts.push(key);
      if (options.cacheFailure) throw Error("Cache unavailable");
      assert.equal(key.method, "GET");
      assert.equal([...key.headers].length, 0);
      assert.equal(response.status, 200);
      assert.equal(response.headers.has("set-cookie"), false);
      stored = {
        bytes: Buffer.from(await response.arrayBuffer()),
        headers: new Headers(response.headers),
      };
      assert.equal(stored.bytes.length, film.video.bytes);
    },
    async match(req) {
      lookups.push(req);
      if (!stored) return undefined;
      if (options.cacheIgnoresRange)
        return new Response(stored.bytes, { headers: stored.headers });
      return partial(req, stored.bytes, stored.headers);
    },
  };
  const storage = {
    async open(name) {
      assert.equal(name, "composer-public-films-v1");
      return cache;
    },
  };
  const assets = {
    async fetch(req) {
      calls.push(req);
      const headers = new Headers({
        "Content-Type": "video/mp4",
        "Content-Length": String(film.video.bytes),
        ETag: etag,
        "Last-Modified": modified,
        "Cache-Control": "public, max-age=0, must-revalidate",
      });
      if (options.encoding) headers.set("Content-Encoding", options.encoding);
      if (options.type) headers.set("Content-Type", options.type);
      if (options.length) headers.set("Content-Length", options.length);
      if (options.unknownLength) headers.delete("Content-Length");
      if (options.cookie) headers.set("Set-Cookie", "fictional-private=secret");
      if (req.headers.get("if-none-match") === etag)
        return new Response(null, { status: 304, headers });
      if (req.headers.has("if-match") && req.headers.get("if-match") !== etag)
        return new Response(null, { status: 412, headers });
      if (options.missing) return new Response(null, { status: 404 });
      if (req.method === "HEAD") return new Response(null, { headers });
      if (options.nativeRange && req.headers.has("range"))
        return partial(req, bytes, headers);
      let offset = 0;
      const body = options.shortBody
        ? bytes.subarray(0, bytes.length - 1)
        : options.longBody
          ? Buffer.concat([bytes, Buffer.from([0])])
          : bytes;
      const stream = new ReadableStream(
        {
          pull(controller) {
            if (options.sourceError && offset > 0) {
              controller.error(Error("Source interrupted"));
              return;
            }
            if (offset === body.length) {
              controller.close();
              return;
            }
            const end = Math.min(offset + 65536, body.length);
            stats.chunks++;
            controller.enqueue(body.subarray(offset, end));
            offset = end;
          },
          cancel() {
            stats.cancelled++;
          },
        },
        { highWaterMark: 0 },
      );
      return new Response(stream, { headers });
    },
  };
  return {
    assets,
    storage,
    calls,
    puts,
    lookups,
    stats,
    tasks,
    run: (req) =>
      publicFilmAsset(req, assets, storage, {
        waitUntil(task) {
          tasks.push(task);
        },
      }),
  };
}

test("only exact reviewed MP4s run Worker-first, adapter retains explicit ASSETS and preview stays separate", async () => {
  const config = JSON.parse(
    readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  );
  assert.equal(config.assets.binding, "ASSETS");
  assert.deepEqual(
    config.assets.run_worker_first,
    ready.map((entry) => entry.video.href),
  );
  assert.equal(ready.length, 2);
  assert.deepEqual(config.env.preview.services, []);
  for (const name of ["d1_databases", "r2_buckets", "kv_namespaces"])
    assert.notDeepEqual(config.env.preview[name], config[name]);
  const require = createRequire(import.meta.url);
  const adapter = dirname(require.resolve("@astrojs/cloudflare"));
  const { cloudflareConfigCustomizer } = await import(
    pathToFileURL(join(adapter, "wrangler.js")).href
  );
  const changes = cloudflareConfigCustomizer()(config);
  assert.equal(changes.assets, undefined); // Explicit binding prevents adapter overwrite.
  assert.deepEqual(
    {
      ...config,
      ...Object.fromEntries(
        Object.entries(changes).filter(([, value]) => value !== undefined),
      ),
    }.assets,
    config.assets,
  );
  const worker = readFileSync(
    new URL("../src/worker.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    worker.indexOf("if(rejection)return rejection;") <
      worker.indexOf("await publicFilmAsset("),
  );
  assert.ok(
    worker.indexOf("await publicFilmAsset(") <
      worker.indexOf("await handler.fetch!"),
  );
  assert.equal(bytes.length, film.video.bytes);
  assert.equal(sha(bytes), film.video.sha256);
});

for (const [range, start, end] of [
  ["bytes=0-", 0, bytes.length - 1],
  ["bytes=0-127", 0, 127],
  ["bytes=1000000-1000127", 1000000, 1000127],
  ["bytes=2000000-", 2000000, bytes.length - 1],
  ["bytes=-128", bytes.length - 128, bytes.length - 1],
  ["bytes=2000000-9999999", 2000000, bytes.length - 1],
])
  test("native cache fallback serves exact bytes for " + range, async () => {
    const f = fixture(),
      response = await f.run(request(range));
    assert.equal(response.status, 206);
    assert.equal(
      response.headers.get("content-range"),
      `bytes ${start}-${end}/${bytes.length}`,
    );
    assert.equal(
      response.headers.get("content-length"),
      String(end - start + 1),
    );
    assert.equal(response.headers.get("accept-ranges"), "bytes");
    assert.equal(
      sha(Buffer.from(await response.arrayBuffer())),
      sha(bytes.subarray(start, end + 1)),
    );
    assert.equal(f.puts.length, 1);
    assert.equal(
      new URL(f.puts[0].url).searchParams.get("film-sha256"),
      film.video.sha256,
    );
  });

test("out-of-bounds range returns native cache 416 and complete resource length", async () => {
  const f = fixture(),
    response = await f.run(request(`bytes=${bytes.length}-`));
  assert.equal(response.status, 416);
  assert.equal(
    response.headers.get("content-range"),
    "bytes */" + bytes.length,
  );
  assert.equal((await response.arrayBuffer()).byteLength, 0);
});

test("warm range reuses cache and cancels the unused fresh source body without reading it", async () => {
  const f = fixture();
  await (await f.run(request("bytes=0-127"))).arrayBuffer();
  const chunks = f.stats.chunks;
  await (await f.run(request("bytes=100-199"))).arrayBuffer();
  assert.equal(f.puts.length, 1);
  assert.equal(f.stats.cancelled, 1);
  assert.equal(f.stats.chunks, chunks);
});

test("native ASSETS 206 and conditional 304/412 pass through without fabricated cache responses", async () => {
  const f = fixture({ nativeRange: true });
  const native = await f.run(request("bytes=100-199"));
  assert.equal(native.status, 206);
  assert.equal(
    sha(Buffer.from(await native.arrayBuffer())),
    sha(bytes.subarray(100, 200)),
  );
  assert.equal(f.puts.length, 0);
  const notModified = await f.run(
    request("bytes=0-", { "If-None-Match": etag }),
  );
  assert.equal(notModified.status, 304);
  assert.equal(notModified.body, null);
  const stale = await f.run(request("bytes=0-", { "If-Match": '"old"' }));
  assert.equal(stale.status, 412);
  assert.equal(f.puts.length, 0);
});

for (const [value, status] of [
  [etag, 206],
  [modified, 206],
  ['"old"', 200],
  ["W/" + etag, 200],
  ["Thu, 22 Oct 2026 12:00:00 GMT", 200],
])
  test(
    "If-Range matches only the same strong representation: " + value,
    async () => {
      const f = fixture(),
        response = await f.run(request("bytes=100-199", { "If-Range": value }));
      assert.equal(response.status, status);
      assert.equal(
        (await response.arrayBuffer()).byteLength,
        status === 206 ? 100 : bytes.length,
      );
      assert.equal(f.puts.length, status === 206 ? 1 : 0);
    },
  );

test("HEAD ignores Range, retains native length/ETag and has no body or cache mutation", async () => {
  const f = fixture(),
    response = await f.run(request("bytes=100-199", {}, "HEAD"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), String(bytes.length));
  assert.equal(response.headers.get("etag"), etag);
  assert.equal(response.body, null);
  assert.equal(f.calls[0].method, "HEAD");
  assert.equal(f.calls[0].headers.has("range"), false);
  assert.equal(f.puts.length, 0);
});

test("a stale If-Range never uses partial content even when the native Assets double ignores that validator", async () => {
  const f = fixture({ nativeRange: true });
  const response = await f.run(
    request("bytes=100-199", { "If-Range": '"old"' }),
  );
  assert.equal(response.status, 200);
  assert.equal((await response.arrayBuffer()).byteLength, bytes.length);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].headers.has("range"), false);
  assert.equal(f.calls[1].headers.has("if-range"), false);
  assert.equal(f.puts.length, 0);
});

test("a warm cache respects weak If-None-Match without returning partial bytes", async () => {
  const f = fixture();
  await (await f.run(request("bytes=0-127"))).arrayBuffer();
  const response = await f.run(
    request("bytes=0-127", { "If-None-Match": "W/" + etag }),
  );
  assert.equal(response.status, 304);
  assert.equal(response.body, null);
  assert.equal(f.puts.length, 1);
});

test("cache/body safety rejects wrong size, encoding, type, cookies or a cache that silently ignores Range", async () => {
  for (const options of [
    { length: "1" },
    { encoding: "gzip" },
    { type: "text/html" },
    { cookie: true },
    { cacheFailure: true },
    { cacheIgnoresRange: true },
  ]) {
    const f = fixture(options),
      response = await f.run(request("bytes=0-127"));
    assert.equal(response.status, 503, JSON.stringify(options));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.has("set-cookie"), false);
    await response.body?.cancel();
  }
});

test("public binding/cache requests never inherit cookies, auth, client origins, query selectors or unsupported assets", async () => {
  const f = fixture();
  const response = await f.run(
    new Request(
      "https://untrusted.invalid" +
        path +
        "?url=https://elsewhere.invalid/secret",
      {
        headers: {
          Range: "bytes=0-127",
          Cookie: "native=session",
          Authorization: "Bearer secret",
          "Cf-Access-Jwt-Assertion": "private",
          Origin: "https://elsewhere.invalid",
        },
      },
    ),
  );
  assert.equal(response.status, 206);
  await response.body.cancel();
  for (const call of [...f.calls, ...f.puts, ...f.lookups]) {
    assert.equal(new URL(call.url).origin, "https://composer.loftwah.com");
    for (const name of [
      "cookie",
      "authorization",
      "cf-access-jwt-assertion",
      "origin",
    ])
      assert.equal(call.headers.has(name), false);
    assert.equal(call.url.includes("elsewhere"), false);
  }
  const before = f.calls.length;
  for (const selected of [
    "/_emdash/admin",
    "/_emdash/api/users",
    "/demos/other.mp4",
    "/brand/private.mp4",
    path + "/child",
    path.replace("demos", "%64emos"),
  ])
    assert.equal(await f.run(request("bytes=0-1", {}, "GET", selected)), null);
  assert.equal(f.calls.length, before);
  assert.equal((await f.run(request(undefined, {}, "POST"))).status, 405);
  assert.equal(f.calls.length, before);
});

test("full GET, missing asset and unsupported/multipart ranges retain native Assets behavior", async () => {
  for (const range of [undefined, "items=0-1", "bytes=0-1,4-5", "bytes=oops"]) {
    const f = fixture(),
      response = await f.run(request(range));
    assert.equal(response.status, 200);
    assert.equal((await response.arrayBuffer()).byteLength, bytes.length);
    assert.equal(f.puts.length, 0);
  }
  const f = fixture({ missing: true });
  assert.equal((await f.run(request("bytes=0-1"))).status, 404);
  assert.equal(f.puts.length, 0);
});

test("missing internal ASSETS length uses exact-length stream for cold and warm ranges", async () => {
  const f = fixture({ unknownLength: true });
  const first = await f.run(request("bytes=0-127"));
  assert.equal(first.status, 206);
  assert.equal(
    sha(Buffer.from(await first.arrayBuffer())),
    sha(bytes.subarray(0, 128)),
  );
  const chunks = f.stats.chunks;
  const second = await f.run(request("bytes=-128"));
  assert.equal(second.status, 206);
  assert.equal(
    sha(Buffer.from(await second.arrayBuffer())),
    sha(bytes.subarray(-128)),
  );
  assert.equal(f.stats.chunks, chunks);
  assert.equal(f.stats.cancelled, 1);
});

test("unknown-length full reads have exact metadata and an owned producer lifetime", async () => {
  const f = fixture({ unknownLength: true });
  const response = await f.run(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), String(bytes.length));
  assert.equal(f.tasks.length, 1);
  assert.equal(f.puts.length, 0);
  assert.equal(
    sha(Buffer.from(await response.arrayBuffer())),
    film.video.sha256,
  );
  await Promise.all(f.tasks);
});

test("unknown-length HEAD returns trusted length without consuming or caching a body", async () => {
  const f = fixture({ unknownLength: true });
  const response = await f.run(request("bytes=0-", {}, "HEAD"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), String(bytes.length));
  assert.equal(response.headers.get("etag"), etag);
  assert.equal(response.body, null);
  assert.equal(f.stats.chunks, 0);
  assert.equal(f.puts.length, 0);
  assert.equal(f.tasks.length, 0);
});

for (const option of ["shortBody", "longBody", "sourceError"])
  test(
    "cache fill refuses " + option + " without partial success or a retry",
    { timeout: 2000 },
    async () => {
      const f = fixture({ unknownLength: true, [option]: true });
      const response = await f.run(request("bytes=0-127"));
      assert.equal(response.status, 503);
      assert.equal(f.calls.length, 1);
      assert.equal(f.puts.length, 1);
      assert.equal(f.lookups.length, 1);
    },
  );

test(
  "cache rejection aborts the owned producer promptly",
  { timeout: 2000 },
  async () => {
    const f = fixture({ unknownLength: true, cacheFailure: true });
    assert.equal((await f.run(request("bytes=0-127"))).status, 503);
    assert.equal(f.stats.cancelled, 1);
    assert.ok(f.stats.chunks <= 1);
  },
);

test("full-read underflow errors the response rather than declaring a complete film", async () => {
  const f = fixture({ unknownLength: true, shortBody: true });
  const response = await f.run(request());
  assert.equal(response.status, 200);
  await assert.rejects(response.arrayBuffer(), /underflow/);
  await Promise.all(f.tasks);
});

test(
  "downstream cancellation terminates the full-read producer",
  { timeout: 2000 },
  async () => {
    const f = fixture({ unknownLength: true });
    const response = await f.run(request());
    await response.body.cancel("Viewer left");
    await Promise.all(f.tasks);
    assert.equal(f.stats.cancelled, 1, JSON.stringify(f.stats));
  },
);

test(
  "aborted request cancels source and cannot populate the range cache",
  { timeout: 2000 },
  async () => {
    const f = fixture({ unknownLength: true });
    const controller = new AbortController();
    const selected = new Request(request("bytes=0-127"), {
      signal: controller.signal,
    });
    controller.abort();
    assert.equal((await f.run(selected)).status, 503);
    assert.equal(f.stats.cancelled, 1);
    assert.equal(f.lookups.length, 1);
  },
);

test(
  "request abort releases an unread full response and its owned task",
  { timeout: 2000 },
  async () => {
    const f = fixture({ unknownLength: true });
    const controller = new AbortController();
    const response = await f.run(
      new Request(request(), { signal: controller.signal }),
    );
    assert.equal(response.status, 200);
    assert.equal(f.tasks.length, 1);
    controller.abort();
    await Promise.all(f.tasks);
    assert.equal(f.stats.cancelled, 1, JSON.stringify(f.stats));
  },
);
