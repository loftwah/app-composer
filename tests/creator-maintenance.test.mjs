import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  fixture,
  saved,
  user,
  instance,
  origin,
} from "./helpers/resource-fixture.mjs";
import { workspaceForUser, readStack, saveStack } from "../src/lib/stacks.mjs";
import { applyStackResources } from "../src/lib/stack-resources.ts";
import { manageMaintenance } from "../src/lib/creator-maintenance.ts";
import { decodeMaintenanceReply } from "../src/plugins/maintenance/protocol.ts";
import { appSettings } from "../src/lib/app-settings.mjs";
import { managePlatform } from "../src/lib/platform-admin.ts";
import { platformPublicFixture } from "./helpers/platform-public-fixture.mjs";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const caller = { ...user, role: 20 };
const ctx = (action, fields, actor = caller) => ({
  user: actor,
  input: { action, ...fields },
  request: new Request(
    origin + "/_emdash/api/plugins/composer-stacks/maintenanceRead",
    { headers: { Origin: origin } },
  ),
});
const run = (f, action, fields, actor) =>
  manageMaintenance(ctx(action, fields, actor), f.runtime);
async function prepared(f) {
  const space = await workspaceForUser(f.db, caller);
  const stack = await saved(f, space.id, "Fictional maintenance book", [
    instance("fictional-maintenance-instance", "Fictional book"),
  ]);
  const applied = await applyStackResources(
    f.db,
    caller.id,
    space.id,
    stack.id,
    stack.revision,
    f.runtime,
  );
  return {
    space,
    stack: applied.stack,
    resource: applied.resources[0].resource,
    fields: {
      workspace: space.id,
      stack: stack.id,
      instance: stack.draft.instances[0].id,
      expectedRevision: String(applied.stack.revision),
    },
  };
}
// Member mode must originate in the current governed runner, never a generic
// applyResources call or a fixture that forges its execution identity.
async function preparedMembers(f) {
  const space = await workspaceForUser(f.db, caller);
  f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
  const invoke = (input) =>
    managePlatform(
      {
        user: caller,
        input: { workspace: space.id, ...input },
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
  const configured = await invoke({
    action: "configure",
    expectedRevision: 0,
    profile: {
      enabled: true,
      allowMemberContributions: true,
      reviewRequired: false,
      allowedRecipes: ["guestbook"],
      environments: ["preview"],
      dataClasses: ["synthetic"],
      maxApplications: 2,
    },
  });
  assert.equal(configured.ok, true, JSON.stringify(configured));
  const created = await invoke({
    action: "submit",
    key: crypto.randomUUID(),
    request: {
      version: 1,
      name: "Fictional member maintenance book",
      recipe: "guestbook",
      environment: "preview",
      dataClass: "synthetic",
      location: "provider-default",
      quota: "small",
      contributions: "members",
    },
  });
  assert.equal(created.ok, true, JSON.stringify(created));
  const service = created.requests[0];
  assert.equal(service.status, "complete", JSON.stringify(service));
  const stack = await readStack(f.db, space.id, service.stackId);
  return {
    space,
    stack,
    resource: service.resources[0].resource,
    fields: {
      workspace: space.id,
      stack: stack.id,
      instance: stack.draft.instances[0].id,
      expectedRevision: String(stack.revision),
    },
  };
}
function portable(f, p) {
  const source = appSettings.guestbook.source.commit,
    row = f.app.resources.get(p.resource);
  return {
    format: "guestbook.approved-portable/v1",
    contract: 1,
    exportedAt: new Date().toISOString(),
    source: {
      app: "guestbook",
      build: source,
      resource: p.resource,
      workspace: p.space.id,
      account: f.runtime.RESOURCE_ACCOUNT_ID,
      environment: "production",
      target: origin + "/guestbook",
      version: row.version,
    },
    configuration: row.active,
    items: [
      {
        id: "fictional-approved-item",
        revision: 2,
        caption: "Fictional approved postcard",
        author: "Fictional visitor",
        synthetic: 1,
        createdAt: "2026-10-18 10:00:00",
        media: {
          type: "image/png",
          sha256: hash(Buffer.from(png, "base64")),
          base64: png,
        },
      },
    ],
    coverage: {
      approvedOriginals: 1,
      included: 1,
      complete: true,
      maximumItems: 8,
      privateContent: false,
      credentials: false,
      restoredCopies: false,
    },
    rights:
      "No new licence is granted. Retain contributor consent and confirm your permission to copy.",
    limitation:
      "Requires this live source authority. Restores are private, fresh copies; not offline or cross-account disaster recovery.",
  };
}
function exportService(f, p, change = (value) => value) {
  const original = f.app.fetch;
  let calls = 0;
  f.runtime.GUESTBOOK = {
    async fetch(request) {
      if (new URL(request.url).pathname.endsWith("/portable")) {
        calls++;
        assert.equal(request.headers.get("X-Composer-Workspace"), p.space.id);
        assert.equal(
          request.headers.get("X-Composer-Target"),
          origin + "/guestbook",
        );
        assert.equal(request.method, "GET");
        return Response.json(await change(portable(f, p)));
      }
      const response = await original(request);
      return request.url.endsWith("/build.json")
        ? Response.json({ ...(await response.json()), portabilityContract: 1 })
        : response;
    },
  };
  return () => calls;
}

test("read-only check compares exact app/runtime/resource/configuration without inventing deployment/media/cost health", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    const before = f.sqlite.prepare("SELECT * FROM creator_stacks").all();
    const writes = f.app.writes.length;
    const list = decodeMaintenanceReply(
      "list",
      await run(f, "list", { workspace: p.space.id }),
    );
    assert.equal(list.stacks[0].instances[0].resource, p.resource);
    const result = decodeMaintenanceReply(
      "check",
      await run(f, "check", p.fields),
    );
    assert.equal(result.check.outcome, "matched");
    assert.equal(
      result.check.expected.source,
      appSettings.guestbook.source.commit,
    );
    assert.equal(result.check.actual.account, f.runtime.RESOURCE_ACCOUNT_ID);
    assert.equal(
      result.check.portabilitySupported,
      false,
      "old pinned app stays explicitly unsupported",
    );
    assert.deepEqual(result.check.coverage, {
      source: "matched",
      resource: "matched",
      workerDeployment: "unavailable",
      media: "not-checked",
      metrics: "unavailable",
      costs: "unavailable",
    });
    f.app.resources.get(p.resource).version++;
    assert.equal((await run(f, "check", p.fields)).check.outcome, "stale");
    f.app.badBuild(true);
    const unavailable = await run(f, "check", p.fields);
    assert.equal(unavailable.check.outcome, "unavailable");
    assert.equal(unavailable.check.actual, null);
    assert.equal(unavailable.check.coverage.source, "unverified");
    assert.equal(f.app.writes.length, writes);
    assert.deepEqual(
      f.sqlite.prepare("SELECT * FROM creator_stacks").all(),
      before,
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /fictional-owner-token|Authorization/,
    );
  } finally {
    f.close();
  }
});

test("viewer metadata is scoped; only current owner/editor can export private app content", async () => {
  const f = fixture();
  try {
    const p = await prepared(f),
      viewer = { ...caller, id: "fictional-viewer-user" },
      outsider = { ...caller, id: "fictional-outsider-user" };
    f.sqlite
      .prepare(
        "INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,?)",
      )
      .run(p.space.id, viewer.id, "viewer");
    assert.equal(
      (await run(f, "check", p.fields, viewer)).check.outcome,
      "matched",
    );
    const calls = exportService(f, p);
    assert.equal((await run(f, "export", p.fields, viewer)).code, "FORBIDDEN");
    assert.equal(calls(), 0);
    assert.equal((await run(f, "check", p.fields, outsider)).code, "FORBIDDEN");
    assert.equal(
      (await run(f, "check", { ...p.fields, instance: "foreign-instance" })).ok,
      false,
    );
    assert.equal(
      (await run(f, "check", { ...p.fields, expectedRevision: "1" })).code,
      "CONFLICT",
    );
    f.sqlite
      .prepare(
        "UPDATE creator_app_resources SET environment='preview' WHERE id=?",
      )
      .run(p.resource);
    assert.equal((await run(f, "check", p.fields)).code, "FORBIDDEN");
  } finally {
    f.close();
  }
});

test("successful export verifies exact identities, coverage, active configuration and actual PNG digest", async () => {
  const f = fixture();
  try {
    const p = await prepared(f),
      calls = exportService(f, p);
    const before = f.sqlite.prepare("SELECT * FROM creator_stacks").all();
    assert.equal(
      (await run(f, "check", p.fields)).check.portabilitySupported,
      true,
    );
    const exported = decodeMaintenanceReply(
      "export",
      await run(f, "export", p.fields),
    );
    assert.equal(exported.portable.source.resource, p.resource);
    assert.equal(exported.portable.items[0].media.base64, png);
    assert.equal(calls(), 1);
    assert.deepEqual(
      f.sqlite.prepare("SELECT * FROM creator_stacks").all(),
      before,
    );
    assert.equal(f.sqlite.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    f.close();
  }
});

for (const mutation of ["membership", "stack", "binding"])
  test(
    "final guard discards export after concurrent " + mutation + " change",
    async () => {
      const f = fixture();
      try {
        const p = await prepared(f);
        exportService(f, p, (value) => {
          if (mutation === "membership")
            f.sqlite
              .prepare(
                "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
              )
              .run(p.space.id, caller.id);
          else if (mutation === "stack")
            f.sqlite
              .prepare(
                "UPDATE creator_stacks SET revision=revision+1 WHERE id=?",
              )
              .run(p.stack.id);
          else
            f.sqlite
              .prepare(
                "UPDATE creator_app_resources SET target='https://wrong.example.test/guestbook' WHERE id=?",
              )
              .run(p.resource);
          return value;
        });
        const result = await run(f, "export", p.fields);
        assert.equal(result.ok, false);
        assert.equal(result.portable, undefined);
        assert.ok(["CONFLICT", "FORBIDDEN"].includes(result.code));
      } finally {
        f.close();
      }
    },
  );

for (const kind of [
  "wrong-resource",
  "wrong-source",
  "wrong-workspace",
  "wrong-digest",
  "private-content",
  "torn-version",
  "malformed",
])
  test(
    "untrusted export is refused before offering copied content: " + kind,
    async () => {
      const f = fixture();
      try {
        const p = await prepared(f);
        exportService(f, p, (value) => {
          if (kind === "wrong-resource")
            value.source.resource = "fictional-wrong-resource";
          if (kind === "wrong-source") value.source.build = "b".repeat(40);
          if (kind === "wrong-workspace")
            value.source.workspace = "fictional-foreign-workspace";
          if (kind === "wrong-digest")
            value.items[0].media.sha256 = "0".repeat(64);
          if (kind === "private-content") value.coverage.privateContent = true;
          if (kind === "torn-version")
            f.app.resources.get(p.resource).version++;
          if (kind === "malformed") return { ok: true };
          return value;
        });
        const result = await run(f, "export", p.fields);
        assert.equal(result.ok, false);
        assert.equal(result.portable, undefined);
      } finally {
        f.close();
      }
    },
  );

test("unresolved app operations stay explicit and export never retries or changes resource journals", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    const fields = { ...p.fields, stack: p.stack.id };
    f.sqlite
      .prepare("UPDATE creator_app_resources SET state='unknown' WHERE id=?")
      .run(p.resource);
    const before = f.sqlite
      .prepare("SELECT * FROM creator_resource_operations ORDER BY id")
      .all();
    assert.equal((await run(f, "check", fields)).check.outcome, "stale");
    assert.equal((await run(f, "export", fields)).code, "CONFLICT");
    assert.deepEqual(
      f.sqlite
        .prepare("SELECT * FROM creator_resource_operations ORDER BY id")
        .all(),
      before,
    );
    const stack = await readStack(f.db, p.space.id, p.stack.id);
    await saveStack(
      f.db,
      p.space.id,
      p.stack.id,
      { ...stack.draft, description: "New saved work" },
      stack.revision,
    );
    assert.equal((await run(f, "check", fields)).code, "CONFLICT");
  } finally {
    f.close();
  }
});

test("strict maintenance decoder rejects missing results, malformed identity and invented coverage", async () => {
  assert.throws(() => decodeMaintenanceReply("list", { ok: true }));
  assert.throws(() =>
    decodeMaintenanceReply("export", {
      ok: true,
      workspace: { id: "valid-workspace", name: "Fictional", role: "owner" },
      portable: { format: "guestbook.approved-portable/v1" },
    }),
  );
  const f = fixture();
  try {
    const p = await prepared(f),
      result = await run(f, "check", p.fields);
    result.check.coverage.costs = "healthy";
    assert.throws(() => decodeMaintenanceReply("check", result));
  } finally {
    f.close();
  }
});

test("fresh app export cannot bypass a stale saved resource confirmation", async () => {
  const f = fixture();
  try {
    const p = await prepared(f);
    exportService(f, p, (value) => {
      f.app.resources.get(p.resource).version++;
      value.source.version++;
      return value;
    });
    const result = await run(f, "export", p.fields);
    assert.equal(result.ok, false);
    assert.equal(result.code, "CONFLICT");
    assert.equal(result.portable, undefined);
  } finally {
    f.close();
  }
});

test("qualified member-mode approved export remains read-only and decodable", async () => {
  const f = fixture();
  try {
    const p = await preparedMembers(f),
      calls = exportService(f, p);
    const before = f.sqlite.prepare("SELECT * FROM creator_stacks").all();
    const writes = f.app.writes.length;
    const changes = f.sqlite.prepare("SELECT total_changes() AS n").get().n;
    const result = await run(f, "export", p.fields);
    assert.equal(result.ok, true, JSON.stringify(result));
    const exported = decodeMaintenanceReply("export", result);
    assert.equal(exported.portable.configuration.values.guestAccess, "members");
    assert.equal(
      exported.portable.source.build,
      appSettings.guestbook.source.commit,
    );
    assert.equal(exported.portable.source.workspace, p.space.id);
    assert.equal(exported.portable.source.resource, p.resource);
    assert.equal(exported.portable.items[0].media.base64, png);
    assert.equal(calls(), 1);
    assert.equal(f.app.writes.length, writes);
    assert.equal(
      f.sqlite.prepare("SELECT total_changes() AS n").get().n,
      changes,
    );
    assert.deepEqual(
      f.sqlite.prepare("SELECT * FROM creator_stacks").all(),
      before,
    );
  } finally {
    f.close();
  }
});

test("member-mode decoder retains strict file and configuration shapes", async () => {
  const f = fixture();
  try {
    const p = await preparedMembers(f);
    for (const change of [
      (value) => {
        value.configuration.values.guestAccess = "public";
      },
      (value) => {
        value.configuration.values.guestAccess = { mode: "members" };
      },
      (value) => {
        value.configuration.values.memberGrant = true;
      },
      (value) => {
        value.configuration.source = "unqualified-source";
      },
      (value) => {
        value.coverage.privateContent = true;
      },
      (value) => {
        value.items[0].media.secret = "fictional-untrusted-field";
      },
    ]) {
      const file = structuredClone(portable(f, p));
      assert.doesNotThrow(() =>
        decodeMaintenanceReply("export", {
          ok: true,
          workspace: p.space,
          portable: file,
        }),
      );
      change(file);
      assert.throws(() =>
        decodeMaintenanceReply("export", {
          ok: true,
          workspace: p.space,
          portable: file,
        }),
      );
    }
  } finally {
    f.close();
  }
});

for (const kind of [
  "foreign-source",
  "foreign-workspace",
  "foreign-account",
  "foreign-resource",
  "foreign-target",
  "configuration-digest",
  "configuration-source",
  "unqualified-build",
  "missing-export-capability",
  "current-version",
  "membership-revoked",
  "viewer",
  "role10",
])
  test(
    "member-mode export retains current scope and authority: " + kind,
    async () => {
      const f = fixture();
      try {
        const p = await preparedMembers(f);
        const calls = exportService(f, p, (value) => {
          if (kind === "foreign-source") value.source.build = "b".repeat(40);
          if (kind === "foreign-workspace")
            value.source.workspace = "fictional-foreign-workspace";
          if (kind === "foreign-account")
            value.source.account = "fictional-other-account";
          if (kind === "foreign-resource")
            value.source.resource = "fictional-other-resource";
          if (kind === "foreign-target")
            value.source.target = "https://other.example.test/guestbook";
          if (kind === "configuration-digest")
            value.configuration.digest = "0".repeat(64);
          if (kind === "configuration-source")
            value.configuration.source = "b".repeat(40);
          if (kind === "current-version")
            f.app.resources.get(p.resource).version++;
          if (kind === "membership-revoked")
            f.sqlite
              .prepare(
                "DELETE FROM creator_members WHERE workspace_id=? AND user_id=?",
              )
              .run(p.space.id, caller.id);
          return value;
        });
        if (kind === "unqualified-build") f.app.badBuild(true);
        if (kind === "missing-export-capability") {
          const service = f.runtime.GUESTBOOK;
          f.runtime.GUESTBOOK = {
            async fetch(request) {
              const response = await service.fetch(request);
              if (!new URL(request.url).pathname.endsWith("/build.json"))
                return response;
              const body = await response.json();
              delete body.portabilityContract;
              return Response.json(body);
            },
          };
        }
        if (kind === "viewer")
          f.sqlite
            .prepare(
              "UPDATE creator_members SET role='viewer' WHERE workspace_id=? AND user_id=?",
            )
            .run(p.space.id, caller.id);
        const writes = f.app.writes.length;
        const result = await run(
          f,
          "export",
          p.fields,
          kind === "role10" ? { ...caller, role: 10 } : caller,
        );
        assert.equal(result.ok, false, kind + ": " + JSON.stringify(result));
        assert.equal(result.portable, undefined);
        assert.equal(f.app.writes.length, writes);
        if (
          [
            "unqualified-build",
            "missing-export-capability",
            "viewer",
            "role10",
          ].includes(kind)
        ) {
          assert.equal(calls(), 0, "Refusal must precede export retrieval");
        }
        if (["membership-revoked", "viewer", "role10"].includes(kind))
          assert.equal(result.code, "FORBIDDEN");
      } finally {
        f.close();
      }
    },
  );
