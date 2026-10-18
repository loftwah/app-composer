import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fixture, saved, user, instance } from "./helpers/resource-fixture.mjs";
import {
  workspaceForUser,
  readStack,
  saveStack,
  publicStack,
} from "../src/lib/stacks.mjs";
import {
  applyStackResources,
  reuseStackResource,
} from "../src/lib/stack-resources.ts";
import { decodeStackReply } from "../src/plugins/stacks/protocol.ts";
import { appSettings } from "../src/lib/app-settings.mjs";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==";
async function prepared(f, name = "Fictional owner book") {
  const space = await workspaceForUser(f.db, user);
  const draft = await saved(f, space.id, name, [
    instance("fictional-owner-instance", name),
  ]);
  const applied = await applyStackResources(
    f.db,
    user.id,
    space.id,
    draft.id,
    draft.revision,
    f.runtime,
  );
  const selection = {
    workspace: space.id,
    stack: draft.id,
    instance: draft.draft.instances[0].id,
    expectedRevision: applied.stack.revision,
  };
  const resource = applied.resources[0].resource;
  const item = {
    id: crypto.randomUUID(),
    resource,
    caption: "Fictional private postcard",
    author: "Fixture visitor",
    status: "pending",
    revision: 1,
    synthetic: 0,
    created_at: "2026-10-18 10:00:00",
    png,
  };
  f.app.items.set(item.id, item);
  return { space, stack: applied.stack, selection, resource, item };
}
const change = (p, patch = {}) => ({
  command: "moderate",
  resource: p.resource,
  operationId: crypto.randomUUID(),
  expectedVersion: 2,
  item: p.item.id,
  itemRevision: 1,
  status: "approved",
  ...patch,
});
const post = (f, p, value) =>
  f.route({ action: "moderateResource", ...p.selection, change: value });

test("native content reads and private PNG use only the saved selected binding; viewer and foreign scope are refused", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    const other = await saved(f, p.space.id, "Second isolated book", [
      instance("other-owner-instance", "Another book"),
    ]);
    const b = await applyStackResources(
      f.db,
      user.id,
      p.space.id,
      other.id,
      other.revision,
      f.runtime,
    );
    const book = await f.route(
      { action: "resourceContent", ...p.selection },
      true,
    );
    assert.equal(book.ok, true);
    assert.equal(
      decodeStackReply("resourceContent", book).book.items[0].caption,
      p.item.caption,
    );
    assert.equal(book.book.resource, p.resource);
    assert.equal(book.book.pending, false);
    const media = await f.route(
      { action: "resourceMedia", ...p.selection, item: p.item.id },
      true,
    );
    assert.equal(media.media.png, png);
    assert.equal(
      JSON.stringify(media).includes("fictional-owner-token"),
      false,
    );
    const wrongItem = await f.route(
      {
        action: "resourceMedia",
        ...p.selection,
        stack: b.stack.id,
        instance: "other-owner-instance",
        expectedRevision: b.stack.revision,
        item: p.item.id,
      },
      true,
    );
    assert.equal(wrongItem.ok, false);
    assert.equal(
      (
        await f.route(
          {
            action: "resourceContent",
            ...p.selection,
            instance: "other-owner-instance",
          },
          true,
        )
      ).code,
      "NOT_FOUND",
    );
    const outsider = {
      id: "fictional-outside-viewer",
      name: "Other person",
      role: 50,
    };
    const foreign = await workspaceForUser(f.db, outsider);
    assert.equal(
      (
        await f.route(
          { action: "resourceContent", ...p.selection, workspace: foreign.id },
          true,
          outsider,
        )
      ).code,
      "NOT_FOUND",
    );
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,?)",
      )
      .run(p.space.id, outsider.id, "viewer");
    assert.equal(
      (
        await f.route(
          { action: "resourceContent", ...p.selection },
          true,
          outsider,
        )
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.route(
          { action: "resourceMedia", ...p.selection, item: p.item.id },
          true,
          outsider,
        )
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.route(
          { action: "moderateResource", ...p.selection, change: change(p) },
          false,
          outsider,
        )
      ).code,
      "FORBIDDEN",
    );
    f.app.badBuild(true);
    assert.equal(
      (await f.route({ action: "resourceContent", ...p.selection }, true)).ok,
      false,
    );
    assert.equal(
      (
        await f.route(
          { action: "resourceMedia", ...p.selection, item: p.item.id },
          true,
        )
      ).ok,
      false,
    );
    const before = f.app.writes.length;
    assert.equal((await post(f, p, change(p))).outcome, "refused");
    assert.equal(f.app.writes.length, before);
  } finally {
    f.close();
  }
});

test("moderation guards app and item revisions, advances one stack token, preserves publication/draft and revokes deleted media", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    const published = await f.route({ action: "publish", ...p.selection });
    p.selection.expectedRevision = published.stack.revision;
    const publicBefore = JSON.stringify(await publicStack(f.db, p.stack.slug));
    const draftBefore = JSON.stringify(published.stack.draft);
    assert.equal(
      (await post(f, p, change(p, { resource: "wrong-resource-id" }))).code,
      "CONFLICT",
    );
    let result = await post(f, p, change(p, { itemRevision: 99 }));
    assert.equal(result.outcome, "refused");
    assert.equal(p.item.status, "pending");
    p.selection.expectedRevision = result.stack.revision;
    result = await post(f, p, change(p));
    assert.equal(
      decodeStackReply("moderateResource", result).outcome,
      "applied",
    );
    assert.equal(result.book.items[0].status, "approved");
    assert.equal(result.book.version, 3);
    assert.ok(result.stack.revision > p.selection.expectedRevision);
    assert.equal(JSON.stringify(result.stack.draft), draftBefore);
    assert.equal(
      JSON.stringify(await publicStack(f.db, p.stack.slug)),
      publicBefore,
    );
    p.selection.expectedRevision = result.stack.revision;
    result = await post(
      f,
      p,
      change(p, { expectedVersion: 3, itemRevision: 2, status: "deleted" }),
    );
    assert.equal(result.outcome, "applied");
    assert.deepEqual(result.book.items, []);
    p.selection.expectedRevision = result.stack.revision;
    assert.equal(
      (
        await f.route(
          { action: "resourceMedia", ...p.selection, item: p.item.id },
          true,
        )
      ).ok,
      false,
    );
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    f.close();
  }
});

test("committed lost moderation ACK is journalled and checked before another request; check does not replay", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    let lose = true;
    f.app.afterWrite(({ command }) => {
      if (lose && command.action === "moderate") {
        lose = false;
        throw Error("Committed but lost reply");
      }
    });
    let result = await post(f, p, change(p));
    assert.equal(result.outcome, "unknown");
    assert.equal(result.book.pending, true);
    assert.equal(p.item.revision, 2);
    const writes = f.app.writes.length;
    p.selection.expectedRevision = result.stack.revision;
    result = await post(
      f,
      p,
      change(p, { expectedVersion: 3, itemRevision: 2, status: "hidden" }),
    );
    assert.equal(result.outcome, "unknown");
    assert.equal(f.app.writes.length, writes);
    p.selection.expectedRevision = result.stack.revision;
    result = await f.route({
      action: "reconcileResourceContent",
      ...p.selection,
    });
    assert.equal(result.outcome, "applied");
    assert.equal(result.book.pending, false);
    assert.equal(result.book.items[0].status, "approved");
    assert.equal(f.app.writes.length, writes);
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_resource_operations WHERE action='moderate' AND state='confirmed'",
        )
        .get().n,
      1,
    );
    p.selection.expectedRevision = result.stack.revision;
    const again = await f.route({
      action: "reconcileResourceContent",
      ...p.selection,
    });
    assert.equal(again.outcome, "unchanged");
    assert.equal(again.stack.revision, result.stack.revision);
  } finally {
    f.close();
  }
});

test("stale stack or membership change after remote commit leaves a recoverable journal and preserves the concurrent saved draft", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    let moved = false;
    f.app.afterWrite(async ({ command }) => {
      if (!moved && command.action === "moderate") {
        moved = true;
        const current = await readStack(f.db, p.space.id, p.stack.id);
        await saveStack(
          f.db,
          p.space.id,
          p.stack.id,
          { ...current.draft, description: "Another window saved this" },
          current.revision,
        );
      }
    });
    const result = await post(f, p, change(p));
    assert.equal(result.code, "CONFLICT");
    assert.equal(
      (await readStack(f.db, p.space.id, p.stack.id)).draft.description,
      "Another window saved this",
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT state FROM creator_resource_operations WHERE action='moderate'",
        )
        .get().state,
      "pending",
    );
    const latest = await readStack(f.db, p.space.id, p.stack.id);
    const checked = await f.route({
      action: "reconcileResourceContent",
      ...p.selection,
      expectedRevision: latest.revision,
    });
    assert.equal(checked.book.items[0].status, "approved");
    assert.equal(checked.stack.draft.description, "Another window saved this");
  } finally {
    f.close();
  }
});

test("shared saved instances resolve the selected app book; controls preserve sharing configuration and refuse target drift", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    const a = await saved(f, p.space.id, "Reuse book", [
      instance("reused-owner-instance", "Unused local title"),
    ]);
    const reused = await reuseStackResource(
      f.db,
      user.id,
      p.space.id,
      a.id,
      a.revision,
      "reused-owner-instance",
      p.resource,
      f.runtime,
    );
    const selection = {
      ...p.selection,
      stack: a.id,
      instance: "reused-owner-instance",
      expectedRevision: reused.stack.revision,
    };
    const result = await f.route({
      action: "moderateResource",
      ...selection,
      change: {
        command: "control",
        resource: p.resource,
        operationId: crypto.randomUUID(),
        expectedVersion: 2,
        visible: false,
        paused: true,
      },
    });
    assert.equal(result.outcome, "applied");
    assert.equal(result.book.shared, true);
    assert.equal(result.book.visible, false);
    assert.equal(result.book.paused, true);
    assert.deepEqual(result.stack.draft, reused.stack.draft);
    assert.equal(result.resources[0].state, "ready");
    f.sqlite
      .prepare(
        "UPDATE creator_app_resources SET environment='wrong-environment' WHERE id=?",
      )
      .run(p.resource);
    const before = f.app.writes.length;
    assert.equal(
      (
        await f.route(
          {
            action: "resourceContent",
            ...selection,
            expectedRevision: result.stack.revision,
          },
          true,
        )
      ).code,
      "FORBIDDEN",
    );
    assert.equal(f.app.writes.length, before);
  } finally {
    f.close();
  }
});

test("membership is checked again after source verification and before the credential-bearing content write", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    const before = f.app.writes.length;
    f.runtime.GUESTBOOK = {
      async fetch(request) {
        const reply = await f.app.fetch(request);
        if (request.url.endsWith("/build.json"))
          f.sqlite
            .prepare(
              "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
            )
            .run(p.space.id, user.id);
        return reply;
      },
    };
    const result = await post(f, p, change(p));
    assert.equal(result.code, "FORBIDDEN");
    assert.equal(f.app.writes.length, before);
    assert.equal(p.item.status, "pending");
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT state FROM creator_resource_operations WHERE action='moderate'",
        )
        .get().state,
      "pending",
    );
  } finally {
    f.close();
  }
});

test("a same-stack shared alias opens its saved source while operation identities cannot be reused for a different change", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    const shared = await saveStack(
      f.db,
      p.space.id,
      p.stack.id,
      {
        ...p.stack.draft,
        instances: [
          ...p.stack.draft.instances,
          {
            ...instance("alias-owner-instance", "Alias"),
            binding: { mode: "shared", shareOf: p.selection.instance },
            config: {},
          },
        ],
      },
      p.stack.revision,
    );
    p.selection.expectedRevision = shared.revision;
    const alias = await f.route(
      {
        action: "resourceContent",
        ...p.selection,
        instance: "alias-owner-instance",
      },
      true,
    );
    assert.equal(alias.book.shared, true);
    assert.equal(alias.book.resource, p.resource);
    const command = change(p);
    const applied = await post(f, p, command);
    p.selection.expectedRevision = applied.stack.revision;
    const before = f.app.writes.length;
    const replay = await post(f, p, {
      ...command,
      status: "deleted",
      itemRevision: 2,
      expectedVersion: 3,
    });
    assert.equal(replay.code, "CONFLICT");
    assert.equal(f.app.writes.length, before);
    assert.equal(p.item.status, "approved");
  } finally {
    f.close();
  }
});

test("explicit retry checks the receipt then replays only the exact recorded request; a source upgrade never replays it", async () => {
  for (const upgrade of [false, true]) {
    const f = fixture();
    const originalSource = appSettings.guestbook.source.commit;
    try {
      const p = await prepared(f);
      let dropped = false;
      f.runtime.GUESTBOOK = { async fetch(request) {
        if (request.method === "POST" && !dropped) {
          dropped = true;
          throw Error("Transport failed before the app received this command");
        }
        return f.app.fetch(request);
      } };
      const submitted = change(p);
      let result = await post(f, p, submitted);
      assert.equal(result.outcome, "unknown");
      assert.equal(p.item.revision, 1);
      const before = f.app.writes.length;
      p.selection.expectedRevision = result.stack.revision;
      result = await f.route({ action: "reconcileResourceContent", ...p.selection });
      assert.equal(result.outcome, "unknown");
      assert.equal(f.app.writes.length, before);
      if (upgrade) {
        appSettings.guestbook.source.commit = "e".repeat(40);
        f.app.source(appSettings.guestbook.source.commit);
      }
      p.selection.expectedRevision = result.stack.revision;
      result = await f.route({ action: "retryResourceContent", ...p.selection });
      assert.equal(result.outcome, upgrade ? "unknown" : "applied");
      assert.equal(f.app.writes.length, before + (upgrade ? 0 : 1));
      assert.equal(p.item.revision, upgrade ? 1 : 2);
      if (!upgrade) assert.deepEqual(f.app.writes.at(-1).command, {
        action: "moderate", operationId: submitted.operationId,
        expectedVersion: submitted.expectedVersion, item: submitted.item,
        itemRevision: submitted.itemRevision, status: submitted.status,
      });
    } finally {
      appSettings.guestbook.source.commit = originalSource;
      f.close();
    }
  }
});

test("forward journal migration preserves historical receipts under FK enforcement and accepts content actions", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    for (const name of [
      "0003_stacks.sql",
      "0004_stack_publications.sql",
      "0005_stack_publications_backfill.sql",
      "0006_stack_resources.sql",
    ])
      db.exec(
        readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
      );
    db.exec(
      "INSERT INTO creator_workspaces(id,name) VALUES('fixture-workspace','Fictional'); INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target) VALUES('fixture-resource','fixture-workspace','guestbook','fictional','test','https://example.test'); INSERT INTO creator_resource_operations(id,resource_id,stack_id,instance_id,action,state,source_revision,request_json,result_json) VALUES('historical-receipt','fixture-resource','fixture-stack','fixture-instance','stage','confirmed','old-source','{}','{\"retained\":true}');",
    );
    const before = db
      .prepare("SELECT * FROM creator_resource_operations")
      .get();
    db.exec(
      readFileSync(
        new URL("../migrations/0007_resource_moderation.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM creator_resource_operations").get(),
      before,
    );
    db.exec(
      "INSERT INTO creator_resource_operations(id,resource_id,stack_id,instance_id,action,state,source_revision,request_json) VALUES('moderate-receipt','fixture-resource','fixture-stack','fixture-instance','moderate','unknown','source','{}')",
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});
