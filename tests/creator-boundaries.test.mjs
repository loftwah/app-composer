import test from "node:test";
import assert from "node:assert/strict";
import {
  appSettings,
  validateConfigurationPatch,
} from "../src/lib/app-settings.mjs";
import {
  normaliseStack,
  capabilityFor,
  declaredConfig,
  appCapabilities,
  workspaceForUser,
  createStack,
  saveStack,
  readStack,
  publishStack,
  publicStack,
  listPublications,
  restoreRevisionToDraft,
  republishRevision,
} from "../src/lib/stacks.mjs";
import {
  activationEntries,
  activateStack,
} from "../src/lib/stack-activation.mjs";
import {
  applyConfiguration,
  verifyConfigurationTarget,
} from "../scripts/app-configuration.mjs";
import { sqliteD1 } from "./helpers/stacks-sqlite.mjs";

const document = (app) => ({
  version: 1,
  name: "Fictional checked stack",
  theme: "midnight",
  instances: [{ id: "fictional-instance-0001", app, label: "Fictional app" }],
});
const configuration = Object.fromEntries(
  appSettings.guestbook.fields.map((field) => [field.key, field.default]),
);
const target = () => ({
  id: "guestbook",
  url: "https://guestbook.loftwah.com",
  source: { ...appSettings.guestbook.source },
  configuration: { ...configuration },
});
const unavailable = (error) =>
  error.code === "UNAVAILABLE" && error.status === 503;

test("prototype-key app and role selectors are refused before storage, credentials or requests", async () => {
  for (const id of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
    assert.equal(capabilityFor(id, "publish"), false);
    assert.equal(declaredConfig(id), null);
    assert.deepEqual(appCapabilities(id), []);
    assert.throws(
      () => normaliseStack(document(id)),
      (error) => error.code === "INVALID",
    );
    assert.throws(
      () => activationEntries(document(id)),
      (error) => error.code === "INVALID",
    );
    assert.throws(
      () => validateConfigurationPatch(configuration, id),
      /required app settings/,
    );
    let io = 0;
    await assert.rejects(
      applyConfiguration([{ ...target(), id }], {
        credential: () => ++io,
        beforeWrite: () => ++io,
        request: () => ++io,
      }),
      /Unsupported operator/,
    );
    assert.equal(io, 0);
  }
  assert.equal(Object.hasOwn(Object.prototype, "configuration"), false);
});

test("malformed persisted JSON never becomes typed owner data or a public draft fallback", async () => {
  const db = sqliteD1();
  try {
    const workspace = await workspaceForUser(db, {
      id: "fictional-creator-0001",
    });
    let stack = await createStack(
      db,
      workspace.id,
      "Fictional corruption check",
    );
    stack = await saveStack(
      db,
      workspace.id,
      stack.id,
      document("hello"),
      stack.revision,
    );
    stack = await publishStack(db, workspace.id, stack.id, stack.revision);
    const original = await db
      .prepare(
        "SELECT draft_json, published_json FROM creator_stacks WHERE id=?",
      )
      .bind(stack.id)
      .first();
    const revision = stack.publishedRevision;
    for (const json of [
      "{",
      "null",
      "[]",
      "42",
      JSON.stringify(document("__proto__")),
      JSON.stringify({
        ...document("hello"),
        instances: [
          {
            ...document("hello").instances[0],
            config: { token: "not a declared field" },
          },
        ],
      }),
    ]) {
      await db
        .prepare("UPDATE creator_stacks SET draft_json=? WHERE id=?")
        .bind(json, stack.id)
        .run();
      await assert.rejects(readStack(db, workspace.id, stack.id), unavailable);
      // Private corruption cannot alter the valid immutable publication.
      assert.equal(
        (await publicStack(db, stack.slug)).name,
        document("hello").name,
      );
      await db
        .prepare("UPDATE creator_stacks SET draft_json=? WHERE id=?")
        .bind(original.draft_json, stack.id)
        .run();
      await db
        .prepare(
          "UPDATE creator_stack_publications SET document_json=? WHERE stack_id=? AND revision=?",
        )
        .bind(json, stack.id, revision)
        .run();
      assert.equal(await publicStack(db, stack.slug), null);
      await assert.rejects(
        listPublications(db, workspace.id, stack.id),
        unavailable,
      );
      await assert.rejects(
        restoreRevisionToDraft(
          db,
          workspace.id,
          stack.id,
          revision,
          stack.revision,
        ),
        unavailable,
      );
      await assert.rejects(
        republishRevision(db, workspace.id, stack.id, revision, stack.revision),
        unavailable,
      );
      assert.equal(
        (await readStack(db, workspace.id, stack.id)).revision,
        stack.revision,
        "unsafe history does not mutate the stack",
      );
      await db
        .prepare(
          "UPDATE creator_stack_publications SET document_json=? WHERE stack_id=? AND revision=?",
        )
        .bind(original.published_json, stack.id, revision)
        .run();
    }
  } finally {
    db.cleanup();
  }
});

test("published scoped resource data survives reads and rejects unsafe references", async () => {
  const db = sqliteD1();
  try {
    const workspace = await workspaceForUser(db, {
      id: "fictional-creator-0001",
    });
    let stack = await createStack(db, workspace.id, "Fictional resource check");
    stack = await saveStack(
      db,
      workspace.id,
      stack.id,
      document("guestbook"),
      stack.revision,
    );
    const resource = {
      id: "fictional-resource-0001",
      configurationRevision: 3,
      digest: "a".repeat(64),
      source: appSettings.guestbook.source.commit,
      path: "/guestbook/r/fictional-resource-0001/c/3/",
      shared: false,
    };
    const publication = {
      ...stack.draft,
      instances: stack.draft.instances.map((instance) => ({
        ...instance,
        resource,
      })),
    };
    stack = await publishStack(
      db,
      workspace.id,
      stack.id,
      stack.revision,
      publication,
    );
    assert.deepEqual(
      (await publicStack(db, stack.slug)).document.instances[0].resource,
      resource,
    );
    assert.deepEqual(
      (await listPublications(db, workspace.id, stack.id))[0].document
        .instances[0].resource,
      resource,
    );
    assert.deepEqual(
      (await readStack(db, workspace.id, stack.id)).published.instances[0]
        .resource,
      resource,
    );
    for (const change of [
      { path: "https://private.invalid/" },
      { configurationRevision: "3" },
      { digest: "invalid" },
      { source: "unknown" },
      { shared: "false" },
      { id: "__proto__" },
    ]) {
      const unsafe = {
        ...publication,
        instances: publication.instances.map((instance) => ({
          ...instance,
          resource: { ...resource, ...change },
        })),
      };
      await assert.rejects(
        publishStack(db, workspace.id, stack.id, stack.revision, unsafe),
        (error) => error.code === "INVALID",
      );
      assert.equal(
        (await readStack(db, workspace.id, stack.id)).revision,
        stack.revision,
      );
    }
  } finally {
    db.cleanup();
  }
});

test("remote JSON must confirm exact source and settings; malformed or lost ACK never retries", async () => {
  for (const json of [null, [], "not a build", 1, { revision: "wrong" }]) {
    let calls = 0;
    await assert.rejects(
      verifyConfigurationTarget(target(), async () => {
        calls++;
        return { ok: true, json: async () => json };
      }),
      /source changed/,
    );
    assert.equal(calls, 1);
  }
  for (const json of [
    null,
    [],
    1,
    { ok: true },
    { ok: true, config: {} },
    { ok: true, config: [] },
    { ok: true, config: { ...configuration, title: "wrong" } },
    new Error("ACK lost"),
  ]) {
    let writes = 0;
    const result = await activateStack(
      {
        ...document("guestbook"),
        instances: [
          ...document("guestbook").instances,
          {
            id: "fictional-showcase-0001",
            app: "showcase",
            label: "Later app",
          },
        ],
      },
      {
        credential: () => "fictional-token",
        beforeWrite: () => {},
        request: async () => {
          writes++;
          return {
            ok: true,
            json: async () => {
              if (json instanceof Error) throw json;
              return json;
            },
          };
        },
      },
    );
    assert.equal(writes, 1);
    assert.equal(result.configured.length, 0);
    assert.equal(result.failed[0].app, "guestbook");
    assert.equal(result.untouched[0].app, "showcase");
    assert.equal(result.publicationUnchanged, true);
  }
});

test("independent operator transport preserves exact validated strings and response confirmation", async () => {
  for (const id of Object.keys(appSettings)) {
    const entry = {
      id,
      url: "https://" + id + ".loftwah.com",
      source: { ...appSettings[id].source },
      configuration: Object.fromEntries(
        appSettings[id].fields.map((field) => [field.key, field.default]),
      ),
    };
    entry.configuration.title = "  Fictional operator title  ";
    entry.configuration.intro = " Original declared text ";
    if (Object.hasOwn(entry.configuration, "website"))
      entry.configuration.website = "https://example.test";
    let requests = 0;
    const result = await applyConfiguration([entry], {
      credential: () => "fictional-token",
      beforeWrite: () => {},
      request: async (url, init) => {
        requests++;
        assert.equal(url, entry.url + "/api/config");
        assert.deepEqual(JSON.parse(init.body), entry.configuration);
        return {
          ok: true,
          json: async () => ({ ok: true, config: entry.configuration }),
        };
      },
    });
    assert.equal(requests, 1);
    assert.deepEqual(result, { configured: [id], deployed: false });
  }
});
