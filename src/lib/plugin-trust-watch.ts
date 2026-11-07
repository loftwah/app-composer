// Watch depth for the curated Plugin Trust snapshot. Automatic refresh is not
// enabled: this compares dated observations, keeps the review list deduplicated
// and states the cadence plainly. It reads committed evidence only and never
// installs, updates or executes a plugin.
import type { CuratedPlugin, TrustSnapshot } from "./plugin-trust-contract.ts";

export const watchPolicy = {
  automatic: false,
  cadenceHours: 24,
  owner: "Composer owner",
  network: "Two registry reads and up to two artifact downloads per run. No credentials, no model spend.",
  escalation: "A deduplicated review item is raised only when a release, permission, host, digest, compatibility or listing state changes.",
} as const;

export type ChangeSeverity = "info" | "review" | "block";

export interface ObservedChange {
  code: string;
  severity: ChangeSeverity;
  detail: string;
}

export interface ReviewItem {
  key: string;
  did: string;
  slug: string;
  version: string;
  severity: ChangeSeverity;
  code: string;
  detail: string;
}

export interface PluginDiff {
  did: string;
  slug: string;
  name: string;
  state: "added" | "removed" | "changed" | "unchanged";
  from: string | null;
  to: string | null;
  changes: ObservedChange[];
}

const identity = (plugin: CuratedPlugin) => plugin.did + "/" + plugin.slug;
const list = (values: string[] | undefined) =>
  [...new Set(values ?? [])].sort();

function added(before: string[] | undefined, after: string[] | undefined) {
  const existing = new Set(before ?? []);
  return list(after).filter((value) => !existing.has(value));
}

// Only meaningful differences are reported. A daily re-observation of the same
// release is not a change and must not create review noise.
export function diffObservation(
  previous: TrustSnapshot,
  next: TrustSnapshot,
): PluginDiff[] {
  const before = new Map(previous.packages.map((p) => [identity(p), p]));
  const after = new Map(next.packages.map((p) => [identity(p), p]));
  const diffs: PluginDiff[] = [];
  for (const [key, plugin] of after) {
    const old = before.get(key);
    if (!old) {
      diffs.push({
        did: plugin.did,
        slug: plugin.slug,
        name: plugin.name,
        state: "added",
        from: null,
        to: plugin.version,
        changes: [
          {
            code: "PACKAGE_ADDED",
            severity: "info",
            detail: "The package was not present in the previous observation.",
          },
        ],
      });
      continue;
    }
    const changes: ObservedChange[] = [];
    if (old.version !== plugin.version)
      changes.push({
        code: "RELEASE_CHANGED",
        severity: "review",
        detail: `Version changed from ${old.version} to ${plugin.version}. Re-read the release and its permissions before an update decision.`,
      });
    if (old.releaseCid !== plugin.releaseCid && old.version === plugin.version)
      changes.push({
        code: "RELEASE_RECORD_CHANGED",
        severity: "review",
        detail:
          "The release record CID changed without a version change. Treat the record as mutable until re-reviewed.",
      });
    if (old.checksum !== plugin.checksum)
      changes.push({
        code: "ARTIFACT_CHANGED",
        severity: "review",
        detail:
          "The artifact checksum changed. The previously inspected bytes do not describe this release.",
      });
    const addedCapabilities = added(
      old.inspection?.capabilities,
      plugin.inspection?.capabilities,
    );
    if (addedCapabilities.length)
      changes.push({
        code: "CAPABILITIES_ADDED",
        severity: addedCapabilities.some((value) =>
          /:(write|publish|restore|send|moderate)$/.test(value),
        )
          ? "review"
          : "info",
        detail: "New declared capabilities: " + addedCapabilities.join(", ") + ".",
      });
    const addedHosts = added(
      old.inspection?.allowedHosts,
      plugin.inspection?.allowedHosts,
    );
    if (addedHosts.length)
      changes.push({
        code: "HOSTS_ADDED",
        severity: "review",
        detail: "New declared outbound hosts: " + addedHosts.join(", ") + ".",
      });
    if ((old.requires ?? "") !== (plugin.requires ?? ""))
      changes.push({
        code: "COMPATIBILITY_CHANGED",
        severity: "review",
        detail: `EmDash compatibility changed from ${old.requires ?? "undeclared"} to ${plugin.requires ?? "undeclared"}.`,
      });
    if ((old.license ?? "") !== (plugin.license ?? ""))
      changes.push({
        code: "LICENSE_CHANGED",
        severity: "review",
        detail: "The observed licence changed or became unavailable.",
      });
    if ((old.repository ?? "") !== (plugin.repository ?? ""))
      changes.push({
        code: "SOURCE_CHANGED",
        severity: "review",
        detail: "The observed source repository changed or became unavailable.",
      });
    const activeBefore = new Map(
      (old.labels ?? []).map((label) => [label.val, label.neg !== true]),
    );
    const activeAfter = new Map(
      (plugin.labels ?? []).map((label) => [label.val, label.neg !== true]),
    );
    const withdrawal =
      [...activeAfter].some(
        ([value, enabled]) =>
          enabled && /yank|withdraw|takedown/.test(value),
      ) &&
      ![...activeBefore].some(
        ([value, enabled]) =>
          enabled && /yank|withdraw|takedown/.test(value),
      );
    if (withdrawal)
      changes.push({
        code: "RELEASE_WITHDRAWN",
        severity: "block",
        detail:
          "The release now carries an active withdrawal or takedown label.",
      });
    const profileBefore = new Map(
      (old.profileLabels ?? []).map((label) => [label.val, label.neg !== true]),
    );
    for (const entry of plugin.profileLabels ?? []) {
      const value = entry.val;
      const enabled = entry.neg !== true;
      if (enabled === false) {
        profileBefore.delete(value);
        continue;
      }
      if (profileBefore.get(value) === true) continue;
      if (/withdrawn|takedown|yank|suspend/.test(value))
        changes.push({
          code: "PROFILE_WITHDRAWN",
          severity: "block",
          detail: "The package listing now carries: " + value + ".",
        });
      else if (/overrid|review|unlisted/.test(value))
        changes.push({
          code: "PROFILE_REVIEW",
          severity: "review",
          detail: "The package listing now carries: " + value + ".",
        });
    }
    if (!old.historyComplete && plugin.historyComplete)
      changes.push({
        code: "HISTORY_COMPLETE",
        severity: "info",
        detail: "The registry now reports complete release history.",
      });
    diffs.push({
      did: plugin.did,
      slug: plugin.slug,
      name: plugin.name,
      state: changes.length ? "changed" : "unchanged",
      from: old.version,
      to: plugin.version,
      changes,
    });
  }
  for (const [key, old] of before)
    if (!after.has(key))
      diffs.push({
        did: old.did,
        slug: old.slug,
        name: old.name,
        state: "removed",
        from: old.version,
        to: null,
        changes: [
          {
            code: "PACKAGE_REMOVED",
            severity: "review",
            detail:
              "The package is absent from the newer observation. Confirm whether it was withdrawn or the registry is incomplete.",
          },
        ],
      });
  return diffs.sort((left, right) =>
    left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0,
  );
}

// Deterministic keys make a repeated observation of the same condition one
// review item, not a new one every day.
export function reviewKey(plugin: CuratedPlugin, code: string) {
  return ["plugin-trust", plugin.did, plugin.slug, code, plugin.version].join(
    ":",
  );
}

export function reviewItems(
  previous: TrustSnapshot,
  next: TrustSnapshot,
): ReviewItem[] {
  const items = new Map<string, ReviewItem>();
  for (const diff of diffObservation(previous, next)) {
    const plugin =
      next.packages.find(
        (candidate) => identity(candidate) === diff.did + "/" + diff.slug,
      ) ??
      previous.packages.find(
        (candidate) => identity(candidate) === diff.did + "/" + diff.slug,
      );
    if (!plugin) continue;
    for (const change of diff.changes) {
      if (change.severity === "info") continue;
      const key = reviewKey(plugin, change.code);
      if (items.has(key)) continue;
      items.set(key, {
        key,
        did: plugin.did,
        slug: plugin.slug,
        version: plugin.version,
        severity: change.severity,
        code: change.code,
        detail: change.detail,
      });
    }
  }
  return [...items.values()].sort((left, right) =>
    left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
  );
}

// Newest first, bounded, and de-duplicated by observation time. Retention keeps
// evidence available without turning the repository into an unbounded archive.
export function retainSnapshots(
  snapshots: TrustSnapshot[],
  maximum = 6,
): TrustSnapshot[] {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 30)
    throw new Error("Retention must be between 1 and 30 snapshots");
  const seen = new Set<string>();
  return [...snapshots]
    .sort((left, right) =>
      left.observedAt < right.observedAt
        ? 1
        : left.observedAt > right.observedAt
          ? -1
          : 0,
    )
    .filter((snapshot) => {
      if (seen.has(snapshot.observedAt)) return false;
      seen.add(snapshot.observedAt);
      return true;
    })
    .slice(0, maximum);
}

export function watchStatus(
  snapshots: TrustSnapshot[],
  now = new Date(),
) {
  const retained = retainSnapshots(snapshots);
  const latest = retained[0] ?? null;
  const age = latest
    ? now.getTime() - Date.parse(latest.observedAt)
    : Number.POSITIVE_INFINITY;
  return {
    ...watchPolicy,
    retained: retained.length,
    latestAt: latest?.observedAt ?? null,
    stale: latest ? age > 14 * 86400000 || age < -300000 : true,
    previousAt: retained[1]?.observedAt ?? null,
  };
}
