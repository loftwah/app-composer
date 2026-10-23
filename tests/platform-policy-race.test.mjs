import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  user,
  origin,
  saved,
  instance,
} from "./helpers/resource-fixture.mjs";
import {
  workspaceForUser,
  createStack,
  readStack,
  publishStack,
  trustedPlatformActor,
} from "../src/lib/stacks.mjs";
import { managePlatform } from "../src/lib/platform-admin.ts";

const profile = {
  enabled: true,
  reviewRequired: false,
  allowedRecipes: ["guestbook"],
  environments: ["preview"],
  dataClasses: ["synthetic"],
  maxApplications: 2,
};
const request = {
  version: 1,
  name: "Fictional race specimen",
  recipe: "guestbook",
  environment: "preview",
  dataClass: "synthetic",
  location: "provider-default",
  quota: "small",
};
const call = (f, input) =>
  managePlatform(
    {
      user,
      input,
      request: new Request(
        origin + "/_emdash/api/plugins/composer-stacks/platformWrite",
        {
          method: "POST",
          headers: { Origin: origin, "X-EmDash-Request": "1" },
        },
      ),
    },
    f.runtime,
  );
const configure = (f, workspace, fields = {}) =>
  call(f, {
    action: "configure",
    workspace,
    expectedRevision: 0,
    profile,
    ...fields,
  });

// Land a competing actual handler immediately before the selected atomic SQL.
function beforeFirst(f, predicate, competing) {
  const prepare = f.db.prepare;
  let fired = false;
  f.db.prepare = (sql) => {
    const wrap = (statement) => ({
      ...statement,
      bind(...values) {
        return wrap(statement.bind(...values));
      },
      async first() {
        if (!fired && predicate(sql)) {
          fired = true;
          await competing();
        }
        return statement.first();
      },
    });
    return wrap(prepare(sql));
  };
  return () => assert.equal(fired, true, "The intended race must execute.");
}

test("platform activation atomically fences an ordinary create already past HTTP preflight", async () => {
  const f = fixture();
  try {
    const w = await workspaceForUser(f.db, user);
    const observed = beforeFirst(
      f,
      (sql) => sql.startsWith("INSERT INTO creator_stacks"),
      async () => {
        assert.equal((await configure(f, w.id)).ok, true);
      },
    );
    const result = await f.route({
      action: "create",
      workspace: w.id,
      name: "Ungoverned race",
    });
    observed();
    assert.equal(result.ok, false);
    assert.equal(result.code, "CONFLICT");
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_stacks WHERE workspace_id=?",
        )
        .get(w.id).n,
      0,
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT revision FROM creator_platform_profiles WHERE workspace_id=?",
        )
        .get(w.id).revision,
      1,
    );
  } finally {
    f.close();
  }
});

test("a winning ordinary create prevents policy from adopting a nonempty workspace", async () => {
  const f = fixture();
  try {
    const w = await workspaceForUser(f.db, user);
    const observed = beforeFirst(
      f,
      (sql) => sql.startsWith("INSERT INTO creator_platform_profiles"),
      async () => {
        assert.equal(
          (
            await f.route({
              action: "create",
              workspace: w.id,
              name: "Existing before policy",
            })
          ).ok,
          true,
        );
      },
    );
    const result = await configure(f, w.id);
    observed();
    assert.equal(result.ok, false);
    assert.equal(result.code, "CONFLICT");
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_platform_profiles WHERE workspace_id=?",
        )
        .get(w.id).n,
      0,
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_stacks WHERE workspace_id=?",
        )
        .get(w.id).n,
      1,
    );
  } finally {
    f.close();
  }
});

test("pausing standing policy preserves the authenticated lifecycle fence", async () => {
  const f = fixture();
  try {
    const w = await workspaceForUser(f.db, user);
    assert.equal((await configure(f, w.id)).ok, true);
    assert.equal(
      (
        await configure(f, w.id, {
          expectedRevision: 1,
          profile: { ...profile, enabled: false },
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await f.route({
          action: "create",
          workspace: w.id,
          name: "Paused bypass",
        })
      ).code,
      "FORBIDDEN",
    );
    await assert.rejects(
      createStack(f.db, w.id, "Direct native bypass", user.id),
      { code: "CONFLICT" },
    );
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_stacks WHERE workspace_id=?",
        )
        .get(w.id).n,
      0,
    );
  } finally {
    f.close();
  }
});

test("only the live branded request actor can publish its exact managed stack", async () => {
  const f = fixture();
  try {
    const w = await workspaceForUser(f.db, user);
    assert.equal((await configure(f, w.id)).ok, true);
    delete f.runtime.GUESTBOOK;
    const pending = (
      await call(f, {
        action: "submit",
        workspace: w.id,
        key: crypto.randomUUID(),
        request,
      })
    ).requests[0];
    // Trusted fixture setup supplies a candidate, as the actual scoped runner does.
    const stack = await saved(f, w.id, "Fictional candidate", [
      instance("fictional-race-instance", "Fictional"),
    ]);
    const other = await saved(f, w.id, "Other candidate", [
      instance("fictional-other-instance", "Other"),
    ]);
    const token = crypto.randomUUID();
    f.sqlite
      .prepare(
        "UPDATE creator_platform_requests SET stack_id=?,status='verifying',lease_token=?,lease_until=? WHERE id=?",
      )
      .run(stack.id, token, Date.now() + 60000, pending.id);
    const branded = trustedPlatformActor(user.id, pending.id, token);
    const publish = (actor, selected = stack) =>
      publishStack(
        f.db,
        w.id,
        selected.id,
        selected.revision,
        selected.draft,
        actor,
      );
    await assert.rejects(publish(user.id), { code: "CONFLICT" });
    await assert.rejects(publish(JSON.parse(JSON.stringify(branded))), {
      code: "FORBIDDEN",
    });
    await assert.rejects(
      publish({ userId: user.id, requestId: pending.id, leaseToken: token }),
      { code: "FORBIDDEN" },
    );
    await assert.rejects(
      publish(trustedPlatformActor(user.id, pending.id, crypto.randomUUID())),
      { code: "CONFLICT" },
    );
    await assert.rejects(publish(branded, other), { code: "CONFLICT" });
    f.sqlite
      .prepare(
        "UPDATE creator_platform_requests SET policy_revision=0 WHERE id=?",
      )
      .run(pending.id);
    await assert.rejects(publish(branded), { code: "CONFLICT" });
    f.sqlite
      .prepare(
        "UPDATE creator_platform_requests SET policy_revision=1,lease_until=0 WHERE id=?",
      )
      .run(pending.id);
    await assert.rejects(publish(branded), { code: "CONFLICT" });
    f.sqlite
      .prepare("UPDATE creator_platform_requests SET lease_until=? WHERE id=?")
      .run(Date.now() + 60000, pending.id);
    f.beforeBatch(() => {
      f.sqlite
        .prepare(
          "UPDATE creator_platform_requests SET lease_until=0 WHERE id=?",
        )
        .run(pending.id);
    });
    await assert.rejects(publish(branded), { code: "CONFLICT" });
    f.beforeBatch(null);
    f.sqlite
      .prepare("UPDATE creator_platform_requests SET lease_until=? WHERE id=?")
      .run(Date.now() + 60000, pending.id);
    await assert.rejects(
      createStack(f.db, w.id, "Wrong branded capability", branded),
      { code: "FORBIDDEN" },
    );
    assert.equal((await publish(branded)).status, "published");
    assert.equal((await readStack(f.db, w.id, other.id)).status, "draft");
    assert.equal(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM creator_stack_publications")
        .get().n,
      1,
    );
  } finally {
    f.close();
  }
});
