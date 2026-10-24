import type { OverviewSnapshot } from "./overview-contract";

export type AttentionItem = OverviewSnapshot["items"][number];
export type AttentionSource = OverviewSnapshot["sources"][number];
export type SourceId = AttentionSource["id"];

// The selected app comes first, then workspace-wide records. Ties break on the
// latest actual observation, then the retained count, then the stable id.
export function rankAttention(
  items: readonly AttentionItem[],
  app: string | null,
): AttentionItem[] {
  // With no app chosen, every record competes on recency alone. A chosen app
  // pulls its own records first, then other apps, then workspace-wide records.
  const weight = (item: AttentionItem) =>
    app ? (item.app === app ? 0 : item.app ? 1 : 2) : 0;
  return [...items].sort(
    (a, b) =>
      weight(a) - weight(b) ||
      b.lastObserved.localeCompare(a.lastObserved) ||
      b.count - a.count ||
      a.id.localeCompare(b.id),
  );
}

export interface AttentionView {
  kind: "problems" | "unreadable" | "clear";
  // Exactly one item may lead. Everything else is a quieter list.
  leader: AttentionItem | null;
  rest: AttentionItem[];
  total: number;
  // Records attributed to the selected app, when an app is selected.
  appScoped: number;
  blocked: AttentionSource[];
  restricted: AttentionSource[];
}

export function attentionView(
  snapshot: Pick<OverviewSnapshot, "items" | "sources" | "selection">,
): AttentionView {
  const ranked = rankAttention(snapshot.items, snapshot.selection.app);
  const blocked = snapshot.sources.filter(
    (source) => source.status === "unavailable",
  );
  const restricted = snapshot.sources.filter(
    (source) => source.status === "restricted",
  );
  return {
    kind: ranked.length ? "problems" : blocked.length ? "unreadable" : "clear",
    leader: ranked[0] ?? null,
    rest: ranked.slice(1),
    total: ranked.length,
    appScoped: snapshot.selection.app
      ? ranked.filter((item) => item.app === snapshot.selection.app).length
      : 0,
    blocked,
    restricted,
  };
}

// The source a reader should retry first, or undefined when nothing is blocked.
export function firstBlockedSource(
  view: AttentionView,
): AttentionSource | undefined {
  return view.blocked[0];
}

export interface RecheckState {
  source: SourceId;
  status: "running" | "succeeded" | "failed";
  message: string;
  at: string | null;
}

export function beginRecheck(source: SourceId, at: string): RecheckState {
  return { source, status: "running", message: "", at };
}

// A failed read stays failed. It never resolves into an empty or successful
// state just because the previous snapshot still has records.
export function settleRecheck(
  previous: RecheckState,
  outcome: { ok: boolean; message: string; at: string },
): RecheckState {
  return {
    source: previous.source,
    status: outcome.ok ? "succeeded" : "failed",
    message: outcome.message,
    at: outcome.at,
  };
}
