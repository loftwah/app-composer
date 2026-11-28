import type { APIRoute } from "astro";
import type { D1Database } from "@cloudflare/workers-types";
import { env } from "cloudflare:workers";
import { decisionImageTypes } from "../lib/portfolio-decision-contract.ts";

export const prerender = false;

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export const GET: APIRoute = async ({ locals, params }) => {
  const missing = () => new Response(null, { status: 404, headers });
  const owner = locals.user;
  const revision = Number(params.revision);
  if (
    owner?.role !== 50 ||
    !/^[a-z][a-z0-9-]{1,63}$/.test(params.id ?? "") ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return missing();
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) return new Response(null, { status: 503, headers });
  const image = await db
    .prepare(
      `
    SELECT image_type, image_data FROM composer_decision_responses
    WHERE owner_id = ? AND decision_id = ? AND revision = ? AND image_revision = revision
  `,
    )
    .bind(owner.id, params.id, revision)
    .first<{
      image_type: (typeof decisionImageTypes)[number];
      image_data: string;
    }>();
  if (!image?.image_data || !decisionImageTypes.includes(image.image_type))
    return missing();
  return new Response(
    Uint8Array.from(atob(image.image_data), (byte) => byte.charCodeAt(0)),
    {
      headers: { ...headers, "Content-Type": image.image_type },
    },
  );
};
