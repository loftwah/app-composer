import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { feedbackEvidenceUrl } from "./owner-feedback-contract.ts";
import { FeedbackError, appendFeedback, listThreads, readThread } from "./owner-feedback.ts";

export const observerPluginId = "composer-feedback-observer";
export const observerScope = `mcp:tools:${observerPluginId}`;
const workspace = z.literal("app-composer");
export const readFeedbackEvidence = z.strictObject({
  workspace,
  threadId: z.uuid().optional(),
  targetKey: z.string().min(1).max(240).optional(),
});
export const postFeedbackFinding = z.strictObject({
  workspace,
  threadId: z.uuid(),
  revision: z.number().int().positive(),
  requestId: z.uuid(),
  kind: z.enum(["finding", "recommendation", "agent-question"]),
  note: z.string().max(4000).refine((value) => value.trim().length > 0),
  evidence: z.array(feedbackEvidenceUrl).min(1).max(6),
});
const maxGrantLifetime = 30 * 24 * 60 * 60 * 1000;

export async function resolveFeedbackObserver(db: D1Database, owner: string, authorization: string | null, now = Date.now()) {
  const match = authorization?.match(/^Bearer (ec_pat_[A-Za-z0-9_-]{20,100})$/);
  if (!match) throw new FeedbackError("A named feedback observer token is required.", 403);
  const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(match[1])));
  // EmDash stores the complete token digest as unpadded base64url.
  const hash = btoa(String.fromCharCode(...hashBytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const grant = await db.prepare(`SELECT id, name, scopes, expires_at AS expiresAt
    FROM _emdash_api_tokens WHERE token_hash=? AND user_id=?`).bind(hash, owner)
    .first<{ id: string; name: string; scopes: string; expiresAt: string | null }>();
  const expiry = Date.parse(grant?.expiresAt ?? "");
  if (!grant || !Number.isFinite(expiry) || expiry <= now || expiry > now + maxGrantLifetime ||
    grant.name.trim().length < 1 || JSON.stringify(JSON.parse(grant.scopes)) !== JSON.stringify([observerScope]))
    throw new FeedbackError("Use an expiring token scoped only to Composer feedback review.", 403);
  return grant;
}

export async function readObserverThreads(db: D1Database, owner: string, input: z.infer<typeof readFeedbackEvidence>) {
  if (!input.threadId) return { threads: await listThreads(db, owner, input.targetKey) };
  const thread = await readThread(db, owner, input.threadId);
  if (!thread) throw new FeedbackError("Feedback thread unavailable.", 404);
  return { thread };
}

export async function addObserverFinding(db: D1Database, owner: string, grant: { id: string; name: string },
  input: z.infer<typeof postFeedbackFinding>) {
  const thread = await readThread(db, owner, input.threadId);
  if (!thread) throw new FeedbackError("Feedback thread unavailable.", 404);
  if (!thread.events.some(({ id }) => id === input.requestId)) {
    if (thread.events.at(-1)?.revision !== input.revision)
      throw new FeedbackError("The thread changed. Reload it before adding your finding.", 409);
    if (thread.state === "closed")
      throw new FeedbackError("The owner closed this incident.", 409);
  }
  const evidence = input.evidence.map((href) => new URL(href).href);
  return { thread: await appendFeedback(db, owner, {
    ...input, actor: grant.name, actorId: grant.id, context: { evidence },
  }, grant.id) };
}
