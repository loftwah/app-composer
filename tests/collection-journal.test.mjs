import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  user,
  instance,
  saved,
  origin,
} from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { applyStackResources } from "../src/lib/stack-resources.ts";
import { appSettings } from "../src/lib/app-settings.mjs";
import { manageMiniapps } from "../src/lib/miniapp-admin.mjs";

const showcaseSource = "b".repeat(40);
const pins = {
  guestbook: appSettings.guestbook.source.commit,
  showcase: showcaseSource,
};
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==";

function showcase() {
  const cards = [];
  const state = { writes: 0, fail: false };
  return {
    cards,
    state,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/build.json"))
        return Response.json({
          app: "showcase",
          revision: showcaseSource,
          dataVersion: 1,
        });
      if (url.pathname.endsWith("/app.manifest.json"))
        return Response.json({
          id: "showcase",
          providerSources: {
            version: 1,
            provider: "guestbook",
            kinds: ["guestbook.resource"],
          },
        });
      if (url.pathname.endsWith("/api/cards") && request.method === "POST") {
        state.writes++;
        if (state.fail) return new Response(null, { status: 503 });
        const body = await request.json();
        const card = {
          id: "card-" + cards.length.toString().padStart(4, "0"),
          status: "published",
          provider: "guestbook",
          item_id: body.item,
          source_resource: body.source.resource,
          source_configuration: body.source.configuration,
          source: body.source,
          outcome: "applied",
        };
        cards.push(card);
        return Response.json(card);
      }
      if (url.pathname.endsWith("/api/export"))
        return Response.json({ dataVersion: 1, cards });
      if (url.pathname.endsWith("/api/invitation"))
        return Response.json({ contract: 1, configured: false, state: "none" });
      return new Response(null, { status: 404 });
    },
  };
}

async function prepared(t) {
  const f = fixture();
  t.after(() => f.close());
  const space = await workspaceForUser(f.db, user);
  const draft = await saved(f, space.id, "Collection book", [
    instance("collection-instance", "Collection book"),
  ]);
  const applied = await applyStackResources(
    f.db,
    user.id,
    space.id,
    draft.id,
    draft.revision,
    f.runtime,
  );
  const resource = applied.resources[0].resource;
  const addItem = (id) => {
    const item = {
      id,
      resource,
      caption: "Fictional collected postcard " + id,
      author: "Fixture visitor",
      status: "approved",
      revision: 1,
      synthetic: 0,
      created_at: "2026-11-08 09:00:00",
      png,
    };
    f.app.items.set(id, item);
    return item;
  };
  const app = showcase();
  const runtime = {
    ...f.runtime,
    PUBLIC_ORIGIN: origin,
    SHOWCASE: app,
    SHOWCASE_OWNER_TOKEN: "fictional-showcase-token",
  };
  const call = (input) => {
    const reading = !["feature-resource", "collection-invitation-set"].includes(
      input.action,
    );
    return manageMiniapps(
      {
        user,
        input: { app: "showcase", ...input },
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-miniapps/" +
            (reading ? "read" : "write"),
          {
            method: reading ? "GET" : "POST",
            headers: {
              Origin: origin,
              "X-EmDash-Request": "1",
            },
          },
        ),
      },
      runtime,
      pins,
    );
  };
  const selection = {
    workspace: space.id,
    stack: applied.stack.id,
    instance: applied.stack.draft.instances[0].id,
    expectedRevision: applied.stack.revision,
  };
  return { ...f, space, applied, resource, addItem, app, call, selection };
}

test("a confirmed collection is one durable applied receipt", async (t) => {
  const f = await prepared(t);
  const item = f.addItem("item-approved-0001");
  const items = await f.call({ action: "collection-items", ...f.selection });
  assert.equal(items.ok, true, items.message);
  assert.ok(items.items.some((entry) => entry.id === item.id));
  assert.equal(items.unresolved, undefined);
  const result = await f.call({
    action: "feature-resource",
    ...f.selection,
    item: item.id,
  });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.outcome, "applied");
  assert.equal(result.card.status, "published");
  const row = f.sqlite
    .prepare(
      "SELECT state,card_id FROM creator_collection_operations WHERE item_id=?",
    )
    .get(item.id);
  assert.equal(row.state, "applied");
  assert.equal(row.card_id, result.card.id);
  // A resolved receipt is not offered as unresolved work.
  const after = await f.call({ action: "collection-items", ...f.selection });
  assert.equal(after.unresolved, undefined);
});

test("an unconfirmed collection survives a reload and is not repeated", async (t) => {
  const f = await prepared(t);
  const item = f.addItem("item-approved-0002");
  f.app.state.fail = true;
  const unknown = await f.call({
    action: "feature-resource",
    ...f.selection,
    item: item.id,
  });
  assert.equal(unknown.ok, true, unknown.message);
  assert.equal(unknown.outcome, "unknown");
  assert.equal(f.app.state.writes, 1);
  const row = f.sqlite
    .prepare("SELECT state FROM creator_collection_operations WHERE item_id=?")
    .get(item.id);
  assert.equal(row.state, "unknown");
  // A reload hydrates the exact open reference.
  const items = await f.call({ action: "collection-items", ...f.selection });
  assert.equal(items.unresolved.item, item.id);
  assert.equal(items.unresolved.outcome, "unknown");
  assert.equal(items.unresolved.source.resource, f.resource);
  // The same write is refused locally while the receipt is open.
  const repeated = await f.call({
    action: "feature-resource",
    ...f.selection,
    item: item.id,
  });
  assert.equal(repeated.outcome, "unknown");
  assert.equal(f.app.state.writes, 1);
  // Checking the app confirms it has no card and keeps the reference open.
  const checked = await f.call({
    action: "collection-check",
    workspace: f.space.id,
    resource: f.resource,
    configuration: items.source.configuration,
    item: item.id,
  });
  assert.equal(checked.outcome, "unknown");
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT state FROM creator_collection_operations WHERE item_id=?",
      )
      .get(item.id).state,
    "unknown",
  );
});

test("a different contribution can still be collected while one reference is open", async (t) => {
  const f = await prepared(t);
  const first = f.addItem("item-approved-0003");
  const second = f.addItem("item-approved-0004");
  f.app.state.fail = true;
  assert.equal(
    (
      await f.call({
        action: "feature-resource",
        ...f.selection,
        item: first.id,
      })
    ).outcome,
    "unknown",
  );
  f.app.state.fail = false;
  const applied = await f.call({
    action: "feature-resource",
    ...f.selection,
    item: second.id,
  });
  assert.equal(applied.outcome, "applied");
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM creator_collection_operations WHERE state='unknown'",
      )
      .get().n,
    1,
  );
});
