import type { D1Database } from "@cloudflare/workers-types";
import type { z } from "zod";
import {
  feedbackKey,
  type feedbackMutation,
  type FeedbackContext,
  type FeedbackEvent,
  type FeedbackTarget,
  type FeedbackThread,
} from "./owner-feedback-contract.ts";

type Row = Omit<FeedbackEvent, "context" | "isOwner"> & { context: string; ownerActor: number };
const fields = `event_id AS id, thread_id AS threadId, revision, kind, actor, actor_id AS actorId,
  actor_id = owner_id AS ownerActor, note, context, created_at AS createdAt`;

function decode(row: Row): FeedbackEvent {
  const { ownerActor, ...event } = row;
  return { ...event, isOwner: ownerActor === 1, context: JSON.parse(row.context) as FeedbackEvent["context"] };
}

export function feedbackThread(events: FeedbackEvent[]): FeedbackThread {
  const first = events[0];
  let state: FeedbackThread["state"] = "open";
  let next: FeedbackThread["next"] = "agent";
  let awaiting: FeedbackThread["awaiting"] = null;
  for (const { kind } of events.slice(1)) {
    if (kind === "satisfied") {
      state = "closed";
      next = null;
      awaiting = null;
    } else if (kind === "reopen") {
      state = "open";
      next = "agent";
      awaiting = null;
    } else if (kind === "attempt" || kind === "agent-question") {
      next = "owner";
      awaiting = kind === "attempt" ? "attempt" : "question";
    } else if (kind === "keep" || kind === "return" || kind === "partial" ||
      (kind === "reply" && awaiting === "question")) {
      next = "agent";
      awaiting = null;
    }
  }
  return { id: first.threadId, context: first.context as FeedbackContext, state, next, awaiting, events };
}

export async function readThread(db: D1Database, owner: string, id: string) {
  const { results } = await db.prepare(`SELECT ${fields} FROM composer_owner_feedback
    WHERE owner_id=? AND thread_id=? ORDER BY revision`)
    .bind(owner, id).all<Row>();
  return results.length ? feedbackThread(results.map(decode)) : null;
}

export async function listThreads(db: D1Database, owner: string, key = "", query = "") {
  const { results } = await db.prepare(`SELECT first.thread_id AS id
    FROM composer_owner_feedback first
    WHERE first.owner_id=? AND first.revision=1
      AND (?='' OR json_extract(first.context, '$.key')=?)
      AND (?='' OR instr(lower(first.context), lower(?)) > 0 OR EXISTS (
        SELECT 1 FROM composer_owner_feedback message
        WHERE message.owner_id=first.owner_id AND message.thread_id=first.thread_id
          AND instr(lower(message.note), lower(?)) > 0
      ))
    ORDER BY (SELECT MAX(created_at) FROM composer_owner_feedback latest
      WHERE latest.owner_id=first.owner_id AND latest.thread_id=first.thread_id) DESC, first.thread_id
    LIMIT 25`).bind(owner, key, key, query, query, query).all<{ id: string }>();
  const threads = await Promise.all(results.map(({ id }) => readThread(db, owner, id)));
  return threads.flatMap((thread) => thread ? [thread] : []);
}

export class FeedbackError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function appendFeedback(
  db: D1Database,
  owner: string,
  input: {
    requestId: string;
    threadId: string;
    revision: number;
    kind: string;
    actor: string;
    actorId?: string;
    note: string;
    context?: FeedbackEvent["context"];
  },
  grantId?: string,
) {
  const { requestId, threadId, revision, kind, actor, note } = input;
  const actorId = input.actorId ?? owner;
  const guard = grantId ? `AND EXISTS (SELECT 1 FROM _emdash_api_tokens
      WHERE user_id=? AND id=? AND julianday(expires_at)>julianday(?))` : "";
  const bindings = grantId ? [owner, grantId, new Date().toISOString()] : [];
  const context = JSON.stringify(input.context ?? {});
  await db.prepare(`INSERT INTO composer_owner_feedback
      (owner_id,event_id,thread_id,revision,kind,actor,actor_id,note,context,created_at)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE COALESCE((
      SELECT MAX(revision) FROM composer_owner_feedback WHERE owner_id=? AND thread_id=?
    ),0)=? ${guard} ON CONFLICT DO NOTHING`)
    .bind(owner, requestId, threadId, revision + 1, kind, actor, actorId, note, context,
      new Date().toISOString(), owner, threadId, revision, ...bindings).run();
  const stored = await db.prepare(`SELECT ${fields} FROM composer_owner_feedback
    WHERE owner_id=? AND event_id=? ${guard}`).bind(owner, requestId, ...bindings).first<Row>();
  if (stored?.threadId !== threadId || stored.revision !== revision + 1 ||
    stored.kind !== kind || stored.actorId !== actorId || stored.actor !== actor || stored.note !== note || stored.context !== context)
    throw new FeedbackError("The thread changed. Reload it before adding your update.", 409);
  return readThread(db, owner, threadId);
}


export async function saveOwnerFeedback(
  db: D1Database,
  owner: string,
  input: z.infer<typeof feedbackMutation>,
  resolve: (target: FeedbackTarget) => Promise<Omit<FeedbackContext, "incident" | "key" | "target">>,
) {
  if (input.action === "open") {
    const existing = await readThread(db, owner, input.requestId);
    const context = existing?.context ?? {
      ...(await resolve(input.target)),
      incident: input.incident,
      ...(input.annotation ? { annotation: input.annotation } : {}),
      key: feedbackKey(input.target),
      target: input.target,
    };
    if (JSON.stringify(context.target) !== JSON.stringify(input.target) || context.incident !== input.incident || context.annotation !== input.annotation)
      throw new FeedbackError("Start a new report for the changed target.", 409);
    return appendFeedback(db, owner, {
      requestId: input.requestId, threadId: input.requestId, revision: 0,
      kind: input.kind, note: input.note, actor: "owner", context,
    });
  }
  const thread = await readThread(db, owner, input.threadId);
  if (!thread) throw new FeedbackError("Feedback thread unavailable.", 404);
  const retry = thread.events.some((event) => event.id === input.requestId);
  if (!retry) {
    if (thread.events.at(-1)?.revision !== input.revision)
      throw new FeedbackError("The thread changed. Reload it before adding your update.", 409);
    const allowed = input.action === "reply" ||
      (input.action === "attempt" && thread.state === "open") ||
      (thread.context.incident && (thread.state === "closed" ? input.action === "reopen" :
        input.action !== "reopen" &&
        (input.action !== "satisfied" || thread.events.some((event) => event.kind === "attempt"))));
    if (!allowed) throw new FeedbackError("That action is unavailable for this thread.", 409);
  }
  return appendFeedback(db, owner, {
    requestId: input.requestId, threadId: input.threadId, revision: input.revision,
    kind: input.action, note: input.note, actor: "owner",
    context: input.action === "attempt" ? { evidence: input.evidence } : undefined,
  });
}
