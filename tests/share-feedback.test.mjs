import test from "node:test";
import assert from "node:assert/strict";
import { migration, sqliteD1 } from "./helpers/stacks-sqlite.mjs";
import { handleShareFeedback } from "../src/lib/share-feedback.ts";
import { shareFilms } from "../src/lib/share-films.ts";

const origin = "https://composer.test";
const first = shareFilms[0];
const second = shareFilms[1];
const save = {
  action: "save", assetId: first.id, revision: first.revision,
  vote: "down", reasons: ["Hard to read on a phone"], note: "Enlarge the menu in the opening.",
};
const make = (payload, requestOrigin = origin) => new Request(origin + "/api/share-feedback", payload ? {
  method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(payload),
} : undefined);

test("film feedback is private, optionally reasoned, editable and scoped to the asset revision", async () => {
  const db = sqliteD1({ schema: migration("0040_share_feedback.sql") });
  const owner = "owner-a";
  const call = (payload, auth = owner, site = origin) => handleShareFeedback(make(payload, site), auth, db);
  try {
    assert.equal((await call(save, "")).status, 401);
    assert.equal((await call(save, owner, "https://other.test")).status, 403);
    assert.equal((await call({...save, actorId:"owner-b"})).status, 400);
    assert.equal((await call({...save, revision:"a".repeat(64)})).status, 409);
    assert.equal((await call({...save, reasons:["Good sound"]})).status, 400);
    assert.equal((await call({...save, note:"x".repeat(10_000)})).status, 400);
    const receipt = await call(save);
    assert.equal(receipt.status, 200);
    assert.equal(receipt.headers.get("Cache-Control"), "private, no-store");
    const {item} = await receipt.json();
    assert.deepEqual([item.revision, item.note, item.reasons], [first.revision, save.note, save.reasons]);
    assert.equal(Object.hasOwn(item, "actorId"), false);
    const revised = await call({...save, vote:"up", reasons:[], note:""});
    assert.equal((await revised.json()).item.vote, "up");
    await call({...save, assetId:second.id, revision:second.revision});
    assert.deepEqual((await (await call(undefined, "owner-b")).json()).items, []);
    const remove = {action:"remove", assetId:first.id, revision:first.revision};
    assert.equal((await call(remove, "owner-b")).status, 200);
    assert.equal((await (await call()).json()).items.length, 2);
    assert.equal((await call(remove)).status, 200);
    const remaining = (await (await call()).json()).items;
    assert.deepEqual(remaining.map(item=>item.assetId), [second.id]);
  } finally { db.cleanup(); }
});
