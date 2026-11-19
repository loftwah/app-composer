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

// The only origin allowed to read this public download in the browser. It is
// never reflected from the request, and no credentials are involved.
const STUDIO_ORIGIN = "https://media.loftwah.com";

// Fixed, coordinated wire contract for the Studio handoff (#477). These are
// the only stages the download ever emits; no request data is interpolated.
const FAILURE_HEADER = "X-Composer-Artwork-Failure";
const REQUEST_HEADER = "X-Composer-Artwork-Request";
const EXPOSED_HEADERS = `${FAILURE_HEADER}, ${REQUEST_HEADER}`;

type FailureStage =
  | "invalid-request"
  | "artwork-unavailable"
  | "revision-changed"
  | "catalogue-unavailable"
  | "file-unavailable"
  | "file-timeout"
  | "file-rejected";

function withStudioCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  headers.set("Vary", "Origin");
  if (origin === STUDIO_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", STUDIO_ORIGIN);
    // Only this fixed origin on the original file may read the two diagnostic
    // headers. No other CORS header or value is added or widened.
    headers.set("Access-Control-Expose-Headers", EXPOSED_HEADERS);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// A public-safe reference: a standard v4 UUID, so its format is fixed and
// bounded. Generated only for a failure response; successes carry no headers.
// Only upstream failures are logged, with the stage, generated reference
// and integer status. URLs, inputs and upstream bodies stay out of the log.
function fail(status: number, message: string, stage: FailureStage): Response {
  const reference = crypto.randomUUID();
  if (status >= 500) console.warn(JSON.stringify({ stage, request: reference, status }));
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      [FAILURE_HEADER]: stage,
      [REQUEST_HEADER]: reference,
    },
  });
}

const handle: APIRoute = async ({ url }) => {
  const id = url.searchParams.get("id") ?? "";
  const index = url.searchParams.get("file") ?? "";
  const revision = url.searchParams.get("revision") ?? "";
  if ((index !== "preview" && !/^\d{1,2}$/.test(index)) || !/^[a-f0-9]{64}$/.test(revision))
    return fail(400, "Choose a file from the artwork page.", "invalid-request");

  const result = await publicShareArtwork(id);
  if (result.status === 404)
    return fail(404, "Artwork is no longer public.", "artwork-unavailable");
  if (result.status === 503)
    return fail(503, "Artwork is temporarily unavailable.", "catalogue-unavailable");

  const file = index === "preview"
    ? { url: result.artwork.previewUrl }
    : artworkFiles(result.artwork)[Number(index)];
  if (!file || (await artworkRevision(result.artwork)) !== revision)
    return fail(
      409,
      "The file has changed. Reopen the artwork page to choose the current file.",
      "revision-changed",
    );

  const signal = AbortSignal.timeout(30_000);
  try {
    const pathname = new URL(file.url).pathname;
    const extension = pathname.split(".").at(-1)?.toLowerCase() ?? "";
    const mime = mimeTypes[extension];
    const upstream = await fetch(file.url, {
      redirect: "manual",
      signal,
    });

    // An unexpected upstream response or a transport failure is a missing
    // source file, not a validation rejection of an otherwise good response.
    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => {});
      return fail(
        502,
        "The download is unavailable. The artwork page still has an image link.",
        "file-unavailable",
      );
    }

    const length = Number(upstream.headers.get("content-length"));
    if (
      !upstream.body ||
      !mime ||
      upstream.headers.get("content-type")?.split(";")[0] !== mime ||
      !Number.isSafeInteger(length) ||
      length < 1 ||
      length > maxBytes
    ) {
      await upstream.body?.cancel().catch(() => {});
      return fail(
        502,
        "The download is unavailable. The artwork page still has an image link.",
        "file-rejected",
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
  } catch (error) {
    // Only a genuine signal timeout is a 504; every other fetch fault stays a
    // 502 file-unavailable. The stream limit above is unchanged and stays
    // post-body, so it cannot be reclassified here.
    if (signal.aborted || (error instanceof DOMException && error.name === "TimeoutError"))
      return fail(504, "The artwork file could not be reached. Try again.", "file-timeout");
    return fail(502, "The artwork file could not be reached. Try again.", "file-unavailable");
  }
};

export const GET: APIRoute = async (context) => {
  const response = await handle(context);
  if (context.url.searchParams.get("file") !== "0") return response;
  return withStudioCors(response, context.request?.headers.get("origin") ?? null);
};
