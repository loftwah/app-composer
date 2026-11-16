import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import {
  appendVote,
  getRunRecord,
  independentTokenCount,
  listVotes,
  listVotesForToken,
  pairTallies,
  REVIEWER_TOKEN_HEADER,
  REVIEWER_TOKEN_PATTERN,
  revealPair,
  runIdFor,
  validateVote,
  voteOriginAllowed,
} from "../../lib/benchmark-runs.ts";

export const prerender = false;

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

function database() {
  const runtime = env as unknown as { DB?: D1Database };
  return runtime.DB && typeof runtime.DB.prepare === "function" ? runtime.DB : null;
}

/** The browser token travels in a header, never the URL, so it does not land in
 * request logs. It is random and is not an identity. */
function tokenHeader(request: Request): string | null {
  const value = request.headers.get(REVIEWER_TOKEN_HEADER);
  if (value === null) return null;
  const token = value.trim().toLowerCase();
  return REVIEWER_TOKEN_PATTERN.test(token) ? token : "";
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const runId = url.searchParams.get("run") ?? "";
  const found = getRunRecord(runId);
  if (!found)
    return json({ ok: false, code: "unknown-run", error: "That run is not recorded." }, 404);
  const token = tokenHeader(request);
  if (token === "")
    return json(
      { ok: false, code: "invalid-token", error: "Reviewer token is not valid." },
      400,
    );
  const db = database();
  if (!db)
    return json(
      { ok: false, code: "unavailable", error: "The benchmark vote record is unavailable in this environment." },
      503,
    );
  try {
    // One read is scoped to this browser token; the other is the label-free
    // tally any blind page may show. Another browser's row never arrives with a
    // reveal attached.
    const [own, all] = await Promise.all([
      token ? listVotesForToken(db, found.id, token) : Promise.resolve([]),
      listVotes(db, found.id),
    ]);
    return json({
      ok: true,
      runId: found.id,
      taskId: found.record.task?.id ?? null,
      votesAvailable: true,
      votes: own.map((vote) => ({
        ...vote,
        reveal: revealPair(found.record, vote.pairId),
      })),
      tallies: pairTallies(all),
      totals: {
        submissions: all.length,
        independentTokens: independentTokenCount(all),
      },
    });
  } catch {
    return json(
      { ok: false, code: "unavailable", error: "The benchmark vote record could not be read." },
      503,
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  if (!voteOriginAllowed(request.headers.get("Origin"), origin))
    return json({ ok: false, code: "origin", error: "Open this action from App Composer." }, 403);
  const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json")
    return json({ ok: false, code: "content-type", error: "Send one JSON object." }, 415);
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return json({ ok: false, code: "too-large", error: "The vote request is too large." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ ok: false, code: "shape", error: "Send one JSON object." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: "json", error: "The vote request could not be read." }, 400);
  }

  // The header wins over a body field, so a malformed header is a refusal rather
  // than something a body value can paper over.
  const token = tokenHeader(request);
  if (token === "")
    return json(
      { ok: false, code: "invalid-token", error: "Reviewer token is not valid." },
      400,
    );
  if (token !== null) body.token = token;

  // Resolve the committed run before touching D1. An unknown run, task or pair
  // is refused from the record itself; the client cannot invent a trial.
  const requestedRun = typeof body.run === "string" ? body.run : "";
  const found = getRunRecord(requestedRun);
  if (!found)
    return json({ ok: false, code: "unknown-run", error: "That run is not recorded." }, 404);
  if (runIdFor(found.record) !== requestedRun)
    return json({ ok: false, code: "unknown-run", error: "That run is not recorded." }, 404);
  const validation = validateVote(found.record, body);
  if (!validation.ok) return json({ ok: false, ...validation.failure }, validation.failure.status);

  const db = database();
  if (!db)
    return json(
      { ok: false, code: "unavailable", error: "The benchmark vote record is unavailable in this environment." },
      503,
    );
  try {
    const stored = await appendVote(db, validation.value);
    const all = await listVotes(db, found.id);
    return json({
      ok: true,
      appended: true,
      vote: stored.vote,
      reveal: revealPair(found.record, stored.vote.pairId),
      tally: pairTallies(all).find((entry) => entry.pairId === stored.vote.pairId) ?? null,
      totals: {
        submissions: all.length,
        independentTokens: independentTokenCount(all),
      },
    });
  } catch {
    return json(
      { ok: false, code: "write-failed", error: "The vote could not be recorded." },
      503,
    );
  }
};
