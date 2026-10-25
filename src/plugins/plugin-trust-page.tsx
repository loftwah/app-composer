import { useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { z } from "zod";
import {
  evaluatePlugin,
  httpsLink,
  pluginTrustSnapshot,
  type TrustSnapshot,
  type TrustState,
} from "../lib/plugin-trust-contract";
import { compareInstalledPlugin } from "../lib/plugin-release-comparison";
import "./plugin-trust-page.css";

const reportSchema = z.object({
  ok: z.literal(true),
  checkedAt: z.iso.datetime(),
  site: z.literal("https://composer.loftwah.com"),
  environment: z.literal("production"),
  snapshot: pluginTrustSnapshot,
  inventory: z.object({
    available: z.boolean(),
    atLimit: z.boolean(),
    rows: z
      .array(
        z.object({
          plugin_id: z.string().max(200),
          version: z.string().max(200),
          status: z.string().max(200),
          source: z.string().max(200),
          registry_publisher_did: z.string().max(200).nullable(),
          registry_slug: z.string().max(200).nullable(),
        }),
      )
      .max(100),
  }),
});
type Report = z.infer<typeof reportSchema>;
const labels: Record<TrustState, string> = {
  RED: "Policy blocked",
  AMBER: "Needs review",
  UNKNOWN: "Unknown",
  GREEN: "Checks passed",
};
const utc = (value: string) =>
  new Date(value).toLocaleString("en-AU", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " UTC";

export function PluginTrustEvidence({
  snapshot,
  checkedAt,
}: {
  snapshot: TrustSnapshot;
  checkedAt: string;
}) {
  return (
    <div className="pt-evidence">
      <p className="pt-scope">
        Curated observation:{" "}
        <time dateTime={snapshot.observedAt}>{utc(snapshot.observedAt)}</time> ·
        Policy {snapshot.policy} · Evaluated host EmDash {snapshot.host.emdash}{" "}
        / Cloudflare adapter {snapshot.host.cloudflare} / Astro{" "}
        {snapshot.host.astro}.
      </p>
      <p>
        These are dated checks on two selected releases. “Policy blocked”
        describes this application's review policy, not a claim that a publisher
        is malicious. Missing evidence stays Unknown. No overall secure rating
        is available.
      </p>
      {snapshot.packages.map((plugin) => {
        const result = evaluatePlugin(plugin, snapshot, new Date(checkedAt));
        const upstream = `https://plugins.emdashcms.com/plugins/@${plugin.handle ?? plugin.did}/${plugin.slug}`;
        const repository = httpsLink(plugin.repository);
        return (
          <article key={plugin.did + plugin.slug} className="pt-package">
            <div className="pt-package-heading">
              <h2>
                {plugin.name} <span>{plugin.version}</span>
              </h2>
              <strong className={`pt-rating pt-${result.state.toLowerCase()}`}>
                {labels[result.state]}
              </strong>
            </div>
            <p className="pt-identity">
              <code>{plugin.did}</code> / <code>{plugin.slug}</code>
            </p>
            <dl className="pt-facts">
              <div>
                <dt>Security / trust</dt>
                <dd>
                  {labels[result.security]} · advisory coverage remains unknown
                </dd>
              </div>
              <div>
                <dt>Maintenance / compatibility</dt>
                <dd>
                  {labels[result.maintenance]} ·{" "}
                  {result.freshness === "stale"
                    ? "refresh required"
                    : "dated evidence"}
                </dd>
              </div>
              <div>
                <dt>Exact release CID</dt>
                <dd>
                  <code>{plugin.releaseCid}</code>
                </dd>
              </div>
              <div>
                <dt>Profile CID</dt>
                <dd>
                  <code>{plugin.profileCid}</code>
                </dd>
              </div>
              <div>
                <dt>Artifact bytes</dt>
                <dd>
                  {result.digestMatches
                    ? "Inspected SHA-256 matches the observed release checksum"
                    : "Not verified"}
                  . Publisher signatures are verified by EmDash during
                  installation.
                </dd>
              </div>
              <div>
                <dt>Build provenance</dt>
                <dd>
                  {plugin.requireProvenance
                    ? "Required by publisher policy; attestation not independently verified"
                    : "Not required by publisher policy; not independently verified"}
                </dd>
              </div>
              <div>
                <dt>Compatibility</dt>
                <dd>
                  {result.compatible === true
                    ? "Declared range includes the evaluated host"
                    : result.compatible === false
                      ? "Declared range excludes the evaluated host"
                      : "Unknown"}{" "}
                  · <code>{plugin.requires ?? "No EmDash range declared"}</code>
                </dd>
              </div>
              <div>
                <dt>Manifest permissions</dt>
                <dd>
                  {result.capabilities?.join(", ") ??
                    "Unknown — exact release not inspected"}
                </dd>
              </div>
              <div>
                <dt>Outbound hosts</dt>
                <dd>
                  {result.allowedHosts
                    ? result.allowedHosts.length
                      ? result.allowedHosts.join(", ")
                      : "No allowlist in inspected manifest"
                    : "Unknown"}
                </dd>
              </div>
              <div>
                <dt>Record index time</dt>
                <dd>
                  <time dateTime={plugin.indexedAt}>
                    {utc(plugin.indexedAt)}
                  </time>{" "}
                  · not a publish date
                </dd>
              </div>
              <div>
                <dt>Licence and costs</dt>
                <dd>
                  {plugin.license ?? "Licence unknown"}. Current plugin price
                  and external service costs are unknown; review the publisher's
                  current terms.
                </dd>
              </div>
            </dl>
            <details>
              <summary>
                Why {labels[result.state].toLowerCase()} — evidence and next
                action
              </summary>
              <ul className="pt-reasons">
                {result.reasons.map((reason) => (
                  <li key={reason.code}>
                    <strong>
                      {labels[reason.state]} · <code>{reason.code}</code>
                    </strong>
                    <p>{reason.detail}</p>
                  </li>
                ))}
              </ul>
            </details>
            <div className="pt-links">
              <a href={upstream}>View this package in the official registry</a>
              {repository && (
                <a href={repository}>Publisher's source repository</a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

const comparisonLabels = {
  native: "Native / build-time",
  unknown: "Comparison unavailable",
  stale: "Refresh required",
  "newer-observed": "Newer version observed",
  "same-version": "Same version number",
  "installed-ahead": "Installed version is newer",
};

export function PluginInstalledInventory({ report }: { report: Report }) {
  return (
    <section className="pt-inventory" aria-labelledby="plugin-inventory-title">
      <div className="pt-package-heading">
        <h2 id="plugin-inventory-title">This site's installed plugins</h2>
        <time dateTime={report.checkedAt}>{utc(report.checkedAt)}</time>
      </div>
      <p>
        Read from this site's EmDash state. Only a matching registry publisher
        DID and package slug can be compared. Native plugins retain their own
        source and release process.
      </p>
      {!report.inventory.available ? (
        <p role="status">
          Inventory unavailable. This is not evidence of an empty installation.
        </p>
      ) : report.inventory.rows.length ? (
        <>
          <div className="pt-installed-list">
            {report.inventory.rows.map((row) => {
              const comparison = compareInstalledPlugin(
                row,
                report.snapshot,
                new Date(report.checkedAt),
              );
              return (
                <article key={row.plugin_id} className="pt-installed-row">
                  <div>
                    <h3>{row.plugin_id}</h3>
                    <p>
                      <strong>Installed {row.version}</strong> · {row.status}
                    </p>
                    <p className="pt-identity">
                      {comparisonLabels[comparison.state]}
                    </p>
                  </div>
                  <div>
                    {comparison.candidate && (
                      <p>
                        Observed registry release:{" "}
                        <strong>
                          {comparison.candidate.name}{" "}
                          {comparison.candidate.version}
                        </strong>{" "}
                        · {labels[comparison.candidate.rating]}
                      </p>
                    )}
                    <p>{comparison.action}</p>
                    {comparison.candidate && (
                      <p>
                        <code>
                          {comparison.candidate.did} /{" "}
                          {comparison.candidate.slug}
                        </code>
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {report.inventory.atLimit && (
            <p>Only the first 100 state records are shown.</p>
          )}
        </>
      ) : (
        <p>
          No plugin-state rows returned. Build-time configuration may still
          declare native plugins.
        </p>
      )}
    </section>
  );
}

export function PluginTrustPage() {
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setReport(undefined);
    void (async () => {
      try {
        const response = await apiFetch(
          "/_emdash/api/plugins/composer-stacks/pluginTrustRead",
          { cache: "no-store", signal: controller.signal },
        );
        const raw = await parseApiResponse<unknown>(
          response,
          "The private Plugin Trust Centre is unavailable. Sign in as an administrator and try again.",
        );
        const parsed = reportSchema.parse(raw);
        if (!controller.signal.aborted) setReport(parsed);
      } catch {
        if (!controller.signal.aborted)
          setError(
            "The private Plugin Trust Centre could not be loaded. No inventory or current rating is available. Try again or open the official registry.",
          );
      }
    })();
    return () => controller.abort();
  }, [generation]);
  return (
    <section
      className="composer-plugin-trust"
      aria-labelledby="plugin-trust-title"
    >
      <header>
        <h1 id="plugin-trust-title">Plugin Trust Centre</h1>
        <p>
          Review what a selected plugin asks to do before deciding whether it
          belongs in your application.
        </p>
        <p>Composer production · administrator-only · read-only</p>
      </header>
      <p>
        <a href="https://plugins.emdashcms.com/">
          Open the official EmDash registry
        </a>{" "}
        · <a href="/plugin-trust">How these checks work</a>
      </p>
      {!report && !error && (
        <p role="status">Loading this site's inventory and curated evidence…</p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setGeneration((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {report && (
        <>
          <PluginInstalledInventory report={report} />
          <h2 className="pt-curated-title">Observed registry releases</h2>
          <p>
            These selected releases are dated observations, not a live
            latest-version feed or an upgrade recommendation.
          </p>
          <PluginTrustEvidence
            snapshot={report.snapshot}
            checkedAt={report.checkedAt}
          />
          <section className="pt-installation">
            <h2>Installation on this site remains unqualified</h2>
            <p>
              This Composer build has no registry configuration, sandbox runner
              or LOADER binding. Workers Paid / Dynamic Workers entitlement and
              Cloudflare lifecycle qualification remain required. This page
              cannot install, update, enable, disable or uninstall anything.
            </p>
            <p>
              Use{" "}
              <code>
                node scripts/plugin-readiness.mjs --environment production
                --json
              </code>{" "}
              in the selected source checkout for the offline configuration
              report. It makes no provider calls.
            </p>
            <p>
              A separate local Node/workerd run installed Publish Check, changed
              its settings, disabled/re-enabled it, updated it and recovered its
              settings after reinstall. That proves the local native API
              lifecycle; it does not qualify this Cloudflare installation.{" "}
              <a href="https://github.com/loftwah/app-composer/blob/main/docs/evidence/plugin-native-lifecycle-20261025.md">
                Read the local lifecycle receipt
              </a>
              .
            </p>
            <a href="https://docs.emdashcms.com/plugins/installing/">
              EmDash's installation guide
            </a>
          </section>
        </>
      )}
    </section>
  );
}
