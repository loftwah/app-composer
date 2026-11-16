import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import { getRunRecord, isMediaRecord, listVotes } from "../../../../../lib/benchmark-runs.ts";
import { mediaExport, mediaExportFilename } from "../../../../../lib/benchmark-media.mjs";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const found = getRunRecord(params.id);
  if (!found || !isMediaRecord(found.record)) {
    return Response.json(
      { ok: false, error: "That media run is not recorded." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
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
  const evidence = mediaExport(found.record, votes, { votesAvailable });
  return new Response(`${JSON.stringify(evidence, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${mediaExportFilename(found.id)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
};
