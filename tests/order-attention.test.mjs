import test from "node:test";
import assert from "node:assert/strict";
import {
  orderAttention,
  orderAttentionHref,
  orderNeedsAttention,
} from "../src/lib/order-attention.ts";
import { overviewSnapshot } from "../src/lib/overview-contract.ts";

const view = ({ payment = "unpaid", fulfilment = "not-requested", actions = [] } = {}) => ({
  order: { payment, fulfilment, fulfilmentOwner: "composer-printful" },
  actions,
});

const workspace = "ws-abcdef";
const orderId = "123e4567-e89b-42d3-a456-426614174000";

test("routine waiting orders are not exceptions", () => {
  assert.equal(orderAttention(view()), null);
  assert.equal(orderNeedsAttention(view()), false);
  assert.equal(orderNeedsAttention(view({ payment: "pending" })), false);
  assert.equal(orderNeedsAttention(view({ payment: "paid" })), false);
  assert.equal(
    orderNeedsAttention(view({ payment: "paid", fulfilment: "submitted" })),
    false,
  );
  assert.equal(orderNeedsAttention(view({ payment: "refunded" })), false);
});

test("an uncertain checkout is reconciled before any repeat", () => {
  const one = orderAttention(view({ actions: [{ kind: "create-checkout", state: "unknown" }] }));
  assert.equal(one.reason, "action-unknown");
  assert.equal(one.action, "Reconcile order");
  assert.match(one.summary, /could charge twice/);
});

test("a failed operation, failed payment and expired checkout keep honest copy", () => {
  const operation = orderAttention(
    view({ actions: [{ kind: "prepare-fulfilment", state: "failed" }] }),
  );
  assert.equal(operation.reason, "action-failed");
  assert.match(operation.summary, /no supported replay/);

  const payment = orderAttention(view({ payment: "failed" }));
  assert.equal(payment.reason, "payment-failed");
  assert.match(payment.summary, /not a completed order/);

  const expired = orderAttention(view({ payment: "expired" }));
  assert.equal(expired.reason, "payment-expired");
  assert.equal(expired.action, "Open order");

  const cancelled = orderAttention(view({ payment: "cancelled" }));
  assert.equal(cancelled.reason, "payment-cancelled");
});

test("unknown fulfilment outranks a failed payment and is never retried blindly", () => {
  const one = orderAttention(view({ payment: "failed", fulfilment: "unknown" }));
  assert.equal(one.reason, "fulfilment-unknown");
  assert.match(one.summary, /Do not repeat fulfilment/);
  const failed = orderAttention(view({ payment: "paid", fulfilment: "failed" }));
  assert.equal(failed.reason, "fulfilment-failed");
  assert.equal(failed.action, "Open order");
});

test("the deep link stays inside the shared attention contract", () => {
  const href = orderAttentionHref(workspace, orderId);
  assert.equal(
    href,
    `/_emdash/admin/plugins/composer-stacks/orders?workspace=${workspace}&order=${orderId}#order-${orderId}`,
  );
  const snapshot = overviewSnapshot.parse({
    ok: true,
    version: "composer.overview/1",
    workspace: { id: workspace, name: "Fixture workspace", role: "owner" },
    target: { account: "fixture-account", environment: "production" },
    selection: { app: null },
    available: {
      workspaces: [{ id: workspace, name: "Fixture workspace", role: "owner" }],
      environments: ["production"],
      apps: [],
    },
    checkedAt: "2026-11-08T00:00:00.000Z",
    sources: [
      "platform",
      "workflows",
      "resources",
      "orders",
      "notifications",
      "delivery",
      "plugin-trust",
    ].map((id) => ({
      id,
      label: id,
      status: "checked",
      count: 0,
      atLimit: false,
      note: "Checked.",
    })),
    items: [
      {
        id: "orders:order-" + orderId,
        source: "orders",
        app: "fictional-reading-club",
        title: "A payment failed",
        summary: "Inspect the saved order.",
        action: "Open order",
        href,
        count: 1,
        firstObserved: "2026-11-08T00:00:00.000Z",
        lastObserved: "2026-11-08T00:00:00.000Z",
      },
    ],
  });
  assert.equal(snapshot.items[0].href, href);
  assert.equal(snapshot.sources.length, 7);
});

test("the contract refuses a malformed order deep link or a short source list", () => {
  const base = {
    ok: true,
    version: "composer.overview/1",
    workspace: { id: workspace, name: "Fixture workspace", role: "owner" },
    target: { account: "fixture-account", environment: "production" },
    selection: { app: null },
    available: {
      workspaces: [{ id: workspace, name: "Fixture workspace", role: "owner" }],
      environments: ["production"],
      apps: [],
    },
    checkedAt: "2026-11-08T00:00:00.000Z",
    sources: [],
    items: [],
  };
  assert.throws(() => overviewSnapshot.parse(base));
  assert.throws(() =>
    overviewSnapshot.parse({
      ...base,
      sources: ["platform", "workflows", "resources", "orders", "notifications", "delivery"].map(
        (id) => ({
          id,
          label: id,
          status: "checked",
          count: 0,
          atLimit: false,
          note: "Checked.",
        }),
      ),
    }),
  );
  assert.throws(() =>
    overviewSnapshot.parse({
      ...base,
      sources: [
        "platform",
        "workflows",
        "resources",
        "orders",
        "notifications",
        "delivery",
        "plugin-trust",
      ].map((id) => ({
        id,
        label: id,
        status: "checked",
        count: 0,
        atLimit: false,
        note: "Checked.",
      })),
      items: [
        {
          id: "orders:order-" + orderId,
          source: "orders",
          app: null,
          title: "A payment failed",
          summary: "Inspect the saved order.",
          action: "Open order",
          href: "/_emdash/admin/plugins/composer-stacks/orders?workspace=" + workspace,
          count: 1,
          firstObserved: "2026-11-08T00:00:00.000Z",
          lastObserved: "2026-11-08T00:00:00.000Z",
        },
      ],
    }),
  );
});

import { readOrderAttention } from "../src/lib/order-attention.ts";
import { migration, sqliteD1 } from "./helpers/stacks-sqlite.mjs";

const scopeWorkspace = "ws-abcdef";
const scopeAccount = "fixture-account";
const scopeEnvironment = "production";
const uuid = (n) => `123e4567-e89b-42d3-a456-42661417400${n}`;

function orderJson(id, overrides = {}) {
  return JSON.stringify({
    version: "composer.order/1",
    id,
    workspace: scopeWorkspace,
    app: "fictional-reading-club",
    checkoutOwner: "custom",
    provider: "stripe",
    providerAccount: "fixture-stripe",
    environment: "fixture",
    proof: "fixture",
    title: "Fictional reading-club guide",
    amount: 1200,
    currency: "AUD",
    payment: "unpaid",
    refundedAmount: 0,
    attempt: { id: uuid(9), providerReference: null, observationRevision: 0 },
    fulfilmentOwner: "none",
    fulfilment: "not-requested",
    ...overrides,
  });
}

function database() {
  return sqliteD1({
    schema: migration("0003_stacks.sql") + "\n" + migration("0014_orders.sql"),
  });
}

test("the shared reader returns only real order exceptions in the exact scope", async () => {
  const db = database();
  try {
    const insert = (id, payment, extra = {}) =>
      db
        .prepare(
          "INSERT INTO creator_orders(id,workspace_id,creation_key,installation_account,installation_environment,provider,provider_account,payment_environment,proof,payment_state,order_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          scopeWorkspace,
          "key-" + id,
          scopeAccount,
          scopeEnvironment,
          "stripe",
          extra.providerAccount ?? "fixture-stripe",
          "fixture",
          "fixture",
          extra.paymentState ?? payment,
          orderJson(id, { payment, ...(extra.order ?? {}) }),
          extra.createdAt ?? "2026-11-08 00:00:00",
          extra.updatedAt ?? "2026-11-08 01:00:00",
        );
    await db.batch([
      db.prepare("INSERT INTO creator_workspaces(id,name) VALUES(?,?)").bind(scopeWorkspace, "Fixture"),
      insert(uuid(1), "failed"),
      insert(uuid(2), "pending"),
      insert(uuid(3), "unpaid"),
      insert(uuid(4), "failed", {
        providerAccount: "fixture-stripe",
        createdAt: "2026-11-07 00:00:00",
        updatedAt: "2026-11-07 01:00:00",
      }),
      db
        .prepare(
          "INSERT INTO creator_order_actions(id,workspace_id,order_id,kind,state,updated_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(uuid(8), scopeWorkspace, uuid(3), "create-checkout", "unknown", "2026-11-08T02:00:00.000Z"),
      db
        .prepare(
          "INSERT INTO creator_order_actions(id,workspace_id,order_id,kind,state) VALUES(?,?,?,?,?)",
        )
        .bind(uuid(9), scopeWorkspace, uuid(2), "create-checkout", "prepared"),
    ]);
    // A failed order in another account must not leak into this scope.
    await db
      .prepare(
        "INSERT INTO creator_orders(id,workspace_id,creation_key,installation_account,installation_environment,provider,provider_account,payment_environment,proof,payment_state,order_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        uuid(5),
        scopeWorkspace,
        "key-other",
        "another-account",
        scopeEnvironment,
        "stripe",
        "fixture-stripe",
        "fixture",
        "fixture",
        "failed",
        orderJson(uuid(5), { payment: "failed" }),
      )
      .run();

    const items = await readOrderAttention(db, {
      workspace: scopeWorkspace,
      account: scopeAccount,
      environment: scopeEnvironment,
    });
    assert.deepEqual(
      items.map((item) => item.orderId).sort(),
      [uuid(1), uuid(3), uuid(4)].sort(),
    );
    const failed = items.find((item) => item.orderId === uuid(1));
    assert.equal(failed.reason, "payment-failed");
    assert.equal(failed.firstObserved, "2026-11-08T00:00:00.000Z");
    assert.equal(failed.app, "fictional-reading-club");
    const unknown = items.find((item) => item.orderId === uuid(3));
    assert.equal(unknown.reason, "action-unknown");
    assert.equal(unknown.lastObserved, "2026-11-08T02:00:00.000Z");
    assert.match(unknown.summary, /could charge twice/);
  } finally {
    db.cleanup();
  }
});

test("an inconsistent retained order identity is unreadable, never zero", async () => {
  const db = database();
  try {
    await db.batch([
      db.prepare("INSERT INTO creator_workspaces(id,name) VALUES(?,?)").bind(scopeWorkspace, "Fixture"),
      db
        .prepare(
          "INSERT INTO creator_orders(id,workspace_id,creation_key,installation_account,installation_environment,provider,provider_account,payment_environment,proof,payment_state,order_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          uuid(6),
          scopeWorkspace,
          "key-6",
          scopeAccount,
          scopeEnvironment,
          "stripe",
          "fixture-stripe",
          "fixture",
          "fixture",
          "failed",
          orderJson(uuid(6), { payment: "paid" }),
        ),
    ]);
    await assert.rejects(
      () => readOrderAttention(db, { workspace: scopeWorkspace, account: scopeAccount, environment: scopeEnvironment }),
      /identity or scope is inconsistent/,
    );
  } finally {
    db.cleanup();
  }
});
