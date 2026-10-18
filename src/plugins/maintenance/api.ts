import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { decodeMaintenanceReply } from "./protocol";
import { confirmWorkspace } from "../stacks/workspace-scope";

export async function maintenanceCall(
  action: "list" | "check" | "export",
  fields: Record<string, string> = {},
) {
  const selected = fields.workspace;
  const response = await apiFetch(
    "/_emdash/api/plugins/composer-stacks/maintenanceRead?" +
      new URLSearchParams({ action, ...fields }),
    { cache: "no-store" },
  );
  const value = decodeMaintenanceReply(
    action,
    await parseApiResponse<unknown>(
      response,
      "The maintenance check could not be confirmed. Your saved stack has not changed.",
    ),
  );
  confirmWorkspace(selected, value.workspace?.id);
  if (
    action !== "list" &&
    value.check &&
    (value.check.stack !== fields.stack ||
      value.check.instance !== fields.instance ||
      value.check.revision !== Number(fields.expectedRevision))
  )
    throw Error("The server returned another saved selection. Check it again.");
  return value;
}
