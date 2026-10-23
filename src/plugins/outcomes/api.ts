import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { decodeOutcomeReply } from "./protocol";
export { defaultFilters, filtersFromSearch } from "./protocol";
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

export async function publicOutcomeCall(
  action: "previewPublicReport" | "publishPublicReport",
  fields: Record<string, unknown>,
) {
  const { parseFrozenReport, reportUrl } =
    await import("../../lib/public-report");
  const response = await apiFetch(
    "/_emdash/api/plugins/composer-stacks/outcomesWrite",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...fields }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const raw = await parseApiResponse<unknown>(
    response,
    "The public report request did not complete. Review the aggregate before retrying.",
  );
  if (!raw || typeof raw !== "object")
    throw new Error("Invalid public report acknowledgement.");
  const value = raw as {
    ok?: boolean;
    message?: string;
    publicReport?: unknown;
    url?: string;
  };
  if (!value.ok)
    throw new Error(
      value.message ?? "The public report could not be prepared.",
    );
  const report = parseFrozenReport(value.publicReport);
  if (
    !report ||
    !report.origin ||
    report.metric !== "app_open_action" ||
    report.origin.traffic !== fields.traffic ||
    report.period.days !== Number(fields.days)
  )
    throw new Error(
      "The returned public aggregate does not match the requested scope.",
    );
  if (
    action === "publishPublicReport" &&
    (value.url !== reportUrl(report.id) || report.id !== fields.expectedReport)
  )
    throw new Error(
      "The published report acknowledgement changed. Review before retrying.",
    );
  return { report, url: value.url };
}
