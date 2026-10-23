import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { managePlatform } from "../src/lib/platform-admin.ts";
import { memberPlugin } from "../src/lib/member-plugin.ts";
import {
  currentPlatform,
  platformContinuation,
} from "../src/components/ready-platform-read.ts";
import {
  platformObservation,
  inspectPlatformReport,
} from "../lib/get-ready/platform.mjs";

const profile = {
  enabled: true,
  allowedRecipes: ["guestbook"],
  environments: ["preview"],
  dataClasses: ["synthetic"],
  maxApplications: 2,
  reviewRequired: false,
};
const entry = new URL(
  import.meta.resolve("emdash/internal/plugin-test-runtime"),
);
const match = readFileSync(entry, "utf8").match(
  /import \{[^}]*?([A-Za-z]+) as dispatchPluginApiRequest[^}]*?\} from "([^"]+)"/,
);
assert.ok(match);
const dispatch = (await import(new URL(match[2], entry)))[match[1]];

function memberTransport(f, actor) {
  const plugin = memberPlugin(f.runtime, {});
  const calls = [];
  const runtime = {
    getPluginRouteMeta(id, path) {
      assert.equal(
        id,
        "composer-members",
        "A denial must not try native fallback",
      );
      return plugin.routes[path.slice(1)];
    },
    async handlePluginApiRoute(id, method, path, request, currentActor) {
      return {
        success: true,
        data: await plugin.routes[path.slice(1)].handler({
          request,
          user: currentActor,
          input:
            method === "GET"
              ? Object.fromEntries(new URL(request.url).searchParams)
              : await request.json(),
        }),
      };
    },
  };
  const transport = async (path, options = {}) => {
    calls.push(path);
    const url = new URL(path, origin);
    const [, pluginId, route] = url.pathname.match(/plugins\/([^/]+)\/(.+)$/);
    return dispatch({
      runtime,
      pluginId,
      path: "/" + route,
      user: actor,
      request: new Request(url, {
        ...options,
        headers: { Origin: origin, "X-EmDash-Request": "1" },
      }),
    });
  };
  return { transport, calls };
}
async function setup(f) {
  const workspace = (await workspaceForUser(f.db, user)).id;
  const response = await managePlatform(
    {
      user,
      input: { action: "configure", workspace, expectedRevision: 0, profile },
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
  assert.equal(response.ok, true);
  return workspace;
}
const path = (workspace) =>
  "/_emdash/api/plugins/composer-members/platformRead?" +
  new URLSearchParams({ action: "list", workspace });
const assess = (snapshot) =>
  inspectPlatformReport(
    platformObservation({
      origin,
      source: "a".repeat(40),
      operator: false,
      snapshot,
    }),
  );

for (const role of [10, 20, 30, 40, 50]) {
  test(`actual member route → Get Ready keeps role${role} viewer read-only`, async () => {
    const f = fixture();
    try {
      const workspace = await setup(f);
      const actor = { id: "fictional-viewer-" + role, role };
      f.sqlite
        .prepare(
          "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'viewer')",
        )
        .run(workspace, actor.id);
      const { transport, calls } = memberTransport(f, actor);
      if (role === 10) {
        assert.equal((await transport(path(workspace))).status, 403);
        calls.length = 0;
        await assert.rejects(currentPlatform(workspace, origin, transport));
        assert.equal(calls.length, 1, "403 is final; no native fallback");
      } else {
        const snapshot = await currentPlatform(workspace, origin, transport);
        assert.equal(snapshot.workspace.role, "viewer");
        assert.equal(snapshot.setup.canConfigurePolicy, false);
        const assessment = assess(snapshot);
        assert.equal(assessment.next.id, "view");
        assert.deepEqual(platformContinuation(assessment), {
          href:
            "/_emdash/admin/plugins/composer-stacks/platform?workspace=" +
            workspace,
          label: "View protected platform",
        });
        actor.role = 10;
        const beforeDowngrade = calls.length;
        await assert.rejects(currentPlatform(workspace, origin, transport));
        assert.equal(
          calls.length,
          beforeDowngrade + 1,
          "A global role downgrade must deny without fallback",
        );
        actor.role = role;
        for (const action of [
          "list",
          "submit",
          "revise",
          "update",
          "run",
          "reconcile",
          "configure",
          "review",
          "grant",
        ]) {
          const response = await transport(
            "/_emdash/api/plugins/composer-members/platformWrite",
            {
              method: "POST",
              body: JSON.stringify({ action, workspace }),
            },
          );
          assert.equal(
            response.status,
            403,
            action + " cannot be used by viewers",
          );
        }
        for (const query of [
          { action: "submit", workspace },
          { action: "list", workspace, extra: "no-imported-fields" },
          { action: "list", workspace: "fictional-other-team" },
        ])
          assert.notEqual(
            (
              await transport(
                "/_emdash/api/plugins/composer-members/platformRead?" +
                  new URLSearchParams(query),
              )
            ).status,
            200,
          );
      }
      assert.equal(f.app.writes.length, 0);
      assert.equal(
        f.sqlite
          .prepare("SELECT COUNT(*) AS n FROM creator_platform_requests")
          .get().n,
        0,
      );
      // An editor retains its supported member view; losing edit access never
      // grants role10 a read capability, and never leaves a creator an edit link.
      f.sqlite
        .prepare(
          "UPDATE creator_members SET role='editor' WHERE workspace_id=? AND user_id=?",
        )
        .run(workspace, actor.id);
      assert.equal(
        assess(await currentPlatform(workspace, origin, transport)).next.id,
        "request",
      );
      f.sqlite
        .prepare(
          "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
        )
        .run(workspace, actor.id);
      if (role === 10)
        await assert.rejects(currentPlatform(workspace, origin, transport));
      else
        assert.equal(
          assess(await currentPlatform(workspace, origin, transport)).next.id,
          "view",
        );
      f.sqlite
        .prepare(
          "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
        )
        .run(workspace, actor.id);
      await assert.rejects(currentPlatform(workspace, origin, transport));
    } finally {
      f.close();
    }
  });
}

test("Get Ready compatibility falls back only on an absent member route", async () => {
  const f = fixture();
  try {
    const workspace = await setup(f);
    const member = memberTransport(f, user);
    const response = await member.transport(path(workspace));
    const calls = [];
    await currentPlatform(workspace, origin, async (path) => {
      calls.push(path);
      return calls.length === 1
        ? new Response(null, { status: 404 })
        : response;
    });
    assert.equal(calls.length, 2);
    assert.match(
      calls[1],
      /^\/_emdash\/api\/plugins\/composer-stacks\/platformRead\?/,
    );
    const deniedCalls = [];
    await assert.rejects(
      currentPlatform(workspace, origin, async (path) => {
        deniedCalls.push(path);
        return Response.json(
          {
            success: false,
            error: { code: "FORBIDDEN", message: "Current access denied" },
          },
          { status: 403 },
        );
      }),
    );
    assert.equal(deniedCalls.length, 1);
  } finally {
    f.close();
  }
});

for (const [globalRole, membershipChange, expectedStatus] of [
  [10, "viewer", 403],
  [20, "viewer", 409],
  [20, null, 403],
]) {
  test(`an in-flight role${globalRole} read rechecks ${membershipChange ?? "removed"} membership`, async () => {
    const f = fixture();
    try {
      const workspace = await setup(f);
      const actor = { id: "fictional-racing-viewer", role: globalRole };
      f.sqlite
        .prepare(
          "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'editor')",
        )
        .run(workspace, actor.id);
      const prepare = f.db.prepare;
      let changed = false;
      f.db.prepare = (sql) => {
        const wrap = (statement) => ({
          ...statement,
          bind(...values) {
            return wrap(statement.bind(...values));
          },
          async first() {
            if (
              !changed &&
              sql.startsWith("SELECT COUNT(*) AS n FROM creator_stacks")
            ) {
              changed = true;
              if (membershipChange)
                f.sqlite
                  .prepare(
                    "UPDATE creator_members SET role=? WHERE workspace_id=? AND user_id=?",
                  )
                  .run(membershipChange, workspace, actor.id);
              else
                f.sqlite
                  .prepare(
                    "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
                  )
                  .run(workspace, actor.id);
            }
            return statement.first();
          },
        });
        return wrap(prepare(sql));
      };
      const { transport, calls } = memberTransport(f, actor);
      assert.equal((await transport(path(workspace))).status, expectedStatus);
      assert.equal(
        changed,
        true,
        "The downgrade must land during the actual snapshot",
      );
      assert.equal(calls.length, 1);
      if (globalRole === 20 && membershipChange) {
        const current = await currentPlatform(workspace, origin, transport);
        assert.equal(current.workspace.role, "viewer");
        assert.equal(assess(current).next.id, "view");
      } else
        await assert.rejects(currentPlatform(workspace, origin, transport));
    } finally {
      f.close();
    }
  });
}
