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
