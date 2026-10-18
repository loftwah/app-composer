import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
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
  const values = {
    action,
    ...Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== ""),
    ),
  };
  const write = action === "setTraffic";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
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
            signal: controller.signal,
          }
        : { cache: "no-store", signal: controller.signal },
    );
    return decodeOutcomeReply(
      action,
      await parseApiResponse<unknown>(
        response,
        "Outcomes are unavailable. Your choice is still here; refresh before retrying a change.",
      ),
      values,
    );
  } finally {
    clearTimeout(timeout);
  }
}
