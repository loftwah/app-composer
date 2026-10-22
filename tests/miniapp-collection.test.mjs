import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  saved,
  user,
  instance,
  origin,
} from "./helpers/resource-fixture.mjs";
import {
  workspaceForUser,
  saveStack,
  readStack,
  deleteStack,
} from "../src/lib/stacks.mjs";
import { applyStackResources } from "../src/lib/stack-resources.ts";
import { manageMiniapps } from "../src/lib/miniapp-admin.mjs";
import {
  collectionSourcesReply,
  collectionItemsReply,
  collectionReceipt,
  collectionInvitationReply,
} from "../src/lib/miniapp-collection-contract.ts";

const pin = "a".repeat(40),
  pins = { showcase: pin };
async function prepared() {
  const f = fixture(),
    space = await workspaceForUser(f.db, user),
    selected = [],
    calls = [],
    cards = [];
  let invitation = null;
  for (const [index, title] of [
    "Fictional Trail",
    "Fictional Launch",
  ].entries()) {
    const draft = await saved(f, space.id, title, [
      instance("fictional-source-" + index, title),
    ]);
    const applied = await applyStackResources(
      f.db,
      user.id,
      space.id,
      draft.id,
      draft.revision,
      f.runtime,
    );
    const item = {
      id: crypto.randomUUID(),
      resource: applied.resources[0].resource,
      caption: title + " contribution",
      author: "Fictional visitor",
      status: "approved",
      revision: 1,
      synthetic: 0,
      created_at: "2026-10-18 10:00:00",
    };
    f.app.items.set(item.id, item);
    selected.push({
      workspace: space.id,
      stack: draft.id,
      instance: draft.draft.instances[0].id,
      expectedRevision: applied.stack.revision,
      item: item.id,
    });
  }
  const faults = {
    unsupported: false,
    source: pin,
    lost: false,
    malformed: false,
    wrongReceipt: false,
    afterVerify: undefined,
    afterExport: undefined,
  };
  f.runtime.SHOWCASE_OWNER_TOKEN = "fictional-showcase-token";
  f.runtime.SHOWCASE = {
    async fetch(request) {
      calls.push(request);
      const path = new URL(request.url).pathname;
      assert.equal(new URL(request.url).origin, origin);
      assert.equal(request.redirect, "manual");
      assert.equal(
        request.headers.get("Authorization"),
        "Bearer fictional-showcase-token",
      );
      if (path === "/showcase/build.json")
        return Response.json({
          app: "showcase",
          revision: faults.source,
          dataVersion: 1,
        });
      if (path === "/showcase/app.manifest.json") {
        if (faults.afterVerify) await faults.afterVerify();
        return Response.json({
          id: "showcase",
          ...(faults.unsupported
            ? {}
            : {
                providerSources: {
                  version: 1,
                  provider: "guestbook",
                  kinds: ["guestbook.resource"],
                },
              }),
        });
      }
      if (path === "/showcase/api/export") {
        if (faults.afterExport) await faults.afterExport();
        return Response.json({ dataVersion: 1, cards });
      }
      if (path === "/showcase/api/invitation") {
        if (request.method === "GET")
          return Response.json({
            contract: 1,
            configured: Boolean(invitation),
            ...(invitation ? { source: invitation } : {}),
            ...(invitation
              ? {
                  invitation: {
                    state: "open",
                    configuration: invitation.configuration,
                    contribute:
                      "https://guestbook.example.test/r/" +
                      invitation.resource +
                      "/c/" +
                      invitation.configuration +
                      "/contribute",
                    collection:
                      "https://guestbook.example.test/r/" +
                      invitation.resource +
                      "/c/" +
                      invitation.configuration +
                      "/",
                  },
                }
              : { state: "none" }),
          });
        assert.equal(
          request.headers.get("X-Composer-Source"),
          faults.source,
        );
        assert.equal(
          request.headers.get("X-Composer-Target"),
          origin + "/showcase",
        );
        const body = await request.json();
        if (body.action === "enable") {
          invitation = body.source;
          return Response.json({
            contract: 1,
            configured: true,
            source: invitation,
            invitation: {
              state: "open",
              configuration: invitation.configuration,
              contribute:
                "https://guestbook.example.test/r/" +
                invitation.resource +
                "/c/" +
                invitation.configuration +
                "/contribute",
              collection:
                "https://guestbook.example.test/r/" +
                invitation.resource +
                "/c/" +
                invitation.configuration +
                "/",
            },
          });
        }
        assert.equal(body.action, "disable");
        invitation = null;
        return Response.json({ contract: 1, configured: false, state: "none" });
      }
      assert.equal(path, "/showcase/api/cards");
      assert.equal(request.headers.get("X-Composer-Source"), pin);
      assert.equal(
        request.headers.get("X-Composer-Target"),
        origin + "/showcase",
      );
      const body = await request.json();
      const current = cards.find(
        (card) =>
          card.item_id === body.item &&
          card.source_resource === body.source.resource &&
          card.source_configuration === body.source.configuration,
      );
      const card = current ?? {
        id: crypto.randomUUID(),
        status: "published",
        provider: "guestbook",
        item_id: body.item,
        source_resource: body.source.resource,
        source_configuration: body.source.configuration,
      };
      if (!current) cards.push(card);
      if (faults.lost) throw Error("Fictional committed response lost");
      if (faults.malformed) return new Response("invalid", { status: 200 });
      return Response.json({
        id: card.id,
        status: card.status,
        source: faults.wrongReceipt
          ? {
              ...body.source,
              resource: selected[1].resource ?? crypto.randomUUID(),
            }
          : body.source,
        outcome: current ? "unchanged" : "applied",
      });
    },
  };
  const route = (action, fields = {}, caller = user) =>
    manageMiniapps(
      {
        user: caller,
        input: { app: "showcase", action, ...fields },
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-miniapps/" +
            (["feature-resource", "collection-invitation-set"].includes(action)
              ? "write"
              : "read"),
          {
            method: ["feature-resource", "collection-invitation-set"].includes(
              action,
            )
              ? "POST"
              : "GET",
            headers: { Origin: origin, "X-EmDash-Request": "1" },
          },
        ),
      },
      f.runtime,
      pins,
    );
  const selection = (i) => {
    const { item, ...value } = selected[i];
    return value;
  };
  return {
    ...f,
    space,
    selected,
    selection,
    calls,
    cards,
    faults,
    route,
    close() {
      assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
      f.close();
    },
  };
}

test("an owner links one exact saved book for contributions, can replace or stop it, and never features a note", async () => {
  const f = await prepared();
  try {
    const none = collectionInvitationReply.parse(
      await f.route("collection-invitation", f.selection(0)),
    );
    assert.equal(none.configured, false);
    assert.equal(none.invitation.state, "none");
    assert.equal(none.outcome, "unchanged");
    assert.equal(f.cards.length, 0);
    const book0 = collectionItemsReply.parse(
      await f.route("collection-items", f.selection(0)),
    );
    const book1 = collectionItemsReply.parse(
      await f.route("collection-items", f.selection(1)),
    );

    const enabled = collectionInvitationReply.parse(
      await f.route("collection-invitation-set", {
        ...f.selection(0),
        operation: "enable",
      }),
    );
    assert.equal(enabled.configured, true);
    assert.equal(enabled.outcome, "applied");
    assert.deepEqual(enabled.source, book0.source);
    assert.deepEqual(enabled.linked, book0.source);
    assert.equal(enabled.invitation.state, "open");
    assert.equal(f.cards.length, 0, "linking an invitation does not feature a note");

    const other = collectionInvitationReply.parse(
      await f.route("collection-invitation", f.selection(1)),
    );
    assert.equal(other.configured, true);
    assert.equal(other.source.resource, book1.source.resource);
    assert.equal(other.linked.resource, book0.source.resource);

    const replaced = collectionInvitationReply.parse(
      await f.route("collection-invitation-set", {
        ...f.selection(1),
        operation: "enable",
      }),
    );
    assert.equal(replaced.source.resource, book1.source.resource);
    assert.deepEqual(replaced.linked, book1.source);
    assert.equal(f.cards.length, 0);

    const hidden = f.app.resources.get(book1.source.resource);
    assert.ok(hidden);
    hidden.visible = false;
    const refused = await f.route("collection-invitation-set", {
      ...f.selection(1),
      operation: "enable",
    });
    assert.equal(refused.code, "CONFLICT");
    assert.match(refused.message, /Publish this visitor book/);
    hidden.visible = true;

    const disabled = collectionInvitationReply.parse(
      await f.route("collection-invitation-set", {
        ...f.selection(1),
        operation: "disable",
      }),
    );
    assert.equal(disabled.configured, false);
    assert.equal(disabled.linked, null);
    assert.equal(disabled.invitation.state, "none");
    assert.equal(disabled.outcome, "applied");
    assert.equal(f.cards.length, 0);
  } finally {
    f.close();
  }
});

test("native selectors expose two exact saved resources and only approved visible items without changing stacks", async () => {
  const f = await prepared();
  try {
    const before = f.sqlite
      .prepare("SELECT * FROM creator_stacks ORDER BY id")
      .all();
    const empty = collectionSourcesReply.parse(
      await f.route("collection-sources"),
    );
    assert.equal(empty.workspace, null);
    assert.equal(empty.sources.length, 0);
    assert.equal(empty.workspaces[0].id, f.space.id);
    const options = collectionSourcesReply.parse(
      await f.route("collection-sources", { workspace: f.space.id }),
    );
    assert.equal(
      new Set(options.sources.map((source) => source.source.resource)).size,
      2,
    );
    for (const i of [0, 1]) {
      const book = collectionItemsReply.parse(
        await f.route("collection-items", f.selection(i)),
      );
      assert.equal(book.items.length, 1);
      assert.equal(book.items[0].id, f.selected[i].item);
      assert.equal(book.source.configuration, 1);
      const saved = collectionReceipt.parse(
        await f.route("feature-resource", f.selected[i]),
      );
      assert.equal(saved.outcome, "applied");
      assert.equal(saved.source.resource, book.source.resource);
      const repeat = await f.route("feature-resource", f.selected[i]);
      assert.equal(repeat.outcome, "unchanged");
      assert.equal(repeat.card.id, saved.card.id);
    }
    assert.equal(f.cards.length, 2);
    assert.deepEqual(
      f.sqlite.prepare("SELECT * FROM creator_stacks ORDER BY id").all(),
      before,
    );
    assert.doesNotMatch(
      JSON.stringify(options),
      /fictional-showcase-token|fictional-owner-token/,
    );
  } finally {
    f.close();
  }
});

test("viewer, foreign workspace, wrong instance, lower global role and browser authority injection refuse before collection dispatch", async () => {
  const f = await prepared();
  try {
    const viewer = { id: "fictional-viewer", role: 50 },
      editor = { id: "fictional-editor", role: 50 };
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,?)",
      )
      .run(f.space.id, viewer.id, "viewer");
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,?)",
      )
      .run(f.space.id, editor.id, "editor");
    for (const caller of [
      viewer,
      { ...editor, role: 20 },
      { id: "fictional-outsider", role: 50 },
    ])
      assert.equal(
        (await f.route("feature-resource", f.selected[0], caller)).ok,
        false,
      );
    for (const patch of [
      { instance: f.selected[1].instance },
      { workspace: "fictional-other-space" },
      { expectedRevision: 1 },
      { target: "https://arbitrary.example.test" },
      { source: { resource: "forged" } },
      { token: "browser-secret" },
    ])
      assert.equal(
        (await f.route("feature-resource", { ...f.selected[0], ...patch })).ok,
        false,
      );
    assert.equal(
      f.calls.filter((request) => request.method === "POST").length,
      0,
    );
    assert.equal(
      (await f.route("feature-resource", f.selected[0], editor)).outcome,
      "applied",
    );
  } finally {
    f.close();
  }
});

test("pending/private items and hidden resources cannot be collected; unsupported source is explicit", async () => {
  const f = await prepared();
  try {
    const item = f.app.items.get(f.selected[0].item);
    item.status = "pending";
    assert.deepEqual(
      (await f.route("collection-items", f.selection(0))).items,
      [],
    );
    assert.equal(
      (await f.route("feature-resource", f.selected[0])).code,
      "CONFLICT",
    );
    item.status = "approved";
    f.app.resources.get(item.resource).visible = false;
    assert.deepEqual(
      (await f.route("collection-items", f.selection(0))).items,
      [],
    );
    assert.equal(
      (await f.route("feature-resource", f.selected[0])).code,
      "CONFLICT",
    );
    f.faults.unsupported = true;
    const unsupported = collectionSourcesReply.parse(
      await f.route("collection-sources", { workspace: f.space.id }),
    );
    assert.equal(unsupported.supported, false);
    assert.deepEqual(unsupported.sources, []);
    f.faults.source = "b".repeat(40);
    assert.equal(
      (await f.route("collection-sources", { workspace: f.space.id })).code,
      "SOURCE",
    );
    assert.equal(f.cards.length, 0);
  } finally {
    f.close();
  }
});

test("saved-draft change or membership revocation during remote verification prevents dispatch and preserves publication", async () => {
  for (const mode of ["save", "revoke"]) {
    const f = await prepared();
    try {
      const before = await readStack(f.db, f.space.id, f.selected[0].stack);
      f.faults.afterVerify = async () => {
        f.faults.afterVerify = undefined;
        if (mode === "save")
          await saveStack(
            f.db,
            f.space.id,
            before.id,
            {
              ...before.draft,
              description: "Saved by another fictional window",
            },
            before.revision,
          );
        else
          f.sqlite
            .prepare(
              "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
            )
            .run(f.space.id, user.id);
      };
      assert.equal(
        (await f.route("feature-resource", f.selected[0])).ok,
        false,
      );
      assert.equal(f.cards.length, 0);
      assert.equal(
        f.calls.some((request) => request.method === "POST"),
        false,
      );
      const after = await readStack(f.db, f.space.id, before.id);
      assert.deepEqual(after.published, before.published);
      if (mode === "save")
        assert.equal(
          after.draft.description,
          "Saved by another fictional window",
        );
    } finally {
      f.close();
    }
  }
});

test("wrong resource account/environment/target and current Guestbook source fail closed", async () => {
  for (const field of ["account_id", "environment", "target", "source"]) {
    const f = await prepared();
    try {
      if (field === "source") f.app.badBuild(true);
      else
        f.sqlite
          .prepare(
            "UPDATE creator_app_resources SET " +
              field +
              "=? WHERE workspace_id=?",
          )
          .run("fictional-wrong-scope", f.space.id);
      assert.equal(
        (await f.route("feature-resource", f.selected[0])).ok,
        false,
      );
      assert.equal(f.cards.length, 0);
    } finally {
      f.close();
    }
  }
});

test("lost or malformed acknowledgements remain unknown; exact check confirms without requiring the old stack binding", async () => {
  for (const fault of ["lost", "malformed", "wrongReceipt"]) {
    const f = await prepared();
    try {
      f.faults[fault] = true;
      const unknown = collectionReceipt.parse(
        await f.route("feature-resource", f.selected[0]),
      );
      assert.equal(unknown.outcome, "unknown");
      assert.equal(f.cards.length, 1);
      const check = {
        workspace: unknown.workspace,
        resource: unknown.source.resource,
        configuration: unknown.source.configuration,
        item: unknown.item,
      };
      const stack = await readStack(f.db, f.space.id, f.selected[0].stack);
      // A later binding/draft change cannot turn the historical reference into a new dispatch.
      await saveStack(
        f.db,
        f.space.id,
        stack.id,
        { ...stack.draft, instances: [] },
        stack.revision,
      );
      const changed = collectionReceipt.parse(
        await f.route("collection-check", check),
      );
      assert.equal(changed.outcome, "unchanged");
      assert.equal(changed.card.id, f.cards[0].id);
      const current = await readStack(f.db, f.space.id, stack.id);
      await deleteStack(f.db, f.space.id, current.id, current.revision);
      assert.equal(
        (await f.route("collection-check", check)).card.id,
        f.cards[0].id,
      );
      f.cards.length = 0;
      assert.equal(
        (await f.route("collection-check", check)).outcome,
        "unknown",
        "deletion after commit cannot prove safe retry",
      );
      assert.equal(
        f.calls.filter((request) => request.method === "POST").length,
        1,
        "checks never replay remote writes",
      );
    } finally {
      f.close();
    }
  }
});

test("historical checks retain ownership and current membership after remote awaits", async () => {
  const f = await prepared();
  try {
    const saved = await f.route("feature-resource", f.selected[0]);
    const check = {
      workspace: saved.workspace,
      resource: saved.source.resource,
      configuration: saved.source.configuration,
      item: saved.item,
    };
    const foreign = await workspaceForUser(f.db, {
      id: "fictional-another-owner",
      name: "Other",
    });
    assert.equal(
      (await f.route("collection-check", { ...check, workspace: foreign.id }))
        .ok,
      false,
    );
    f.faults.afterExport = () =>
      f.sqlite
        .prepare(
          "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
        )
        .run(f.space.id, user.id);
    assert.equal((await f.route("collection-check", check)).ok, false);
    assert.equal(
      f.calls.filter((request) => request.method === "POST").length,
      1,
    );
  } finally {
    f.close();
  }
});
