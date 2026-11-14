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
  "brand-916-motion.mp4": {
    type: "video/mp4",
    key: "media-studio/brand/brand-916-motion-20261114.mp4",
  },
};

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid" as const;
  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;
  if (start === null && end === null) return "invalid" as const;
  if (start === null) {
    start = Math.max(0, size - end!);
    end = size - 1;
  } else if (end === null) {
    end = size - 1;
  }
  end = Math.min(end, size - 1);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end)
    return "invalid" as const;
  return { offset: start, length: end - start + 1, start, end };
}

/** Range-capable film delivery from the app's own bucket, so HTML video can
 * seek. The response is a real 206 with Content-Range; a whole-file 200 is only
 * used when the request has no Range. */
export const GET: APIRoute = async ({ params, request }) => {
  const name = String(params.name ?? "");
  const file = files[name];
  if (!file) return notFound();
  const bucket = (env as unknown as { MEDIA?: Bucket }).MEDIA;
  if (!bucket) return new Response("Media storage is unavailable", { status: 503 });
  const head = await bucket.head(file.key);
  if (!head) return notFound();
  const range = parseRange(request.headers.get("range"), head.size);
  if (range === "invalid")
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${head.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  const object = await bucket.get(
    file.key,
    range ? { range: { offset: range.offset, length: range.length } } : undefined,
  );
  if (!object) return notFound();
  const headers = new Headers();
  headers.set("Content-Type", file.type);
  headers.set("Cache-Control", file.type.startsWith("video/") ? "public, max-age=86400" : "public, max-age=3600");
  headers.set("Content-Length", String(range ? range.length : object.size));
  headers.set("Accept-Ranges", "bytes");
  if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${head.size}`);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { status: range ? 206 : 200, headers });
};

export const HEAD: APIRoute = async (context) => {
  const response = await GET(context);
  return new Response(null, { status: response.status, headers: response.headers });
};
