import { useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { z } from "zod";
import {
  stackStatusSnapshot,
  type StackPackageRow,
  type StackRemotePackage,
} from "../lib/stack-status-contract";
import "./stack-status-page.css";

const reportSchema = z.object({
  ok: z.literal(true),
  checkedAt: z.iso.datetime(),
  snapshot: stackStatusSnapshot,
});
type Report = z.infer<typeof reportSchema>;

const statusLabels = {
  ok: "Current",
  attention: "Needs review",
  security: "Security action",
  unknown: "Unknown",
} as const;

const packageStatusLabels = {
  ok: "Qualified",
  drift: "Outside policy",
  unknown: "No policy",
  unresolved: "Unresolved",
} as const;

const signalLabels: Record<string, string> = {
  current: "Current",
  "compatible-patch": "Patch available",
  "feature-opportunity": "Feature release",
  "breaking-major": "Breaking major",
  "security-urgent": "Security advisory",
  unsupported: "Unsupported",
  unknown: "Unknown",
};

const utc = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-AU", {
        timeZone: "UTC",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " UTC"
    : "Unknown";

function warningClass(value: string) {
  if (value === "security" || value === "security-urgent") return "ss-warning";
  if (
    value === "attention" ||
    value === "breaking-major" ||
    value === "unsupported" ||
    value === "drift" ||
    value === "unknown"
  )
    return "ss-attention";
  return "ss-ok";
}

function RemoteSignal({ remote }: { remote: StackRemotePackage }) {
  const label = signalLabels[remote.classification] ?? "Unknown";
  const detail = remote.reason ? (
    <details>
      <summary>{label}</summary>
      <p>{remote.reason}</p>
      {remote.latestQualified === false && (
        <p>This release is outside the reviewed supported range.</p>
      )}
    </details>
  ) : (
    <span>{label}</span>
  );
  return (
    <span className={warningClass(remote.classification)}>{detail}</span>
  );
}

function PackageRow({ row }: { row: StackPackageRow }) {
  return (
    <tr>
      <th scope="row">
        <code>{row.name}</code>
        <small>{row.declared}</small>
        {row.note && <small>{row.note}</small>}
      </th>
      <td>{row.installed ?? "Not installed"}</td>
      <td>{row.deployed ?? "Unknown"}</td>
      <td>{row.latestTested ?? "Not recorded"}</td>
      <td>
        {row.remote.state === "available"
          ? row.remote.latest ?? "Unknown"
          : "Unknown"}
      </td>
      <td>
        <span className={warningClass(row.status)}>
          {packageStatusLabels[row.status]}
        </span>
      </td>
      <td>
        <RemoteSignal remote={row.remote} />
      </td>
    </tr>
  );
}

export function StackStatusPage() {
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
          "/_emdash/api/plugins/composer-stacks/stackStatusRead",
          { cache: "no-store", signal: controller.signal },
        );
        const raw = await parseApiResponse<unknown>(
          response,
          "Stack status is unavailable. Sign in as an administrator and try again.",
        );
        const parsed = reportSchema.parse(raw);
        if (!controller.signal.aborted) setReport(parsed);
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Stack status could not be loaded. No installed, deployed or registry comparison is available. Try again, or run the local freshness command from the reviewed checkout.",
          );
      }
    })();
    return () => controller.abort();
  }, [generation]);
  const snapshot = report?.snapshot;
  return (
    <section
      className="composer-stack-status"
      aria-labelledby="stack-status-title"
    >
      <header>
        <h1 id="stack-status-title">Stack status</h1>
        <p>
          What this build installs, what the deployed Worker serves, and what
          the reviewed policy has actually tested. Updates are not installed
          here.
        </p>
        <p>Composer production · administrator-only · read-only</p>
      </header>
      {!report && !error && (
        <p role="status">Loading the generated stack snapshot…</p>
      )}
      {error && (
        <div role="alert" className="ss-error">
          <p>{error}</p>
          <button onClick={() => setGeneration((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {snapshot && (
        <>
          <div className={`ss-summary ${warningClass(snapshot.status)}`}>
            <strong>{statusLabels[snapshot.status]}</strong>
            <p>
              {snapshot.blockers.length
                ? `${snapshot.blockers.length} item(s) need a decision.`
                : "No security, unsupported or breaking-major item is recorded."}
            </p>
          </div>
          <dl className="ss-facts">
            <div>
              <dt>Deployed source</dt>
              <dd>
                <a
                  href={`https://github.com/loftwah/app-composer/commit/${snapshot.deployed.commit}`}
                >
                  <code>{snapshot.deployed.commit.slice(0, 12)}</code>
                </a>{" "}
                · {utc(snapshot.deployed.sourceCommittedAt)}
              </dd>
            </div>
            <div>
              <dt>Policy reviewed</dt>
              <dd>{snapshot.review.date ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Snapshot generated</dt>
              <dd>{utc(snapshot.generatedAt)}</dd>
            </div>
            <div>
              <dt>Registry comparison</dt>
              <dd>
                {snapshot.remote.state === "available" ? (
                  <>
                    Checked {utc(snapshot.remote.checkedAt)} ·{" "}
                    {snapshot.remote.ageDays ?? 0} day(s) old ·{" "}
                    <code>{snapshot.remote.registry}</code>
                  </>
                ) : (
                  <span className="ss-attention">
                    Unknown — {snapshot.remote.reason}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Worker version</dt>
              <dd>
                Recorded in the release receipt, not inferred from the build.{" "}
                {snapshot.deployed.note}
              </dd>
            </div>
          </dl>
          {snapshot.blockers.length > 0 && (
            <section className="ss-blockers" aria-labelledby="ss-blockers-title">
              <h2 id="ss-blockers-title">What needs attention</h2>
              <p>
                These are the only conditions raised as blockers. A newer patch
                or minor release is shown in the table without becoming a
                warning.
              </p>
              <ul>
                {snapshot.blockers.map((blocker, index) => (
                  <li
                    key={`${blocker.kind}-${blocker.name}-${index}`}
                    className={warningClass(blocker.kind)}
                  >
                    <strong>
                      {blocker.name} · {blocker.kind}
                    </strong>
                    <p>{blocker.detail}</p>
                    {blocker.url && <a href={blocker.url}>Open the advisory</a>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="ss-runtime-title">
            <h2 id="ss-runtime-title">Runtime policy</h2>
            <div className="ss-table-wrap">
              <table>
                <caption>
                  Installed or declared runtime against the reviewed policy.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Runtime</th>
                    <th scope="col">Installed / declared</th>
                    <th scope="col">Reviewed policy</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.runtime.map((row) => (
                    <tr key={row.name}>
                      <th scope="row">{row.name}</th>
                      <td>{row.installed ?? "Unknown"}</td>
                      <td>
                        <code>{row.policy}</code>
                      </td>
                      <td>
                        <span className={warningClass(row.status)}>
                          {packageStatusLabels[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby="ss-packages-title">
            <h2 id="ss-packages-title">Dependencies</h2>
            <p>
              <strong>Installed</strong> is this checkout’s local
              <code>node_modules</code>. <strong>Deployed</strong> is the
              lockfile resolved into this Worker build.{" "}
              <strong>Latest tested</strong> is the version recorded in the
              reviewed policy, not a claim about the newest release.{" "}
              <strong>Available</strong> comes only from the dated registry
              report; when that check is unknown, no latest version is invented.
            </p>
            <div className="ss-table-wrap">
              <table>
                <caption>
                  Declared dependencies: installed, deployed, reviewed and
                  registry-observed versions.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Package</th>
                    <th scope="col">Installed</th>
                    <th scope="col">Deployed</th>
                    <th scope="col">Latest tested</th>
                    <th scope="col">Available</th>
                    <th scope="col">Policy</th>
                    <th scope="col">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.packages.map((row) => (
                    <PackageRow key={row.name} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="ss-boundary" aria-labelledby="ss-boundary-title">
            <h2 id="ss-boundary-title">What this page does not do</h2>
            <p>
              It does not install, update, deploy, change a pin or call the
              registry. The registry report is a separate opt-in local command:
            </p>
            <pre>
              node scripts/freshness.mjs --remote --write
              config/dependency-remote.json
            </pre>
            <p>
              Review and commit that snapshot before the next release. A stale
              or missing report stays <strong>Unknown</strong> with the reason
              shown above. The local <code>pnpm freshness</code> command remains
              offline and unchanged. No credentials or project data are sent;
              only public package names and locked versions.
            </p>
          </section>
        </>
      )}
    </section>
  );
}
