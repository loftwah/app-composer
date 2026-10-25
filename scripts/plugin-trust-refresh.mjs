// Read-only, bounded discovery. Emits a review candidate; never writes the
// shipped snapshot, installs code, fetches artifacts or reads private inventory.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  curatedPlugin,
  pluginTrustSnapshot,
} from "../src/lib/plugin-trust-contract.ts";

const aggregator = "https://registry.emdashcms.com";
export async function registryFetch(input, init, fetcher = fetch) {
  const url = new URL(input instanceof Request ? input.url : input);
  if (
    url.origin !== aggregator ||
    !url.pathname.startsWith("/xrpc/") ||
    (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase() !== "GET"
  )
    throw Error("Discovery target refused");
  const response = await fetcher(input, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || !response.body) throw Error("Discovery unavailable");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 512 * 1024) throw Error("Discovery response too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return new Response(Buffer.concat(chunks), {
    status: response.status,
    headers: response.headers,
  });
}

export async function refreshPluginTrust(
  snapshotInput,
  discovery,
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
      const sameArtifact =
        release.cid === previous.releaseCid &&
        record.artifacts?.package?.checksum === previous.checksum;
      packages.push(
        curatedPlugin.parse({
          ...previous,
          name: metadata.name ?? previous.slug,
          handle: profile.handle ?? null,
          profileCid: profile.cid,
          profileUri: profile.uri,
          releaseCid: release.cid,
          releaseUri: release.uri,
          version: release.version,
          indexedAt: release.indexedAt,
          checksum: record.artifacts?.package?.checksum ?? null,
          requires: record.requires?.["env:emdash"] ?? null,
          historyComplete: profile.releaseHistoryComplete === true,
          license: metadata.license ?? null,
          repository:
            metadata.extensions?.[
              "com.emdashcms.experimental.package.profileExtension"
            ]?.repository ?? null,
          securityContact:
            Array.isArray(metadata.security) &&
            metadata.security.some((contact) =>
              Boolean(contact.email || contact.url),
            ),
          requireProvenance:
            metadata.extensions?.[
              "com.emdashcms.experimental.package.profileExtension"
            ]?.releasePolicy?.requireProvenance === true,
          labels: release.labels ?? [],
          inspection: sameArtifact ? previous.inspection : null,
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

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 2)
      throw Error("This command accepts no target overrides.");
    const requireEmdash = createRequire(import.meta.resolve("emdash"));
    const clientPackage = JSON.parse(
      readFileSync(
        new URL(
          "../../package.json",
          pathToFileURL(
            requireEmdash.resolve("@emdash-cms/registry-client/discovery"),
          ),
        ),
        "utf8",
      ),
    );
    // Resolve the exact dependency already installed by EmDash, never acquire a
    // second registry package or execute registry configuration.
    if (clientPackage.version !== "0.7.1")
      throw Error("Unreviewed registry client version");
    const { DiscoveryClient } = await import(
      requireEmdash.resolve("@emdash-cms/registry-client/discovery")
    );
    const discovery = new DiscoveryClient({
      aggregatorUrl: aggregator,
      fetch: registryFetch,
    });
    const input = JSON.parse(
      readFileSync(
        new URL("../src/data/plugin-trust-20261025.json", import.meta.url),
        "utf8",
      ),
    );
    const output = await refreshPluginTrust(input, discovery);
    console.log(JSON.stringify(output, null, 2));
    if (output.packages.some((plugin) => plugin.refreshFailed))
      process.exitCode = 1;
  } catch {
    console.error(
      "Registry refresh unavailable. Keep the previous dated observation and retry after checking the selected source and official registry.",
    );
    process.exitCode = 1;
  }
}
