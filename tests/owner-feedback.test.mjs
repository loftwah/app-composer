import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { feedbackMutation } from "../src/lib/owner-feedback-contract.ts";
import { appendFeedback, listThreads, readThread, saveOwnerFeedback } from "../src/lib/owner-feedback.ts";
import {
  addObserverFinding, observerScope, postFeedbackFinding,
  readFeedbackEvidence, resolveFeedbackObserver,
} from "../src/lib/owner-feedback-observer.ts";

function fixture(t) {
  const sql = new DatabaseSync(":memory:");
  t.after(() => sql.close());
  sql.exec(readFileSync(new URL("../migrations/0050_owner_feedback.sql", import.meta.url), "utf8"));
  sql.exec("CREATE TABLE _emdash_api_tokens (id TEXT, user_id TEXT, token_hash TEXT, name TEXT, scopes TEXT, expires_at TEXT)");
  const db = { prepare(query) {
    const statement = sql.prepare(query);
    return { bind(...values) {
      return {
        run: async () => statement.run(...values),
        first: async () => statement.get(...values),
        all: async () => ({ results: statement.all(...values) }),
      };
    } };
  } };
  const target = { type: "film", id: "keep-a-copy", startMs: 12900,
    endMs: 17900, revision: "a".repeat(64) };
  const context = { build: "b".repeat(40), url: "https://composer.loftwah.com/share/who-keeps-the-map#trailer",
    environment: "local", project: "Composer", title: "Keep a Copy" };
  const resolve = async (target) => {
    if (target.revision !== "a".repeat(64)) throw new Error("stale target");
    return context;
  };
  const input = { action: "open", requestId: crypto.randomUUID(), incident: true,
    kind: "problem", note: "  Keep the opening.\nRevisit the insert.  ", target };
  const save = (value, owner = "admin") => saveOwnerFeedback(db, owner, feedbackMutation.parse(value), resolve);
  const update = (action, revision, note) => ({ action, revision, note,
    requestId: crypto.randomUUID(), threadId: input.requestId });
  return { db, sql, input, save, update };
}

test("exact source and owner text survive retries and a scoped, searchable read", async (t) => {
  const { db, input, save, update } = fixture(t);
  const first = await save(input);
  assert.deepEqual(first.context.target, input.target);
  assert.equal(first.events[0].note, input.note);
  assert.equal(first.events[0].isOwner, true);
  assert.equal((await save(input)).events.length, 1);
  await assert.rejects(save({ ...input, note: "Different report" }), { status: 409 });
  await assert.rejects(save({ ...input, requestId: crypto.randomUUID(),
    target: { ...input.target, revision: "c".repeat(64) } }), /stale target/);
  const reply = update("reply", 1, "Keep the sound");
  await save(reply);
  await assert.rejects(save(update("reply", 1, "A stale edit")), { status: 409 });
  assert.equal((await save(reply)).events.length, 2);
  assert.equal((await listThreads(db, "admin", "film:keep-a-copy", "keep the sound")).length, 1);
  assert.equal(await readThread(db, "other-admin", first.id), null);
  await assert.rejects(save(update("reply", 2, "wrong owner"), "other-admin"), { status: 404 });
});

test("isolated incident retains partial acceptance, two attempts, closure and reopening", async (t) => {
  const { db, input, save, update } = fixture(t);
  const first = await save(input);
  await assert.rejects(save(update("satisfied", 1, "No delivery")), { status: 409 });
  const attempt = (revision) => appendFeedback(db, "admin", { threadId: first.id, revision,
    requestId: crypto.randomUUID(), kind: "attempt", actor: "Delivery agent", actorId: "delivery",
    note: "Delivered a reviewable revision", context: { evidence: ["https://composer.loftwah.com/release"] } });
  assert.equal((await attempt(1)).next, "owner");
  assert.equal((await save(update("partial", 2, "Keep the soundtrack. Rework the insert."))).state, "open");
  assert.equal((await attempt(3)).next, "owner");
  const close = update("satisfied", 4, "Satisfied with this revision.");
  assert.equal((await save(close)).state, "closed");
  assert.equal((await save(close)).events.length, 5);
  const reopened = await save(update("reopen", 5, "The insert regressed."));
  assert.equal(reopened.next, "agent");
  assert.deepEqual(reopened.events.map(({ kind }) => kind), ["problem", "attempt", "partial", "attempt", "satisfied", "reopen"]);
});

test("observer token is exact scope, time bounded, attributed, owner isolated and revocable", async (t) => {
  const { db, sql, input, save } = fixture(t);
  const token = "ec_pat_" + "S".repeat(43);
  const hash = createHash("sha256").update(token).digest("base64url");
  const insert = sql.prepare("INSERT INTO _emdash_api_tokens VALUES (?, ?, ?, ?, ?, ?)");
  insert.run("grant", "admin", hash, "Emilio fixture", JSON.stringify([observerScope]),
    new Date(Date.now() + 3600000).toISOString());
  const auth = "Bearer " + token;
  const credential = await resolveFeedbackObserver(db, "admin", auth);
  assert.equal(credential.name, "Emilio fixture");
  await assert.rejects(resolveFeedbackObserver(db, "other-admin", auth), { status: 403 });
  await assert.rejects(resolveFeedbackObserver(db, "admin", null), { status: 403 });
  assert.equal(readFeedbackEvidence.safeParse({ workspace: "other-workspace" }).success, false);
  assert.equal(readFeedbackEvidence.safeParse({ workspace: "app-composer", owner: "another" }).success, false);
  const data = { workspace: "app-composer", threadId: input.requestId, revision: 1,
    requestId: crypto.randomUUID(), kind: "recommendation", note: "Keep the soundtrack.",
    evidence: ["https://composer.loftwah.com/share/who-keeps-the-map"] };
  for (const kind of ["satisfied", "attempt", "publish", "record"]) {
    assert.equal(postFeedbackFinding.safeParse({ ...data, kind }).success, false);
  }
  await save(input);
  const updated = await addObserverFinding(db, "admin", credential, postFeedbackFinding.parse(data));
  assert.equal(updated.thread.events[1].actor, "Emilio fixture");
  assert.equal(updated.thread.events[1].isOwner, false);
  assert.equal((await addObserverFinding(db, "admin", credential, data)).thread.events.length, 2);
  sql.prepare("UPDATE _emdash_api_tokens SET scopes=?").run(JSON.stringify([observerScope, "content:write"]));
  await assert.rejects(resolveFeedbackObserver(db, "admin", auth), { status: 403 });
  sql.prepare("UPDATE _emdash_api_tokens SET scopes=?, expires_at=?").run(JSON.stringify([observerScope]),
    new Date(Date.now() - 10000).toISOString());
  await assert.rejects(resolveFeedbackObserver(db, "admin", auth), { status: 403 });
  sql.exec("DELETE FROM _emdash_api_tokens");
  await assert.rejects(resolveFeedbackObserver(db, "admin", auth), { status: 403 });
  await assert.rejects(addObserverFinding(db, "admin", credential, data), { status: 409 });
});

test("a reply to an agent question returns work to the agent without implying delivery", async (t) => {
  const { db, input, save, update } = fixture(t);
  const first = await save(input);
  const asked = await appendFeedback(db, "admin", { threadId: first.id, revision: 1,
    requestId: crypto.randomUUID(), kind: "agent-question", actor: "Review agent", actorId: "review",
    note: "Which ending should stay?" });
  assert.equal(asked.awaiting, "question");
  const replied = await save(update("reply", 2, "The original ending."));
  assert.equal(replied.next, "agent");
  assert.equal(replied.awaiting, null);
});

test("owner can record visible delivery evidence independently of satisfaction", async (t) => {
  const { input, save, update } = fixture(t);
  await save(input);
  await assert.rejects(save(update("reply", 3, "Future revision")), { status: 409 });
  const delivered = await save({ ...update("attempt", 1, "A published revision is ready"),
    evidence: ["https://composer.loftwah.com/release"] });
  assert.equal(delivered.state, "open");
  assert.equal(delivered.awaiting, "attempt");
  assert.equal(delivered.events[1].context.evidence.length, 1);
  assert.equal((await save(update("satisfied", 2, "I reviewed this release."))).state, "closed");
});
