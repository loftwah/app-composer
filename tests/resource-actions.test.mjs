import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resources } from "../src/lib/resource-library.ts";
import {
  resourceIds,
  resourceActions,
  resourceQaLabel,
} from "../src/lib/resource-action-contract.ts";
import {
  resourceActionPayload,
  recordResourceAction,
  installResourceActions,
} from "../src/browser/resource-actions.ts";

test("resource action IDs match every maintained catalogue module and literal download marker", () => {
  assert.deepEqual(
    resourceIds,
    resources.map((resource) => resource.id),
  );
  for (const resource of resources) {
    for (const action of resourceActions)
      assert.ok(resourceActionPayload(resource.id, action));
  }
  assert.equal(resourceActionPayload("kit", "download"), null);
  const markup = readFileSync("src/components/ResourceDesk.astro", "utf8");
  for (const marker of markup.matchAll(/data-resource-id="([^"]+)"/g))
    assert.ok(resourceIds.includes(marker[1]), marker[1]);
});

test("resource actions retain only a finite job and action, never entered text or URL", async () => {
  const sent = [];
  const send = async (...args) => {
    sent.push(args);
    return new Response(null, { status: 204 });
  };
  recordResourceAction(
    "change",
    "download",
    "https://composer.test/resources/change?private=canary#private",
    send,
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "/api/resource-actions");
  const options = sent[0][1];
  assert.deepEqual(JSON.parse(options.body), {
    contract: 1,
    resource: "change",
    action: "download",
  });
  assert.equal(options.credentials, "omit");
  assert.equal(options.referrerPolicy, "no-referrer");
  assert.equal(options.keepalive, true);
  assert.ok(!JSON.stringify(sent).includes("canary"));
  for (const value of [
    null,
    undefined,
    "__proto__",
    "../private",
    "change?private=canary",
    {},
    "CHANGE",
  ]) {
    assert.equal(resourceActionPayload(value, "download"), null);
    assert.equal(resourceActionPayload("change", value), null);
    recordResourceAction(
      value,
      "download",
      "https://composer.test/resources",
      send,
    );
    recordResourceAction(
      "change",
      value,
      "https://composer.test/resources",
      send,
    );
  }
  assert.equal(sent.length, 1);
});

test("manual and repeated QA opt-outs suppress all resource action transport", () => {
  const sent = [];
  const send = async (...args) => {
    sent.push(args);
    return new Response(null, { status: 204 });
  };
  for (const query of [
    "?analytics=off",
    "?qa=1",
    "?analytics=on&analytics=off",
    "?qa=0&qa=1",
    "?qa=resources-reviewed",
    "?qa=",
    "?qa=0",
    "?qa=private%20text",
    "?qa=" + "x".repeat(65),
  ]) {
    for (const action of ["choice", "copy", "download", "example_open"]) {
      recordResourceAction(
        "incident",
        action,
        "https://composer.test/resources/incident" + query,
        send,
      );
    }
  }
  assert.equal(sent.length, 0);
});

test("only bounded QA labels travel; invalid labels still exclude recording", () => {
  for (const value of [
    "",
    "private text",
    "x".repeat(65),
    "https://private.test/",
  ])
    assert.equal(
      resourceQaLabel(new URLSearchParams({ qa: value })),
      undefined,
    );
  assert.equal(
    resourceQaLabel(new URLSearchParams("qa=resources-reviewed")),
    "resources-reviewed",
  );
  assert.equal(
    resourceQaLabel(new URLSearchParams("qa=bad%20value&qa=reviewed-2")),
    "reviewed-2",
  );
});

test("offline and unsupported keepalive recording do not own the visitor action or retry", async () => {
  let calls = 0;
  recordResourceAction(
    "pipeline",
    "choice",
    "https://composer.test/resources",
    () => {
      calls++;
      throw Error("canary private network failure");
    },
  );
  recordResourceAction(
    "hook",
    "copy",
    "https://composer.test/resources",
    async () => {
      calls++;
      throw Error("canary private network failure");
    },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
});

test("activation listeners ignore synthetic/cancelled events and repeated installation; QA links carry only exclusions", async () => {
  const previousElement = globalThis.Element;
  const previousFetch = globalThis.fetch;
  const sent = [];
  class Anchor {
    dataset = { resourceId: "change", resourceAction: "choice" };
    href = "https://composer.test/resources/change#resource";
    closest() {
      return this;
    }
  }
  const anchor = new Anchor();
  const listeners = new Map();
  const root = {
    URL: "https://composer.test/resources?private=canary",
    querySelectorAll() {
      return [anchor];
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  globalThis.Element = Anchor;
  globalThis.fetch = async (...args) => {
    sent.push(args);
    return new Response(null, { status: 204 });
  };
  try {
    installResourceActions(root);
    const stop = installResourceActions(root);
    assert.equal(listeners.size, 2);
    const click = {
      target: anchor,
      type: "click",
      button: 0,
      isTrusted: true,
      defaultPrevented: false,
    };
    for (const patch of [
      { isTrusted: false },
      { defaultPrevented: true },
      { button: 2 },
    ])
      listeners.get("click")({ ...click, ...patch });
    assert.equal(sent.length, 0);
    listeners.get("click")(click);
    assert.equal(sent.length, 1);
    listeners.get("auxclick")({ ...click, type: "auxclick", button: 1 });
    assert.equal(sent.length, 2);
    anchor.dataset.resourceAction = "copy";
    listeners.get("click")(click);
    assert.equal(sent.length, 2, "copy click is not clipboard resolution");
    root.URL += "&analytics=on&analytics=off&qa=1";
    installResourceActions(root);
    assert.equal(new URL(anchor.href).searchParams.get("analytics"), "off");
    assert.equal(new URL(anchor.href).searchParams.get("qa"), "1");
    assert.ok(!anchor.href.includes("canary"));
    anchor.dataset.resourceAction = "choice";
    listeners.get("click")(click);
    assert.equal(sent.length, 2);
    for (const query of [
      "?qa=resources-reviewed&private=canary",
      "?qa=&private=canary",
      "?qa=" + "x".repeat(65),
    ]) {
      root.URL = "https://composer.test/resources" + query;
      anchor.href = "https://composer.test/resources/change#resource";
      installResourceActions(root);
      const target = new URL(anchor.href);
      assert.equal(target.searchParams.get("analytics"), "off");
      assert.ok(!target.href.includes("canary"));
      assert.equal(
        target.searchParams.has("qa"),
        query.startsWith("?qa=resources-reviewed"),
      );
      if (target.searchParams.has("qa"))
        assert.equal(target.searchParams.get("qa"), "resources-reviewed");
      listeners.get("click")(click);
      assert.equal(sent.length, 2);
    }
    stop();
  } finally {
    globalThis.Element = previousElement;
    globalThis.fetch = previousFetch;
  }
});
