import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertOwnedAvailabilityLab,
  runLocalAvailabilityExercise,
  stableAvailability,
} from "../labs/platform/native-incident.mjs";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { platformPublicFixture } from "./helpers/platform-public-fixture.mjs";
import { managePlatform } from "../src/lib/platform-admin.ts";
import { workspaceForUser, readStack } from "../src/lib/stacks.mjs";

const account = "00000000000000000000000000000001";
const services = [
  { binding: "GUESTBOOK", service: "composer-invited-guestbook" },
  {
    binding: "GUESTBOOK_MEMBERS",
    service: "composer-invited-guestbook",
    entrypoint: "GuestbookMemberService",
  },
  { binding: "SHOWCASE", service: "composer-invited-showcase" },
  { binding: "PLATFORM_PUBLIC_PAGES", service: "composer-invited-composer" },
];

test("availability admission requires the owned local lifecycle, exact self-binding and no remote resource", async () => {
  const owned = await mkdtemp(join(tmpdir(), "composer-incident-test-"));
  try {
    const root = join(owned, "lab");
    const configs = {};
    const lab = {
      root,
      origins: { composer: origin },
      sources: Object.fromEntries(
        ["composer", "guestbook", "showcase"].map((name) => [
          name,
          { head: "a".repeat(40) },
        ]),
      ),
    };
    for (const name of ["composer", "guestbook", "showcase"]) {
      await mkdir(join(root, name), { recursive: true });
      configs[name] = {
        name: "composer-invited-" + name,
        main: name === "composer" ? "./lab-entry.ts" : "./local-entry.ts",
        workers_dev: false,
        preview_urls: false,
        routes: [],
        vars: { RESOURCE_ACCOUNT_ID: account, RESOURCE_ENVIRONMENT: "local" },
        ...(name === "composer" ? { services } : {}),
      };
    }
    const save = (name) =>
      writeFile(
        join(root, name, "wrangler.local.jsonc"),
        JSON.stringify(configs[name]),
      );
    for (const name of Object.keys(configs)) await save(name);
    assert.equal(
      (await assertOwnedAvailabilityLab(lab, owned)).environment,
      "local",
    );
    const scope = (suffix) => ({
      workspace: "workspace-" + suffix,
      stack: "stack-" + suffix,
      instance: "instance-" + suffix,
      resource: "resource-" + suffix,
      request: "request-" + suffix,
    });
    // A refused actual dispatch boundary must leave a bounded failure receipt.
    // This page transport double never creates a browser/session or app write.
    const failed = await runLocalAvailabilityExercise({
      owner: {
        page: { evaluate: async () => ({ status: 401, body: {} }) },
        user,
      },
      lab,
      ownedRoot: owned,
      output: owned,
      teamA: scope("aaaaaa"),
      teamB: scope("bbbbbb"),
      expectedMediaSha: "a".repeat(64),
      readPublic: () => assert.fail("No public reads after admission refusal"),
      capture: () => assert.fail("No capture after admission refusal"),
    });
    assert.equal(failed.status, "blocked");
    assert.equal(failed.receiverClosed, true);
    assert.deepEqual(failed.actions, []);
    const receipt = JSON.parse(
      await readFile(join(owned, failed.receipt), "utf8"),
    );
    assert.equal(receipt.status, "blocked");
    assert.equal(receipt.classification, "local-workerd-fixture");
    await assert.rejects(
      assertOwnedAvailabilityLab({ ...lab, root: owned }, owned),
      /owned local root/,
    );
    configs.composer.services = services.slice(0, 3);
    await save("composer");
    await assert.rejects(
      assertOwnedAvailabilityLab(lab, owned),
      /exact local service/,
    );
    configs.composer.services = services;
    await save("composer");
    for (const field of ["RESOURCE_ENVIRONMENT", "RESOURCE_ACCOUNT_ID"]) {
      const before = configs.guestbook.vars[field];
      configs.guestbook.vars[field] = "production";
      await save("guestbook");
      await assert.rejects(assertOwnedAvailabilityLab(lab, owned), /not local/);
      configs.guestbook.vars[field] = before;
    }
    configs.guestbook.d1_databases = [{ binding: "DB", remote: true }];
    await save("guestbook");
    await assert.rejects(
      assertOwnedAvailabilityLab(lab, owned),
      /Remote bindings/,
    );
    delete configs.guestbook.d1_databases;
    await save("guestbook");
    const outside = join(owned, "outside.json");
    await writeFile(outside, JSON.stringify(configs.showcase));
    await rm(join(root, "showcase/wrangler.local.jsonc"));
    await symlink(outside, join(root, "showcase/wrangler.local.jsonc"));
    await assert.rejects(
      assertOwnedAvailabilityLab(lab, owned),
      /escaped its owned root/,
    );
  } finally {
    await rm(owned, { recursive: true, force: true });
  }
});

test("recovery needs three distinct consecutive successes; flapping stops without another sample", async () => {
  let calls = 0;
  const stable = await stableAvailability(
    async () => ({ healthy: true, sequence: ++calls }),
    { intervalMs: 1 },
  );
  assert.equal(stable.count, 3);
  assert.deepEqual(
    stable.observations.map((x) => x.sequence),
    [1, 2, 3],
  );
  calls = 0;
  await assert.rejects(
    stableAvailability(async () => ({ healthy: ++calls !== 2 }), {
      intervalMs: 1,
    }),
    /flapped/,
  );
  assert.equal(calls, 2);
  await assert.rejects(
    stableAvailability(() => assert.fail("No sampling before admission"), {
      intervalMs: 0,
    }),
    /bounded/,
  );
});

// Real Composer routes, SQLite CAS and operation journal; the app transport and
// public publication below are explicitly HTTP contract doubles, not workerd proof.
async function managedTeam(f, actor, name) {
  const workspace = (await workspaceForUser(f.db, actor)).id;
  const call = (input) =>
    managePlatform(
      {
        user: actor,
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
  const configured = await call({
    action: "configure",
    workspace,
    expectedRevision: 0,
    profile: {
      enabled: true,
      reviewRequired: false,
      allowedRecipes: ["guestbook"],
      environments: ["preview"],
      dataClasses: ["synthetic"],
      maxApplications: 2,
    },
  });
  assert.equal(configured.ok, true, JSON.stringify(configured));
  const submitted = await call({
    action: "submit",
    workspace,
    key: crypto.randomUUID(),
    request: {
      version: 1,
      name,
      recipe: "guestbook",
      environment: "preview",
      dataClass: "synthetic",
      location: "provider-default",
      quota: "small",
    },
  });
  assert.equal(submitted.ok, true, JSON.stringify(submitted));
  const request = submitted.requests[0];
  assert.equal(request.status, "complete", JSON.stringify(request));
  const resource = request.resources[0];
  return {
    workspace,
    stack: request.stackId,
    instance: resource.instance,
    resource: resource.resource,
    actor,
  };
}
const selection = (scope, revision) => ({
  workspace: scope.workspace,
  stack: scope.stack,
  instance: scope.instance,
  expectedRevision: revision,
});
const inspect = async (f, scope) => {
  const stack = await readStack(f.db, scope.workspace, scope.stack);
  const reply = await f.route(
    { action: "resourceContent", ...selection(scope, stack.revision) },
    true,
    scope.actor,
  );
  assert.equal(reply.ok, true, JSON.stringify(reply));
  return { stack, book: reply.book };
};
const control = (f, scope, state, visible, operationId = crypto.randomUUID()) =>
  f.route(
    {
      action: "moderateResource",
      ...selection(scope, state.stack.revision),
      change: {
        command: "control",
        resource: scope.resource,
        operationId,
        expectedVersion: state.book.version,
        visible,
        paused: state.book.paused,
      },
    },
    false,
    scope.actor,
  );

test("managed control faults and restores only the selected resource using fresh CAS; lost ACK reconciliation never replays", async () => {
  const f = fixture();
  f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
  try {
    const a = await managedTeam(f, user, "Fictional availability A");
    const b = await managedTeam(
      f,
      { ...user, id: "fictional-control-team-b" },
      "Fictional availability B",
    );
    const baseline = await inspect(f, a),
      controlB = await inspect(f, b);
    const configuration = [...f.app.resources.get(a.resource).configurations];
    const writes = f.app.writes.length;
    const rejected = await f.route({
      action: "applyResources",
      ...selection(a, baseline.stack.revision),
    });
    assert.equal(rejected.code, "FORBIDDEN");
    assert.equal(f.app.writes.length, writes);
    const hidden = await control(f, a, baseline, false);
    assert.equal(hidden.outcome, "applied", JSON.stringify(hidden));
    assert.equal(hidden.book.visible, false);
    assert.equal(hidden.book.version, baseline.book.version + 1);
    assert.deepEqual(hidden.stack.draft, baseline.stack.draft);
    assert.deepEqual(hidden.stack.published, baseline.stack.published);
    const stale = await control(f, a, baseline, true);
    assert.equal(stale.ok, false);
    assert.equal(f.app.writes.length, writes + 1);
    let lose = true;
    f.app.afterWrite(({ command }) => {
      if (lose && command.action === "control") {
        lose = false;
        throw Error("Committed control reply lost");
      }
    });
    const restored = await control(f, a, await inspect(f, a), true);
    assert.equal(restored.outcome, "unknown");
    const afterCommit = f.app.writes.length;
    const reconciled = await f.route({
      action: "reconcileResourceContent",
      ...selection(a, restored.stack.revision),
    });
    assert.equal(reconciled.outcome, "applied");
    assert.equal(reconciled.book.visible, true);
    assert.equal(reconciled.book.paused, baseline.book.paused);
    assert.equal(reconciled.book.version, baseline.book.version + 2);
    assert.equal(f.app.writes.length, afterCommit);
    assert.equal(reconciled.book.pending, false);
    assert.deepEqual(
      [...f.app.resources.get(a.resource).configurations],
      configuration,
    );
    assert.deepEqual(await inspect(f, b), controlB);
    assert.equal(f.app.resources.size, 2);
    assert.equal(
      f.sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_resource_operations WHERE action='control' AND state='confirmed'",
        )
        .get().n,
      2,
    );
    const denied = await f.route({
      action: "moderateResource",
      ...selection(a, reconciled.stack.revision),
      change: {
        command: "control",
        resource: b.resource,
        operationId: crypto.randomUUID(),
        expectedVersion: reconciled.book.version,
        visible: false,
        paused: false,
      },
    });
    assert.equal(denied.ok, false);
    assert.equal(f.app.writes.length, afterCommit);
  } finally {
    f.close();
  }
});
