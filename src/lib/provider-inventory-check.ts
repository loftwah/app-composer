// Build the bounded, read-only Cloudflare check shown in Composer's owner
// administration. Everything here is derived from a verified observation or is
// explicitly unverified; no resource, tag or setting is ever changed.
import {
  COST_UNKNOWN,
  STALE_AFTER_HOURS,
  compareProviderInventory,
  formatCost,
  type ExpectedInventory,
  type ProviderComparison,
  type ProviderSnapshot,
  type ResourceComparison,
} from "./provider-inventory.mjs";
import type {
  ProviderCheck,
  ProviderFindingView,
} from "./provider-inventory-contract.ts";

export interface BuildProviderCheckInput {
  expected: ExpectedInventory;
  snapshot: ProviderSnapshot | null;
  source: "live" | "local-cli";
  state?: "unconfigured" | "inaccessible";
  reason?: string;
  checkedAt?: string;
  now?: number;
  actionHref?: string | null;
  revision?: string | null;
}

const priority: Record<ProviderFindingView["code"], number> = {
  "untracked-resources": 0,
  "expected-missing": 1,
  "expected-drift": 2,
  "provider-inaccessible": 3,
  "provider-unconfigured": 4,
  "provider-partial": 5,
  "identity-unrecorded": 6,
  "expected-unverified": 7,
  "provider-tags-absent": 8,
  "stale-observation": 9,
  "d1-list-counts-untrusted": 10,
  "domain-service-split": 11,
  "preview-revision-differs": 12,
};

function unverifiedComparison(
  expected: ExpectedInventory,
  reason: string,
): ResourceComparison[] {
  return expected.resources.map((item) => ({
    kind: item.kind,
    name: item.name,
    environment: item.environment,
    expectedSource: item.source,
    expectedId: item.id,
    observedId: null,
    state: "unverified" as const,
    detail: reason,
    changes: [],
    tags: {
      state: "unverified" as const,
      expected: item.tags,
      observed: null,
      missing: [],
      unexpected: [],
    },
    cost: COST_UNKNOWN,
    stale: false,
  }));
}

function names(resources: ResourceComparison[], maximum = 4): string {
  const list = resources.slice(0, maximum).map((item) => item.name);
  return (
    list.join(", ") +
    (resources.length > maximum
      ? `, and ${resources.length - maximum} more`
      : "")
  );
}

function findingsFor(
  expected: ExpectedInventory,
  comparison: ProviderComparison,
  snapshot: ProviderSnapshot,
  input: BuildProviderCheckInput,
): ProviderFindingView[] {
  const findings: ProviderFindingView[] = [];
  const action = input.actionHref
    ? { label: "Open Creator stacks", href: input.actionHref }
    : null;
  const identityUnrecorded = new Set(
    expected.resources
      .filter((item) => !item.identityRecorded)
      .map((item) => item.kind + "\u0000" + item.name),
  );
  const byState = (state: ResourceComparison["state"]) =>
    comparison.comparisons.filter((item) => item.state === state);

  const earlier = new Set(
    comparison.untrackedWorkers.earlierCompositions.map((name) =>
      name.split("-").at(-1),
    ),
  ).size;
  const undeclared =
    comparison.untrackedWorkers.earlierCompositions.length +
    comparison.untrackedWorkers.otherComposerWorkers.length;
  if (undeclared > 0)
    findings.push({
      code: "untracked-resources",
      severity: "attention",
      title: `${undeclared} observed Worker script${undeclared === 1 ? "" : "s"} are not in the current composition`,
      detail: `${comparison.untrackedWorkers.earlierCompositions.length} script(s) come from ${earlier} earlier composition id(s)${
        comparison.untrackedWorkers.otherComposerWorkers.length
          ? ` and ${comparison.untrackedWorkers.otherComposerWorkers.length} other composer-* script(s) are undeclared`
          : ""
      }. They are observed, not declared by composition.lock.json or wrangler.jsonc. Their retention, rollback role and ownership are unverified. This check does not mark them safe to delete and changes nothing.`,
      action,
    });

  const missing = byState("missing");
  if (missing.length)
    findings.push({
      code: "expected-missing",
      severity: "attention",
      title: `${missing.length} declared resource${missing.length === 1 ? " is" : "s are"} missing`,
      detail: `The provider list was read, but ${names(missing)} did not appear. A missing observation is not proof that the resource never existed.`,
      action,
    });

  const drift = byState("drift");
  if (drift.length)
    findings.push({
      code: "expected-drift",
      severity: "attention",
      title: `${drift.length} declared resource${drift.length === 1 ? " differs" : "s differ"} from Composer's expectation`,
      detail: drift
        .slice(0, 3)
        .map((item) => item.detail)
        .join(" "),
      action,
    });

  const inaccessible = byState("inaccessible");
  if (inaccessible.length)
    findings.push({
      code: "provider-inaccessible",
      severity: "attention",
      title: "Part of the Cloudflare account could not be read",
      detail: `${names(inaccessible)} could not be confirmed because the provider refused or did not complete a read. Inaccessible is not absent and is not healthy.`,
      action,
    });

  if (snapshot.state === "partial")
    findings.push({
      code: "provider-partial",
      severity: "unknown",
      title: "The Cloudflare scan is partial",
      detail:
        "At least one resource type or detail read did not complete. Unread values stay unverified; this is not a clean scan.",
      action,
    });

  const unverified = byState("unverified");
  const identity = unverified.filter((item) =>
    identityUnrecorded.has(item.kind + "\u0000" + item.name),
  );
  if (identity.length)
    findings.push({
      code: "identity-unrecorded",
      severity: "unknown",
      title: `${identity.length} first-party Worker${identity.length === 1 ? " has" : "s have"} no recorded provider identity`,
      detail: `Composer records the documented names for ${names(identity)}, but composition.lock.json and wrangler.jsonc record no provider Worker id or service identity for them. A matching name is a convention, not authority.`,
      action,
    });
  const otherUnverified = unverified.filter(
    (item) => !identityUnrecorded.has(item.kind + "\u0000" + item.name),
  );
  if (otherUnverified.length)
    findings.push({
      code: "expected-unverified",
      severity: "unknown",
      title: `${otherUnverified.length} declared resource${otherUnverified.length === 1 ? " is" : "s are"} unverified`,
      detail: `${names(otherUnverified)} could not be confirmed by the fields read. Unverified is not a match.`,
      action,
    });

  const tagged = comparison.comparisons.filter(
    (item) =>
      item.tags.state !== "unverified" &&
      item.kind === "worker" &&
      item.tags.missing.length > 0,
  );
  if (tagged.length)
    findings.push({
      code: "provider-tags-absent",
      severity: "info",
      title: `Suggested Composer tags are absent on ${tagged.length} observed Worker${tagged.length === 1 ? "" : "s"}`,
      detail:
        "The per-Worker tag read succeeded and the proposed composer:app, composer:service, environment, managed-by, lifecycle and owner keys were not all present. No tag has been adopted or written. A tag is not ownership, access or billing authority. The account-level Resource Tagging API is a public beta and is not written by this check.",
      action,
    });

  const age =
    (Date.parse(input.checkedAt ?? new Date().toISOString()) -
      Date.parse(snapshot.observedAt)) /
    3600000;
  if (Number.isFinite(age) && age > STALE_AFTER_HOURS)
    findings.push({
      code: "stale-observation",
      severity: "unknown",
      title: "This provider observation is old",
      detail: `The observation is more than ${STALE_AFTER_HOURS} hours old. Re-run the check before relying on it; an old snapshot is not current state.`,
      action,
    });

  if (
    snapshot.limitations.some((line) =>
      line.startsWith("The D1 list endpoint reported"),
    )
  )
    findings.push({
      code: "d1-list-counts-untrusted",
      severity: "info",
      title: "Cloudflare's D1 list table count was not used",
      detail:
        "The D1 list endpoint reported a different table count from the per-database read. The per-database value is shown; the list count is treated as unreliable rather than as an empty database.",
      action,
    });

  for (const app of expected.composition.apps) {
    const host = new URL(app.url).hostname;
    const serving = snapshot.resources.find(
      (resource) =>
        resource.kind === "worker" &&
        (resource.facts as { domains?: string[] } | null)?.domains?.includes(
          host,
        ),
    );
    if (serving && serving.name !== app.service)
      findings.push({
        code: "domain-service-split",
        severity: "info",
        title: `${host} is served by a different Worker than Composer's pinned service`,
        detail: `${host} points at ${serving.name}; Composer binds ${app.service} for the ${app.id} composition. Both may currently serve the same source, but a release of one surface will not update the other. Confirm this split is intended; nothing was changed.`,
        action,
      });
  }

  const production = snapshot.resources.find(
    (resource) =>
      resource.kind === "worker" &&
      resource.name === expected.resources[0]?.name,
  );
  const preview = snapshot.resources.find(
    (resource) =>
      resource.kind === "worker" && resource.name === "app-composer-preview",
  );
  const message = (resource: typeof production): string | null =>
    resource &&
    (resource.facts as { deploymentMessage?: string | null } | null)
      ?.deploymentMessage
      ? ((resource.facts as { deploymentMessage: string }).deploymentMessage ??
        null)
      : null;
  if (
    message(production) &&
    message(preview) &&
    message(production) !== message(preview)
  )
    findings.push({
      code: "preview-revision-differs",
      severity: "info",
      title: "Preview names a different source revision from production",
      detail: `Production names ${message(production)}; preview names ${message(preview)}. Preview is a separate operator deployment. This observation does not make preview a production claim or authorise a deployment.`,
      action,
    });

  return findings
    .sort(
      (left, right) =>
        priority[left.code] - priority[right.code] ||
        left.code.localeCompare(right.code),
    )
    .slice(0, 8);
}

export function buildProviderCheck(
  input: BuildProviderCheckInput,
): ProviderCheck {
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const actionHref = input.actionHref ?? null;
  if (!input.snapshot) {
    const reason =
      input.reason ??
      (input.state === "unconfigured"
        ? "This deployment has no read-only Cloudflare credential, so no provider request was made. The local provider-inventory CLI is the supported check path; unconfigured is not a clean scan."
        : "The provider read did not return an observation. Unreachable is not a clean scan.");
    const findings: ProviderFindingView[] = [
      {
        code:
          input.state === "unconfigured"
            ? "provider-unconfigured"
            : "provider-inaccessible",
        severity: "attention",
        title:
          input.state === "unconfigured"
            ? "Cloudflare state is not checked in this deployment"
            : "Cloudflare state could not be read",
        detail: reason,
        action: actionHref
          ? { label: "Open Creator stacks", href: actionHref }
          : null,
      },
    ];
    return {
      ok: true,
      version: "composer.provider-check/1",
      readOnly: true,
      source: input.source,
      state: input.state ?? "inaccessible",
      checkedAt,
      expectedRevision: input.revision ?? null,
      observedAt: null,
      observation: null,
      account: input.expected.account,
      counts: {
        expected: input.expected.resources.length,
        observed: 0,
        match: 0,
        drift: 0,
        missing: 0,
        unverified: input.expected.resources.length,
        inaccessible: 0,
        untracked: 0,
        attention: 1,
      },
      comparisons: unverifiedComparison(input.expected, reason),
      findings,
      endpoints: [],
      limitations: [
        "No provider request was made. Unconfigured or unreachable is not a clean scan.",
        "Cost remains unknown, not zero.",
      ],
      cost: COST_UNKNOWN,
      note: "Read-only check. Nothing was created, changed, tagged, deployed or deleted. Run the local provider-inventory CLI to observe Cloudflare with the owner's read-only credential and import its bounded result.",
    };
  }

  const comparison = compareProviderInventory(
    input.expected,
    input.snapshot,
    input.now ?? Date.now(),
  );
  const findings = findingsFor(input.expected, comparison, input.snapshot, {
    ...input,
    checkedAt,
    actionHref,
  });
  const limitations = [
    ...input.snapshot.limitations,
    "This check reads per-Worker tags only; account-level Resource Tagging is not written and is not used as authority.",
  ].slice(0, 8);
  return {
    ok: true,
    version: "composer.provider-check/1",
    readOnly: true,
    source: input.source,
    state: input.snapshot.state,
    checkedAt,
    expectedRevision: input.revision ?? null,
    observedAt: input.snapshot.observedAt,
    observation: input.snapshot.observation,
    account: input.snapshot.account,
    counts: {
      ...comparison.counts,
      attention: findings.filter((finding) => finding.severity === "attention")
        .length,
    },
    comparisons: comparison.comparisons.slice(0, 32),
    findings,
    endpoints: input.snapshot.endpoints.slice(0, 48).map((endpoint) => ({
      path: endpoint.path,
      method: "GET" as const,
      state: endpoint.state,
      status: endpoint.status,
      message: endpoint.message,
    })),
    limitations,
    cost: COST_UNKNOWN,
    note: "Read-only check. Nothing was created, changed, tagged, deployed or deleted. Cloudflare names and tags are evidence for a comparison, not ownership, access or billing authority. Cost is unknown, not zero.",
  };
}

/** Keep a human report honest about the one number that must never become zero. */
export function providerCostLabel(check: ProviderCheck): string {
  return formatCost(check.cost);
}
