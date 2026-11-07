// Shared-attention reader for the Plugin Trust watch.
//
// The persisted review items, the owner enablement state and the latest
// observation failure become items in the existing owner "Needs attention"
// view. Review items stay administrator-only: a creator, workspace editor or
// viewer never sees them, and no public page reads this data. A missing or
// unreadable table is "unavailable", never zero.
import type { D1Database } from "@cloudflare/workers-types";
import { reviewAnchor } from "./plugin-trust-contract.ts";
import { openReviews, watchView } from "./plugin-trust-watch-run.ts";

export interface PluginTrustAttentionItem {
  id: string;
  title: string;
  summary: string;
  action: string;
  href: string;
  count: number;
  firstObserved: string;
  lastObserved: string;
}

export interface PluginTrustAttention {
  status: "checked" | "restricted" | "unavailable";
  note: string;
  atLimit: boolean;
  items: PluginTrustAttentionItem[];
}

const page = "/_emdash/admin/plugins/composer-stacks/plugin-trust";

function timestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function bounded(value: string, limit: number): string {
  const text = String(value ?? "").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export async function readPluginTrustAttention(
  db: D1Database | undefined,
  { administrator }: { administrator: boolean },
): Promise<PluginTrustAttention> {
  if (!administrator)
    return {
      status: "restricted",
      note: "Plugin Trust review items are administrator-only. Open the Trust Centre in an administrator session; restricted is not zero.",
      atLimit: false,
      items: [],
    };
  if (!db)
    return {
      status: "unavailable",
      note: "Plugin Trust records are unavailable in this environment. Unavailable is not zero.",
      atLimit: false,
      items: [],
    };
  const view = await watchView(db);
  const reviews = await openReviews(db);
  const items: PluginTrustAttentionItem[] = [];
  for (const review of reviews.slice(0, 25)) {
    const observed =
      timestamp(review.lastSeenAt) ?? timestamp(review.firstSeenAt) ?? null;
    if (!observed) continue;
    items.push({
      id: `plugin-trust:${bounded(review.key, 150)}`,
      title: `${bounded(review.slug, 60)} ${bounded(review.version, 40)} ${
        review.severity === "block" ? "is blocked" : "needs review"
      }`,
      summary: `${review.severity === "block" ? "Blocking" : "Review"}: ${bounded(review.detail, 380)}`,
      action: "Open Trust Centre",
      href: `${page}#plugin-trust-review-${reviewAnchor(review.key)}`,
      count: 1,
      firstObserved: timestamp(review.firstSeenAt) ?? observed,
      lastObserved: observed,
    });
  }
  const failureAt = timestamp(view.lastRunAt);
  if (view.enabled && (view.state === "failed" || view.state === "partial") && failureAt)
    items.push({
      id: "plugin-trust:watch",
      title: "The daily Plugin Trust watch needs attention",
      summary: bounded(
        `The last run finished ${view.state}${
          view.error ? ` (${view.error})` : ""
        }. The last good observation is kept; the Trust Centre shows which evidence is stale.`,
        400,
      ),
      action: "Open Trust Centre",
      href: `${page}#plugin-trust-watch`,
      count: 1,
      firstObserved: failureAt,
      lastObserved: failureAt,
    });
  const enabled = view.enabled
    ? `Daily watch is on${
        view.lastRunAt ? `; last run ${view.state}` : "; no run yet"
      }.`
    : "Daily watch is off; the owner enables it from the Trust Centre.";
  return {
    status: "checked",
    note: bounded(
      `${items.length} open review item${items.length === 1 ? "" : "s"} and owner enablement evidence. ${enabled} Advisory coverage is explicit: an unconfigured source is ADVISORY_SOURCE_NONE and an unreadable one is ADVISORY_SOURCE_UNKNOWN; neither is ever treated as clean. Review items are deduplicated by publisher, package, code and version; they are administrator-only and never appear on a public page.`,
      500,
    ),
    atLimit: items.length >= 25,
    items,
  };
}
