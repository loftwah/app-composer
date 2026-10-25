import type {
  ProviderCheck,
  ProviderComparisonView,
} from "../lib/provider-inventory-contract";

const CLOUD_STATE: Record<ProviderCheck["state"], string> = {
  verified: "Verified read",
  partial: "Partly read",
  inaccessible: "Could not read",
  unconfigured: "Not configured",
};
const CLOUD_COMPARISON: Record<ProviderComparisonView["state"], string> = {
  match: "Match",
  drift: "Differs",
  missing: "Missing",
  unverified: "Unverified",
  inaccessible: "Inaccessible",
  stale: "Check is old",
  untracked: "Not declared",
};

/**
 * The on-demand Cloudflare panel. It is deliberately presentational: the page
 * owns the two explicit actions, and this component offers no destructive
 * control, background task or automatic check.
 */
export function ProviderCheckPanel({
  check,
  busy,
  error,
  imported,
  disabled,
  onCheck,
  onImport,
}: {
  check: ProviderCheck | undefined;
  busy: boolean;
  error: string;
  imported: boolean;
  disabled: boolean;
  onCheck: () => void;
  onImport: (file: File | undefined) => void;
}) {
  const attention =
    check?.findings.filter((finding) => finding.severity === "attention") ?? [];
  const primary = attention[0];
  const others = check?.findings.filter((finding) => finding !== primary) ?? [];
  return (
    <section
      className="ri-cloud"
      aria-labelledby="ri-cloud-title"
      aria-busy={busy}
    >
      <div className="ri-heading">
        <div>
          <h2 id="ri-cloud-title">Cloudflare check</h2>
          <p>
            Compare Composer’s declared resources with a live, read-only
            Cloudflare observation. Every provider request is a GET. Nothing is
            created, changed, tagged, deployed or deleted.
          </p>
        </div>
        <strong className="ri-cloud-badge">
          {check ? CLOUD_STATE[check.state] : "Not checked"}
        </strong>
      </div>
      <div className="ri-cloud-actions">
        <button type="button" disabled={busy || disabled} onClick={onCheck}>
          {busy ? "Checking Cloudflare…" : "Check Cloudflare now"}
        </button>
        <label className="ri-file">
          <span>Import a local check</span>
          <input
            type="file"
            accept="application/json,.json"
            aria-describedby="ri-cloud-import-help"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              onImport(file);
            }}
          />
        </label>
      </div>
      <p className="ri-muted" id="ri-cloud-import-help">
        The check does not run on page load and there is no polling. If this
        deployment has no read-only Cloudflare credential, run{" "}
        <code>node scripts/provider-inventory.mjs compare</code> locally and
        import the bounded compare JSON. An imported file is displayed only; it
        is not saved and grants no authority.
      </p>
      <p className="ri-status" role="status">
        {busy ? "Reading the allowlisted Cloudflare endpoints…" : ""}
      </p>
      {error && (
        <p className="ri-error" role="alert">
          {error}
        </p>
      )}
      {!check && !busy && !error && (
        <p className="ri-muted">
          Nothing has been read. Check Cloudflare now, or import a local check.
        </p>
      )}
      {check && (
        <>
          <p className="ri-cloud-observation">
            {imported
              ? "Imported local check · not a live read from this page"
              : check.endpoints.length === 0 || check.observedAt === null
                ? "Composer route response · no provider request"
                : "Live read from this deployment"}
            {check.observation && (
              <>
                {" "}
                · observed {check.observation.utc} (
                {check.observation.melbourne})
              </>
            )}
            {check.account && (
              <>
                {" "}
                · account <code>{check.account}</code>
              </>
            )}
            {check.expectedRevision && (
              <>
                {" "}
                · expected source{" "}
                <code>{check.expectedRevision.slice(0, 12)}</code>
              </>
            )}
          </p>
          <dl className="ri-counts" aria-label="Cloudflare check counts">
            <div>
              <dt>Expected</dt>
              <dd>{check.counts.expected}</dd>
            </div>
            <div>
              <dt>Observed</dt>
              <dd>{check.counts.observed}</dd>
            </div>
            <div>
              <dt>Match</dt>
              <dd>{check.counts.match}</dd>
            </div>
            <div>
              <dt>Differs</dt>
              <dd>{check.counts.drift}</dd>
            </div>
            <div>
              <dt>Missing</dt>
              <dd>{check.counts.missing}</dd>
            </div>
            <div>
              <dt>Unverified</dt>
              <dd>{check.counts.unverified}</dd>
            </div>
            <div>
              <dt>Inaccessible</dt>
              <dd>{check.counts.inaccessible}</dd>
            </div>
            <div>
              <dt>Not declared</dt>
              <dd>{check.counts.untracked}</dd>
            </div>
            <div>
              <dt>Needs attention</dt>
              <dd>{check.counts.attention}</dd>
            </div>
          </dl>
          {primary ? (
            <section
              className="ri-cloud-attention"
              aria-labelledby="ri-cloud-attention-title"
            >
              <h3 id="ri-cloud-attention-title">Needs attention</h3>
              <p className="ri-finding ri-finding-attention">
                <strong>{primary.title}</strong> {primary.detail}
              </p>
            </section>
          ) : (
            <p className="ri-muted">
              No provider finding needs attention in this observation. An
              unverified field still stays unverified.
            </p>
          )}
          {others.length > 0 && (
            <details className="ri-cloud-other">
              <summary>
                Other observations ({others.length}) · not a clean bill of
                health
              </summary>
              <ul className="ri-findings">
                {others.map((finding) => (
                  <li
                    key={finding.code}
                    className={"ri-finding ri-finding-" + finding.severity}
                  >
                    <strong>{finding.title}</strong>
                    <p>{finding.detail}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div
            className="ri-table ri-cloud-table"
            role="region"
            aria-label="Cloudflare expected and observed resources"
            tabIndex={0}
          >
            <table>
              <caption>
                {check.comparisons.length} declared or first-party resource(s) ·
                cost is unknown for every row, never zero
              </caption>
              <thead>
                <tr>
                  <th scope="col">Resource</th>
                  <th scope="col">Expected</th>
                  <th scope="col">Observed</th>
                  <th scope="col">State</th>
                  <th scope="col">Cost</th>
                </tr>
              </thead>
              <tbody>
                {check.comparisons.map((item) => (
                  <tr key={item.kind + ":" + item.name}>
                    <th scope="row">
                      {item.name}
                      <span className="ri-muted"> · {item.kind}</span>
                      <span className="ri-cloud-detail">{item.detail}</span>
                      <span className="ri-cloud-detail">
                        Tags:{" "}
                        {
                          {
                            match: "match",
                            partial: "partly differ",
                            mismatch: "do not match",
                            unverified: "not verified",
                          }[item.tags.state]
                        }
                        {item.tags.missing.length > 0
                          ? " · missing " + item.tags.missing.join(", ")
                          : ""}
                      </span>
                    </th>
                    <td>
                      <code>{item.expectedId ?? item.expectedSource}</code>
                    </td>
                    <td>
                      <code>{item.observedId ?? "Not observed"}</code>
                    </td>
                    <td>
                      <span
                        className={
                          "ri-cloud-state ri-cloud-state-" + item.state
                        }
                      >
                        {CLOUD_COMPARISON[item.state]}
                      </span>
                    </td>
                    <td>Unknown</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="ri-cloud-other">
            <summary>
              {check.endpoints.length} provider request(s) · all GET
            </summary>
            {check.endpoints.length === 0 ? (
              <p className="ri-muted">No provider request was made.</p>
            ) : (
              <div
                className="ri-table"
                role="region"
                aria-label="Provider requests"
                tabIndex={0}
              >
                <table>
                  <caption>
                    Allowlisted read requests and their outcome. No other path
                    is requested.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Path</th>
                      <th scope="col">State</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.endpoints.map((endpoint) => (
                      <tr key={endpoint.path}>
                        <th scope="row">
                          <code>{endpoint.path}</code>
                          {endpoint.message && (
                            <span className="ri-cloud-detail">
                              {endpoint.message}
                            </span>
                          )}
                        </th>
                        <td>{endpoint.state}</td>
                        <td>{endpoint.status ?? "Not read"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
          <details className="ri-cloud-other">
            <summary>Limits, unknowns and the cost boundary</summary>
            <ul className="ri-bindings">
              {check.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
            <p className="ri-muted">{check.cost.note}</p>
          </details>
          <p className="ri-boundary">{check.note}</p>
        </>
      )}
    </section>
  );
}
