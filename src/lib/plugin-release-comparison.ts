import {
  evaluatePlugin,
  type CuratedPlugin,
  type TrustSnapshot,
} from "./plugin-trust-contract.ts";

export interface InstalledPluginIdentity {
  plugin_id: string;
  version: string;
  status: string;
  source: string;
  registry_publisher_did: string | null;
  registry_slug: string | null;
}

// This bounded observer accepts only canonical numeric releases. EmDash remains
// responsible for semver ranges, signatures, permissions and installation.
export function compareReleaseVersions(a: string, b: string): number | null {
  const parse = (value: string) => {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
    const parts = value.split(".").map(Number);
    return parts.every(Number.isSafeInteger) ? parts : null;
  };
  const left = parse(a),
    right = parse(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++)
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

function inspected(plugin: CuratedPlugin, snapshot: TrustSnapshot, now: Date) {
  const result = evaluatePlugin(plugin, snapshot, now);
  return result.digestMatches &&
    !result.reasons.some((reason) =>
      ["STALE_SNAPSHOT", "IDENTITY_MISMATCH", "RELEASE_WITHDRAWN"].includes(
        reason.code,
      ),
    )
    ? result
    : null;
}

export function comparePluginReleases(
  baseline: CuratedPlugin,
  candidate: CuratedPlugin,
  snapshot: TrustSnapshot,
  now = new Date(),
) {
  if (baseline.did !== candidate.did || baseline.slug !== candidate.slug)
    return {
      state: "identity-mismatch" as const,
      addedCapabilities: null,
      addedHosts: null,
    };
  const before = inspected(baseline, snapshot, now);
  const after = inspected(candidate, snapshot, now);
  if (!before || !after)
    return {
      state: "unknown" as const,
      addedCapabilities: null,
      addedHosts: null,
    };
  const addedCapabilities = [...new Set(after.capabilities!)]
    .filter((value) => !before.capabilities!.includes(value))
    .sort();
  const addedHosts = [...new Set(after.allowedHosts!)]
    .filter((value) => !before.allowedHosts!.includes(value))
    .sort();
  return {
    state:
      addedCapabilities.length || addedHosts.length
        ? ("review-required" as const)
        : ("no-observed-increase" as const),
    addedCapabilities,
    addedHosts,
  };
}

export function compareInstalledPlugin(
  installed: InstalledPluginIdentity,
  snapshot: TrustSnapshot,
  now = new Date(),
) {
  if (installed.source !== "registry")
    return {
      state: "native" as const,
      candidate: null,
      action:
        "Review this plugin's source release and redeploy through its owning repository. Registry recommendations do not describe this installation.",
    };
  const candidates = snapshot.packages.filter(
    (candidate) =>
      candidate.did === installed.registry_publisher_did &&
      candidate.slug === installed.registry_slug,
  );
  if (candidates.length !== 1)
    return {
      state: "unknown" as const,
      candidate: null,
      action:
        "Re-observe the exact publisher DID and package slug. A name or version match cannot identify this installation.",
    };
  const candidate = candidates[0];
  const result = evaluatePlugin(candidate, snapshot, now);
  const order = compareReleaseVersions(candidate.version, installed.version);
  const state = result.reasons.some(
    (reason) => reason.code === "STALE_SNAPSHOT",
  )
    ? ("stale" as const)
    : order === null
      ? ("unknown" as const)
      : order > 0
        ? ("newer-observed" as const)
        : order < 0
          ? ("installed-ahead" as const)
          : ("same-version" as const);
  const action =
    state === "stale"
      ? "Refresh the dated registry observation before deciding. The installed state remains separate from the stale recommendation."
      : state === "installed-ahead"
        ? "Keep the installed version; this dated observation is older. Do not downgrade from this comparison."
        : state === "same-version"
          ? "Version numbers match, but the installed release CID, manifest and provenance are unverified. Reconcile them in native EmDash before changing anything."
          : state === "newer-observed"
            ? result.reasons.some((reason) => reason.state === "RED")
              ? "The observed candidate is blocked by this policy. Review its reasons and report upstream or choose a reviewed alternative; do not infer that the installed release is affected."
              : "Inspect the exact candidate in native EmDash and review permission, host and public-route changes before approval. No installed manifest baseline has been observed."
            : "This version syntax is outside the comparison's numeric-release scope. Use native EmDash to inspect the exact releases.";
  return {
    state,
    candidate: {
      name: candidate.name,
      version: candidate.version,
      did: candidate.did,
      slug: candidate.slug,
      releaseCid: candidate.releaseCid,
      rating: result.state,
    },
    action,
  };
}
