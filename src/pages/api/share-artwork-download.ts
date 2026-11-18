import type { APIRoute } from "astro";
import {
  artworkFiles,
  artworkRevision,
  publicShareArtwork,
} from "../../lib/share-catalogue-asset.ts";

const maxBytes = 32 * 1024 * 1024;
const mimeTypes: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const error = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get("id") ?? "";
  const index = url.searchParams.get("file") ?? "";
  const revision = url.searchParams.get("revision") ?? "";
  if ((index !== "preview" && !/^\d{1,2}$/.test(index)) || !/^[a-f0-9]{64}$/.test(revision))
    return error(400, "Choose a file from the artwork page.");
  const result = await publicShareArtwork(id);
  if (result.status !== 200)
    return error(
      result.status,
      result.status === 404
        ? "Artwork is no longer public."
        : "Artwork is temporarily unavailable.",
    );
  const file = index === "preview"
    ? { url: result.artwork.previewUrl }
    : artworkFiles(result.artwork)[Number(index)];
  if (!file || (await artworkRevision(result.artwork)) !== revision)
    return error(
      409,
      "The file has changed. Reopen the artwork page to choose the current file.",
    );

  try {
    const pathname = new URL(file.url).pathname;
    const extension = pathname.split(".").at(-1)?.toLowerCase() ?? "";
    const mime = mimeTypes[extension];
    const upstream = await fetch(file.url, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const length = Number(upstream.headers.get("content-length"));
    if (
      !upstream.ok ||
      !upstream.body ||
      !mime ||
      upstream.headers.get("content-type")?.split(";")[0] !== mime ||
      length < 1 ||
      length > maxBytes
    ) {
      await upstream.body?.cancel().catch(() => {});
      return error(
        502,
        "The download is unavailable. The artwork page still has an image link.",
      );
    }
    let received = 0;
    const body = upstream.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength;
          if (received > maxBytes)
            controller.error(Error("Artwork file exceeds download limit."));
          else controller.enqueue(chunk);
        },
      }),
    );
    return new Response(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${id}${Number(index) ? `-${index}` : ""}.${extension}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return error(502, "The artwork file could not be reached. Try again.");
  }
};
