import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fixture,
  saved,
  user,
  instance,
  origin,
  account,
} from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { applyStackResources } from "../src/lib/stack-resources.ts";
import { manageConnections } from "../src/lib/connections.ts";
import { connectionSnapshot } from "../src/lib/connection-contract.ts";

async function prepared(t, withResource = true) {
  const f = fixture();
  t.after(() => f.close());
  f.sqlite.exec(
    readFileSync(
      new URL("../migrations/0013_enquiry_notifications.sql", import.meta.url),
      "utf8",
    ),
  );
  const workspace = await workspaceForUser(f.db, user);
  let resource;
  if (withResource) {
    const stack = await saved(
      f,
      workspace.id,
      "Fictional connection consumer",
      [instance("fictional-connection-instance", "Fictional book")],
    );
    const result = await applyStackResources(
      f.db,
      user.id,
      workspace.id,
      stack.id,
      stack.revision,
      f.runtime,
    );
    resource = result.resources[0].resource;
  }
  const route = (
    input = { action: "list", workspace: workspace.id },
    runtime = f.runtime,
    caller = user,
  ) =>
    manageConnections(
      {
        input,
        user: caller,
        request: new Request(
          origin + "/_emdash/api/plugins/composer-stacks/connectionsRead",
          { headers: { Origin: origin } },
        ),
      },
      runtime,
    );
  const check = () =>
    route({
      action: "check",
      workspace: workspace.id,
      connection: "guestbook-owner",
    });
  return { ...f, workspace, resource, route, check };
}

test("metadata contains named references and scoped consumers, never canary secret values or recipient details", async (t) => {
  const f = await prepared(t);
  const canary = "CANARY_PRIVATE_VALUE_CONNECTIONS_291";
  const runtime = {
    ...f.runtime,
    GUESTBOOK_OWNER_TOKEN: canary,
    RESEND_API_KEY: canary,
    RESEND_FROM_ADDRESS: "private-owner@example.test",
    RESEND_ALLOWED_RECIPIENTS: "private-owner@example.test",
    ENQUIRY_NOTIFICATION_RECIPIENT: "private-owner@example.test",
    EXTRA_UNREVIEWED_SECRET: canary,
  };
  const reply = connectionSnapshot.parse(await f.route(undefined, runtime));
  assert.doesNotMatch(
    JSON.stringify(reply),
    /CANARY_PRIVATE_VALUE|private-owner|EXTRA_UNREVIEWED_SECRET/,
  );
  assert.equal(reply.connections[0].credentialPresent, true);
  assert.equal(reply.connections[0].status, "metadata-only");
  assert.equal(
    reply.connections[0].dependencies.items[0].label,
    "Fictional connection consumer",
  );
  assert.match(
    reply.connections[0].dependencies.items[0].href,
    /workspace=.*&stack=/,
  );
  assert.equal(reply.connections[0].checkedAt, null);
  assert.equal(reply.connections[1].checkOutcome, "not-checked");
  assert.ok(
    reply.connections.every((connection) => connection.expiresAt === null),
  );
});

test("the actual maintained adapter checks only a fixed owned resource read and exact source identity", async (t) => {
  const f = await prepared(t),
    writes = f.app.writes.length;
  const seen = [],
    original = f.runtime.GUESTBOOK;
  f.runtime.GUESTBOOK = {
    async fetch(request) {
      seen.push({ method: request.method, url: request.url });
      return original.fetch(request);
    },
  };
  const reply = connectionSnapshot.parse(await f.check());
  assert.equal(reply.connections[0].status, "read-verified");
  assert.equal(reply.connections[0].checkOutcome, "passed");
  assert.deepEqual(reply.connections[0].verifiedCapabilities, [
    "read-owned-resource",
  ]);
  assert.equal(f.app.writes.length, writes);
  assert.ok(
    seen.every(
      (request) =>
        request.method === "GET" &&
        request.url.startsWith(origin + "/guestbook/"),
    ),
  );
  assert.ok(seen.some((request) => request.url.endsWith("/build.json")));
  assert.ok(
    seen.some((request) =>
      request.url.endsWith("/api/resources/" + f.resource),
    ),
  );
});

test("missing resource or key remains unknown/unconfigured and makes no probe call", async (t) => {
  const f = await prepared(t, false);
  let calls = 0;
  f.runtime.GUESTBOOK = {
    async fetch() {
      calls++;
      throw Error("should not run");
    },
  };
  const unknown = connectionSnapshot.parse(await f.check());
  assert.equal(unknown.connections[0].status, "unknown");
  assert.equal(unknown.connections[0].checkOutcome, "unavailable");
  assert.equal(calls, 0);
  f.runtime.GUESTBOOK_OWNER_TOKEN = undefined;
  assert.equal(
    connectionSnapshot.parse(await f.check()).connections[0].status,
    "not-configured",
  );
  assert.equal(calls, 0);
});

test("denial, rate limit, provider interruption and mismatched source are distinct and never echo errors", async (t) => {
  const f = await prepared(t),
    original = f.runtime.GUESTBOOK;
  for (const [status, outcome] of [
    [403, "denied"],
    [429, "rate-limited"],
    [503, "unavailable"],
  ]) {
    f.runtime.GUESTBOOK = {
      async fetch() {
        return new Response("CANARY_SECRET_PROVIDER_ERROR", { status });
      },
    };
    const reply = connectionSnapshot.parse(await f.check());
    assert.equal(reply.connections[0].checkOutcome, outcome);
    assert.doesNotMatch(JSON.stringify(reply), /CANARY_SECRET/);
  }
  f.runtime.GUESTBOOK = original;
  f.app.badBuild(true);
  assert.equal(
    connectionSnapshot.parse(await f.check()).connections[0].checkOutcome,
    "mismatch",
  );
  f.app.badBuild(false);
  f.runtime.GUESTBOOK = {
    async fetch(request) {
      if (request.url.endsWith("/build.json")) return original.fetch(request);
      throw Error("CANARY_SECRET_NETWORK_ERROR");
    },
  };
  const interrupted = connectionSnapshot.parse(await f.check());
  assert.equal(interrupted.connections[0].status, "unknown");
  assert.equal(interrupted.connections[0].checkOutcome, "unavailable");
  assert.doesNotMatch(JSON.stringify(interrupted), /CANARY_SECRET/);
});

test("caller-supplied URLs, secrets, wrong workspace and viewer grants cannot probe or read metadata", async (t) => {
  const f = await prepared(t);
  for (const input of [
    { action: "check", workspace: f.workspace.id, connection: "owner-mail" },
    {
      action: "check",
      workspace: f.workspace.id,
      connection: "guestbook-owner",
      url: "https://example.test/",
    },
    { action: "list", workspace: f.workspace.id, secret: "CANARY_PRIVATE" },
  ])
    assert.equal((await f.route(input)).ok, false);
  assert.equal(
    (await f.route({ action: "list", workspace: "other-workspace" })).code,
    "FORBIDDEN",
  );
  f.sqlite
    .prepare(
      "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
    )
    .run(f.workspace.id, user.id);
  assert.equal((await f.route()).code, "FORBIDDEN");
});

test("revocation during a read and a resource moving scope do not return verified connection metadata", async (t) => {
  const f = await prepared(t),
    original = f.runtime.GUESTBOOK;
  f.runtime.GUESTBOOK = {
    async fetch(request) {
      const response = await original.fetch(request);
      if (!request.url.endsWith("/build.json"))
        f.sqlite
          .prepare(
            "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
          )
          .run(f.workspace.id, user.id);
      return response;
    },
  };
  const revoked = await f.check();
  assert.equal(revoked.code, "FORBIDDEN");
  assert.equal(revoked.connections, undefined);
  f.sqlite
    .prepare(
      "INSERT INTO creator_members(workspace_id,user_id,role) VALUES (?,?,'owner')",
    )
    .run(f.workspace.id, user.id);
  f.runtime.GUESTBOOK = {
    async fetch(request) {
      const response = await original.fetch(request);
      if (!request.url.endsWith("/build.json"))
        f.sqlite
          .prepare(
            "UPDATE creator_app_resources SET environment='different' WHERE id=?",
          )
          .run(f.resource);
      return response;
    },
  };
  const moved = connectionSnapshot.parse(await f.check());
  assert.notEqual(moved.connections[0].status, "read-verified");
  assert.deepEqual(moved.connections[0].verifiedCapabilities, []);
});

test("dependencies exclude another account/environment and missing sources remain unavailable", async (t) => {
  const f = await prepared(t);
  f.sqlite
    .prepare("UPDATE creator_app_resources SET account_id=? WHERE id=?")
    .run("other-account", f.resource);
  const empty = connectionSnapshot.parse(await f.route());
  assert.equal(empty.connections[0].dependencies.items.length, 0);
  f.sqlite.exec(
    "DROP TABLE creator_enquiry_notification_outbox; DROP TABLE creator_enquiry_notification_preferences;",
  );
  const partial = connectionSnapshot.parse(await f.route());
  assert.equal(partial.connections[1].dependencies.available, false);
  assert.equal(partial.connections[1].dependencies.items.length, 0);
});
