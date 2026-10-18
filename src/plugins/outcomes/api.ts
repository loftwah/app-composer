import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { workspaceSelection } from "../stacks/workspace-scope";
import { decodeOutcomeReply } from "./protocol";
export { defaultFilters } from "./protocol";
export type {
  Filters,
  ReportReply,
  OutcomeReport,
  OutcomeMetric,
} from "./protocol";

export async function outcomeCall(
  action: "report" | "export" | "setTraffic",
  fields: Record<string, unknown>,
) {
  const selected = workspaceSelection(window.location.search);
  if (selected && fields.workspace && fields.workspace !== selected)
    throw Error("Open the selected workspace before its outcomes.");
  const values = {
    action,
    ...Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== ""),
    ),
    ...(selected ? { workspace: selected } : {}),
  };
  const write = action === "setTraffic";
  const response = await apiFetch(
    "/_emdash/api/plugins/composer-stacks/" +
      (write
        ? "outcomesWrite"
        : "outcomesRead?" +
          new URLSearchParams(values as Record<string, string>)),
    write
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      : { cache: "no-store" },
  );
  return decodeOutcomeReply(
    action,
    await parseApiResponse<unknown>(
      response,
      "Outcomes are unavailable. Your choice is still here; refresh before retrying a change.",
    ),
    values,
  );
}
