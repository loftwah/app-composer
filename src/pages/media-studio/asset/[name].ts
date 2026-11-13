import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

type StoredObject = {
  body: ReadableStream | null;
  size: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};
type MediaBucket = { get(key: string): Promise<StoredObject | null> };

const types: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
};

/** Serve an owned import from the app's own R2. The name is the exact job id
 * plus extension written by the import action; nothing else is addressable. */
export const GET: APIRoute = async ({ params }) => {
  const name = String(params.name ?? "");
  if (!/^job_[a-z0-9]{21}\.(jpg|jpeg|png|webp|mp4)$/.test(name))
    return new Response("Not found", { status: 404 });
  const extension = name.split(".").pop() as string;
  const bucket = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
  if (!bucket) return new Response("Media storage is unavailable", { status: 503 });
  const object = await bucket.get("media-studio/" + name);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  headers.set("Content-Type", types[extension] ?? "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Length", String(object.size));
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
};
