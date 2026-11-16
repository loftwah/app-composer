import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import {
  buildRunEvidence,
  exportFilename,
  getRunRecord,
  isMediaRecord,
  listVotes,
} from "../../../../lib/benchmark-runs.ts";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const found = getRunRecord(params.id);
  if (found && isMediaRecord(found.record)) {
    return Response.redirect(
      new URL(`/benchmarks/media/runs/${encodeURIComponent(found.id)}/export.json`, request.url),
      302,
    );
  }
  if (!found)
    return Response.json({ ok: false, error: "That run is not recorded." }, { status: 404 });
  const runtime = env as unknown as { DB?: D1Database };
  let votes: Awaited<ReturnType<typeof listVotes>> = [];
  let votesAvailable = false;
  if (runtime.DB && typeof runtime.DB.prepare === "function") {
    try {
      votes = await listVotes(runtime.DB, found.id);
      votesAvailable = true;
    } catch {
      votesAvailable = false;
    }
  }
  const evidence = buildRunEvidence(found.record, votes, { votesAvailable });
  return new Response(`${JSON.stringify(evidence, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(found.id)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
};
