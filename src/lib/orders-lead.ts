import type { OrderView } from "./order-contract.ts";

export type OrderAction = OrderView["actions"][number];

/** One selected order and the next action its existing contract supports. */
export type OrdersLead =
  | { kind: "empty" }
  | { kind: "reconcile"; view: OrderView }
  | { kind: "failed"; view: OrderView; action: OrderAction }
  | { kind: "pending"; view: OrderView }
  | { kind: "fulfilment"; view: OrderView }
  | { kind: "observation"; view: OrderView };

export function ordersLead(view?: OrderView): OrdersLead {
  if (!view) return { kind: "empty" };

  // Reconcile is the existing recovery action only for an uncertain checkout.
  // A failed or uncertain fulfilment has no supported replay, so it stays a
  // review lead rather than inventing a second recovery call.
  const uncertainCheckout = view.actions.find(
    (action) =>
      action.kind === "create-checkout" && action.state === "unknown",
  );
  if (uncertainCheckout) return { kind: "reconcile", view };

  const unresolved = view.actions.find(
    (action) => action.state === "unknown" || action.state === "failed",
  );
  if (unresolved) return { kind: "failed", view, action: unresolved };

  if (view.order.payment === "pending" || view.order.payment === "unpaid")
    return { kind: "pending", view };

  if (
    view.order.payment === "paid" &&
    view.order.fulfilmentOwner === "composer-printful" &&
    view.order.fulfilment === "not-requested"
  )
    return { kind: "fulfilment", view };

  return { kind: "observation", view };
}
