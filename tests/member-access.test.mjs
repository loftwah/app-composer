import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  manageMembers,
  memberIssuer as origin,
} from "../src/lib/member-access.ts";
import { memberPlugin } from "../src/lib/member-plugin.ts";
import { manageWorkspaceAccess } from "../src/lib/workspace-access.ts";
const owner = {
  id: "fictional-owner",
  email: "owner@example.test",
  name: "Owner",
  role: 50,
};
const a = {
  id: "fictional-member-a",
  email: "a@example.test",
  name: "Member A",
  role: 10,
};
const b = {
  id: "fictional-member-b",
  email: "b@example.test",
  name: "Member B",
  role: 10,
};
const pins = { showcase: "a".repeat(40), guestbook: "b".repeat(40) };
const workspace = "fictional-space";
const ctx = (user, input, read = false, headers = {}) => ({
  user,
  input,
  request: new Request(
    origin +
      "/_emdash/api/plugins/composer-members/" +
      (read ? "read" : "write"),
    {
      method: read ? "GET" : "POST",
      headers: { Origin: origin, "X-EmDash-Request": "1", ...headers },
    },
  ),
});
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const migration of [
    "0003_stacks.sql",
    "0004_stack_publications.sql",
    "0005_stack_publications_backfill.sql",
    "0006_stack_resources.sql",
    "0008_workspace_access.sql",
    "0010_member_app_grants.sql",
  ])
    sqlite.exec(
      readFileSync(
        new URL("../migrations/" + migration, import.meta.url),
        "utf8",
      ),
    );
  let before;
  const statement = (sql, args = []) => ({
    sql,
    args,
    bind(...next) {
      return statement(sql, next);
    },
    async first() {
      await before?.(sql, args);
      return sqlite.prepare(sql).get(...args) ?? null;
    },
    async all() {
      await before?.(sql, args);
      return { results: sqlite.prepare(sql).all(...args) };
    },
    async run() {
      await before?.(sql, args);
      return sqlite.prepare(sql).run(...args);
    },
  });
  const db = {
    prepare: statement,
    async batch(statements) {
      for (const s of statements) await before?.(s.sql, s.args);
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((s) => ({
          results: sqlite.prepare(s.sql).all(...s.args),
        }));
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  sqlite
    .prepare("INSERT INTO creator_workspaces(id,name) VALUES(?,?)")
    .run(workspace, "Fictional members");
  sqlite
    .prepare(
      "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'owner')",
    )
    .run(workspace, owner.id);
  const runtime = {
    PUBLIC_ORIGIN: origin,
    DB: db,
    COMPOSER_PROFILE_BRIDGE_TOKEN: "fictional-profile-token",
    GUESTBOOK_MEMBER_TOKEN: "fictional-guestbook-token",
    RESOURCE_ACCOUNT_ID: "fictional-account",
    RESOURCE_ENVIRONMENT: "fictional",
  };
  const f = {
    sqlite,
    db,
    runtime,
    before(fn) {
      before = fn;
    },
    call: (user, input, read = false, headers) =>
      manageMembers(ctx(user, input, read, headers), runtime, pins),
    revision: () =>
      sqlite
        .prepare(
          "SELECT access_revision AS n FROM creator_workspaces WHERE id=?",
        )
        .get(workspace).n,
    close: () => sqlite.close(),
  };
  f.add = (user) =>
    sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'viewer')",
      )
      .run(workspace, user.id);
  f.grant = (user, app, resource, capability) =>
    f.call(owner, {
      action: "grant",
      workspace,
      expectedRevision: f.revision(),
      member: user.id,
      app,
      resource,
      capability,
    });
  f.revoke = async (user, app, resource, capability) => {
    const g = sqlite
      .prepare(
        "SELECT revision FROM creator_app_grants WHERE user_id=? AND app=? AND resource_id=? AND action=?",
      )
      .get(user.id, app, resource, capability);
    return f.call(owner, {
      action: "revoke",
      workspace,
      expectedRevision: f.revision(),
      member: user.id,
      app,
      resource,
      capability,
      expectedGrantRevision: g.revision,
    });
  };
  return f;
}
test("role10 account can inspect its own invitations and accept exact recipient without creator permissions or auto ownership", async () => {
  const f = fixture();
  try {
    const empty = await f.call(a, { action: "session" }, true);
    assert.equal(empty.ok, true);
    assert.deepEqual(empty.workspaces, []);
    assert.equal(
      f.sqlite.prepare("SELECT COUNT(*) AS n FROM creator_members").get().n,
      1,
    );
    assert.equal(
      (await manageWorkspaceAccess(ctx(a, { action: "list" }, true), f.runtime))
        .code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call(owner, {
          action: "invite",
          workspace,
          expectedRevision: f.revision(),
          email: a.email,
          role: "viewer",
        })
      ).ok,
      true,
    );
    const incoming = (await f.call(a, { action: "session" }, true)).incoming[0];
    const accept = {
      action: "accept",
      workspace,
      expectedRevision: incoming.workspaceRevision,
      invitation: incoming.id,
      invitationRevision: incoming.revision,
    };
    assert.equal((await f.call(b, accept)).code, "CONFLICT");
    assert.equal((await f.call(a, accept)).ok, true);
    assert.equal((await f.call(a, accept)).code, "CONFLICT");
    assert.equal(
      (await f.call(a, { action: "people", workspace }, true)).code,
      "FORBIDDEN",
    );
    const forged = { ...accept, actor: owner.id };
    assert.equal((await f.call(a, forged)).code, "INVALID");
  } finally {
    f.close();
  }
});
test("expired and revoked invitation cannot be accepted", async () => {
  for (const status of ["expired", "revoked"]) {
    const f = fixture();
    try {
      await f.call(owner, {
        action: "invite",
        workspace,
        expectedRevision: f.revision(),
        email: a.email,
        role: "viewer",
      });
      const incoming = (await f.call(a, { action: "session" }, true))
        .incoming[0];
      f.sqlite
        .prepare("UPDATE creator_workspace_invitations SET status=? WHERE id=?")
        .run(status, incoming.id);
      assert.equal(
        (
          await f.call(a, {
            action: "accept",
            workspace,
            expectedRevision: f.revision(),
            invitation: incoming.id,
            invitationRevision: incoming.revision,
          })
        ).code,
        "CONFLICT",
      );
    } finally {
      f.close();
    }
  }
});
test("exact Guestbook grant, standalone-resistant service dispatch and next-request revocation preserve unrelated profile access", async () => {
  const f = fixture();
  try {
    f.add(a);
    f.add(b);
    const resource = "fictional-book";
    f.sqlite
      .prepare(
        "INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target,state) VALUES(?,?,'guestbook',?,?,?,'ready')",
      )
      .run(
        resource,
        workspace,
        "fictional-account",
        "fictional",
        origin + "/guestbook",
      );
    const calls = [];
    f.runtime.GUESTBOOK_MEMBERS = {
      async fetch(req) {
        calls.push({
          url: req.url,
          body: await req.json(),
          headers: req.headers,
        });
        return Response.json({
          contract: 1,
          resource: { id: resource, version: 1 },
          items: [],
        });
      },
    };
    f.runtime.SHOWCASE = {
      async fetch(req) {
        return Response.json({
          ok: true,
          resource: "fictional-profile-b",
          profile: { name: "B" },
        });
      },
    };
    await f.grant(a, "guestbook", resource, "contribute");
    await f.grant(b, "guestbook", resource, "moderate");
    await f.grant(b, "showcase", "fictional-profile-b", "maintain");
    const request = {
      action: "guestbook",
      workspace,
      resource,
      capability: "moderate",
      input: { operation: "list" },
    };
    assert.equal((await f.call(a, request)).code, "FORBIDDEN");
    assert.equal(
      (await f.call(b, { ...request, resource: "another-resource" })).code,
      "FORBIDDEN",
    );
    assert.equal((await f.call(b, request)).ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body.actor, { issuer: origin, accountId: b.id });
    assert.equal(calls[0].url, origin + "/guestbook/__composer/member");
    assert.equal(
      calls[0].headers.get("Authorization"),
      "Bearer fictional-guestbook-token",
    );
    assert.equal(
      (await f.revoke(b, "guestbook", resource, "moderate")).ok,
      true,
    );
    assert.equal((await f.call(b, request)).code, "FORBIDDEN");
    assert.equal(calls.length, 1);
    assert.equal(
      (
        await f.call(b, {
          action: "profile",
          workspace,
          operation: "read",
          resource: "fictional-profile-b",
        })
      ).ok,
      true,
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_app_access_audit WHERE event='revoke'",
        )
        .get().n,
      1,
    );
    assert.equal(
      (
        await f.call(b, {
          action: "grant",
          workspace,
          expectedRevision: f.revision(),
          member: b.id,
          app: "guestbook",
          resource,
          capability: "moderate",
        })
      ).code,
      "FORBIDDEN",
    );
  } finally {
    f.close();
  }
});
test("revocation at final dispatch SQL prevents service call", async () => {
  const f = fixture();
  try {
    f.add(a);
    await f.grant(a, "showcase", "fictional-profile-a", "maintain");
    let calls = 0;
    f.runtime.SHOWCASE = {
      async fetch() {
        calls++;
        return Response.json({ ok: true, resource: "fictional-profile-a" });
      },
    };
    let once = false;
    f.before((sql) => {
      if (!once && sql.startsWith("INSERT INTO creator_app_access_audit")) {
        once = true;
        f.sqlite
          .prepare(
            "UPDATE creator_app_grants SET status='revoked',revision=revision+1",
          )
          .run();
      }
    });
    assert.equal(
      (
        await f.call(a, {
          action: "profile",
          workspace,
          operation: "read",
          resource: "fictional-profile-a",
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(calls, 0);
  } finally {
    f.close();
  }
});
test("profile create binds selected capabilities only; account/resource forgery and publication escalation fail", async () => {
  const f = fixture();
  try {
    f.add(a);
    f.add(b);
    await f.grant(a, "showcase", "new-profile", "create");
    await f.grant(a, "showcase", "new-profile", "maintain");
    const calls = [];
    f.runtime.SHOWCASE = {
      async fetch(req) {
        calls.push(await req.json());
        return Response.json({
          ok: true,
          resource: "fictional-profile-a",
          profile: { name: "A" },
        });
      },
    };
    const created = await f.call(a, {
      action: "profile",
      workspace,
      operation: "create",
      command: { handle: "fictional-a" },
    });
    assert.equal(created.ok, true, JSON.stringify(created));
    assert.deepEqual(
      created.grants
        .filter((g) => g.resource === "fictional-profile-a")
        .map((g) => g.action),
      ["maintain"],
    );
    assert.deepEqual(calls[0].actor, { issuer: origin, subject: a.id });
    assert.equal(
      (
        await f.call(a, {
          action: "profile",
          workspace,
          operation: "publish",
          resource: "fictional-profile-a",
          expectedRevision: 1,
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call(a, {
          action: "profile",
          workspace,
          operation: "share-card",
          resource: "fictional-profile-a",
          expectedRevision: 1,
          command: { action: "adopt" },
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call(b, {
          action: "profile",
          workspace,
          operation: "read",
          resource: "fictional-profile-a",
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call(a, {
          action: "profile",
          workspace,
          operation: "export",
          resource: "fictional-profile-a",
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call(a, {
          action: "profile",
          workspace,
          operation: "profile-settings",
          resource: "fictional-profile-a",
          command: { operation: "export" },
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call(a, {
          action: "profile",
          workspace,
          operation: "read",
          resource: "fictional-profile-a",
          actor: b.id,
        })
      ).code,
      "INVALID",
    );
  } finally {
    f.close();
  }
});
test("revocation while create is dispatched preserves app result but cannot bind access", async () => {
  const f = fixture();
  try {
    f.add(a);
    await f.grant(a, "showcase", "new-profile", "create");
    await f.grant(a, "showcase", "new-profile", "maintain");
    f.runtime.SHOWCASE = {
      async fetch() {
        await f.revoke(a, "showcase", "new-profile", "maintain");
        return Response.json({ ok: true, resource: "fictional-profile-a" });
      },
    };
    assert.equal(
      (await f.call(a, { action: "profile", workspace, operation: "create" }))
        .code,
      "FORBIDDEN",
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_app_grants WHERE resource_id='fictional-profile-a'",
        )
        .get().n,
      0,
    );
  } finally {
    f.close();
  }
});
test("unknown create outcome retains entitlement and no-profile recovery read does not bind", async () => {
  const f = fixture();
  try {
    f.add(a);
    await f.grant(a, "showcase", "new-profile", "create");
    f.runtime.SHOWCASE = {
      async fetch() {
        throw Error("lost acknowledgement");
      },
    };
    assert.equal(
      (await f.call(a, { action: "profile", workspace, operation: "create" }))
        .code,
      "UNAVAILABLE",
    );
    assert.equal(
      (await f.call(a, { action: "session" }, true)).grants.length,
      1,
    );
    f.runtime.SHOWCASE = {
      async fetch() {
        return Response.json({ ok: true, version: 1, profile: null });
      },
    };
    assert.equal(
      (await f.call(a, { action: "profile", workspace, operation: "read" })).ok,
      true,
    );
    assert.equal(
      (await f.call(a, { action: "session" }, true)).grants.length,
      1,
    );
  } finally {
    f.close();
  }
});
test("member surface rejects anonymous, foreign origin, missing CSRF and wrong installation", async () => {
  const f = fixture();
  try {
    assert.equal(
      (await f.call(undefined, { action: "session" }, true)).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await f.call(a, { action: "session" }, true, {
          Origin: "https://attacker.example",
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (await f.call(a, { action: "session" }, true, { "X-EmDash-Request": "" }))
        .code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await manageMembers(
          ctx(a, { action: "session" }, true),
          { ...f.runtime, PUBLIC_ORIGIN: "https://preview.example" },
          pins,
        )
      ).code,
      "UNAVAILABLE",
    );
    const plugin = memberPlugin(f.runtime, pins);
    assert.equal(plugin.routes.read.permission, "content:read");
    assert.equal(plugin.routes.write.permission, "content:read");
    assert.equal(plugin.routes.read.public, undefined);
  } finally {
    f.close();
  }
});

test("installed EmDash 1.2.0 dispatcher permits role10 member routes and refuses unrelated draft/admin routes", async () => {
  const f = fixture();
  try {
    const entry = new URL(
      import.meta.resolve("emdash/internal/plugin-test-runtime"),
    );
    const match = readFileSync(entry, "utf8").match(
      /import \{[^}]*?([A-Za-z]+) as dispatchPluginApiRequest[^}]*?\} from "([^"]+)"/,
    );
    assert.ok(match);
    const dispatch = (await import(new URL(match[2], entry)))[match[1]];
    const definition = memberPlugin(f.runtime, pins);
    let calls = 0;
    const host = {
      getPluginRouteMeta(plugin, path) {
        if (plugin === "composer-members")
          return definition.routes[path.slice(1)];
        if (plugin === "drafts")
          return { methods: ["GET"], permission: "content:read_drafts" };
        return { methods: ["GET"], permission: "plugins:manage" };
      },
      async handlePluginApiRoute(plugin, method, path, request, user) {
        calls++;
        return {
          success: true,
          data: await definition.routes[path.slice(1)].handler({
            request,
            user,
            input: Object.fromEntries(new URL(request.url).searchParams),
          }),
        };
      },
    };
    const invoke = (user, plugin = "composer-members", headers = {}) =>
      dispatch({
        runtime: host,
        pluginId: plugin,
        path: "/read",
        user,
        request: new Request(
          origin + "/_emdash/api/plugins/" + plugin + "/read?action=session",
          { headers: { "X-EmDash-Request": "1", ...headers } },
        ),
      });
    assert.equal((await invoke(undefined)).status, 401);
    assert.equal((await invoke(a, "drafts")).status, 403);
    assert.equal((await invoke(a, "global-admin")).status, 403);
    assert.equal(calls, 0);
    const response = await invoke(a);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.actor.subject, a.id);
    assert.equal(calls, 1);
    assert.equal(
      (await invoke(a, "composer-members", { "X-EmDash-Request": "" })).status,
      403,
    );
  } finally {
    f.close();
  }
});
