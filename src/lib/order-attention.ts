// Deterministic commerce exceptions for the shared Needs attention view.
//
// The predicate is the same one the Orders screen uses for its "Needs
// attention" filter, so the two surfaces cannot disagree about what is an
// exception. Only saved records in the selected workspace, account and
// environment are read. No provider is contacted and no payment state is
// inferred from an HTTP response.
import type { D1Database } from "@cloudflare/workers-types";
import { orderDocument } from "./order-contract.ts";

export interface OrderAttentionView {
  order: {
    payment: string;
    fulfilment: string;
    fulfilmentOwner: string;
  };
  actions: Array<{ kind: string; state: string }>;
}

export type OrderAttentionReason =
  | "action-unknown"
  | "action-failed"
  | "fulfilment-unknown"
  | "fulfilment-failed"
  | "payment-failed"
  | "payment-expired"
  | "payment-cancelled";

export interface OrderAttentionCopy {
  reason: OrderAttentionReason;
  title: string;
  summary: string;
  action: "Open order" | "Reconcile order";
}

/**
 * One order can carry several problems; the earliest matching reason is the
 * one a person should act on first. A routine pending or unpaid checkout is
 * waiting, not an exception, and is deliberately not included.
 */
export function orderAttention(view: OrderAttentionView): OrderAttentionCopy | null {
  const action = (state: string, kind?: string) =>
    view.actions.find(
      (entry) => entry.state === state && (kind ? entry.kind === kind : true),
    );
  if (action("unknown", "create-checkout"))
    return {
      reason: "action-unknown",
      title: "A checkout needs reconciliation",
      summary:
        "The saved checkout outcome is uncertain. Reconcile it before repeating any payment step; a new checkout could charge twice.",
      action: "Reconcile order",
    };
  if (action("unknown"))
    return {
      reason: "action-unknown",
      title: "An order operation has an unknown outcome",
      summary:
        "The retained operation did not report a trusted result. Inspect the saved order and provider state before any repeat.",
      action: "Open order",
    };
  if (action("failed"))
    return {
      reason: "action-failed",
      title: "An order operation failed",
      summary:
        "The retained operation did not succeed. Inspect its saved history; there is no supported replay for this step.",
      action: "Open order",
    };
  if (view.order.fulfilment === "unknown")
    return {
      reason: "fulfilment-unknown",
      title: "A fulfilment outcome is unknown",
      summary:
        "Do not repeat fulfilment. Reconcile the retained order and provider state before preparing another step.",
      action: "Open order",
    };
  if (view.order.fulfilment === "failed")
    return {
      reason: "fulfilment-failed",
      title: "A fulfilment step failed",
      summary:
        "The saved order keeps the failure. Review the retained steps; this slice provides no automatic fulfilment replay.",
      action: "Open order",
    };
  if (view.order.payment === "failed")
    return {
      reason: "payment-failed",
      title: "A payment failed",
      summary:
        "Payment failed for this saved order. Inspect the attempt and choose a supported next step; a failed payment is not a completed order.",
      action: "Open order",
    };
  if (view.order.payment === "expired")
    return {
      reason: "payment-expired",
      title: "A checkout expired",
      summary:
        "The saved checkout expired without a current paid observation. Inspect the order before creating another attempt.",
      action: "Open order",
    };
  if (view.order.payment === "cancelled")
    return {
      reason: "payment-cancelled",
      title: "A checkout was cancelled",
      summary:
        "The checkout was cancelled. Confirm that is the intended end state before removing or reopening anything.",
      action: "Open order",
    };
  return null;
}

export function orderNeedsAttention(view: OrderAttentionView): boolean {
  return orderAttention(view) !== null;
}

/** One stable deep link to the selected native order and its retained detail. */
export function orderAttentionHref(workspace: string, orderId: string): string {
  return (
    "/_emdash/admin/plugins/composer-stacks/orders?" +
    new URLSearchParams({ workspace, order: orderId }) +
    "#order-" +
    orderId
  );
}

interface OrderRow {
  id: string;
  workspace_id: string;
  installation_account: string;
  installation_environment: string;
  provider: string;
  provider_account: string;
  payment_environment: string;
  proof: string;
  payment_state: string;
  order_json: string;
  created_at: string;
  updated_at: string;
}

interface ActionRow {
  order_id: string;
  kind: string;
  state: string;
  updated_at: string;
}

export interface OrderAttentionItem {
  id: string;
  orderId: string;
  app: string | null;
  reason: OrderAttentionReason;
  title: string;
  summary: string;
  action: OrderAttentionCopy["action"];
  firstObserved: string;
  lastObserved: string;
}

const timestamp = (value: string) => {
  const text = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const time = Date.parse(text);
  if (!Number.isFinite(time)) throw Error("Invalid stored order date");
  return new Date(time).toISOString();
};

/**
 * Read at most the newest 50 saved orders for the exact scope. A stored record
 * whose identity disagrees with its row is refused as unreadable, never shown
 * as zero problems.
 */
export async function readOrderAttention(
  db: D1Database,
  target: { workspace: string; account: string; environment: string },
): Promise<OrderAttentionItem[]> {
  const rows = await db
    .prepare(
      "SELECT id,workspace_id,installation_account,installation_environment,provider,provider_account,payment_environment,proof,payment_state,order_json,created_at,updated_at FROM creator_orders WHERE workspace_id=? AND installation_account=? AND installation_environment=? ORDER BY created_at DESC,id DESC LIMIT 50",
    )
    .bind(target.workspace, target.account, target.environment)
    .all<OrderRow>();
  if (!rows.results.length) return [];
  const actions = await db
    .prepare(
      "SELECT order_id,kind,state,updated_at FROM creator_order_actions WHERE workspace_id=? AND order_id IN (" +
        rows.results.map(() => "?").join(",") +
        ")",
    )
    .bind(target.workspace, ...rows.results.map((row) => row.id))
    .all<ActionRow>();
  const byOrder = new Map<string, ActionRow[]>();
  for (const action of actions.results) {
    const list = byOrder.get(action.order_id) ?? [];
    list.push(action);
    byOrder.set(action.order_id, list);
  }
  const items: OrderAttentionItem[] = [];
  for (const row of rows.results) {
    const order = orderDocument.parse(JSON.parse(row.order_json));
    if (
      order.id !== row.id ||
      order.workspace !== row.workspace_id ||
      order.provider !== row.provider ||
      order.providerAccount !== row.provider_account ||
      order.environment !== row.payment_environment ||
      order.proof !== row.proof ||
      order.payment !== row.payment_state
    )
      throw Error("A retained order identity or scope is inconsistent.");
    const own = byOrder.get(row.id) ?? [];
    const attention = orderAttention({ order, actions: own });
    if (!attention) continue;
    const observed = [timestamp(row.updated_at), ...own.map((action) => timestamp(action.updated_at))];
    items.push({
      id: "order-" + row.id,
      orderId: row.id,
      app: /^[a-z0-9-]{1,40}$/.test(order.app) ? order.app : null,
      ...attention,
      firstObserved: timestamp(row.created_at),
      lastObserved: observed.sort().at(-1)!,
    });
  }
  return items;
}
