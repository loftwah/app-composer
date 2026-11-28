import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { saveDecision } from "../src/lib/portfolio-decision-contract.ts";

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "./share-catalogue-asset.ts") {
      return {
        url: "data:text/javascript,export const publicShareArtwork=()=>({status:404});export const artworkRevision=()=>''",
        shortCircuit: true,
      };
    }
    return next(
      specifier,
      specifier.endsWith(".json")
        ? { ...context, importAttributes: { type: "json" } }
        : context,
    );
  },
  load(url, context, next) {
    return next(
      url,
      url.endsWith(".json")
        ? { ...context, importAttributes: { type: "json" } }
        : context,
    );
  },
});
const { getDecision, recordDecision } =
  await import("../src/lib/portfolio-decisions.ts");
hooks.deregister();

const owner = "fictional-owner";
const earlier = "owner-feedback-next";
const followUp = "composer-feedback-entry";
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/vsAAAAASUVORK5CYII=";

test("a follow-up keeps earlier answers and private media across revisions", async (t) => {
  const sql = new DatabaseSync(":memory:");
  t.after(() => sql.close());
  for (const filename of [
    "0047_portfolio_decisions.sql",
    "0048_decision_feedback_media.sql",
  ]) {
    sql.exec(
      readFileSync(
        new URL(`../migrations/${filename}`, import.meta.url),
        "utf8",
      ),
    );
    if (filename.startsWith("0047")) {
      sql
        .prepare(
          `INSERT INTO composer_decision_responses
        (owner_id, decision_id, revision, selected, note, saved_at)
        VALUES (?, ?, 1, ?, ?, ?)`,
        )
        .run(
          owner,
          earlier,
          '["surface"]',
          "A prior reaction in my own words",
          new Date().toISOString(),
        );
    }
  }
  const db = {
    prepare(query) {
      const statement = sql.prepare(query);
      return {
        bind(...args) {
          return {
            first: async () => statement.get(...args) ?? null,
            all: async () => ({ results: statement.all(...args) }),
          };
        },
      };
    },
  };
  const read = (id, account = owner) => getDecision(db, account, id);
  const write = (input) =>
    recordDecision(
      db,
      owner,
      saveDecision.parse({ id: followUp, note: "", ...input }),
    );
  assert.equal(
    (await read(followUp)).previousBrief.response.note,
    "A prior reaction in my own words",
  );
  assert.equal(
    (await read(followUp, "other-owner")).previousBrief.response,
    null,
  );
  assert.equal((await read(earlier)).followUps[0].id, followUp);
  await assert.rejects(
    write({ revision: 0, selected: ["all-of-the-above", "first"] }),
    { code: "INVALID_CHOICES" },
  );
  const first = await write({
    revision: 0,
    selected: ["all-of-the-above"],
    reaction: "needs-work",
    media: ["https://example.com/candidate"],
    image: { name: "candidate.png", type: "image/png", data: png },
  });
  assert.equal(first.image.revision, 1);
  const second = await write({ revision: 1, selected: ["none-of-the-above"] });
  assert.deepEqual(second.media, first.media);
  assert.deepEqual(second.image, first.image);
  assert.equal(second.reaction, "needs-work");
  await assert.rejects(write({ revision: 1, selected: ["first"] }), {
    code: "STALE_RESPONSE",
  });
  await write({
    revision: 2,
    selected: [],
    note: "Keep the explanation",
    image: null,
    media: [],
  });
  const detail = await read(followUp);
  assert.equal(detail.response.image, null);
  assert.deepEqual(detail.earlier[1], first);
  assert.equal((await read(followUp, "other-owner")).response, null);
});

test("malformed media produce validation errors without throwing", () => {
  const base = { id: followUp, revision: 0, note: "A reference", selected: [] };
  for (const link of [
    "invalid URL",
    "javascript:alert(1)",
    "https://user:secret@example.com/",
  ]) {
    assert.equal(
      saveDecision.safeParse({ ...base, media: [link] }).success,
      false,
    );
  }
});
