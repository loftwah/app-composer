import test from "node:test";
import assert from "node:assert/strict";
import { EditorSession } from "../src/plugins/stacks/editor-session.ts";
import { decodeStackReply } from "../src/plugins/stacks/protocol.ts";
import { sqliteD1, migration } from "./helpers/stacks-sqlite.mjs";
import { manageStacks } from "../src/lib/stacks-admin.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";

test("a delayed save acknowledges only the submitted edit generation", () => {
  const editor = new EditorSession();
  editor.adopt("stack-one", 2);
  editor.edit();
  const submitted = editor.capture();
  editor.edit();
  assert.equal(editor.acknowledge(submitted, 3, true), true);
  assert.equal(editor.revision, 3);
  assert.equal(editor.dirty, true, "newer edits stay unsaved");
  editor.acknowledge(editor.capture(), 4, true);
  assert.equal(editor.dirty, false, "exact latest save is clean");
});

test("publication/status acknowledgements update revision without replacing or saving local work", () => {
  const editor = new EditorSession();
  editor.adopt("stack-one", 2);
  for (const action of [
    "publish",
    "unpublish",
    "archive",
    "restore",
    "republish",
  ]) {
    const pending = editor.capture();
    editor.edit();
    editor.acknowledge(pending, editor.revision + 1);
    assert.equal(editor.dirty, true, action);
    assert.equal(
      editor.unchanged(pending),
      false,
      "must not adopt server draft",
    );
  }
});

test("a delayed reload/open/import/create/restore cannot replace edits made during the request", () => {
  const editor = new EditorSession();
  for (const action of [
    "reload",
    "open",
    "import",
    "create",
    "restoreRevision",
  ]) {
    editor.adopt("stack-one", 2);
    const pending = editor.capture();
    assert.equal(editor.unchanged(pending), true);
    editor.edit();
    assert.equal(editor.unchanged(pending), false, action);
  }
});

test("old selection and out-of-order responses cannot move the acknowledged revision backwards", () => {
  const editor = new EditorSession();
  editor.adopt("stack-one", 2);
  const old = editor.capture();
  editor.adopt("stack-two", 6);
  editor.edit();
  assert.equal(editor.acknowledge(old, 100, true), false);
  assert.equal(editor.revision, 6);
  assert.equal(editor.acknowledge(editor.capture(), 5, true), false);
  assert.equal(editor.dirty, true);
});

test("conflict, authentication failure and missing acknowledgements retain the last saved revision and dirty draft", () => {
  const editor = new EditorSession();
  editor.adopt("stack-one", 2);
  editor.edit();
  const pending = editor.capture();
  // No server acknowledgement is accepted on any failure path.
  assert.equal(editor.revision, 2);
  assert.equal(editor.dirty, true);
  assert.equal(editor.unchanged(pending), true);
  editor.adopt(undefined);
  assert.equal(editor.acknowledge(pending, 3, true), false);
});

test("an intervening acknowledgement invalidates an older replacement read", () => {
  const editor = new EditorSession();
  editor.adopt("stack-one", 2);
  const reload = editor.capture();
  editor.acknowledge(editor.capture(), 3, true);
  assert.equal(
    editor.unchanged(reload),
    false,
    "old reload cannot replace newer saved text",
  );
});

test("malformed and non-advancing acknowledgements never mark an edit clean", () => {
  for (const revision of [
    undefined,
    null,
    NaN,
    Infinity,
    0,
    -1,
    1.5,
    "3",
    2,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    const editor = new EditorSession();
    editor.adopt("stack-one", 2);
    editor.edit();
    assert.equal(
      editor.acknowledge(editor.capture(), revision, true),
      false,
      String(revision),
    );
    assert.equal(editor.revision, 2);
    assert.equal(editor.dirty, true);
  }
});

test("incomplete replacing responses and malformed saved documents are refused at the transport boundary", () => {
  const workspace = {
    id: "workspace-fixture-0001",
    name: "Fictional",
    role: "owner",
  };
  assert.throws(
    () => decodeStackReply("list", { ok: true }),
    /did not acknowledge/,
  );
  assert.throws(
    () => decodeStackReply("list", { ok: true, workspace, stacks: [null] }),
    /incomplete/,
  );
  assert.throws(
    () => decodeStackReply("save", { ok: true, stack: { revision: NaN } }),
    /incomplete/,
  );
  assert.throws(
    () => decodeStackReply("publish", { ok: true }),
    /did not acknowledge/,
  );
  assert.throws(
    () =>
      decodeStackReply("save", {
        ok: false,
        code: "CONFLICT",
        message: "Other window changed it",
      }),
    (error) => error.code === "CONFLICT",
  );
  assert.deepEqual(
    decodeStackReply("list", { ok: true, workspace, stacks: [] }).stacks,
    [],
  );
});

test("valid pre-binding snapshots reopen, export and show history without changing persisted publication bytes", async () => {
  const db = sqliteD1({
    schema:
      migration("0003_stacks.sql") + migration("0004_stack_publications.sql"),
  });
  try {
    const user = {
      id: "legacy-user-0001",
      name: "Fictional legacy creator",
      role: 50,
    };
    const space = await workspaceForUser(db, user);
    const legacy = JSON.stringify({
      version: 1,
      name: "Legacy stack",
      description: "",
      theme: "midnight",
      instances: [
        {
          id: "legacy-instance-0001",
          app: "guestbook",
          label: "Guestbook",
          caption: "",
          visible: true,
        },
      ],
    });
    await db
      .prepare(
        "INSERT INTO creator_stacks(id,workspace_id,slug,name,status,revision,published_revision,draft_json,published_json) VALUES(?,?,?,?,'published',2,1,?,?)",
      )
      .bind(
        "legacy-stack-0001",
        space.id,
        "legacy-stack",
        "Legacy stack",
        legacy,
        legacy,
      )
      .run();
    db.migrate(migration("0005_stack_publications_backfill.sql"));
    for (const action of ["list", "open", "export", "publications"]) {
      const result = await manageStacks(
        {
          user,
          request: new Request(
            "https://composer.loftwah.com/_emdash/api/plugins/composer-stacks/read",
          ),
          input: { action, workspace: space.id, stack: "legacy-stack-0001" },
        },
        { DB: db, PUBLIC_ORIGIN: "https://composer.loftwah.com" },
      );
      const decoded = decodeStackReply(action, result);
      const document =
        action === "list"
          ? decoded.stacks[0].draft
          : action === "open"
            ? decoded.stack.draft
            : action === "export"
              ? decoded.export.document
              : decoded.publications[0].document;
      assert.deepEqual(
        document.instances[0].binding,
        { mode: "own", shareOf: null },
        action,
      );
      assert.deepEqual(document.instances[0].config, {}, action);
    }
    const row = await db
      .prepare(
        "SELECT draft_json,published_json FROM creator_stacks WHERE id=?",
      )
      .bind("legacy-stack-0001")
      .first();
    assert.equal(row.draft_json, legacy);
    assert.equal(row.published_json, legacy);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT document_json FROM creator_stack_publications WHERE stack_id=?",
          )
          .bind("legacy-stack-0001")
          .first()
      ).document_json,
      legacy,
    );
  } finally {
    db.cleanup();
  }
});
