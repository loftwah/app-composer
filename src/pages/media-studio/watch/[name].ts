import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

type StoredObject = {
  body: ReadableStream | null;
  size: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};
type Bucket = { get(key: string, options?: { range?: { offset: number; length: number } }): Promise<StoredObject | null>; head(key: string): Promise<{ size: number } | null> };

const files: Record<string, { type: string; key: string }> = {
  "overview.mp4": { type: "video/mp4", key: "media-studio/films/overview.mp4" },
  "walkthrough.mp4": { type: "video/mp4", key: "media-studio/films/walkthrough.mp4" },
  "overview.vtt": { type: "text/vtt; charset=utf-8", key: "media-studio/films/overview.vtt" },
  "walkthrough.vtt": { type: "text/vtt; charset=utf-8", key: "media-studio/films/walkthrough.vtt" },
  "overview.srt": { type: "text/plain; charset=utf-8", key: "media-studio/films/overview.srt" },
  "walkthrough.srt": { type: "text/plain; charset=utf-8", key: "media-studio/films/walkthrough.srt" },
  "overview.txt": { type: "text/plain; charset=utf-8", key: "media-studio/films/overview.txt" },
  "walkthrough.txt": { type: "text/plain; charset=utf-8", key: "media-studio/films/walkthrough.txt" },
  "overview-poster.jpg": { type: "image/jpeg", key: "media-studio/films/overview-poster.jpg" },
  "walkthrough-poster.jpg": { type: "image/jpeg", key: "media-studio/films/walkthrough-poster.jpg" },
};

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

/** Range-capable film delivery from the app's own bucket, so HTML video can
 * seek. Static assets answered the whole file and browsers could not seek. */
export const GET: APIRoute = async ({ params, request }) => {
  const name = String(params.name ?? "");
  const file = files[name];
  if (!file) return notFound();
  const bucket = (env as unknown as { MEDIA?: Bucket }).MEDIA;
  if (!bucket) return new Response("Media storage is unavailable", { status: 503 });
  const range = request.headers.get("range");
  let object: StoredObject | null = null;
  let status = 200;
  let contentRange: string | null = null;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) return new Response("Unsupported range", { status: 416 });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : undefined;
    const length = end === undefined ? undefined : Math.max(1, end - start + 1);
    const head = await bucket.head(file.key);
    const total = head?.size ?? 0;
    object = await bucket.get(file.key, length === undefined ? undefined : { range: { offset: start, length } });
    if (object && total > 0) {
      status = 206;
      contentRange = `bytes ${start}-${start + object.size - 1}/${total}`;
    }
  } else {
    object = await bucket.get(file.key);
  }
  if (!object) return notFound();
  const headers = new Headers();
  headers.set("Content-Type", file.type);
  headers.set("Cache-Control", file.type.startsWith("video/") ? "public, max-age=86400" : "public, max-age=3600");
  headers.set("Accept-Ranges", "bytes");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Length", String(object.size));
  if (contentRange) headers.set("Content-Range", contentRange);
  object.writeHttpMetadata(headers);
  // The bucket object's own metadata may be generic; the route owns the type.
  headers.set("Content-Type", file.type);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { status, headers });
};

export const HEAD: APIRoute = async (context) => {
  const response = await GET(context);
  return new Response(null, { status: response.status, headers: response.headers });
};
