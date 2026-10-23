// Only the two authored, reviewed public MP4s use this transport. Access checks
// run in the Worker before this helper; ordinary static/admin routing is intact.
import { demoFilms, reviewedDemoFilms } from "./platform-demo.ts";

const origin = "https://composer.loftwah.com";
const films = new Map(
  reviewedDemoFilms(demoFilms).flatMap((film) =>
    film.status === "ready" ? [[film.video.href, film.video] as const] : [],
  ),
);
interface Assets {
  fetch(request: Request): Promise<Response>;
}
interface FilmCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<unknown>;
}
interface FilmCaches {
  open(name: string): Promise<FilmCache>;
}
const publicHeaders = [
  "range",
  "if-range",
  "if-none-match",
  "if-modified-since",
  "if-match",
  "if-unmodified-since",
];
const failure = () =>
  new Response("Film transport temporarily unavailable.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
const cancel = async (response: Response) => {
  await response.body?.cancel().catch(() => {});
};
const ifRangeMatches = (value: string | null, response: Response) => {
  if (value === null) return true;
  if (value.startsWith('"')) return value === response.headers.get("etag");
  const modified = response.headers.get("last-modified");
  // A weak/missing validator never authorizes combining partial representations.
  return (
    modified !== null &&
    value === modified &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toUTCString() === value
  );
};
const validPartial = (response: Response, bytes: number) => {
  const interval = response.headers
    .get("content-range")
    ?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  return (
    interval !== undefined &&
    interval !== null &&
    Number(interval[3]) === bytes &&
    Number(interval[1]) <= Number(interval[2]) &&
    Number(interval[2]) < bytes &&
    response.headers.get("content-length") ===
      String(Number(interval[2]) - Number(interval[1]) + 1) &&
    response.headers.get("content-type")?.split(";", 1)[0].trim() ===
      "video/mp4" &&
    !response.headers.has("content-encoding")
  );
};

export async function publicFilmAsset(
  request: Request,
  assets: Assets | undefined,
  storage: FilmCaches = globalThis.caches,
): Promise<Response | null> {
  const film = films.get(new URL(request.url).pathname as `/${string}`);
  if (!film) return null;
  if (!["GET", "HEAD"].includes(request.method))
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  if (!assets || film.bytes > 10 * 1024 * 1024) return failure();
  const headers = new Headers({ "Accept-Encoding": "identity" });
  for (const name of publicHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (request.method === "HEAD") {
    headers.delete("range");
    headers.delete("if-range");
  }
  const range = headers.get("range");
  // Multiple/unknown/malformed ranges retain the native Assets response. There
  // is no application multipart parser and no arbitrary asset or origin fetch.
  let partial =
    range !== null &&
    range.length <= 128 &&
    /^bytes=(?:\d+-\d*|-\d+)$/.test(range);
  let source: Response | undefined;
  try {
    source = await assets.fetch(
      new Request(origin + film.href, {
        method: request.method,
        headers,
        redirect: "manual",
        signal: request.signal,
      }),
    );
    if (
      source.status === 206 &&
      !ifRangeMatches(headers.get("if-range"), source)
    ) {
      await cancel(source);
      headers.delete("range");
      headers.delete("if-range");
      partial = false;
      source = await assets.fetch(
        new Request(origin + film.href, {
          method: request.method,
          headers,
          redirect: "manual",
          signal: request.signal,
        }),
      );
    }
    if (source.headers.has("set-cookie")) {
      await cancel(source);
      return failure();
    }
    if (
      source.status === 206 &&
      (!partial ||
        request.method !== "GET" ||
        !validPartial(source, film.bytes))
    ) {
      await cancel(source);
      return failure();
    }
    if (source.status !== 200) return source;
    if (
      source.headers.get("content-type")?.split(";", 1)[0].trim() !==
        "video/mp4" ||
      source.headers.get("content-length") !== String(film.bytes) ||
      ![null, "identity"].includes(source.headers.get("content-encoding"))
    ) {
      await cancel(source);
      return failure();
    }
    // Keep native HEAD and full/conditional reads, including uncommon native
    // preconditions the Cache API does not promise to implement.
    if (
      request.method === "HEAD" ||
      !partial ||
      headers.has("if-match") ||
      headers.has("if-unmodified-since") ||
      !ifRangeMatches(headers.get("if-range"), source)
    )
      return source;
    if (!source.body) return failure();

    const cache = await storage.open("composer-public-films-v1");
    const key = new Request(origin + film.href + "?film-sha256=" + film.sha256);
    const matchHeaders = new Headers();
    for (const name of ["range", "if-none-match", "if-modified-since"]) {
      const value = headers.get(name);
      if (value !== null) matchHeaders.set(name, value);
    }
    const lookup = new Request(key, { headers: matchHeaders });
    let response = await cache.match(lookup);
    if (response) await cancel(source);
    else {
      const stored = new Headers({
        "Content-Type": "video/mp4",
        "Content-Length": String(film.bytes),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
      });
      for (const name of ["etag", "last-modified"]) {
        const value = source.headers.get(name);
        if (value !== null) stored.set(name, value);
      }
      // The existing fixed-length Assets body streams directly to native cache.
      // No arrayBuffer, blob, clone/tee, application slicing or full-file buffer.
      await cache.put(key, new Response(source.body, { headers: stored }));
      response = await cache.match(lookup);
    }
    if (!response) return failure();
    const contentRange = response.headers.get("content-range");
    const valid =
      (response.status === 304 &&
        response.headers.get("etag") === source.headers.get("etag")) ||
      (response.status === 416 && contentRange === "bytes */" + film.bytes) ||
      (response.status === 206 &&
        validPartial(response, film.bytes) &&
        response.headers.get("etag") === source.headers.get("etag") &&
        response.headers.get("content-type") === "video/mp4");
    if (
      !valid ||
      response.headers.has("set-cookie") ||
      response.headers.has("content-encoding")
    ) {
      await cancel(response);
      return failure();
    }
    return response;
  } catch {
    if (source) await cancel(source);
    return failure();
  }
}
