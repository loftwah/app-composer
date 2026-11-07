// Shared, read-only registry refresh. The CLI uses the installed registry
// discovery client; the scheduled Worker supplies its own bounded adapter. This
// module makes no request, reads no file and decides nothing about installation.
import { curatedPlugin, pluginTrustSnapshot } from "./plugin-trust-contract.ts";

export interface PackageView {
  did: string;
  slug: string;
  handle?: string | null;
  cid: string;
  uri: string;
  profile?: Record<string, unknown> | null;
  releaseHistoryComplete?: boolean;
}

export interface ReleaseView {
  did: string;
  package: string;
  cid: string;
  uri: string;
  version: string;
  indexedAt?: string;
  release?: Record<string, unknown> | null;
  labels?: unknown[];
}

export interface Discovery {
  getPackage(input: { did: string; slug: string }): Promise<PackageView>;
  getLatestRelease(input: { did: string; package: string }): Promise<ReleaseView>;
}

const extension = (
  value: unknown,
  key: string,
): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const found = (value as Record<string, unknown>)[key];
  return found && typeof found === "object" && !Array.isArray(found)
    ? (found as Record<string, unknown>)
    : null;
};

export async function refreshPluginTrust(
  snapshotInput: unknown,
  discovery: Discovery,
  now = new Date(),
) {
  const snapshot = pluginTrustSnapshot.parse(snapshotInput);
  const packages = [];
  for (const previous of snapshot.packages) {
    try {
      const profile = await discovery.getPackage({
        did: previous.did,
        slug: previous.slug,
      });
      const release = await discovery.getLatestRelease({
        did: previous.did,
        package: previous.slug,
      });
      if (
        profile.did !== previous.did ||
        profile.slug !== previous.slug ||
        release.did !== previous.did ||
        release.package !== previous.slug ||
        !profile.profile ||
        !release.release
      )
        throw Error("Discovery identity unavailable");
      const record = release.release;
      const metadata = profile.profile;
      const artifacts = record.artifacts as
        | { package?: { checksum?: string } }
        | undefined;
      const requires = record.requires as Record<string, string> | undefined;
      const packageExtension = extension(
        metadata.extensions,
        "com.emdashcms.experimental.package.profileExtension",
      );
      const releasePolicy = extension(packageExtension, "releasePolicy");
      const sameArtifact =
        release.cid === previous.releaseCid &&
        artifacts?.package?.checksum === previous.checksum;
      packages.push(
        curatedPlugin.parse({
          ...previous,
          name:
            typeof metadata.name === "string" ? metadata.name : previous.slug,
          handle: profile.handle ?? null,
          profileCid: profile.cid,
          profileUri: profile.uri,
          releaseCid: release.cid,
          releaseUri: release.uri,
          version: release.version,
          indexedAt: release.indexedAt,
          checksum: artifacts?.package?.checksum ?? null,
          requires: requires?.["env:emdash"] ?? null,
          historyComplete: profile.releaseHistoryComplete === true,
          license: typeof metadata.license === "string" ? metadata.license : null,
          repository:
            typeof packageExtension?.repository === "string"
              ? packageExtension.repository
              : null,
          securityContact:
            Array.isArray(metadata.security) &&
            metadata.security.some((contact) => {
              if (!contact || typeof contact !== "object") return false;
              const value = contact as Record<string, unknown>;
              return Boolean(value.email || value.url);
            }),
          requireProvenance: releasePolicy?.requireProvenance === true,
          labels: release.labels ?? [],
          inspection: sameArtifact ? previous.inspection : null,
          // Advisory evidence belongs to one exact release. A new artifact
          // starts with no advisory coverage rather than carrying it forward.
          advisory: sameArtifact ? previous.advisory : undefined,
          refreshFailed: false,
        }),
      );
    } catch {
      // Remote errors may echo hostile content. Retain previous evidence with a
      // failure flag; never forward the raw exception or manufacture a release.
      packages.push({ ...previous, refreshFailed: true });
    }
  }
  return pluginTrustSnapshot.parse({
    ...snapshot,
    observedAt: now.toISOString(),
    packages,
  });
}
