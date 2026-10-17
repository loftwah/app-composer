import test from "node:test";
import assert from "node:assert/strict";
import { decodeStackReply } from "../src/plugins/stacks/protocol.ts";
import { EditorSession } from "../src/plugins/stacks/editor-session.ts";
import { observeResourceRevision, resourcePreview, resourceDraft, resourceEditsDuringReuse } from "../src/plugins/stacks/resource-editor.ts";

const resource = {
  instance: "instance-fixture-0001",
  resource: "resource-fixture-0001",
  app: "guestbook",
  shared: false,
  state: "ready",
  version: 2,
  configuration: {
    revision: 1,
    digest: "a".repeat(64),
    source: "b".repeat(40),
    values: { title: "Fictional visitor book" },
    path: "/guestbook/r/resource-fixture-0001/c/1/",
  },
};
const reference = {
  id: resource.resource,
  configurationRevision: 1,
  digest: resource.configuration.digest,
  source: resource.configuration.source,
  path: resource.configuration.path,
  shared: false,
};
const document = {
  version: 1,
  name: "Fictional stack",
  description: "",
  theme: "midnight",
  instances: [
    {
      id: resource.instance,
      app: "guestbook",
      label: "Visitor book",
      caption: "",
      visible: true,
      binding: { mode: "own", shareOf: null },
      config: {},
      resource: reference,
    },
  ],
};
const stack = {
  id: "stack-fixture-0001",
  slug: "fictional-stack",
  name: document.name,
  status: "published",
  revision: 3,
  publishedRevision: 2,
  updatedAt: "2026-10-18",
  publishedAt: "2026-10-18",
  draft: document,
  published: document,
};

test("published references survive decoding while draft authority is stripped", () => {
  const decoded = decodeStackReply("open", { ok: true, stack });
  assert.deepEqual(decoded.stack.published.instances[0].resource, reference);
  assert.equal(decoded.stack.draft.instances[0].resource, undefined);
  const history = decodeStackReply("publications", {
    ok: true,
    publications: [{ revision: 2, publishedAt: "2026-10-18", document }],
  });
  assert.deepEqual(
    history.publications[0].document.instances[0].resource,
    reference,
  );
});

test("resource replies refuse mismatched paths, invalid source and incomplete outcomes", () => {
  const valid = {
    ok: true,
    stack,
    resources: [resource],
    outcome: "applied",
    completed: [resource.instance],
    problems: [],
    publicationUnchanged: true,
  };
  assert.equal(decodeStackReply("applyResources", valid).outcome, "applied");
  for (const changed of [
    {
      ...resource,
      configuration: {
        ...resource.configuration,
        path: "https://example.test/other",
      },
    },
    {
      ...resource,
      configuration: {
        ...resource.configuration,
        path: "/guestbook/r/another-resource/c/1/",
      },
    },
    {
      ...resource,
      configuration: { ...resource.configuration, source: "unverified" },
    },
    { ...resource, configuration: null },
    { ...resource, version: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.throws(
      () =>
        decodeStackReply("applyResources", { ...valid, resources: [changed] }),
      /incomplete/,
    );
  for (const key of [
    "outcome",
    "completed",
    "problems",
    "publicationUnchanged",
    "resources",
    "stack",
  ]) {
    const incomplete = { ...valid };
    delete incomplete[key];
    assert.throws(
      () => decodeStackReply("applyResources", incomplete),
      /acknowledge/,
    );
  }
  const malformed = structuredClone(stack);
  malformed.published.instances[0].resource.path =
    "/guestbook/r/another-resource/c/1/";
  assert.throws(
    () => decodeStackReply("open", { ok: true, stack: malformed }),
    /incomplete/,
  );
});

test("same-revision reconciliation preserves dirty generations and refuses stale tokens", () => {
  const editor = new EditorSession();
  editor.adopt("stack-fixture-0001", 3);
  const request = editor.capture();
  editor.edit();
  assert.equal(editor.acknowledgeUnchanged(request, 3), true);
  assert.equal(editor.dirty, true);
  assert.equal(editor.revision, 3);
  assert.equal(editor.acknowledgeUnchanged(request, 2), false);
  assert.equal(editor.acknowledgeUnchanged(request, 4), false);
  editor.acknowledge(editor.capture(), 4);
  assert.equal(editor.acknowledgeUnchanged(request, 3), false);
  editor.adopt("other-stack-0001", 3);
  assert.equal(editor.acknowledgeUnchanged(request, 3), false);
});

test("a lost Apply acknowledgement can refresh its committed token while retaining newer local settings", () => {
  const editor = new EditorSession();
  editor.adopt(stack.id, 3);
  const local = structuredClone(stack.draft);
  local.instances[0].config.title = "New local work after Apply";
  editor.edit();
  const generation = editor.generation;
  const saved = decodeStackReply("open", { ok: true, stack: { ...stack, revision: 7 } }).stack;
  assert.equal(observeResourceRevision(editor, editor.capture(), saved, decodeStackReply("open", { ok: true, stack }).stack.draft), true);
  assert.equal(editor.revision, 7);
  assert.equal(editor.generation, generation);
  assert.equal(editor.dirty, true);
  assert.equal(local.instances[0].config.title, "New local work after Apply");
  const check = editor.capture();
  assert.equal(editor.acknowledgeUnchanged(check, 7), true, "the following no-change reconciliation uses the observed token");
  assert.equal(editor.dirty, true);
});

test("a read cannot grant overwrite authority for a changed saved draft after an unconfirmed reuse", () => {
  const editor = new EditorSession();
  editor.adopt(stack.id, 3);
  const local = decodeStackReply("open", { ok: true, stack }).stack.draft;
  const changed = structuredClone(stack);
  changed.revision = 4;
  changed.draft.instances[0].config.title = "App-confirmed shared settings";
  const saved = decodeStackReply("open", { ok: true, stack: changed }).stack;
  assert.equal(observeResourceRevision(editor, editor.capture(), saved, local), false);
  assert.equal(editor.revision, 3);
  assert.equal(editor.dirty, false);
  assert.equal(local.instances[0].config.title, undefined, "reading the saved token does not adopt its fields");
});

test("checking another window's saved description keeps the original expected revision until an explicit choice", () => {
  const editor = new EditorSession();
  editor.adopt(stack.id, 3);
  const local = decodeStackReply("open", { ok: true, stack }).stack.draft;
  const saved = decodeStackReply("open", { ok: true, stack: { ...stack, revision: 4, draft: { ...local, description: "Saved in another window" } } }).stack;
  const before = editor.capture();
  assert.equal(observeResourceRevision(editor, before, saved, local), false);
  assert.deepEqual(editor.capture(), before);
  editor.edit();
  assert.equal(editor.capture().revision, 3, "a subsequent save must still conflict rather than overwrite revision 4");
  assert.equal(local.description, "");
});

test("resource recovery refuses another stack and regressed or out-of-order read tokens", () => {
  const editor = new EditorSession();
  editor.adopt(stack.id, 3);
  const checkpoint = editor.capture();
  const saved = decodeStackReply("open", { ok: true, stack }).stack;
  assert.equal(observeResourceRevision(editor, checkpoint, { ...saved, id: "foreign-stack-0001", revision: 9 }, saved.draft), false);
  assert.equal(observeResourceRevision(editor, checkpoint, { ...saved, revision: 2 }, saved.draft), false);
  editor.acknowledge(checkpoint, 5);
  assert.equal(observeResourceRevision(editor, checkpoint, { ...saved, revision: 4 }, saved.draft), false);
  assert.equal(editor.revision, 5);
});

test("shared preview inherits confirmed app values while independent and retained local drafts remain untouched", () => {
  const local = decodeStackReply("open", { ok: true, stack }).stack.draft;
  local.instances[0].config.title = "Retained unsaved settings after delayed reuse";
  local.instances.push({ ...structuredClone(local.instances[0]), id: "independent-instance-0001", config: { title: "Independent draft title" } });
  const before = structuredClone(local);
  const preview = resourcePreview(local, [{ ...resource, shared: true }]);
  assert.equal(preview.instances[0].config.title, "Fictional visitor book");
  assert.equal(preview.instances[0].resource.path, resource.configuration.path);
  assert.equal(preview.instances[0].resource.shared, true);
  assert.equal(preview.instances[1].config.title, "Independent draft title");
  assert.equal(preview.instances[1].resource, undefined);
  assert.deepEqual(local, before, "a preview cannot rewrite local settings or grant draft resource authority");
});

test("delayed reuse retains newer captions but projects app-confirmed settings into every saved copy", () => {
  const submitted = decodeStackReply("open", { ok: true, stack }).stack.draft;
  submitted.instances[0].config.title = "Original owned title";
  const local = structuredClone(submitted);
  local.instances[0].caption = "Keep this newer caption";
  const bindings = [{ ...resource, shared: true }];
  assert.deepEqual(resourceEditsDuringReuse(local, submitted, bindings), []);
  const projected = resourceDraft(local, bindings);
  assert.equal(projected.instances[0].config.title, "Fictional visitor book");
  assert.equal(projected.instances[0].caption, "Keep this newer caption");
  assert.equal(projected.instances[0].resource, undefined);
  assert.equal(local.instances[0].config.title, "Original owned title", "projection does not mutate the retained input object");
  local.instances[0].config.title = "App setting typed during reuse";
  assert.deepEqual(resourceEditsDuringReuse(local, submitted, bindings), [{ instance: resource.instance, config: local.instances[0].config }]);
  assert.equal(resourceDraft(local, bindings).instances[0].config.title, "Fictional visitor book");
});
