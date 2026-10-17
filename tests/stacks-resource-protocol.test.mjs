import test from "node:test";
import assert from "node:assert/strict";
import { decodeStackReply } from "../src/plugins/stacks/protocol.ts";
import { EditorSession } from "../src/plugins/stacks/editor-session.ts";

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
