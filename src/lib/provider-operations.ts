// Derived read-only operations view for the existing bounded provider inventory.
// Declarations name accountable owners; observations never create ownership.
import type {
  ExpectedInventory,
  ObservedResource,
  ProviderSnapshot,
  WorkerFacts,
} from "./provider-inventory.mjs";
import { COST_UNKNOWN } from "./provider-inventory.mjs";

function declaration(expected: ExpectedInventory, resource: ObservedResource) {
  return expected.resources.find(
    (value) =>
      (value.kind === resource.kind ||
        (value.kind === "service" && resource.kind === "worker")) &&
      (value.id ? value.id === resource.id : value.name === resource.name),
  );
}
function references(resource: ObservedResource) {
  const facts =
    resource.kind === "worker" ? (resource.facts as WorkerFacts | null) : null;
  if (!facts?.settingsRead) return null;
  return facts.bindings
    .flatMap((binding) => {
      const selected =
        binding.type === "service"
          ? ["worker", binding.service]
          : binding.type === "d1"
            ? ["d1", binding.databaseId]
            : binding.type === "r2_bucket"
              ? ["r2", binding.bucketName]
              : binding.type === "kv_namespace"
                ? ["kv", binding.namespaceId]
                : null;
      return selected?.[1]
        ? [
            {
              binding: binding.name,
              kind: selected[0]!,
              id: selected[1]!,
              environment: binding.environment ?? null,
              entrypoint: binding.entrypoint ?? null,
            },
          ]
        : [];
    })
    .sort((a, b) => a.binding.localeCompare(b.binding));
}
function key(resource: Pick<ObservedResource, "kind" | "id">) {
  return resource.kind + ":" + resource.id;
}
function completeList(
  snapshot: ProviderSnapshot,
  kind: ObservedResource["kind"],
) {
  // Current snapshots record a successful storage page, not pagination or R2
  // cursor exhaustion. Presence is useful; storage absence/newness stays unknown.
  // Workers alone have the reader's bounded whole-list completion sentinel.
  if (kind !== "worker") return false;
  return (
    snapshot.state === "verified" &&
    snapshot.lists[kind as keyof ProviderSnapshot["lists"]] === "read" &&
    !(kind === "worker" && snapshot.workersAtLimit)
  );
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
/** Current dependencies and optionally two selected observations, never deletions. */
export function providerOperations(
  expected: ExpectedInventory,
  current: ProviderSnapshot,
  previous: ProviderSnapshot | null = null,
) {
  for (const snapshot of [current, ...(previous ? [previous] : [])]) {
    if (!Number.isFinite(Date.parse(snapshot.observedAt)))
      throw Error("Select a dated observation.");
    const keys = snapshot.resources.map(key);
    if (new Set(keys).size !== keys.length)
      throw Error("Duplicate resource identity in observation.");
  }
  if (
    current.account !== expected.account ||
    (previous &&
      (previous.account !== current.account ||
        previous.scope !== current.scope))
  )
    throw Error("Select matching account and scope observations.");
  if (
    previous &&
    Date.parse(previous.observedAt) >= Date.parse(current.observedAt)
  )
    throw Error("Select an earlier baseline observation.");
  const resources = current.resources.map((resource) => {
    const declared = declaration(expected, resource),
      dependencies = references(resource);
    const owner =
      declared?.tags.find((tag) => tag.key === "owner")?.value ?? null;
    const dependents = current.resources.flatMap(
      (worker) =>
        references(worker)
          ?.filter(
            (ref) =>
              ref.kind === resource.kind &&
              (ref.id === resource.id || ref.id === resource.name),
          )
          .map((ref) => ({ worker: worker.name, binding: ref.binding })) ?? [],
    );
    return {
      kind: resource.kind,
      id: resource.id,
      name: resource.name,
      environment: declared?.environment ?? resource.environment,
      declared: !!declared,
      declaredOwner: owner,
      declaration: declared?.source ?? null,
      dependencyCoverage:
        resource.kind !== "worker"
          ? "not-applicable"
          : dependencies === null
            ? "unread"
            : "read",
      dependencies: dependencies ?? [],
      dependents,
      retirement: "not-authorised" as const,
      cost: COST_UNKNOWN,
    };
  });
  const changes: Array<{
    kind: string;
    id: string;
    name: string;
    state: string;
    fields: string[];
    detail: string;
  }> = [];
  if (previous) {
    const before = new Map(
        previous.resources.map((resource) => [key(resource), resource]),
      ),
      after = new Map(
        current.resources.map((resource) => [key(resource), resource]),
      );
    for (const resource of current.resources) {
      const old = before.get(key(resource));
      if (!old) {
        changes.push({
          kind: resource.kind,
          id: resource.id,
          name: resource.name,
          state: completeList(previous, resource.kind)
            ? "newly-observed"
            : "baseline-unread",
          fields: [],
          detail: completeList(previous, resource.kind)
            ? "Not present in the selected complete earlier list; creation time and ownership still need provider evidence."
            : "Earlier list coverage cannot establish whether this resource is new.",
        });
        continue;
      }
      const fields: string[] = [];
      if (resource.name !== old.name) fields.push("name");
      if (resource.environment !== old.environment)
        fields.push("environment-hint");
      const a =
          old.kind === "worker" ? (old.facts as WorkerFacts | null) : null,
        b =
          resource.kind === "worker"
            ? (resource.facts as WorkerFacts | null)
            : null;
      if (a?.deploymentRead && b?.deploymentRead && a.versionId !== b.versionId)
        fields.push("active-version");
      const oldRefs = references(old),
        newRefs = references(resource);
      if (oldRefs && newRefs && !equal(oldRefs, newRefs))
        fields.push("dependency-bindings");
      if (
        a?.domainsRead &&
        b?.domainsRead &&
        !equal([...a.domains].sort(), [...b.domains].sort())
      )
        fields.push("custom-domains");
      if (
        a?.schedulesRead &&
        b?.schedulesRead &&
        !equal([...a.schedules].sort(), [...b.schedules].sort())
      )
        fields.push("schedules");
      if (fields.length)
        changes.push({
          kind: resource.kind,
          id: resource.id,
          name: resource.name,
          state: "changed",
          fields,
          detail:
            "Both selected observations read these fields. Investigate through the owning app release process.",
        });
      if (resource.kind === "worker" && (oldRefs === null || newRefs === null))
        changes.push({
          kind: resource.kind,
          id: resource.id,
          name: resource.name,
          state: "dependency-unverified",
          fields: [],
          detail:
            "A missing settings read is unknown, never evidence that dependencies were removed.",
        });
    }
    for (const old of previous.resources)
      if (!after.has(key(old)))
        changes.push({
          kind: old.kind,
          id: old.id,
          name: old.name,
          state: completeList(current, old.kind)
            ? "no-longer-observed"
            : "current-unread",
          fields: [],
          detail: completeList(current, old.kind)
            ? "Absent from the selected current complete list; this is not deletion or retirement authority."
            : "Current list coverage is incomplete; absence cannot establish removal.",
        });
  }
  return {
    version: "composer.provider-operations/1",
    readOnly: true,
    account: current.account,
    observedAt: current.observedAt,
    baselineAt: previous?.observedAt ?? null,
    resources,
    changes,
    dependencyCoverage: {
      workers: current.resources.filter((r) => r.kind === "worker").length,
      settingsRead: current.resources.filter(
        (r) => r.kind === "worker" && references(r) !== null,
      ).length,
      reverseReferencesComplete: false,
    },
    cost: COST_UNKNOWN,
    limits: [
      "Dependencies cover only successfully observed service/D1/R2/KV bindings. Queues, Workflows, external clients and unread Worker settings remain unknown.",
      "A committed owner declaration is accountable scope, not a provider ownership or permission grant. Undeclared resources stay unassigned.",
      "No resource is safe to retire from this view; reverse references are incomplete. Costs remain unknown.",
    ],
  };
}
