import test from "node:test";
import assert from "node:assert/strict";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { platformPublicFixture } from "./helpers/platform-public-fixture.mjs";
import { workspaceForUser, readStack } from "../src/lib/stacks.mjs";
import { managePlatform } from "../src/lib/platform-admin.ts";
import { platformPlan } from "../src/lib/platform-contract.ts";

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
  name: "Fictional review specimen",
  recipe: "guestbook",
  environment: "preview",
  dataClass: "synthetic",
  location: "provider-default",
  quota: "small",
};
async function setup() {
  const f = fixture();
  f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
  const call = (input, reading = false) =>
    managePlatform(
      {
        user,
        input,
        request: new Request(
          origin +
            "/_emdash/api/plugins/composer-stacks/platform" +
            (reading ? "Read" : "Write"),
          {
            method: reading ? "GET" : "POST",
            headers: { Origin: origin, "X-EmDash-Request": "1" },
          },
        ),
      },
      f.runtime,
    );
  try {
    const workspace = await workspaceForUser(f.db, user);
    assert.equal(
      (
        await call({
          action: "configure",
          workspace: workspace.id,
          expectedRevision: 0,
          profile,
        })
      ).ok,
      true,
    );
    return { ...f, call, workspace };
  } catch (error) {
    f.close();
    throw error;
  }
}
async function submit(f) {
  return f.call({
    action: "submit",
    workspace: f.workspace.id,
    key: crypto.randomUUID(),
    request,
  });
}

test("unrelated public resource HTML cannot establish verification or discard created identities", async () => {
  const f = await setup();
  try {
    const seen = [];
    f.runtime.PLATFORM_PUBLIC_FETCH = async (req) => {
      seen.push({
        url: req.url,
        authorization: req.headers.get("Authorization"),
      });
      return new Response("<html><h1>Unrelated maintenance page</h1></html>", {
        headers: { "Content-Type": "text/html" },
      });
    };
    const result = await submit(f);
    assert.equal(result.ok, true);
    assert.equal(result.requests[0].status, "needs-attention");
    assert.equal(f.app.resources.size, 1);
    assert.equal(seen.length, 1);
    assert.match(
      seen[0].url,
      /^https:\/\/composer\.loftwah\.com\/guestbook\/r\//,
    );
    assert.equal(seen[0].authorization, null);
    const writes = f.app.writes.length;
    f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
    const resumed = await f.call({
      action: "run",
      workspace: f.workspace.id,
      id: result.requests[0].id,
      expectedRevision: result.requests[0].revision,
    });
    assert.equal(resumed.requests[0].status, "complete");
    assert.equal(f.app.resources.size, 1);
    assert.equal(f.app.writes.length, writes);
  } finally {
    f.close();
  }
});

test("correct standalone resource HTML does not substitute for composed publication verification", async () => {
  const f = await setup();
  try {
    const good = platformPublicFixture(f),
      seen = [];
    f.runtime.PLATFORM_PUBLIC_FETCH = async (req) => {
      const path = new URL(req.url).pathname;
      seen.push(path);
      return path.startsWith("/s/")
        ? new Response("<html>Different publication</html>", {
            headers: { "Content-Type": "text/html" },
          })
        : good(req);
    };
    const result = await submit(f);
    assert.equal(result.requests[0].status, "needs-attention");
    assert.equal(seen.length, 2);
    assert.match(seen[0], /^\/guestbook\/r\//);
    assert.match(seen[1], /^\/s\/team-/);
  } finally {
    f.close();
  }
});

test("actual legacy republish endpoint cannot bypass enabled standing policy", async () => {
  const f = await setup();
  try {
    const result = await submit(f);
    assert.equal(result.requests[0].status, "complete");
    const stack = await readStack(
      f.db,
      f.workspace.id,
      result.requests[0].stackId,
    );
    const response = await f.route({
      action: "republish",
      workspace: f.workspace.id,
      stack: stack.id,
      revision: stack.publishedRevision,
      expectedRevision: stack.revision,
    });
    assert.equal(response.code, "FORBIDDEN");
    assert.equal(
      (await readStack(f.db, f.workspace.id, stack.id)).revision,
      stack.revision,
    );
  } finally {
    f.close();
  }
});

test("historical request remains inspectable if its stack is missing; pausing policy keeps the lifecycle fence", async () => {
  const f = await setup();
  try {
    const result = await submit(f),
      retained = result.requests[0];
    assert.equal(retained.status, "complete");
    assert.equal(
      (
        await f.call({
          action: "configure",
          workspace: f.workspace.id,
          expectedRevision: 1,
          profile: { ...profile, enabled: false },
        })
      ).ok,
      true,
    );
    const stack = await readStack(f.db, f.workspace.id, retained.stackId);
    assert.equal(
      (
        await f.route({
          action: "delete",
          workspace: f.workspace.id,
          stack: stack.id,
          expectedRevision: stack.revision,
        })
      ).code,
      "FORBIDDEN",
    );
    // A historical/corrupt reference can still be absent without breaking all
    // requests. Only this isolated fixture removes the local stack row.
    f.sqlite.prepare("DELETE FROM creator_stacks WHERE id=?").run(stack.id);
    const listed = await f.call(
      { action: "list", workspace: f.workspace.id },
      true,
    );
    assert.equal(listed.ok, true);
    assert.equal(listed.requests[0].id, retained.id);
    assert.equal(listed.requests[0].planDigest, retained.planDigest);
    assert.equal(listed.requests[0].url, null);
    assert.equal(f.app.resources.size, 1); // Stack deletion never claims app-owned data was retired.
  } finally {
    f.close();
  }
});

test("scoped platform handoff never recommends applying global paired-app settings", () => {
  const plan = platformPlan(
    request,
    { ...profile, version: 1, revision: 1 },
    {
      account: "fictional-account",
      environment: "production",
      url: origin + "/guestbook",
    },
  );
  assert.doesNotMatch(
    JSON.stringify(plan.handoff),
    /--apply-settings|pnpm compose/,
  );
});
