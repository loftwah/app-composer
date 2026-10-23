import test from "node:test";
import assert from "node:assert/strict";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { platformPublicFixture } from "./helpers/platform-public-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import {
  manageMemberPlatform,
  managePlatform,
} from "../src/lib/platform-admin.ts";
import { decodePlatformList } from "../src/plugins/platform/protocol.ts";
import { memberPlugin } from "../src/lib/member-plugin.ts";
import { readFileSync } from "node:fs";
import {
  memberPageSelection,
  memberScopeBlocked,
  acceptInvitationPreservingScope,
} from "../src/components/members/selection.ts";

const profile = {
  enabled: true,
  allowedRecipes: ["guestbook"],
  environments: ["preview"],
  dataClasses: ["synthetic"],
  maxApplications: 2,
  reviewRequired: false,
};
const request = {
  version: 1,
  name: "Fictional delegated app",
  recipe: "guestbook",
  environment: "preview",
  dataClass: "synthetic",
  location: "provider-default",
  quota: "small",
};
const member = {
  id: "fictional-delegated-member",
  role: 10,
  name: "Fictional member",
};
const ctx = (actor, input, reading = false) => ({
  user: actor,
  input,
  request: new Request(
    origin + "/_emdash/api/plugins/composer-members/platform",
    {
      method: reading ? "GET" : "POST",
      headers: { Origin: origin, "X-EmDash-Request": "1" },
    },
  ),
});

test("readiness links select one platform view and explicit workspace without granting access", () => {
  assert.deepEqual(
    memberPageSelection("?view=platform&workspace=fictional-workspace"),
    { view: "platform", workspace: "fictional-workspace" },
  );
  assert.deepEqual(memberPageSelection(""), {
    view: "profile",
    workspace: undefined,
  });
  for (const query of [
    "?view=platform&view=profile",
    "?workspace=fictional-a&workspace=fictional-b",
    "?view=platform&workspace=../other",
    "?view=admin",
  ])
    assert.throws(() => memberPageSelection(query));
});

test("invitation and selector transitions retain pending contribution identities and platform drafts", async () => {
  for (const drafts of [
    { guestbook: true, platform: false },
    { guestbook: false, platform: true },
  ]) {
    assert.equal(memberScopeBlocked(false, false, drafts), true);
    // Recheck after an invitation acknowledgement: a child may have started work
    // while the parent acceptance request was awaiting the server.
    assert.equal(memberScopeBlocked(false, false, { ...drafts }), true);
  }
  assert.equal(memberScopeBlocked(true, false, {}), true);
  assert.equal(memberScopeBlocked(false, true, {}), true);
  assert.equal(
    memberScopeBlocked(false, false, { guestbook: false, platform: false }),
    false,
  );
  for (const child of ["guestbook", "platform"]) {
    const retained = {
      workspace: "fictional-team-a",
      operationId: crypto.randomUUID(),
      input: "Unsaved fictional input",
    };
    const original = structuredClone(retained);
    let accepted = 0,
      selected = 0;
    const drafts = { guestbook: false, platform: false };
    const blocked = () => memberScopeBlocked(false, false, drafts);
    // An operation starts while acceptance is awaiting the server. The actual
    // coordinator used by MyApps accepts membership but never switches scope.
    const switched = await acceptInvitationPreservingScope(
      blocked,
      async () => {
        accepted++;
        drafts[child] = true;
      },
      async () => {
        selected++;
        retained.workspace = "fictional-team-b";
      },
    );
    assert.equal(switched, false);
    assert.equal(accepted, 1);
    assert.equal(selected, 0);
    assert.deepEqual(retained, original);
    await assert.rejects(() =>
      acceptInvitationPreservingScope(
        blocked,
        async () => {
          accepted++;
        },
        async () => {
          selected++;
        },
      ),
    );
    assert.equal(accepted, 1);
    drafts[child] = false;
    assert.equal(
      await acceptInvitationPreservingScope(
        blocked,
        async () => {
          accepted++;
        },
        async () => {
          selected++;
        },
      ),
      true,
    );
    assert.equal(selected, 1);
  }
});

test("role10 editor self-service is explicit and never grants native operator or CMS authority", async () => {
  const f = fixture();
  try {
    f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
    const workspace = (await workspaceForUser(f.db, user)).id;
    assert.equal(
      (
        await managePlatform(
          ctx(user, {
            action: "configure",
            workspace,
            expectedRevision: 0,
            profile,
          }),
          f.runtime,
        )
      ).ok,
      true,
    );
    const call = (input, actor = member, reading = false) =>
      manageMemberPlatform(ctx(actor, input, reading), f.runtime);
    assert.equal(
      (await call({ action: "list", workspace }, member, true)).code,
      "FORBIDDEN",
    );
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'viewer')",
      )
      .run(workspace, member.id);
    assert.equal(
      (
        await call({
          action: "submit",
          workspace,
          key: crypto.randomUUID(),
          request,
        })
      ).code,
      "FORBIDDEN",
    );
    f.sqlite
      .prepare(
        "UPDATE creator_members SET role='editor' WHERE workspace_id=? AND user_id=?",
      )
      .run(workspace, member.id);
    const created = await call({
      action: "submit",
      workspace,
      key: crypto.randomUUID(),
      request,
    });
    assert.equal(created.ok, true, JSON.stringify(created));
    assert.equal(created.requests[0].status, "complete");
    assert.equal(created.actor.subject, member.id);
    assert.equal(member.role, 10);
    assert.equal(
      (
        await managePlatform(
          ctx(member, { action: "list", workspace }, true),
          f.runtime,
        )
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await call({
          action: "configure",
          workspace,
          expectedRevision: 1,
          profile,
        })
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await call({
          action: "review",
          workspace,
          id: created.requests[0].id,
          expectedRevision: created.requests[0].revision,
          decision: "accept",
          reason: "No operator role",
        })
      ).code,
      "FORBIDDEN",
    );
    const updated = await call({
      action: "update",
      workspace,
      id: created.requests[0].id,
      expectedRevision: created.requests[0].revision,
      request: { ...request, name: "Delegated update" },
    });
    assert.equal(updated.requests[0].status, "complete");
    assert.equal(
      updated.requests[0].resources[0].resource,
      created.requests[0].resources[0].resource,
    );
    f.sqlite
      .prepare(
        "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
      )
      .run(workspace, member.id);
    assert.equal(
      (
        await call({
          action: "run",
          workspace,
          id: updated.requests[0].id,
          expectedRevision: updated.requests[0].revision,
        })
      ).code,
      "FORBIDDEN",
    );
    // Even a retained workspace-owner role cannot make a globally demoted user an operator.
    const demoted = { ...user, role: 10 };
    assert.equal(
      (
        await managePlatform(
          ctx(demoted, {
            action: "configure",
            workspace,
            expectedRevision: 1,
            profile,
          }),
          f.runtime,
        )
      ).code,
      "FORBIDDEN",
    );
    assert.equal(
      (
        await manageMemberPlatform(
          ctx(demoted, {
            action: "configure",
            workspace,
            expectedRevision: 1,
            profile,
          }),
          f.runtime,
        )
      ).code,
      "FORBIDDEN",
    );
    const other = (
      await workspaceForUser(f.db, { ...user, id: "fictional-other-owner" })
    ).id;
    assert.equal(
      (await call({ action: "list", workspace: other }, member, true)).code,
      "FORBIDDEN",
    );
  } finally {
    f.close();
  }
});

test("setup snapshot is additive, workspace-derived and retains managed state while disabled", async () => {
  const f = fixture();
  try {
    const workspace = (await workspaceForUser(f.db, user)).id;
    const read = () =>
      managePlatform(ctx(user, { action: "list", workspace }, true), f.runtime);
    const before = await read();
    assert.equal(before.runner.available, true);
    assert.match(before.runner.message, /configuration is validated only/i);
    assert.match(
      before.runner.message,
      /no upstream network connection or provider permission has been checked/i,
    );
    assert.deepEqual(before.setup, {
      target: {
        account: f.runtime.RESOURCE_ACCOUNT_ID,
        environment: f.runtime.RESOURCE_ENVIRONMENT,
        url: origin + "/guestbook",
      },
      existingStacks: 0,
      managed: false,
    });
    await managePlatform(
      ctx(user, {
        action: "configure",
        workspace,
        expectedRevision: 0,
        profile: { ...profile, enabled: false },
      }),
      f.runtime,
    );
    const current = await read();
    assert.equal(current.setup.managed, true);
    assert.deepEqual(decodePlatformList(current).setup, current.setup);
    const old = structuredClone(current);
    delete old.setup;
    assert.equal(decodePlatformList(old).setup, undefined);
    assert.doesNotMatch(JSON.stringify(current.setup), /token|secret|grant/i);
  } finally {
    f.close();
  }
});

test("installed EmDash dispatcher admits the delegated member route but denies draft/global administration", async () => {
  const f = fixture();
  try {
    const workspace = (await workspaceForUser(f.db, user)).id;
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'editor')",
      )
      .run(workspace, member.id);
    const entry = new URL(
      import.meta.resolve("emdash/internal/plugin-test-runtime"),
    );
    const match = readFileSync(entry, "utf8").match(
      /import \{[^}]*?([A-Za-z]+) as dispatchPluginApiRequest[^}]*?\} from "([^"]+)"/,
    );
    assert.ok(match);
    const dispatch = (await import(new URL(match[2], entry)))[match[1]];
    const plugin = memberPlugin(f.runtime, {});
    const host = {
      getPluginRouteMeta(id, path) {
        return id === "composer-members"
          ? plugin.routes[path.slice(1)]
          : {
              methods: ["GET"],
              permission:
                id === "drafts" ? "content:read_drafts" : "plugins:manage",
            };
      },
      async handlePluginApiRoute(id, method, path, request, actor) {
        return {
          success: true,
          data: await plugin.routes[path.slice(1)].handler({
            request,
            user: actor,
            input: Object.fromEntries(new URL(request.url).searchParams),
          }),
        };
      },
    };
    const invoke = (id) =>
      dispatch({
        runtime: host,
        pluginId: id,
        path: "/platformRead",
        user: member,
        request: new Request(
          origin +
            "/_emdash/api/plugins/" +
            id +
            "/platformRead?" +
            new URLSearchParams({ action: "list", workspace }),
          { headers: { "X-EmDash-Request": "1" } },
        ),
      });
    assert.equal((await invoke("drafts")).status, 403);
    assert.equal((await invoke("admin")).status, 403);
    const result = await invoke("composer-members");
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data.ok, true);
    f.sqlite
      .prepare(
        "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
      )
      .run(workspace, member.id);
    const denied = await invoke("composer-members");
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error.code, "FORBIDDEN");
  } finally {
    f.close();
  }
});
