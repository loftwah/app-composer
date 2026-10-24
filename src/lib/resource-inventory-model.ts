// Pure comparison and classification for the read-only resource inventory.
// These functions never read a provider, write a record or retire anything:
// they state what Composer's trusted records and its own expected settings
// imply, and where a comparison simply cannot be made.
import type {
  InventoryFinding,
  InventoryResource,
} from "./resource-inventory-contract.ts";

/** A confirmed app operation older than this is shown as stale, not failed. */
export const STALE_AFTER_DAYS = 45;
/** Composer-local labels are namespaced so they cannot impersonate provider keys. */
export const PROVIDER_TAG_PREFIX = "composer";

export interface ProviderTag {
  key: string;
  value: string;
}

export type ProviderTagComparison = InventoryResource["providerTags"];

export type ResourceStatus = InventoryResource["status"];

/** The recorded app actions; keep in step with the contract's operation enum. */
export type OperationAction =
  "create" | "stage" | "activate" | "moderate" | "control";

export interface ResourceObservation {
  id: string;
  state: InventoryResource["state"];
  configuration: {
    revision: number;
    digest: string;
    source: string;
    values: Record<string, string>;
  } | null;
  expected: {
    available: boolean;
    basis: InventoryResource["expected"]["basis"];
    values: Record<string, string> | null;
    digest: string | null;
    source: string | null;
    note: string | null;
  };
  targetMatches: boolean;
  bindings: number;
  unfinished: {
    action: OperationAction;
    state: "pending" | "unknown";
    at: string;
  } | null;
  lastConfirmedAt: string | null;
  published: { pinned: number[]; current: number | null } | null;
  providerTags: ProviderTagComparison;
  actionHref: string;
}

/**
 * Compare the labels Composer records against the tag set it would expect on a
 * provider. The value is deterministic so a later verified snapshot can be
 * compared without guessing which side changed.
 */
export function normaliseLabel(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function expectedProviderTags(labels: {
  workspace: string;
  app: string;
  environment: string;
  resource: string;
}): ProviderTag[] {
  return [
    {
      key: PROVIDER_TAG_PREFIX + ":workspace",
      value: normaliseLabel(labels.workspace),
    },
    { key: PROVIDER_TAG_PREFIX + ":app", value: normaliseLabel(labels.app) },
    {
      key: PROVIDER_TAG_PREFIX + ":environment",
      value: normaliseLabel(labels.environment),
    },
    {
      key: PROVIDER_TAG_PREFIX + ":resource",
      value: normaliseLabel(labels.resource),
    },
  ].sort((left, right) => left.key.localeCompare(right.key));
}

/**
 * `recorded: null` means no verified provider tag snapshot exists, so the
 * answer is unknown rather than a failure. An empty array is a verified read
 * that found no tags and therefore does not match.
 */
export function compareProviderTags(
  expected: ProviderTag[],
  recorded: ProviderTag[] | null,
): ProviderTagComparison {
  const base: ProviderTagComparison = {
    state: "unverified",
    expected,
    recorded,
    missing: [],
    unexpected: [],
  };
  if (recorded === null) return base;
  const actual = new Map(recorded.map((tag) => [tag.key, tag.value]));
  const wanted = new Map(expected.map((tag) => [tag.key, tag.value]));
  const missing = expected
    .filter((tag) => !actual.has(tag.key))
    .map((tag) => tag.key);
  const unexpected = recorded
    .filter((tag) => !wanted.has(tag.key))
    .map((tag) => tag.key);
  const differing = expected.filter(
    (tag) => actual.has(tag.key) && actual.get(tag.key) !== tag.value,
  );
  const agreeing = expected.filter(
    (tag) => actual.has(tag.key) && actual.get(tag.key) === tag.value,
  );
  const state =
    missing.length === 0 && unexpected.length === 0 && differing.length === 0
      ? "match"
      : agreeing.length > 0
        ? "partial"
        : "mismatch";
  return {
    ...base,
    state,
    missing,
    unexpected: [...unexpected, ...differing.map((tag) => tag.key)],
  };
}

export function configurationDifferences(
  current: Record<string, string> | null,
  expected: Record<string, string> | null,
): InventoryResource["differences"] {
  if (!expected) return [];
  const fields = [
    ...new Set([...Object.keys(expected), ...Object.keys(current ?? {})]),
  ].sort();
  return fields
    .filter((field) => (current?.[field] ?? null) !== (expected[field] ?? null))
    .slice(0, 12)
    .map((field) => ({
      field,
      current: current?.[field] ?? null,
      expected: expected[field] ?? null,
    }));
}

const days = (from: string, to: number) => {
  const time = Date.parse(from);
  if (!Number.isFinite(time)) return null;
  return (to - time) / 86400000;
};

/**
 * Classify one recorded resource. Ordering is deliberate: a refused or
 * unconfirmed operation outranks configuration drift, and drift outranks an
 * old check. Tags never decide ownership or billing, so a tag difference is
 * reported as drift without implying either.
 */
export function classifyResource(
  observation: ResourceObservation,
  now: number,
): { status: ResourceStatus; findings: InventoryFinding[] } {
  const findings: InventoryFinding[] = [];
  const open = {
    label: "Open Creator stacks",
    href: observation.actionHref,
  };
  const { configuration, expected } = observation;

  if (!observation.targetMatches)
    findings.push({
      code: "target-mismatch",
      severity: "attention",
      title: "Recorded against another target",
      detail:
        "This resource was recorded for a different account, environment or app target than this installation. App operations refuse it until the saved stack is applied against the current target.",
      action: open,
    });
  if (observation.unfinished)
    findings.push({
      code: "unfinished-operation",
      severity: "unknown",
      title: "An app operation is not confirmed",
      detail: `The last recorded ${observation.unfinished.action} operation is ${observation.unfinished.state}. Check it in Creator stacks before applying or publishing again. Nothing is retried here.`,
      action: open,
    });
  if (observation.state === "refused")
    findings.push({
      code: "operation-refused",
      severity: "attention",
      title: "The app refused the last change",
      detail:
        "The app refused the recorded change. The published page was not changed by that refusal. Review the saved settings before another apply.",
      action: open,
    });
  else if (observation.state === "unknown")
    findings.push({
      code: "state-unknown",
      severity: "unknown",
      title: "The app state is not confirmed",
      detail:
        "This resource is recorded as unconfirmed. Check the operation in Creator stacks before relying on its settings or publishing again.",
      action: open,
    });
  else if (observation.state === "reserved" || !configuration)
    findings.push({
      code: "not-activated",
      severity: "unknown",
      title: "No confirmed configuration",
      detail:
        "The resource exists in Composer's records but no app-confirmed configuration is stored. Apply the saved stack settings to activate it.",
      action: open,
    });

  if (expected.basis === "unavailable" && observation.bindings > 0)
    findings.push({
      code: "declared-settings-incomplete",
      severity: "unknown",
      title: "Saved settings cannot be compared",
      detail:
        expected.note ??
        "The saved stack's declared settings could not be evaluated, so the expected configuration is unknown.",
      action: open,
    });

  if (
    configuration &&
    expected.available &&
    expected.source &&
    configuration.source !== expected.source
  )
    findings.push({
      code: "source-drift",
      severity: "attention",
      title: "The connected app source changed",
      detail: `This configuration was confirmed against app source ${configuration.source.slice(0, 8)}; the installation expects ${expected.source.slice(0, 8)}. Apply or check the resource before relying on its settings.`,
      action: open,
    });

  if (
    configuration &&
    expected.available &&
    expected.values &&
    (configuration.digest !== expected.digest ||
      configurationDifferences(configuration.values, expected.values).length >
        0)
  )
    findings.push({
      code: "unapplied-settings",
      severity: "attention",
      title: "Saved settings are not applied",
      detail:
        "The saved stack settings differ from the app-confirmed configuration. Apply them in Creator stacks; until then the published page keeps the older configuration.",
      action: open,
    });

  if (
    configuration &&
    observation.published &&
    observation.published.pinned.some(
      (pinned) => pinned !== configuration.revision,
    )
  )
    findings.push({
      code: "published-configuration-drift",
      severity: "attention",
      title: "The public page uses an older configuration",
      detail: `The published page pins configuration ${observation.published.pinned.join(", ")} while the resource confirms ${configuration.revision}. Publish the stack again to show the current configuration.`,
      action: open,
    });

  if (
    observation.providerTags.state === "mismatch" ||
    observation.providerTags.state === "partial"
  )
    findings.push({
      code: "provider-tag-drift",
      severity: "attention",
      title:
        observation.providerTags.state === "mismatch"
          ? "Provider tags do not match the local labels"
          : "Provider tags partly differ from the local labels",
      detail:
        "A recorded provider tag snapshot differs from the labels Composer derives. Tags are not ownership, access or billing authority, and Composer does not remove an unrelated tag; review the resource at the provider first.",
      action: open,
    });

  if (configuration && !observation.unfinished) {
    const age = observation.lastConfirmedAt
      ? days(observation.lastConfirmedAt, now)
      : null;
    if (age === null || age > STALE_AFTER_DAYS)
      findings.push({
        code: "stale-check",
        severity: "info",
        title: "No recent confirmed check",
        detail: observation.lastConfirmedAt
          ? `The last confirmed app operation is more than ${STALE_AFTER_DAYS} days old. Refresh this inventory and apply only if the saved settings differ.`
          : `No confirmed app operation is recorded. Refresh this inventory and apply only if the saved settings differ.`,
        action: open,
      });
  }

  if (observation.bindings === 0)
    findings.push({
      code: "no-binding",
      severity: "info",
      title: "Not used by a saved stack",
      detail:
        "This recorded resource has no saved stack binding. It stays listed so it is not mistaken for an active one; Composer does not retire or delete it automatically.",
      action: null,
    });

  const status: ResourceStatus = findings.some(
    (finding) => finding.severity === "attention",
  )
    ? "attention"
    : findings.some((finding) => finding.severity === "unknown")
      ? "unknown"
      : observation.bindings === 0
        ? "unbound"
        : findings.some((finding) => finding.code === "stale-check")
          ? "stale"
          : "in-step";
  return { status, findings };
}

export function countStatuses(
  resources: InventoryResource[],
): ResourceInventorySnapshotCounts {
  const counts = {
    inStep: 0,
    stale: 0,
    attention: 0,
    unknown: 0,
    unbound: 0,
  };
  for (const resource of resources) {
    if (resource.status === "in-step") counts.inStep++;
    else if (resource.status === "stale") counts.stale++;
    else if (resource.status === "attention") counts.attention++;
    else if (resource.status === "unknown") counts.unknown++;
    else counts.unbound++;
  }
  return counts;
}

export interface ResourceInventorySnapshotCounts {
  inStep: number;
  stale: number;
  attention: number;
  unknown: number;
  unbound: number;
}
