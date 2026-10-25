import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  manageTeamHub,
  teamHubPageGate,
  teamHubProfile,
} from "../src/lib/team-hub.ts";
import {
  recoveryChecklist,
  filterTeamRequests,
} from "../src/components/team-hub/workspace.ts";
import { teamHubSnapshot } from "../src/lib/team-hub-contract.ts";

const origin = "http://localhost:4444",
  alpha = "team-alpha",
  bravo = "team-bravo";
const users = {
  owner: { id: "alpha-owner", role: 10 },
  editor: { id: "alpha-editor", role: 10 },
  viewer: { id: "alpha-viewer", role: 10 },
  other: { id: "bravo-owner", role: 10 },
  outsider: { id: "site-admin", role: 50 },
};
const action = {
  title: "Confirm the drill",
  body: "Review the fictional evacuation checklist before Friday.",
  assignee: null,
  status: "open",
  attachment: {
    name: "checklist.txt",
    text: "Fictional checklist\nKeep the previous version.",
  },
};
function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role INTEGER,disabled INTEGER DEFAULT 0)",
  );
  for (const [key, user] of Object.entries(users))
    sqlite
      .prepare("INSERT INTO users(id,name,email,role)VALUES(?,?,?,?)")
      .run(user.id, key + " (fictional)", key + "@example.test", user.role);
  for (const file of [
    "0003_stacks.sql",
    "0008_workspace_access.sql",
    "0010_member_app_grants.sql",
  ])
    sqlite.exec(
      readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
    );
  sqlite.exec(
    "INSERT INTO creator_workspaces(id,name)VALUES('team-alpha','Fictional Alpha'),('team-bravo','Fictional Bravo'); INSERT INTO creator_members(workspace_id,user_id,role)VALUES('team-alpha','alpha-owner','owner'),('team-alpha','alpha-editor','editor'),('team-alpha','alpha-viewer','viewer'),('team-bravo','bravo-owner','owner')",
  );
  sqlite.exec(
    "INSERT INTO creator_app_grants(id,issuer,workspace_id,user_id,app,resource_id,action,status,revision,created_by)VALUES('legacy-revoked','https://composer.loftwah.com','team-alpha','alpha-owner','showcase','legacy-profile','maintain','revoked',7,'alpha-owner')",
  );
  sqlite.exec(
    "INSERT INTO creator_app_access_audit(id,issuer,workspace_id,actor_id,member_id,app,resource_id,action,event,grant_revision)VALUES('legacy-audit','https://composer.loftwah.com','team-alpha','alpha-owner','alpha-owner','showcase','legacy-profile','maintain','revoke',7)",
  );
  const legacy = {
    grants: sqlite
      .prepare("SELECT * FROM creator_app_grants ORDER BY id")
      .all(),
    audit: sqlite
      .prepare("SELECT * FROM creator_app_access_audit ORDER BY id")
      .all(),
  };
  sqlite.exec(
    readFileSync(
      new URL("../migrations/0021_team_hub.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    sqlite.prepare("SELECT * FROM creator_app_grants ORDER BY id").all(),
    legacy.grants,
  );
  assert.deepEqual(
    sqlite.prepare("SELECT * FROM creator_app_access_audit ORDER BY id").all(),
    legacy.audit,
  );
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  let beforeBatch;
  const statement = (sql, params = []) => ({
    sql,
    params,
    bind(...args) {
      return statement(sql, args);
    },
    async first() {
      return sqlite.prepare(sql).get(...params) ?? null;
    },
    async all() {
      return { results: sqlite.prepare(sql).all(...params) };
    },
  });
  const db = {
    prepare: statement,
    async batch(statements) {
      if (beforeBatch) {
        const before = beforeBatch;
        beforeBatch = null;
        await before();
      }
      sqlite.exec("BEGIN");
      try {
        const result = statements.map((s) => ({
          success: true,
          results: sqlite.prepare(s.sql).all(...s.params),
        }));
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const runtime = {
    DB: db,
    PUBLIC_ORIGIN: origin,
    RESOURCE_ACCOUNT_ID: "fictional-account",
    RESOURCE_ENVIRONMENT: "production",
    TEAM_HUB_AUTH_PROFILE: "native-local",
  };
  const ctx = (user, input) => ({
    user,
    input,
    request: new Request(
      origin +
        "/_emdash/api/plugins/composer-members/teamHub" +
        (["scope", "read", "history", "attachment", "connection"].includes(
          input.action,
        )
          ? "Read"
          : "Write"),
      {
        method: [
          "scope",
          "read",
          "history",
          "attachment",
          "connection",
        ].includes(input.action)
          ? "GET"
          : "POST",
        headers: { Origin: origin, "X-EmDash-Request": "1" },
      },
    ),
  });
  const call = (user, input, env = runtime) =>
    manageTeamHub(ctx(user, input), env);
  return {
    sqlite,
    legacy,
    runtime,
    ctx,
    call,
    interleave(fn) {
      beforeBatch = fn;
    },
  };
}
async function enabled(f, workspace = alpha, user = users.owner) {
  const result = await f.call(user, {
    action: "enable",
    workspace,
    expectedRevision: 0,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}
async function share(f, state, user = users.owner, member = users.editor.id) {
  const result = await f.call(user, {
    action: "grant",
    workspace: state.target.workspace,
    expectedRevision: state.revision,
    member,
    capability: "use",
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}
test("migration preserves legacy grants/audit/FKs and Team Hub starts without implicit user grants", async (t) => {
  const f = fixture(t);
  const state = await f.call(users.owner, { action: "read", workspace: alpha });
  assert.equal(state.enabled, false);
  assert.equal(state.requests.length, 0);
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT COUNT(*)AS n FROM creator_app_grants WHERE app='team-hub'",
      )
      .get().n,
    0,
  );
  await enabled(f);
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT COUNT(*)AS n FROM creator_app_grants WHERE app='team-hub'",
      )
      .get().n,
    2,
  );
  assert.equal(
    f.sqlite
      .prepare(
        "SELECT COUNT(*)AS n FROM creator_app_access_audit WHERE app='team-hub'",
      )
      .get().n,
    2,
  );
  assert.equal(
    (await f.call(users.viewer, { action: "read", workspace: alpha })).code,
    "FORBIDDEN",
  );
  assert.equal(
    (await f.call(users.outsider, { action: "read", workspace: alpha })).code,
    "FORBIDDEN",
    "global admin is no team bypass",
  );
  f.sqlite
    .prepare("DELETE FROM creator_members WHERE workspace_id=? AND user_id=?")
    .run(alpha, users.owner.id);
  assert.equal(
    f.sqlite
      .prepare("SELECT COUNT(*)AS n FROM creator_app_grants WHERE user_id=?")
      .get(users.owner.id).n,
    0,
  );
  assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
});
test("ordinary role10 members create/update requests, preserve revisions and privately download attachment", async (t) => {
  const f = fixture(t);
  let state = await enabled(f);
  state = await share(f, state);
  state = await share(f, state, users.owner, users.viewer.id);
  const id = crypto.randomUUID();
  state = await f.call(users.editor, {
    action: "save",
    workspace: alpha,
    expectedRevision: state.revision,
    id,
    expectedRequestRevision: 0,
    request: { ...action, assignee: users.viewer.id },
  });
  assert.equal(state.ok, true, JSON.stringify(state));
  teamHubSnapshot.parse(state);
  const read = await f.call(users.viewer, { action: "read", workspace: alpha });
  assert.equal(read.requests[0].title, action.title);
  const attached = await f.call(users.viewer, {
    action: "attachment",
    workspace: alpha,
    id,
  });
  assert.deepEqual(attached.attachment, action.attachment);
  assert.equal(
    (
      await f.call(users.viewer, {
        action: "save",
        workspace: alpha,
        expectedRevision: state.revision,
        id,
        expectedRequestRevision: 1,
        request: action,
      })
    ).code,
    "FORBIDDEN",
  );
  state = await f.call(users.owner, {
    action: "save",
    workspace: alpha,
    expectedRevision: state.revision,
    id,
    expectedRequestRevision: 1,
    request: {
      ...action,
      status: "done",
      body: "The fictional checklist was reviewed.",
    },
  });
  assert.equal(state.ok, true, JSON.stringify(state));
  const history = await f.call(users.editor, {
    action: "history",
    workspace: alpha,
    id,
  });
  assert.equal(history.history.length, 2);
  assert.equal(history.history[1].request.body, action.body);
  assert.deepEqual(
    f.sqlite
      .prepare("SELECT * FROM creator_app_grants WHERE id='legacy-revoked'")
      .all(),
    f.legacy.grants,
  );
});
test("wrong team/environment/anonymous and unqualified production fail closed without reading private bytes", async (t) => {
  const f = fixture(t);
  let state = await enabled(f);
  const id = crypto.randomUUID();
  state = await f.call(users.owner, {
    action: "save",
    workspace: alpha,
    expectedRevision: state.revision,
    id,
    expectedRequestRevision: 0,
    request: action,
  });
  assert.equal(state.ok, true);
  await enabled(f, bravo, users.other);
  for (const read of ["read", "history", "attachment"]) {
    const input = {
      action: read,
      workspace: alpha,
      ...(read === "read" ? {} : { id }),
    };
    assert.equal((await f.call(users.other, input)).ok, false);
    assert.equal((await f.call(undefined, input)).ok, false);
  }
  assert.equal(
    (await f.call(users.other, { action: "attachment", workspace: bravo, id }))
      .ok,
    false,
  );
  assert.equal(
    (
      await f.call(
        users.owner,
        { action: "attachment", workspace: alpha, id },
        { ...f.runtime, RESOURCE_ENVIRONMENT: "preview" },
      )
    ).ok,
    false,
  );
  for (const env of [
    { ...f.runtime, PUBLIC_ORIGIN: "https://composer.loftwah.com" },
    { ...f.runtime, TEAM_HUB_AUTH_PROFILE: "qualified-mfa" },
    { ...f.runtime, TEAM_HUB_AUTH_PROFILE: undefined },
  ]) {
    assert.equal(teamHubProfile(env), false);
    assert.equal(
      (await f.call(users.owner, { action: "read", workspace: alpha }, env))
        .code,
      "UNQUALIFIED",
    );
  }
  const request = new Request(origin + "/team-hub?workspace=" + alpha),
    gate = await teamHubPageGate(
      { url: new URL(request.url), request, locals: {} },
      f.runtime,
    );
  assert.equal(gate.status, 403);
  assert.ok(!(await gate.text()).includes(action.body));
});
test("revocation, membership removal, disabled users and role reduction apply on the next request", async (t) => {
  const f = fixture(t);
  let state = await enabled(f);
  state = await share(f, state);
  state = await share(f, state, users.owner, users.viewer.id);
  const grant = state.people.find(
    (row) => row.id === users.editor.id && row.action === "contribute",
  );
  state = await f.call(users.owner, {
    action: "revoke",
    workspace: alpha,
    expectedRevision: state.revision,
    grant: grant.grantId,
    expectedGrantRevision: grant.revision,
  });
  assert.equal(state.ok, true);
  assert.equal(
    (await f.call(users.editor, { action: "read", workspace: alpha })).code,
    "FORBIDDEN",
  );
  f.sqlite
    .prepare("UPDATE users SET disabled=1 WHERE id=?")
    .run(users.viewer.id);
  assert.equal(
    (await f.call(users.viewer, { action: "scope" })).code,
    "FORBIDDEN",
  );
  f.sqlite
    .prepare("UPDATE users SET disabled=0 WHERE id=?")
    .run(users.viewer.id);
  f.sqlite
    .prepare("DELETE FROM creator_members WHERE workspace_id=? AND user_id=?")
    .run(alpha, users.viewer.id);
  assert.equal(
    (await f.call(users.viewer, { action: "read", workspace: alpha })).code,
    "FORBIDDEN",
  );
  state = await share(f, state);
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
    )
    .run(alpha, users.editor.id);
  assert.equal(
    (
      await f.call(users.editor, {
        action: "save",
        workspace: alpha,
        expectedRevision: state.revision,
        id: crypto.randomUUID(),
        expectedRequestRevision: 0,
        request: action,
      })
    ).code,
    "FORBIDDEN",
  );
});
test("stale CAS and in-flight grant/role changes preserve every previous request version", async (t) => {
  const f = fixture(t);
  let state = await enabled(f);
  state = await share(f, state);
  const id = crypto.randomUUID();
  const command = {
    action: "save",
    workspace: alpha,
    expectedRevision: state.revision,
    id,
    expectedRequestRevision: 0,
    request: action,
  };
  f.interleave(() =>
    f.sqlite
      .prepare(
        "UPDATE creator_app_grants SET status='revoked',revision=revision+1 WHERE user_id=? AND app='team-hub' AND action='contribute'",
      )
      .run(users.editor.id),
  );
  assert.equal((await f.call(users.editor, command)).code, "CONFLICT");
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*)AS n FROM team_hub_requests").get().n,
    0,
  );
  state = await f.call(users.owner, {
    action: "save",
    workspace: alpha,
    expectedRevision: state.revision,
    id,
    expectedRequestRevision: 0,
    request: action,
  });
  assert.equal(state.ok, true);
  assert.equal((await f.call(users.owner, command)).code, "CONFLICT");
  const invalid = {
    ...command,
    expectedRevision: state.revision,
    id: crypto.randomUUID(),
    request: {
      ...action,
      attachment: { name: "bad.html", text: "<script>bad</script>" },
    },
  };
  assert.equal((await f.call(users.owner, invalid)).ok, false);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*)AS n FROM team_hub_requests").get().n,
    1,
  );
});
test("connection uses only an explicitly supplied binding and never echoes endpoint/credential/provider body", async (t) => {
  const f = fixture(t);
  await enabled(f);
  assert.equal(
    (await f.call(users.owner, { action: "connection", workspace: alpha }))
      .state,
    "not-configured",
  );
  let called = 0;
  const env = {
    ...f.runtime,
    TEAM_HUB_SERVICE: {
      async fetch(request) {
        called++;
        assert.equal(request.url, "https://team-hub-private.invalid/status");
        return Response.json({ state: "available", secret: "not-for-browser" });
      },
    },
  };
  const reply = await f.call(
    users.owner,
    { action: "connection", workspace: alpha },
    env,
  );
  assert.equal(reply.state, "available");
  assert.equal(called, 1);
  assert.ok(!JSON.stringify(reply).includes("not-for-browser"));
  env.TEAM_HUB_SERVICE.fetch = async () => {
    throw Error("private-address-secret");
  };
  const failure = await f.call(
    users.owner,
    { action: "connection", workspace: alpha },
    env,
  );
  assert.equal(failure.state, "unavailable");
  assert.ok(!JSON.stringify(failure).includes("private-address-secret"));
});

test("private recovery checklist saves through current request authority and keeps original versions", async (t) => {
  const f = fixture(t);
  let state = await enabled(f);
  state = await share(f, state);
  const request = recoveryChecklist();
  const id = crypto.randomUUID();
  state = await f.call(users.editor, {
    action: "save",
    workspace: alpha,
    expectedRevision: state.revision,
    id,
    expectedRequestRevision: 0,
    request,
  });
  assert.equal(state.ok, true, JSON.stringify(state));
  assert.match(state.requests[0].body, /current access revocations/);
  const attached = await f.call(users.owner, {
    action: "attachment",
    workspace: alpha,
    id,
  });
  assert.equal(attached.attachment.text, request.attachment.text);
  assert.equal(
    (await f.call(users.other, { action: "attachment", workspace: alpha, id }))
      .code,
    "FORBIDDEN",
  );
  const revision = state.revision;
  state = await f.call(users.editor, {
    action: "save",
    workspace: alpha,
    expectedRevision: revision,
    id,
    expectedRequestRevision: 1,
    request: {
      ...request,
      title: "Fictional Alpha recovery",
      status: "in-progress",
    },
  });
  assert.equal(state.ok, true);
  const history = await f.call(users.editor, {
    action: "history",
    workspace: alpha,
    id,
  });
  assert.equal(history.history.length, 2);
  assert.equal(history.history[1].request.title, request.title);
  assert.equal(
    f.sqlite.prepare("SELECT COUNT(*) AS n FROM team_hub_requests").get().n,
    1,
  );
});

test("request discovery combines words, assignment and status without changing saved records", () => {
  const requests = [
    {
      id: "first",
      title: "Alpha recovery",
      body: "Check private media",
      status: "open",
      assignee: "editor",
    },
    {
      id: "second",
      title: "Media review",
      body: "Alpha data",
      status: "done",
      assignee: "viewer",
    },
    {
      id: "third",
      title: "Bravo recovery",
      body: "Check records",
      status: "in-progress",
      assignee: "editor",
    },
  ];
  const before = JSON.stringify(requests);
  assert.deepEqual(
    filterTeamRequests(requests, "  ALPHA   media ", "all", null).map(
      (row) => row.id,
    ),
    ["first", "second"],
  );
  assert.deepEqual(
    filterTeamRequests(requests, "", "active", "editor").map((row) => row.id),
    ["first", "third"],
  );
  assert.deepEqual(filterTeamRequests(requests, "", "done", "editor"), []);
  assert.deepEqual(filterTeamRequests(requests, "missing", "all", null), []);
  assert.equal(JSON.stringify(requests), before);
});
