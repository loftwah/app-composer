import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import build from "../../../lib/build.json";
import {
  INSIGHT_ID,
  INSIGHT_CARD,
  INSIGHT_CARD_TYPE,
  insightStatusFor,
} from "../../../lib/activity-insight";
import { insightFromParams } from "../../../lib/insight-source";
import { renderInsightImage } from "../../../lib/insight-share-image";

const base = () =>
  new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
const failure = (body: string, status: number) => {
  const headers = base();
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(body, { status, headers });
};

export const GET: APIRoute = async ({ params, request }) => {
  const headers = base();
  if (params.insight !== INSIGHT_ID)
    return failure("No public insight card exists at this address.", 404);
  const runtime = env as unknown as { DB?: D1Database };
  const result = await insightFromParams(
    runtime.DB,
    new URL(request.url).searchParams,
    { revision: build.commit },
  );
  // A withdrawn, empty or unavailable source fails closed: no earlier image is
  // served, so the card cannot outlive the public population it names.
  if (result.status !== "ok")
    return failure(result.reason, insightStatusFor(result.status));
  headers.set("Content-Type", INSIGHT_CARD_TYPE);
  headers.set("X-Insight-Card", `${INSIGHT_CARD.width}x${INSIGHT_CARD.height}`);
  if (request.method === "HEAD") return new Response(null, { headers });
  try {
    const image = await renderInsightImage(result.insight);
    headers.set("Content-Length", String(image.byteLength));
    return new Response(image, { headers });
  } catch {
    return failure("The insight card is temporarily unavailable.", 503);
  }
};

export const HEAD = GET;
