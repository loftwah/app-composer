import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { stacksLead } from "../src/lib/stacks-lead.ts";
import { ordersLead } from "../src/lib/orders-lead.ts";
import { enquiriesLead } from "../src/lib/enquiries-lead.ts";

const stack = {
  name: "Trail Notes",
  slug: "trail-notes",
  status: "draft",
  revision: 4,
  publishedRevision: null,
};

test("the stack lead offers only a state the existing editor supports", () => {
  assert.equal(
    stacksLead({ ready: false, lifecycle: "creator", role: "owner" }),
    undefined,
  );
  assert.deepEqual(
    stacksLead({ ready: true, lifecycle: "governed", role: "owner" }),
    { kind: "governed" },
  );
  assert.deepEqual(
    stacksLead({
      ready: true,
      lifecycle: "creator",
      role: "viewer",
      stack,
    }),
    { kind: "read-only", reason: "viewer", stack },
  );
  assert.deepEqual(
    stacksLead({
      ready: true,
      lifecycle: "creator",
      role: "owner",
      canCreate: true,
    }),
    { kind: "create" },
  );
  assert.deepEqual(
    stacksLead({
      ready: true,
      lifecycle: "creator",
      role: "editor",
      canCreate: false,
    }),
    { kind: "read-only", reason: "no-create" },
  );
  assert.deepEqual(
    stacksLead({
      ready: true,
      lifecycle: "creator",
      role: "owner",
      stack: { ...stack, status: "archived", publishedRevision: 3 },
    }),
    {
      kind: "read-only",
      reason: "archived",
      stack: { ...stack, status: "archived", publishedRevision: 3 },
    },
  );
  assert.deepEqual(
    stacksLead({
      ready: true,
      lifecycle: "creator",
      role: "editor",
      stack,
      savedRevision: 9,
      dirty: true,
      canSave: true,
    }),
    { kind: "unsaved", stack, savedRevision: 9, canSave: true },
  );
  // A published stack with unsaved edits still leads with Save draft first.
  assert.deepEqual(
    stacksLead({
      ready: true,
      lifecycle: "creator",
      role: "owner",
      stack: { ...stack, status: "published", publishedRevision: 4 },
      dirty: true,
      canSave: true,
      canPublish: true,
    }),
    {
      kind: "unsaved",
      stack: { ...stack, status: "published", publishedRevision: 4 },
      savedRevision: 4,
      canSave: true,
    },
  );
  assert.deepEqual(
    stacksLead({
      ready: true,
      lifecycle: "creator",
      role: "owner",
      stack: { ...stack, status: "published", publishedRevision: 4 },
      canPublish: true,
    }),
    {
      kind: "published",
      stack: { ...stack, status: "published", publishedRevision: 4 },
    },
  );
  assert.deepEqual(
    stacksLead({
      ready: true,
      lifecycle: "creator",
      role: "owner",
      stack: { ...stack, publishedRevision: 3 },
      canPublish: true,
    }),
    { kind: "draft", stack: { ...stack, publishedRevision: 3 }, canPublish: true },
  );
});

const order = (patch = {}, actions = []) => ({
  order: {
    id: "order-1",
    title: "Reading-club guide",
    amount: 1200,
    currency: "AUD",
    provider: "stripe",
    payment: "pending",
    fulfilmentOwner: "none",
    fulfilment: "not-requested",
    ...patch,
  },
  actions,
});

test("the order lead selects one existing recovery action and never invents one", () => {
  assert.deepEqual(ordersLead(), { kind: "empty" });

  const unknownCheckout = order({}, [
    { id: "a1", kind: "create-checkout", state: "unknown" },
  ]);
  assert.deepEqual(ordersLead(unknownCheckout), {
    kind: "reconcile",
    view: unknownCheckout,
  });

  const unknownFulfilment = order(
    { payment: "paid", fulfilment: "unknown" },
    [{ id: "a2", kind: "prepare-fulfilment", state: "unknown" }],
  );
  assert.equal(ordersLead(unknownFulfilment).kind, "failed");
  assert.equal(ordersLead(unknownFulfilment).action.kind, "prepare-fulfilment");

  const failedCheckout = order({ payment: "failed" }, [
    { id: "a3", kind: "create-checkout", state: "failed" },
  ]);
  assert.equal(ordersLead(failedCheckout).kind, "failed");

  assert.equal(ordersLead(order()).kind, "pending");
  assert.equal(ordersLead(order({ payment: "unpaid" })).kind, "pending");
  assert.equal(
    ordersLead(
      order({
        payment: "paid",
        fulfilmentOwner: "composer-printful",
        fulfilment: "not-requested",
      }),
    ).kind,
    "fulfilment",
  );
  assert.equal(ordersLead(order({ payment: "paid" })).kind, "observation");
  assert.equal(
    ordersLead(
      order({
        payment: "paid",
        fulfilmentOwner: "composer-printful",
        fulfilment: "draft",
      }),
    ).kind,
    "observation",
  );
});

test("the enquiry lead uses the latest pending brief without copying private body text", () => {
  assert.deepEqual(enquiriesLead({ ready: false, readyBooks: [], status: "pending" }), {
    kind: "loading",
  });
  assert.deepEqual(
    enquiriesLead({
      ready: true,
      role: "viewer",
      readyBooks: [{ id: "book-1", label: "Trail Notes" }],
      status: "pending",
    }),
    { kind: "read-only" },
  );
  assert.deepEqual(
    enquiriesLead({
      ready: true,
      role: "owner",
      readyBooks: [],
      status: "pending",
    }),
    { kind: "setup" },
  );

  const book = { id: "book-1", label: "Trail Notes" };
  const inbox = {
    resourceId: "book-1",
    status: "pending",
    page: 1,
    items: [
      {
        id: "brief-2",
        title: "Second brief",
        status: "pending",
        createdAt: "2026-11-07 10:00:00",
        body: "secret body text",
      },
      {
        id: "brief-1",
        title: "First brief",
        status: "pending",
        createdAt: "2026-11-06 10:00:00",
      },
    ],
  };
  const brief = enquiriesLead({
    ready: true,
    role: "editor",
    readyBooks: [book],
    selectedBook: book,
    status: "pending",
    inbox,
    inboxReady: true,
    pendingCount: 2,
    summaryReady: true,
  });
  assert.equal(brief.kind, "brief");
  assert.equal(brief.item.id, "brief-2");
  assert.equal(brief.item.title, "Second brief");
  assert.equal(JSON.stringify(brief).includes("secret body text"), false);
  assert.equal("body" in brief.item, false);

  assert.deepEqual(
    enquiriesLead({
      ready: true,
      role: "owner",
      readyBooks: [book],
      selectedBook: book,
      status: "reviewed",
      // The reviewed inbox must not be mistaken for a pending one.
      inbox: { ...inbox, status: "reviewed" },
      pendingCount: 3,
      summaryReady: true,
    }),
    { kind: "pending-elsewhere", book, count: 3 },
  );
  assert.deepEqual(
    enquiriesLead({
      ready: true,
      role: "owner",
      readyBooks: [book],
      selectedBook: book,
      status: "pending",
      inbox: { ...inbox, items: [] },
      inboxReady: true,
      pendingCount: 0,
      summaryReady: true,
    }),
    { kind: "no-pending", book, summaryKnown: false },
  );
  // A summary can arrive before the pending inbox: do not claim the briefs are
  // outside the current view while that view is still loading.
  assert.deepEqual(
    enquiriesLead({
      ready: true,
      role: "owner",
      readyBooks: [book],
      selectedBook: book,
      status: "pending",
      inboxReady: false,
      pendingCount: 2,
      summaryReady: true,
    }),
    { kind: "book", book },
  );
  assert.deepEqual(
    enquiriesLead({
      ready: true,
      role: "owner",
      readyBooks: [book],
      selectedBook: book,
      status: "reviewed",
      pendingCount: 0,
      summaryReady: true,
    }),
    { kind: "no-pending", book, summaryKnown: true },
  );
  assert.deepEqual(
    enquiriesLead({
      ready: true,
      role: "owner",
      readyBooks: [book],
      selectedBook: book,
      status: "pending",
      inbox: { ...inbox, resourceId: "another-book" },
      summaryReady: false,
    }),
    { kind: "book", book },
  );
});

test("each page renders its lead before the long secondary content", () => {
  const page = (path) =>
    readFileSync(new URL("../src/plugins/" + path, import.meta.url), "utf8");
  const stacks = page("stacks-admin.tsx");
  assert.ok(
    stacks.indexOf("ca-task-lead") < stacks.indexOf('className="ca-stack-create"'),
    "Creator stacks lead must precede the separate create form",
  );
  assert.ok(
    stacks.indexOf("ca-task-lead") < stacks.indexOf("ca-stack-preview"),
    "Creator stacks lead must precede the preview",
  );
  const orders = page("orders-page.tsx");
  assert.ok(
    orders.indexOf("or-next") < orders.indexOf("<ShopifyCataloguePanel"),
    "Orders lead must precede the catalogue",
  );
  assert.ok(
    orders.indexOf("or-next") < orders.indexOf('className="or-proof"'),
    "Orders lead must precede the fictional-lab explanation",
  );
  const enquiries = page("enquiries.tsx");
  assert.ok(
    enquiries.indexOf("ce-lead") < enquiries.indexOf('className="ce-controls"'),
    "Enquiries lead must precede the filters",
  );
});
