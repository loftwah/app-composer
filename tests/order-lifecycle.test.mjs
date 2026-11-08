import test from "node:test";
import assert from "node:assert/strict";
import { manageOrders } from "../src/lib/orders.ts";
import { reduceOrder } from "../src/lib/order-contract.ts";
import { migration, sqliteD1 } from "./helpers/stacks-sqlite.mjs";

const origin = "https://composer.loftwah.com";
const workspaceId = "ws-orders-lifecycle";
const userId = "fictional-orders-owner";
const uuid = () => crypto.randomUUID();

function database() {
  return sqliteD1({
    schema:
      migration("0003_stacks.sql") +
      "\n" +
      migration("0004_stack_publications.sql") +
      "\n" +
      migration("0014_orders.sql"),
  });
}

async function prepared() {
  const db = database();
  await db.batch([
    db
      .prepare("INSERT INTO creator_workspaces(id,name) VALUES(?,?)")
      .bind(workspaceId, "Fixture orders"),
    db
      .prepare("INSERT INTO creator_members(workspace_id,user_id,role) VALUES(?,?,'owner')")
      .bind(workspaceId, userId),
  ]);
  const runtime = {
    PUBLIC_ORIGIN: origin,
    DB: db,
    RESOURCE_ACCOUNT_ID: "fixture-account",
    RESOURCE_ENVIRONMENT: "production",
  };
  const call = (input) =>
    manageOrders(
      {
        user: { id: userId, role: 50 },
        input,
        request: new Request(
          origin + "/_emdash/api/plugins/composer-stacks/ordersWrite",
          {
            method: "POST",
            headers: { Origin: origin, "X-EmDash-Request": "1" },
          },
        ),
      },
      runtime,
    );
  const create = async () => {
    const snapshot = await call({
      action: "create-fixture",
      workspace: workspaceId,
      operation: uuid(),
      provider: "stripe",
      fulfilmentOwner: "composer-printful",
    });
    assert.equal(snapshot.ok, true, snapshot.message);
    return snapshot.orders[0];
  };
  return { db, call, create };
}

test("a checkout cannot become uncertain after payment is established", async () => {
  const f = await prepared();
  try {
    let view = await f.create();
    const paid = await f.call({
      action: "observe-fixture",
      workspace: workspaceId,
      order: view.order.id,
      operation: uuid(),
      expectedRevision: view.revision,
      scenario: "payment-paid",
    });
    assert.equal(paid.ok, true, paid.message);
    view = paid.orders[0];
    assert.equal(view.order.payment, "paid");
    const timeout = await f.call({
      action: "timeout-fixture",
      workspace: workspaceId,
      order: view.order.id,
      operation: uuid(),
      expectedRevision: view.revision,
    });
    assert.equal(timeout.ok, false);
    assert.equal(timeout.code, "CONFLICT");
    assert.equal(
      (
        await f.db
          .prepare(
            "SELECT state FROM creator_order_actions WHERE order_id=? AND kind='create-checkout'",
          )
          .bind(view.order.id)
          .first()
      ).state,
      "prepared",
    );
  } finally {
    f.db.cleanup();
  }
});

test("fulfilment cannot be prepared while the checkout outcome is unknown", async () => {
  const f = await prepared();
  try {
    let view = await f.create();
    const timedOut = await f.call({
      action: "timeout-fixture",
      workspace: workspaceId,
      order: view.order.id,
      operation: uuid(),
      expectedRevision: view.revision,
    });
    assert.equal(timedOut.ok, true, timedOut.message);
    view = timedOut.orders[0];
    assert.equal(view.actions.find((a) => a.kind === "create-checkout").state, "unknown");
    const paid = await f.call({
      action: "observe-fixture",
      workspace: workspaceId,
      order: view.order.id,
      operation: uuid(),
      expectedRevision: view.revision,
      scenario: "payment-paid",
    });
    assert.equal(paid.ok, true, paid.message);
    view = paid.orders[0];
    assert.equal(view.order.payment, "paid");
    const prepare = await f.call({
      action: "prepare-fixture-draft",
      workspace: workspaceId,
      order: view.order.id,
      operation: uuid(),
      expectedRevision: view.revision,
    });
    assert.equal(prepare.ok, false);
    assert.equal(prepare.code, "CONFLICT");
    assert.equal(
      (
        await f.db
          .prepare(
            "SELECT COUNT(*) AS n FROM creator_order_actions WHERE order_id=? AND kind='prepare-fulfilment'",
          )
          .bind(view.order.id)
          .first()
      ).n,
      0,
    );
  } finally {
    f.db.cleanup();
  }
});

test("checkout completion alone cannot establish payment and refunds cannot regress", () => {
  const order = {
    version: "composer.order/1",
    id: "123e4567-e89b-42d3-a456-426614174000",
    workspace: "ws-orders-lifecycle",
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
    attempt: {
      id: "123e4567-e89b-42d3-a456-426614174001",
      providerReference: null,
      observationRevision: 0,
    },
    fulfilmentOwner: "none",
    fulfilment: "not-requested",
  };
  const event = (patch) => ({
    version: "composer.order-event/1",
    id: crypto.randomUUID(),
    order: order.id,
    workspace: order.workspace,
    provider: order.provider,
    providerAccount: order.providerAccount,
    environment: order.environment,
    attempt: order.attempt.id,
    amount: order.amount,
    currency: order.currency,
    observationRevision: 1,
    kind: "payment.current-state",
    state: "paid",
    refundedAmount: 0,
    providerState: "fictional",
    ...patch,
  });
  assert.throws(
    () =>
      reduceOrder(order, event({ kind: "checkout.completed", state: "paid" })),
    /Checkout completion alone/,
  );
  const paid = reduceOrder(order, event({})).order;
  assert.equal(paid.payment, "paid");
  assert.throws(
    () =>
      reduceOrder(paid, event({ observationRevision: 2, state: "pending" })),
    /cannot undo an established payment/,
  );
  const refunded = reduceOrder(
    paid,
    event({
      observationRevision: 2,
      kind: "refund.current-state",
      state: "refunded",
      refundedAmount: order.amount,
    }),
  ).order;
  assert.equal(refunded.payment, "refunded");
  assert.throws(
    () =>
      reduceOrder(
        refunded,
        event({
          observationRevision: 3,
          kind: "refund.current-state",
          state: "partially-refunded",
          refundedAmount: 600,
        }),
      ),
    /regressed|undo a recorded refund/,
  );
});
