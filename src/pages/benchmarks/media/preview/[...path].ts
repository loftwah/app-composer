import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getRunRecord } from "../../../../lib/benchmark-runs.ts";
import {
  mediaResponsePlan,
  mediaRunIdFor,
  mediaSideAsset,
} from "../../../../lib/benchmark-media.mjs";

export const prerender = false;

// The blind media page must not leak a model through a preview URL. It links to
// /benchmarks/media/preview/<run>/<pair>/<side>/(clip.mp4|poster.jpg), and this
// route resolves that opaque address to the committed Studio artifact on the
// server. The record holds the mapping; the request never does.
//
// The body comes from the Worker's ASSETS binding. Only the allowlisted file
// names and MIME types in the record are served, the committed byte count is
// enforced, and byte ranges are passed through so a video can seek.
interface Assets {
  fetch(request: Request): Promise<Response>;
}

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

const unavailable = () =>
  new Response("Media unavailable", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

export const GET: APIRoute = async ({ params, request }) => {
  const segments = String(params.path ?? "")
    .split("/")
    .filter(Boolean);
  if (segments.length !== 4) return notFound();
  const [runId, pairId, side, assetName] = segments;
  const found = getRunRecord(runId);
  if (!found || mediaRunIdFor(found.record) !== runId) return notFound();
  const asset = mediaSideAsset(found.record, pairId, side, assetName);
  if (!asset) return notFound();

  const assets = (env as unknown as { ASSETS?: Assets }).ASSETS;
  if (!assets || typeof assets.fetch !== "function") return unavailable();

  const headers = new Headers({ "Accept-Encoding": "identity" });
  for (const name of ["range", "if-range", "if-none-match", "if-modified-since"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (request.method === "HEAD") {
    headers.delete("range");
    headers.delete("if-range");
  }

  let source: Response;
  try {
    source = await assets.fetch(
      new Request(new URL(asset.publicPath, request.url), {
        method: request.method,
        headers,
        redirect: "manual",
        signal: request.signal,
      }),
    );
  } catch {
    return unavailable();
  }

  const plan = mediaResponsePlan(asset, source.status, source.headers, request.method);
  if (!plan.ok) {
    await source.body?.cancel().catch(() => {});
    return plan.status === 404 ? notFound() : unavailable();
  }
  if (plan.body === null) {
    await source.body?.cancel().catch(() => {});
    return new Response(null, { status: plan.status, headers: plan.headers });
  }
  if (!source.body) return unavailable();
  return new Response(source.body, { status: plan.status, headers: plan.headers });
};
