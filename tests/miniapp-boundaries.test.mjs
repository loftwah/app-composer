import test from "node:test";
import assert from "node:assert/strict";
import { manageMiniapps } from "../src/lib/miniapp-admin.mjs";

const origin = "https://composer.loftwah.com",
  revision = "a".repeat(40);
const pins = { guestbook: revision, showcase: revision };
const context = (input) => ({
  user: { id: "fictional-owner", role: 50 },
  input,
  request: new Request(origin + "/_emdash/api/plugins/composer-miniapps/read", {
    method: ["snapshot", "preview"].includes(input.action) ? "GET" : "POST",
    headers: { Origin: origin, "X-EmDash-Request": "1" },
  }),
});
function fixture(response, { identity, app = "guestbook" } = {}) {
  const calls = [],
    service = {
      async fetch(request) {
        calls.push(request);
        return request.url.endsWith("/build.json")
          ? identity
            ? await identity()
            : Response.json({ app, revision, dataVersion: 1 })
          : typeof response === "function"
            ? response()
            : Response.json(response);
      },
    };
  return {
    calls,
    runtime: {
      PUBLIC_ORIGIN: origin,
      GUESTBOOK: service,
      SHOWCASE: service,
      GUESTBOOK_OWNER_TOKEN: "fictional-private-token",
      SHOWCASE_OWNER_TOKEN: "fictional-private-token",
    },
  };
}
const invoke = (input, f) =>
  manageMiniapps(context(input), f.runtime, { ...pins });

test("checked snapshot types preserve current optional owner fields and full legacy queues", async () => {
  const config = {
    title: "Fictional book",
    intro: "",
    theme: "midnight",
    layout: "future-saved-layout",
    guestAccess: "closed",
    submissionsPaused: true,
    ownerExtension: { version: 1 },
  };
  const item = {
    id: "fictional-photo",
    status: "hidden",
    caption: "Fictional retained caption",
    author: null,
    synthetic: 0,
    width: 1200,
    height: 900,
    created_at: "2026-10-18",
    storage_key: "photos/fictional-photo.png",
    extension: { version: 2 },
  };
  const f = fixture({
    dataVersion: 1,
    config,
    items: [
      item,
      ...Array.from({ length: 5000 }, (_, i) => ({
        id: "deleted-" + i,
        status: "deleted",
        caption: "Former caption",
        extension: "x".repeat(1000),
      })),
    ],
  });
  const result = await invoke({ app: "guestbook", action: "snapshot" }, f);
  assert.equal(result.ok, true);
  assert.deepEqual(result.config, config);
  assert.deepEqual(result.items, [item]);
  assert.equal(f.calls.length, 2);
});

test("malformed snapshot JSON never reaches typed native fields or hides behind a valid envelope", async () => {
  for (const patch of [
    null,
    [],
    { dataVersion: 1, config: [], items: [] },
    { dataVersion: 1, config: { title: 7 }, items: [] },
    { dataVersion: 1, config: { submissionsPaused: "true" }, items: [] },
    { dataVersion: 1, config: {}, items: [null] },
    { dataVersion: 1, config: {}, items: [{ id: 1, status: "pending" }] },
    { dataVersion: 1, config: {}, items: [{ id: "photo", status: 7 }] },
    {
      dataVersion: 1,
      config: {},
      items: [
        { id: "photo", status: "pending", caption: { secret: "private" } },
      ],
    },
  ]) {
    const f = fixture(patch),
      result = await invoke({ app: "guestbook", action: "snapshot" }, f);
    assert.equal(result.ok, false);
    assert.equal(f.calls.length, 2);
    assert.doesNotMatch(
      JSON.stringify(result),
      /secret|fictional-private-token/,
    );
  }
});

test("malformed or oversized build identity refuses credentials and private app dispatch", async () => {
  for (const value of [
    null,
    [],
    { app: "guestbook", revision, dataVersion: 2 },
    { app: "guestbook", revision, dataVersion: 1, padding: "x".repeat(17000) },
  ]) {
    const f = fixture({}, { identity: () => Response.json(value) }),
      result = await invoke({ app: "guestbook", action: "snapshot" }, f);
    assert.equal(result.ok, false);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].headers.get("Authorization"), null);
  }
});

test("a pin changed while build verification is awaiting refuses the private write", async () => {
  let release, entered;
  const waiting = new Promise((resolve) => {
      entered = resolve;
    }),
    held = new Promise((resolve) => {
      release = resolve;
    });
  const f = fixture(
    { id: "photo", status: "approved" },
    {
      identity: async () => {
        entered();
        await held;
        return Response.json({ app: "guestbook", revision, dataVersion: 1 });
      },
    },
  );
  const selected = { ...pins },
    pending = manageMiniapps(
      context({
        app: "guestbook",
        action: "moderate",
        id: "photo",
        status: "approved",
      }),
      f.runtime,
      selected,
    );
  await waiting;
  selected.guestbook = "b".repeat(40);
  release();
  assert.equal((await pending).code, "SOURCE");
  assert.equal(f.calls.length, 1);
});

test("actual app mutation receipts accept supported optional data and refuse malformed or oversized acknowledgements without replay", async () => {
  for (const response of [
    { ok: true, config: { title: "Fictional" } },
    { id: "photo", status: "approved" },
  ]) {
    const f = fixture(response);
    assert.equal(
      (
        await invoke(
          {
            app: "guestbook",
            action: "moderate",
            id: "photo",
            status: "approved",
          },
          f,
        )
      ).ok,
      true,
    );
  }
  for (const response of [
    null,
    [],
    {},
    { ok: false },
    { id: 7 },
    { ok: true, padding: "x".repeat(66000) },
  ]) {
    const f = fixture(response),
      result = await invoke(
        {
          app: "guestbook",
          action: "moderate",
          id: "photo",
          status: "approved",
        },
        f,
      );
    assert.equal(result.ok, false);
    assert.equal(f.calls.length, 2);
  }
});

test("private PNG encoding uses Worker globals and returns the exact original bytes", async () => {
  const bytes = Uint8Array.from({ length: 65537 }, (_, index) => index % 256);
  const f = fixture(
    () => new Response(bytes, { headers: { "Content-Type": "image/png" } }),
  );
  const result = await invoke(
    { app: "guestbook", action: "preview", id: "photo" },
    f,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    Uint8Array.from(atob(result.png), (char) => char.charCodeAt(0)),
    bytes,
  );
});

test("a legitimate full app-owned tag collection receipt can exceed64KiB", async () => {
  const source = "a".repeat(40),
    origin = "https://composer.loftwah.com";
  const fields = {
    label: "\ud800".repeat(40),
    description: "\ud800".repeat(240),
    citationLabel: "\ud800".repeat(100),
    citationURL: "https://example.test/" + "a".repeat(1900),
    relatedLabel: "\ud800".repeat(100),
    relatedURL: "https://example.test/" + "b".repeat(1900),
    status: "draft",
  };
  const collection = {
    version: 1,
    revision: 12,
    items: Array.from({ length: 12 }, (_, index) => ({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-" + String(index).padStart(12, "0"),
      ...fields,
    })),
  };
  const receipt = { ok: true, id: collection.items[11].id, collection };
  const length = new TextEncoder().encode(JSON.stringify(receipt)).length;
  assert(length > 65536 && length < 160 * 1024);
  const service = {
    fetch: async (request) =>
      Response.json(
        request.url.endsWith("/build.json")
          ? { app: "showcase", revision: source, dataVersion: 1 }
          : receipt,
      ),
  };
  const result = await manageMiniapps(
    {
      user: { role: 50 },
      input: {
        app: "showcase",
        action: "tag",
        operation: "create",
        expectedRevision: 11,
        item: fields,
      },
      request: new Request(origin + "/native", {
        method: "POST",
        headers: { Origin: origin, "X-EmDash-Request": "1" },
      }),
    },
    {
      PUBLIC_ORIGIN: origin,
      SHOWCASE: service,
      SHOWCASE_OWNER_TOKEN: "fictional-token",
    },
    { showcase: source },
  );
  assert.equal(result.ok, true, JSON.stringify({ length, result }));
});
