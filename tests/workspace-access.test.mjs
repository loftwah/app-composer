import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  manageWorkspaceAccess,
  readWorkspaceAccess,
  changeWorkspaceAccess,
} from "../src/lib/workspace-access.ts";
import { creatorPlugin } from "../src/lib/creator-plugin.ts";
import { manageMiniapps } from "../src/lib/miniapp-admin.mjs";
import { manageStacks } from "../src/lib/stacks-admin.mjs";
import {
  workspaceForUser,
  createStack,
  saveStack,
  readStack,
  exportStack,
} from "../src/lib/stacks.mjs";
import { decodeWorkspaceReply } from "../src/plugins/workspaces/api.ts";
import {
  workspaceSelection,
  confirmWorkspace,
} from "../src/plugins/stacks/workspace-scope.ts";

// The packaged test entry also imports Astro virtual config. Follow its exact
// re-export to exercise the unmodified production policy function in plain Node.
const testRuntime = new URL(
  import.meta.resolve("emdash/internal/plugin-test-runtime"),
);
const dispatchExport = readFileSync(testRuntime, "utf8").match(
  /import \{[^}]*?([A-Za-z]+) as dispatchPluginApiRequest[^}]*?\} from "([^"]+)"/,
);
assert.ok(
  dispatchExport,
  "Installed EmDash must expose its production plugin dispatcher",
);
const dispatchPluginApiRequest = (
  await import(new URL(dispatchExport[2], testRuntime))
)[dispatchExport[1]];

const origin = "https://composer.loftwah.com";
const owner = {
  id: "fictional-owner-0001",
  email: "owner@example.test",
  name: "Fictional owner",
  role: 20,
};
const editor = {
  id: "fictional-editor-0002",
  email: "editor@example.test",
  name: "Fictional editor",
  role: 20,
};
const viewer = {
  id: "fictional-viewer-0003",
  email: "viewer@example.test",
  name: "Fictional viewer",
  role: 20,
};
const outside = {
  id: "fictional-outside-0004",
  email: "outside@example.test",
  name: "Fictional outsider",
  role: 20,
};
const ctx = (user, input, reading = false, headers = {}) => ({
  user,
  input,
  request: new Request(
    origin +
      "/_emdash/api/plugins/composer-stacks/" +
      (reading ? "accessRead" : "accessWrite"),
    {
      method: reading ? "GET" : "POST",
      headers: { Origin: origin, "X-EmDash-Request": "1", ...headers },
    },
  ),
});
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const name of [
    "0003_stacks.sql",
    "0004_stack_publications.sql",
    "0005_stack_publications_backfill.sql",
    "0006_stack_resources.sql",
    "0008_workspace_access.sql",
    "0011_platform_requests.sql",
  ])
    sqlite.exec(
      readFileSync(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
  let before, after;
  const statement = (sql, params = []) => ({
    sql,
    params,
    bind(...args) {
      return statement(sql, args);
    },
    async first() {
      if (before) await before(sql, params);
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async all() {
      if (before) await before(sql, params);
      return { results: sqlite.prepare(sql).all(...params) };
    },
    async run() {
      if (before) await before(sql, params);
      const result = sqlite.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(result.changes) } };
    },
  });
  const db = {
    prepare: statement,
    async batch(statements) {
      if (before) for (const s of statements) await before(s.sql, s.params);
      sqlite.exec("BEGIN IMMEDIATE");
      let result;
      try {
        result = statements.map((s) => ({
          success: true,
          results: sqlite.prepare(s.sql).all(...s.params),
        }));
        sqlite.exec("COMMIT");
      } catch (cause) {
        sqlite.exec("ROLLBACK");
        throw cause;
      }
      if (after) await after(statements);
      return result;
    },
  };
  const runtime = { DB: db, PUBLIC_ORIGIN: origin };
  return {
    db,
    sqlite,
    runtime,
    route: (user, input, reading = false, headers) =>
      manageWorkspaceAccess(ctx(user, input, reading, headers), runtime),
    stack: (user, input, reading = false) =>
      manageStacks(ctx(user, input, reading), runtime),
    before(fn) {
      before = fn;
    },
    after(fn) {
      after = fn;
    },
    close() {
      sqlite.close();
    },
  };
}
async function invite(f, workspace, recipient, role = "viewer") {
  const opened = await f.route(owner, { action: "open", workspace }, true);
  const result = await f.route(owner, {
    action: "invite",
    workspace,
    expectedRevision: opened.access.workspace.revision,
    email: recipient.email,
    role,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  const listing = await f.route(recipient, { action: "list" }, true);
  const entry = listing.incoming.find(
    (row) => row.id === result.changed.invitation,
  );
  assert.ok(entry);
  return {
    action: "accept",
    workspace,
    expectedRevision: entry.workspaceRevision,
    invitation: entry.id,
    invitationRevision: entry.revision,
  };
}
async function members(f) {
  const space = await workspaceForUser(f.db, owner);
  for (const [recipient, role] of [
    [editor, "editor"],
    [viewer, "viewer"],
  ])
    assert.equal(
      (await f.route(recipient, await invite(f, space.id, recipient, role))).ok,
      true,
    );
  return space;
}
const sample = (name) => ({
  version: 1,
  name,
  description: "Fictional only",
  theme: "midnight",
  instances: [{ id: "fictional-hello-instance", app: "hello", label: "Hello" }],
});

test("actual revocation before the durable native stack write refuses it without touching the stack", async () => {
  for (const action of [
    "save",
    "create",
    "import",
    "publish",
    "unpublish",
    "archive",
    "restore",
    "duplicate",
    "delete",
    "republish",
    "restoreRevision",
  ]) {
    const f = fixture();
    try {
      const space = await members(f);
      const created = await createStack(
        f.db,
        space.id,
        "Fictional saved stack",
      );
      let saved = await saveStack(
        f.db,
        space.id,
        created.id,
        sample(created.name),
        created.revision,
      );
      if (["unpublish", "republish", "restoreRevision"].includes(action))
        saved = (
          await f.stack(owner, {
            action: "publish",
            workspace: space.id,
            stack: saved.id,
            expectedRevision: saved.revision,
          })
        ).stack;
      if (action === "restore")
        saved = (
          await f.stack(owner, {
            action: "archive",
            workspace: space.id,
            stack: saved.id,
            expectedRevision: saved.revision,
          })
        ).stack;
      const count = f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM creator_stacks")
        .get().n;
      const history = f.sqlite
        .prepare("SELECT * FROM creator_stack_publications")
        .all();
      const actor = action === "delete" ? owner : editor;
      let once = false;
      f.before((sql) => {
        if (
          !once &&
          /^(UPDATE creator_stacks|INSERT INTO creator_stacks|INSERT OR IGNORE INTO creator_stack_publications|DELETE FROM creator_stacks)/.test(
            sql,
          )
        ) {
          once = true;
          f.sqlite
            .prepare(
              "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
            )
            .run(space.id, actor.id);
        }
      });
      const command =
        action === "save"
          ? {
              action,
              stack: saved.id,
              expectedRevision: saved.revision,
              document: { ...saved.draft, description: "Must not land" },
            }
          : action === "create"
            ? { action, name: "Must not be created" }
            : action === "import"
              ? {
                  action,
                  name: "Must not be imported",
                  payload: exportStack(saved),
                }
              : {
                  action,
                  stack: saved.id,
                  expectedRevision: saved.revision,
                  revision: saved.publishedRevision,
                };
      const result = await f.stack(actor, { ...command, workspace: space.id });
      assert.equal(result.ok, false, action + " landed after revocation");
      assert.equal(once, true, action + " did not reach its durable boundary");
      assert.deepEqual(await readStack(f.db, space.id, saved.id), saved);
      assert.equal(
        f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_stacks").get().n,
        count,
      );
      assert.deepEqual(
        f.sqlite.prepare("SELECT * FROM creator_stack_publications").all(),
        history,
      );
    } finally {
      f.close();
    }
  }
});

test("pending invitations are recipient-bound one-time grants within the existing authenticated creator boundary", async () => {
  const f = fixture();
  try {
    const personal = await workspaceForUser(f.db, owner);
    const recipientPersonal = await workspaceForUser(f.db, editor);
    const acceptance = await invite(f, personal.id, editor, "editor");
    assert.equal((await f.route(outside, acceptance)).code, "CONFLICT");
    assert.equal(
      (await f.route({ ...editor, role: 10 }, acceptance)).code,
      "FORBIDDEN",
    );
    assert.equal((await f.route(undefined, acceptance)).code, "FORBIDDEN");
    assert.equal(
      (
        await f.route(editor, {
          ...acceptance,
          email: editor.email,
          user: owner.id,
        })
      ).code,
      "INVALID",
    );
    const accepted = await f.route(
      { ...editor, email: "EDITOR@EXAMPLE.TEST" },
      acceptance,
    );
    assert.equal(decodeWorkspaceReply("accept", accepted).ok, true);
    assert.equal(
      accepted.workspaces.find((space) => space.id === personal.id).role,
      "editor",
    );
    assert.equal((await f.route(editor, acceptance)).code, "CONFLICT");
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_members WHERE workspace_id=? AND user_id=?",
        )
        .get(personal.id, editor.id).n,
      1,
    );
    assert.equal((await workspaceForUser(f.db, owner)).id, personal.id);
    assert.equal(
      (await workspaceForUser(f.db, editor)).id,
      recipientPersonal.id,
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT role FROM creator_members WHERE workspace_id=? AND user_id=?",
        )
        .get(recipientPersonal.id, editor.id).role,
      "owner",
    );
    const read = await f.route(
      editor,
      { action: "open", workspace: personal.id },
      true,
    );
    assert.deepEqual(read.access.members, []);
    assert.deepEqual(read.access.invitations, []);
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    f.close();
  }
});

test("expired, revoked and stale invitation snapshots never grant membership or rewrite another grant", async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, owner);
    const acceptance = await invite(f, space.id, editor);
    const before = f.sqlite
      .prepare("SELECT * FROM creator_workspace_invitations")
      .all();
    await assert.rejects(
      changeWorkspaceAccess(
        f.db,
        editor,
        acceptance,
        Date.now() + 8 * 86400000,
      ),
      (error) => error.code === "CONFLICT",
    );
    assert.deepEqual(
      f.sqlite.prepare("SELECT * FROM creator_workspace_invitations").all(),
      before,
    );
    const opened = await f.route(
      owner,
      { action: "open", workspace: space.id },
      true,
    );
    const revoked = await f.route(owner, {
      action: "revokeInvitation",
      workspace: space.id,
      expectedRevision: opened.access.workspace.revision,
      invitation: acceptance.invitation,
      invitationRevision: acceptance.invitationRevision,
    });
    assert.equal(revoked.ok, true);
    const latest = await readWorkspaceAccess(f.db, owner, space.id);
    assert.equal(
      (
        await f.route(editor, {
          ...acceptance,
          expectedRevision: latest.workspace.revision,
        })
      ).code,
      "CONFLICT",
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT role FROM creator_members WHERE workspace_id=? AND user_id=?",
        )
        .get(space.id, editor.id),
      undefined,
    );
    const next = await invite(f, space.id, editor);
    assert.notEqual(next.invitation, acceptance.invitation);
    assert.equal((await f.route(editor, acceptance)).code, "CONFLICT");
    assert.equal((await f.route(editor, next)).ok, true);
  } finally {
    f.close();
  }
});

test("only the current owner changes non-owner grants; owner and original personal membership are protected", async () => {
  const f = fixture();
  try {
    const space = await members(f);
    let access = await readWorkspaceAccess(f.db, owner, space.id);
    const initial = f.sqlite
      .prepare("SELECT * FROM creator_members ORDER BY workspace_id,user_id")
      .all();
    for (const caller of [editor, viewer, outside]) {
      for (const action of [
        { action: "invite", email: "new@example.test", role: "viewer" },
        {
          action: "changeRole",
          member: viewer.id,
          expectedRole: "viewer",
          role: "editor",
        },
        { action: "removeMember", member: viewer.id, expectedRole: "viewer" },
      ])
        assert.equal(
          (
            await f.route(caller, {
              ...action,
              workspace: space.id,
              expectedRevision: access.workspace.revision,
            })
          ).code,
          "FORBIDDEN",
        );
    }
    for (const command of [
      {
        action: "changeRole",
        member: owner.id,
        expectedRole: "owner",
        role: "viewer",
      },
      { action: "removeMember", member: owner.id, expectedRole: "owner" },
      { action: "invite", email: "new@example.test", role: "owner" },
      { action: "deleteWorkspace" },
    ])
      assert.equal(
        (
          await f.route(owner, {
            ...command,
            workspace: space.id,
            expectedRevision: access.workspace.revision,
          })
        ).code,
        "INVALID",
      );
    assert.deepEqual(
      f.sqlite
        .prepare("SELECT * FROM creator_members ORDER BY workspace_id,user_id")
        .all(),
      initial,
    );
    const changed = await f.route(owner, {
      action: "changeRole",
      workspace: space.id,
      expectedRevision: access.workspace.revision,
      member: editor.id,
      expectedRole: "editor",
      role: "viewer",
    });
    assert.equal(changed.ok, true);
    assert.equal(
      (
        await f.stack(editor, {
          action: "create",
          workspace: space.id,
          name: "Must refuse",
        })
      ).code,
      "FORBIDDEN",
    );
    access = await readWorkspaceAccess(f.db, owner, space.id);
    const removed = await f.route(owner, {
      action: "removeMember",
      workspace: space.id,
      expectedRevision: access.workspace.revision,
      member: editor.id,
      expectedRole: "viewer",
    });
    assert.equal(removed.ok, true);
    assert.equal(
      (await f.stack(editor, { action: "list", workspace: space.id }, true))
        .code,
      "FORBIDDEN",
    );
    assert.equal(
      (await f.route(editor, { action: "open", workspace: space.id }, true))
        .code,
      "FORBIDDEN",
    );
    assert.equal(
      (await workspaceForUser(f.db, editor)).role,
      "owner",
      "their personal workspace survives removal",
    );
  } finally {
    f.close();
  }
});

test("workspace CAS and an owner revocation at the transaction boundary refuse every losing access write", async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, owner);
    const access = await readWorkspaceAccess(f.db, owner, space.id);
    const first = await f.route(owner, {
      action: "invite",
      workspace: space.id,
      expectedRevision: access.workspace.revision,
      email: editor.email,
      role: "viewer",
    });
    assert.equal(first.ok, true);
    assert.equal(
      (
        await f.route(owner, {
          action: "invite",
          workspace: space.id,
          expectedRevision: access.workspace.revision,
          email: viewer.email,
          role: "viewer",
        })
      ).code,
      "CONFLICT",
    );
    const latest = await readWorkspaceAccess(f.db, owner, space.id);
    let once = false;
    f.before((sql) => {
      if (
        !once &&
        sql.startsWith("UPDATE creator_workspaces SET access_revision")
      ) {
        once = true;
        f.sqlite
          .prepare(
            "UPDATE creator_members SET role='editor' WHERE workspace_id=? AND user_id=?",
          )
          .run(space.id, owner.id);
      }
    });
    assert.equal(
      (
        await f.route(owner, {
          action: "invite",
          workspace: space.id,
          expectedRevision: latest.workspace.revision,
          email: viewer.email,
          role: "viewer",
        })
      ).code,
      "CONFLICT",
    );
    assert.equal(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM creator_workspace_invitations")
        .get().n,
      1,
    );
    assert.equal(
      f.sqlite
        .prepare("SELECT access_revision FROM creator_workspaces WHERE id=?")
        .get(space.id).access_revision,
      latest.workspace.revision,
    );
  } finally {
    f.close();
  }
});

test("lost local transaction acknowledgements are verified by refresh and cannot create duplicate pending grants", async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, owner);
    const access = await readWorkspaceAccess(f.db, owner, space.id);
    let once = false;
    f.after((statements) => {
      if (
        !once &&
        statements.some((s) =>
          s.sql.startsWith("INSERT INTO creator_workspace_invitations"),
        )
      ) {
        once = true;
        throw Error("Commit succeeded but D1 acknowledgement was lost");
      }
    });
    const command = {
      action: "invite",
      workspace: space.id,
      expectedRevision: access.workspace.revision,
      email: editor.email,
      role: "editor",
    };
    assert.equal((await f.route(owner, command)).code, "UNAVAILABLE");
    const refreshed = await f.route(
      owner,
      { action: "open", workspace: space.id },
      true,
    );
    assert.equal(refreshed.access.invitations.length, 1);
    assert.equal(refreshed.access.invitations[0].status, "pending");
    assert.equal((await f.route(owner, command)).code, "CONFLICT");
    assert.equal(
      (
        await f.route(owner, {
          ...command,
          expectedRevision: refreshed.access.workspace.revision,
        })
      ).code,
      "CONFLICT",
    );
    assert.equal(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM creator_workspace_invitations")
        .get().n,
      1,
    );
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    f.close();
  }
});

test("new workspace creation keeps original stacks, publication bytes and personal owner selection intact", async () => {
  const f = fixture();
  try {
    const space = await workspaceForUser(f.db, owner);
    let stack = await createStack(f.db, space.id, "Fictional preserved stack");
    stack = await saveStack(
      f.db,
      space.id,
      stack.id,
      sample(stack.name),
      stack.revision,
    );
    stack = (
      await f.stack(owner, {
        action: "publish",
        workspace: space.id,
        stack: stack.id,
        expectedRevision: stack.revision,
      })
    ).stack;
    const row = f.sqlite
      .prepare("SELECT * FROM creator_stacks WHERE id=?")
      .get(stack.id);
    const publication = f.sqlite
      .prepare("SELECT * FROM creator_stack_publications WHERE stack_id=?")
      .all(stack.id);
    const generate = crypto.randomUUID;
    let created;
    try {
      crypto.randomUUID = () => "00000000-0000-4000-8000-000000000000";
      created = await f.route(owner, {
        action: "create",
        name: "Fictional collaboration workspace",
      });
    } finally {
      crypto.randomUUID = generate;
    }
    assert.equal(created.ok, true);
    assert.notEqual(created.changed.workspace, space.id);
    f.sqlite
      .prepare(
        "UPDATE creator_members SET created_at=(SELECT created_at FROM creator_members WHERE workspace_id=? AND user_id=?) WHERE workspace_id=? AND user_id=?",
      )
      .run(space.id, owner.id, created.changed.workspace, owner.id);
    assert.equal((await workspaceForUser(f.db, owner)).id, space.id);
    assert.deepEqual(
      f.sqlite.prepare("SELECT * FROM creator_stacks WHERE id=?").get(stack.id),
      row,
    );
    assert.deepEqual(
      f.sqlite
        .prepare("SELECT * FROM creator_stack_publications WHERE stack_id=?")
        .all(stack.id),
      publication,
    );
    assert.equal(
      (
        await f.stack(
          owner,
          { action: "list", workspace: created.changed.workspace },
          true,
        )
      ).stacks.length,
      0,
    );
    assert.equal(
      (
        await f.stack(
          outside,
          {
            action: "open",
            workspace: created.changed.workspace,
            stack: stack.id,
          },
          true,
        )
      ).code,
      "FORBIDDEN",
    );
  } finally {
    f.close();
  }
});

test("revocation before a resource journal CAS leaves no new resource, binding or remote write", async () => {
  const f = fixture();
  try {
    const space = await members(f);
    const created = await createStack(
      f.db,
      space.id,
      "Fictional resource reservation",
    );
    const saved = await saveStack(
      f.db,
      space.id,
      created.id,
      {
        ...sample(created.name),
        instances: [
          { id: "fictional-book-instance", app: "guestbook", label: "Book" },
        ],
      },
      created.revision,
    );
    let calls = 0;
    Object.assign(f.runtime, {
      RESOURCE_ACCOUNT_ID: "fictional-account",
      RESOURCE_ENVIRONMENT: "production",
      GUESTBOOK_OWNER_TOKEN: "fictional-only-token",
      GUESTBOOK: {
        async fetch() {
          calls++;
          throw Error("No app call is expected");
        },
      },
    });
    let once = false;
    f.before((sql) => {
      if (
        !once &&
        sql.startsWith("UPDATE creator_stacks SET revision=revision+1")
      ) {
        once = true;
        f.sqlite
          .prepare(
            "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
          )
          .run(space.id, editor.id);
      }
    });
    const result = await f.stack(editor, {
      action: "applyResources",
      workspace: space.id,
      stack: saved.id,
      expectedRevision: saved.revision,
    });
    assert.equal(result.ok, false);
    assert.equal(once, true);
    assert.equal(calls, 0);
    for (const table of [
      "creator_app_resources",
      "creator_stack_resource_bindings",
      "creator_resource_operations",
    ])
      assert.equal(
        f.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,
        0,
        table,
      );
    assert.deepEqual(await readStack(f.db, space.id, saved.id), saved);
  } finally {
    f.close();
  }
});

test("native route origin, account role, selectors and strict decoder cannot supply authority from browser data", async () => {
  const f = fixture();
  try {
    for (const caller of [
      undefined,
      ...[10, 0, 99, "20"].map((role) => ({ ...owner, role })),
    ])
      assert.equal(
        (await f.route(caller, { action: "list" }, true)).code,
        "FORBIDDEN",
      );
    assert.equal(
      (
        await f.route(owner, { action: "list" }, true, {
          Origin: "https://outside.example.test",
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.route(owner, { action: "create", name: "Must refuse" }, false, {
          "X-EmDash-Request": "",
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await manageWorkspaceAccess(ctx(owner, { action: "list" }, true), {
          ...f.runtime,
          PUBLIC_ORIGIN: "https://preview.example.test",
        })
      ).code,
      "UNAVAILABLE",
    );
    assert.throws(() =>
      workspaceSelection(
        "?workspace=valid-workspace&workspace=other-workspace",
      ),
    );
    assert.throws(() =>
      workspaceSelection("?workspace=https://outside.example.test"),
    );
    assert.equal(
      workspaceSelection("?workspace=valid-workspace"),
      "valid-workspace",
    );
    assert.throws(() => confirmWorkspace("valid-workspace", "other-workspace"));
    assert.throws(() =>
      decodeWorkspaceReply("invite", {
        ok: true,
        workspaces: [],
        incoming: [],
        changed: { action: "invite", workspace: "valid-workspace" },
      }),
    );
    assert.throws(() =>
      decodeWorkspaceReply("open", { ok: true, workspaces: [], incoming: [] }),
    );
    assert.throws(() =>
      decodeWorkspaceReply("accept", {
        ok: true,
        workspaces: [],
        incoming: [],
        changed: {
          action: "invite",
          workspace: "valid-workspace",
          invitation: "valid-invitation",
        },
      }),
    );
  } finally {
    f.close();
  }
});

test("actual EmDash permission dispatch admits role20 Creator work and refuses legacy/global administration", async () => {
  const f = fixture();
  try {
    const definition = creatorPlugin("fictional-admin-entry", f.runtime);
    let invocations = 0;
    const host = {
      getPluginRouteMeta(plugin, path) {
        if (plugin === "composer-stacks")
          return definition.routes[path.slice(1)] ?? null;
        if (plugin === "composer-miniapps")
          return { methods: ["POST"], permission: "plugins:manage" };
        return null;
      },
      async handlePluginApiRoute(plugin, method, path, request, user) {
        invocations++;
        const input =
          method === "GET"
            ? Object.fromEntries(new URL(request.url).searchParams)
            : await request.json();
        const data =
          plugin === "composer-stacks"
            ? await definition.routes[path.slice(1)].handler({
                request,
                input,
                user,
              })
            : await manageMiniapps({ request, input, user }, f.runtime, {});
        return { success: true, data };
      },
    };
    const dispatch = (
      user,
      path,
      input,
      pluginId = "composer-stacks",
      headers = {},
    ) => {
      const reading = path.endsWith("Read") || path === "/read";
      const request = new Request(
        origin +
          "/_emdash/api/plugins/" +
          pluginId +
          path +
          (reading ? "?" + new URLSearchParams(input) : ""),
        {
          method: reading ? "GET" : "POST",
          headers: { Origin: origin, "X-EmDash-Request": "1", ...headers },
          ...(reading ? {} : { body: JSON.stringify(input) }),
        },
      );
      return dispatchPluginApiRequest({
        runtime: host,
        pluginId,
        path,
        request,
        user,
      });
    };
    for (const caller of [undefined, { ...owner, role: 10 }]) {
      assert.equal(
        (await dispatch(caller, "/accessRead", { action: "list" })).status,
        caller ? 403 : 401,
      );
      assert.equal(
        invocations,
        0,
        "Host refuses before a Creator handler runs",
      );
    }
    for (const role of [20, 30, 40, 50]) {
      const response = await dispatch({ ...owner, role }, "/accessRead", {
        action: "list",
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.ok, true);
    }
    const personal = await workspaceForUser(f.db, owner);
    const createdResponse = await dispatch(owner, "/write", {
      action: "create",
      workspace: personal.id,
      name: "Role20 Creator project",
    });
    const created = (await createdResponse.json()).data;
    assert.equal(created.ok, true);
    assert.equal(created.workspace.role, "owner");
    const accepted = await dispatch(
      editor,
      "/accessWrite",
      await invite(f, personal.id, editor, "editor"),
    );
    assert.equal((await accepted.json()).data.ok, true);
    const changed = await dispatch(editor, "/write", {
      action: "save",
      workspace: personal.id,
      stack: created.stack.id,
      expectedRevision: created.stack.revision,
      document: sample("Role20 editor project"),
    });
    assert.equal((await changed.json()).data.ok, true);
    assert.equal(
      (
        await (
          await dispatch(outside, "/read", {
            action: "open",
            workspace: personal.id,
            stack: created.stack.id,
          })
        ).json()
      ).data.code,
      "FORBIDDEN",
    );
    const beforeGlobal = invocations;
    assert.equal(
      (
        await dispatch(
          owner,
          "/write",
          { action: "settings" },
          "composer-miniapps",
        )
      ).status,
      403,
    );
    assert.equal(
      invocations,
      beforeGlobal,
      "Global mini-app handler is never reached by role20",
    );
    assert.equal(
      (await manageMiniapps(ctx(owner, { action: "settings" }), f.runtime, {}))
        .code,
      "FORBIDDEN",
      "Second global boundary stays role50",
    );
    const packageEntry = import.meta.resolve("emdash");
    const { GET: usersGet } = await import(
      new URL("./astro/routes/api/admin/users/index.mjs", packageEntry)
    );
    const { POST: pluginDisable } = await import(
      new URL("./astro/routes/api/admin/plugins/_id_/disable.mjs", packageEntry)
    );
    const globalContext = {
      locals: { user: owner, emdash: { db: {} } },
      url: new URL(origin + "/_emdash/api/admin/users"),
      params: { id: "composer-miniapps" },
    };
    assert.equal((await usersGet(globalContext)).status, 403);
    assert.equal((await pluginDisable(globalContext)).status, 403);
    assert.equal(
      (
        await dispatch(
          owner,
          "/write",
          { action: "create", name: "No CSRF" },
          "composer-stacks",
          { "X-EmDash-Request": "" },
        )
      ).status,
      403,
    );
    assert.equal(owner.role, 20);
    assert.equal(editor.role, 20);
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    f.close();
  }
});
