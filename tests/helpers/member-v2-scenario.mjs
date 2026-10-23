// Isolated synthetic contract promotion for bridge tests only. The repository's
// actual source pin/manifest remain untouched and unqualified by these tests.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
const lock = JSON.parse(
  readFileSync(new URL("../../composition.lock.json", import.meta.url), "utf8"),
);
const selected = lock.apps.find((app) => app.id === "guestbook");
selected.manifest.memberService.version = 2;
selected.manifest.configuration.guestAccess.options.push("members");
registerHooks({
  load(url, context, nextLoad) {
    if (url === new URL("../../composition.lock.json", import.meta.url).href)
      return {
        format: "json",
        source: JSON.stringify(lock),
        shortCircuit: true,
      };
    return nextLoad(url, context);
  },
});
const { fixture, user, origin, saved, instance } =
  await import("./resource-fixture.mjs");
const { platformPublicFixture } = await import("./platform-public-fixture.mjs");
const { workspaceForUser } = await import("../../src/lib/stacks.mjs");
const { managePlatform } = await import("../../src/lib/platform-admin.ts");
const { manageMembers } = await import("../../src/lib/member-access.ts");
const { configurationDigest } =
  await import("../../src/lib/resource-client.ts");
const { memberContributionsQualified } =
  await import("../../src/lib/member-contribution-contract.ts");
const { applyStackResources } =
  await import("../../src/lib/stack-resources.ts");
const { trustedPlatformActor } = await import("../../src/lib/stacks.mjs");
assert.equal(
  memberContributionsQualified(),
  true,
  "Only this isolated synthetic module graph qualifies v2.",
);
const {
  appSettings,
  globalAppSettings,
  validateConfigurationPatch,
  validateAppSettings,
} = await import("../../src/lib/app-settings.mjs");
const { applyConfiguration } =
  await import("../../src/lib/app-configuration.mjs");
const { manageMiniapps } = await import("../../src/lib/miniapp-admin.mjs");
assert.deepEqual(
  globalAppSettings.guestbook.fields.find(
    (field) => field.key === "guestAccess",
  ).options,
  ["closed", "postcards"],
);
const memberSettings = Object.fromEntries(
  appSettings.guestbook.fields.map((field) => [
    field.key,
    field.key === "guestAccess" ? "members" : field.default,
  ]),
);
assert.throws(
  () => validateConfigurationPatch(memberSettings, "guestbook"),
  /supported/,
);
assert.throws(
  () => validateAppSettings({ guestbook: memberSettings }, ["guestbook"]),
  /supported/,
);
await assert.rejects(
  () =>
    applyConfiguration(
      [
        {
          id: "guestbook",
          url: "https://guestbook.loftwah.com",
          source: appSettings.guestbook.source,
          configuration: memberSettings,
        },
      ],
      {
        credential: () =>
          assert.fail("Global validation must precede credentials"),
        beforeWrite: () => assert.fail("Global validation must precede writes"),
        request: () =>
          assert.fail("Global validation must precede network access"),
      },
    ),
  /supported/,
);
const globalRejected = await manageMiniapps(
  {
    user,
    input: { app: "guestbook", action: "settings", ...memberSettings },
    request: new Request(
      origin + "/_emdash/api/plugins/composer-miniapps/write",
      {
        method: "POST",
        headers: { Origin: origin, "X-EmDash-Request": "1" },
      },
    ),
  },
  {
    PUBLIC_ORIGIN: origin,
    GUESTBOOK_OWNER_TOKEN: "fictional-only",
    GUESTBOOK: {
      fetch: () => assert.fail("Native global rejection must precede app IO"),
    },
  },
  { guestbook: selected.commit },
);
assert.equal(globalRejected.ok, false);
assert.equal(globalRejected.code, "INVALID");
// Even after a real manifest promotion, ordinary native scoped resources cannot
// select an unusable members mode outside the governed synthetic runner.
const unmanaged = fixture();
try {
  const workspace = (await workspaceForUser(unmanaged.db, user)).id;
  const scoped = instance(
    "fictional-unmanaged-instance",
    "Fictional unmanaged",
  );
  scoped.config.guestAccess = "members";
  const stack = await saved(unmanaged, workspace, "Fictional unmanaged", [
    scoped,
  ]);
  const result = await unmanaged.route({
    action: "applyResources",
    workspace,
    stack: stack.id,
    expectedRevision: stack.revision,
  });
  assert.equal(result.code, "FORBIDDEN");
  for (const actor of [
    { userId: user.id, requestId: "forged", leaseToken: "forged" },
    trustedPlatformActor(user.id, "no-current-request", "no-current-lease"),
  ]) {
    await assert.rejects(
      () =>
        applyStackResources(
          unmanaged.db,
          actor,
          workspace,
          stack.id,
          stack.revision,
          unmanaged.runtime,
        ),
      (failure) => failure.code === "FORBIDDEN",
    );
  }
  assert.equal(unmanaged.app.writes.length, 0);
  assert.equal(
    unmanaged.sqlite
      .prepare("SELECT count(*) AS n FROM creator_app_resources")
      .get().n,
    0,
  );
} finally {
  unmanaged.close();
}

const profile = {
  enabled: true,
  allowMemberContributions: true,
  reviewRequired: false,
  allowedRecipes: ["guestbook"],
  environments: ["preview"],
  dataClasses: ["synthetic"],
  maxApplications: 2,
};
const requested = {
  version: 1,
  name: "Fictional member-only app",
  recipe: "guestbook",
  environment: "preview",
  dataClass: "synthetic",
  location: "provider-default",
  quota: "small",
  contributions: "members",
};
const member = {
  id: "fictional-app-member",
  name: "Fictional member",
  email: "member@example.test",
  role: 10,
};
const context = (actor, input) => ({
  user: actor,
  input,
  request: new Request(origin + "/_emdash/api/plugins/composer-members/write", {
    method: "POST",
    headers: { Origin: origin, "X-EmDash-Request": "1" },
  }),
});
async function setup() {
  const f = fixture();
  try {
    for (const migration of [
      "0008_workspace_access.sql",
      "0010_member_app_grants.sql",
    ])
      f.sqlite.exec(
        readFileSync(
          new URL("../../migrations/" + migration, import.meta.url),
          "utf8",
        ),
      );
    f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
    const app = f.runtime.GUESTBOOK;
    f.runtime.GUESTBOOK = {
      async fetch(req) {
        const response = await app.fetch(req);
        if (new URL(req.url).pathname.endsWith("/build.json"))
          return Response.json({
            ...(await response.json()),
            memberService: selected.manifest.memberService,
          });
        return response;
      },
    };
    const workspace = (await workspaceForUser(f.db, user)).id;
    const platform = (input) =>
      managePlatform(context(user, { workspace, ...input }), f.runtime);
    assert.equal(
      (await platform({ action: "configure", expectedRevision: 0, profile }))
        .ok,
      true,
    );
    const created = await platform({
      action: "submit",
      key: crypto.randomUUID(),
      request: requested,
    });
    assert.equal(
      created.requests[0].status,
      "complete",
      JSON.stringify(created),
    );
    const service = created.requests[0],
      resource = service.resources[0].resource;
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'viewer')",
      )
      .run(workspace, member.id);
    const grant = crypto.randomUUID();
    f.sqlite
      .prepare(
        "INSERT INTO creator_app_grants(id,issuer,workspace_id,user_id,app,resource_id,action,created_by) VALUES(?,?,?,?,'guestbook',?,'contribute',?)",
      )
      .run(grant, origin, workspace, member.id, resource, user.id);
    const calls = [];
    const receipts = new Map();
    f.runtime.GUESTBOOK_MEMBER_TOKEN = "fictional-member-token";
    f.runtime.GUESTBOOK_MEMBERS = {
      async fetch(req) {
        const body = await req.json();
        calls.push(body);
        assert.equal(
          req.headers.get("Authorization"),
          "Bearer fictional-member-token",
        );
        assert.equal(body.schema, "composer.member-operation/2");
        assert.deepEqual(body.actor, { issuer: origin, accountId: member.id });
        assert.deepEqual(body.context, { dataClass: "synthetic" });
        assert.equal(body.resource, resource);
        assert.equal(body.configuration.source, selected.commit);
        if (body.action === "contribution-status") {
          const receipt = receipts.get(body.input.operationId);
          return Response.json({
            contract: 2,
            resource,
            operationId: body.input.operationId,
            outcome: receipt ? "completed" : "not-recorded",
            ...(receipt ? { receipt } : {}),
          });
        }
        let receipt = receipts.get(body.input.operationId);
        if (!receipt) {
          receipt = {
            id: "fictional-pending-postcard",
            resource,
            operationId: body.input.operationId,
            status: "pending",
            message: "Review required",
          };
          receipts.set(body.input.operationId, receipt);
        }
        return Response.json(receipt, { status: 201 });
      },
    };
    const input = {
      operationId: crypto.randomUUID(),
      caption: "Fictional member message",
      author: "Fictional member",
      consent: true,
      png: "fictional-png",
    };
    const invoke = (patch = {}) =>
      manageMembers(
        context(member, {
          action: "guestbook",
          workspace,
          resource,
          capability: "contribute",
          input,
          ...patch,
        }),
        f.runtime,
        { guestbook: selected.commit },
      );
    return {
      ...f,
      workspace,
      platform,
      service,
      resource,
      grant,
      calls,
      input,
      invoke,
    };
  } catch (error) {
    f.close();
    throw error;
  }
}

for (const scenario of [
  "success",
  "no-grant",
  "cross-team",
  "source",
  "configuration",
  "mode",
  "policy",
  "late-policy",
  "revoke",
  "browser-proof",
]) {
  const f = await setup();
  try {
    if (scenario === "success") {
      const first = await f.invoke();
      assert.equal(first.ok, true, JSON.stringify(first));
      const repeat = await f.invoke();
      assert.deepEqual(repeat.result, first.result);
      assert.equal(
        f.calls[0].configuration.revision,
        f.service.resources[0].configuration.revision,
      );
      assert.equal(
        f.calls[0].configuration.digest,
        f.service.resources[0].configuration.digest,
      );
      const closed = await f.platform({
        action: "update",
        id: f.service.id,
        expectedRevision: f.service.revision,
        request: { ...requested, contributions: "closed" },
      });
      assert.equal(closed.requests[0].status, "complete");
      await f.platform({
        action: "configure",
        expectedRevision: 1,
        profile: {
          ...profile,
          enabled: false,
          allowMemberContributions: false,
        },
      });
      const observed = await f.invoke({
        capability: "contribution-status",
        input: { operationId: f.input.operationId },
      });
      assert.equal(observed.ok, true, JSON.stringify(observed));
      assert.equal(observed.result.outcome, "completed");
      assert.deepEqual(observed.result.receipt, first.result);
      continue;
    }
    if (scenario === "no-grant")
      f.sqlite
        .prepare("DELETE FROM creator_app_grants WHERE id=?")
        .run(f.grant);
    if (scenario === "source") f.app.badBuild(true);
    if (scenario === "configuration") {
      const remote = f.app.resources.get(f.resource);
      remote.active = {
        ...remote.active,
        values: {
          ...remote.active.values,
          title: "Changed outside publication",
        },
      };
      remote.active.digest = await configurationDigest(remote.active.values);
    }
    if (scenario === "mode") f.app.resources.get(f.resource).paused = true;
    if (scenario === "policy")
      await f.platform({
        action: "configure",
        expectedRevision: 1,
        profile: { ...profile, allowMemberContributions: false },
      });
    if (["late-policy", "revoke"].includes(scenario)) {
      const prepare = f.db.prepare;
      let fired = false;
      f.db.prepare = (sql) => {
        const wrap = (statement) => ({
          ...statement,
          bind(...values) {
            return wrap(statement.bind(...values));
          },
          async first() {
            if (
              !fired &&
              sql.startsWith("INSERT INTO creator_app_access_audit")
            ) {
              fired = true;
              if (scenario === "revoke")
                f.sqlite
                  .prepare(
                    "UPDATE creator_app_grants SET status='revoked',revision=revision+1 WHERE id=?",
                  )
                  .run(f.grant);
              else
                f.sqlite
                  .prepare(
                    "UPDATE creator_platform_profiles SET profile_json=? WHERE workspace_id=?",
                  )
                  .run(
                    JSON.stringify({
                      ...profile,
                      allowMemberContributions: false,
                    }),
                    f.workspace,
                  );
            }
            return statement.first();
          },
        });
        return wrap(prepare(sql));
      };
    }
    const response = await f.invoke(
      scenario === "cross-team"
        ? { workspace: "different-workspace" }
        : scenario === "browser-proof"
          ? {
              configuration: { source: selected.commit },
              context: { dataClass: "synthetic" },
            }
          : {},
    );
    assert.equal(
      response.ok,
      false,
      scenario + ": " + JSON.stringify(response),
    );
    assert.equal(
      f.calls.length,
      0,
      scenario + " must not reach the member service",
    );
  } finally {
    f.close();
  }
}
console.log(
  JSON.stringify({
    syntheticContractOnly: true,
    scenarios: 10,
    actualPinPromoted: false,
  }),
);
