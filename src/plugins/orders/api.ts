import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { ordersSnapshot, type OrdersSnapshot } from "../../lib/order-contract";
import { confirmWorkspace } from "../stacks/workspace-scope";
const base = "/_emdash/api/plugins/composer-stacks/";
export async function ordersCall(
  action: string,
  workspace?: string,
  fields: Record<string, unknown> = {},
): Promise<OrdersSnapshot> {
  const reading = action === "list";
  const response = await apiFetch(
    base +
      (reading
        ? "ordersRead?" +
          new URLSearchParams({ action, ...(workspace ? { workspace } : {}) })
        : "ordersWrite"),
    reading
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...fields, action, workspace }),
        },
  );
  const value = await parseApiResponse<unknown>(
    response,
    "The order result could not be confirmed. Refresh its saved history before retrying.",
  );
  const parsed = ordersSnapshot.safeParse(value);
  if (!parsed.success)
    throw Error(
      value &&
        typeof value === "object" &&
        "message" in value &&
        typeof value.message === "string"
        ? value.message
        : "The order response could not be validated. Keep its operation identity and refresh.",
    );
  confirmWorkspace(workspace, parsed.data.workspace.id);
  return parsed.data;
}
