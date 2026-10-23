import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import {
  outcomeCall,
  publicOutcomeCall,
  filtersFromSearch,
  type Filters,
  type ReportReply,
  type OutcomeMetric,
} from "./outcomes/api";
import type { FrozenReport } from "../lib/public-report";
import { useNavigationGuard } from "./stacks/use-navigation-guard";
import { workspaceSelection } from "./stacks/workspace-scope";
import "./outcomes.css";

const quantity = (n: number | null) =>
  n === null ? "Unavailable" : n.toLocaleString("en-AU");
const dayLabel = (day: string) =>
  new Date(day + "T00:00:00Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const quality = {
  unavailable: "No retained observation in this scope",
  partial: "Partial recorded lower bound",
  bounded: "Recorded lower bound",
  retained: "Retained records, not an action log",
};
function Timeline({ metric }: { metric: OutcomeMetric }) {
  const [day, setDay] = useState(metric.daily.length - 1);
  const figure = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    if (!figure.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(
        Math.max(220, Math.min(700, Math.floor(entries[0].contentRect.width))),
      ),
    );
    observer.observe(figure.current);
    return () => observer.disconnect();
  }, []);
  const index = Math.min(day, metric.daily.length - 1),
    point = metric.daily[index];
  const maximum = Math.max(1, ...metric.daily.map((value) => value.value ?? 0));
  const step = (width - 80) / metric.daily.length;
  return (
    <figure className="co-timeline" ref={figure}>
      <figcaption>
        {metric.label} <span>· daily, UTC</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} 250`}
        role="img"
        aria-label={`${metric.label}: ${quantity(metric.value)}. Daily values are available in the table below.`}
      >
        <line className="co-axis" x1="52" y1="210" x2={width - 20} y2="210" />
        <line className="co-grid" x1="52" y1="34" x2={width - 20} y2="34" />
        <text className="co-axis-label" x="42" y="39" textAnchor="end">
          {new Intl.NumberFormat("en-AU", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(maximum)}
        </text>
        <text className="co-axis-label" x="42" y="213" textAnchor="end">
          0
        </text>
        {metric.daily.map((value, i) => (
          <g
            key={value.date}
            className={i === index ? "co-day co-day-selected" : "co-day"}
          >
            {value.value === null ? (
              <path
                className="co-gap"
                d={`M${58 + i * step} 200l${Math.max(3, step - 9)} -7`}
              />
            ) : value.value === 0 ? (
              <circle
                className="co-zero"
                cx={56 + i * step + step / 2}
                cy="210"
                r="2.5"
              />
            ) : (
              <rect
                className="co-bar"
                x={56 + i * step}
                y={210 - (value.value / maximum) * 176}
                width={Math.max(3, step - 7)}
                height={(value.value / maximum) * 176}
                rx="2"
              />
            )}
            <title>
              {value.date}: {quantity(value.value)}
            </title>
          </g>
        ))}
        <text className="co-axis-label" x="56" y="239">
          {dayLabel(metric.daily[0].date)}
        </text>
        <text className="co-axis-label" x={width - 22} y="239" textAnchor="end">
          {dayLabel(metric.daily.at(-1)!.date)}
        </text>
      </svg>
      <label className="co-inspector">
        Inspect a day{" "}
        <input
          type="range"
          aria-label="Inspect a day"
          min="0"
          max={metric.daily.length - 1}
          value={index}
          onChange={(event) => setDay(Number(event.target.value))}
          aria-valuetext={`${point.date}: ${quantity(point.value)}`}
        />
        <output aria-live="polite">
          {dayLabel(point.date)}: <strong>{quantity(point.value)}</strong>
        </output>
      </label>
      <p className="co-muted">
        A slash is unavailable history. A dot on zero means no event was
        recorded that day. The first observation and today are partial.
      </p>
    </figure>
  );
}

export function OutcomesPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <WorkspaceOutcomes key={search} search={search} />;
}

function WorkspaceOutcomes({ search }: { search: string }) {
  const initial = filtersFromSearch(search);
  const [filters, setFilters] = useState<Filters>(initial);
  const [snapshot, setSnapshot] = useState<{
    reply: ReportReply;
    filters: Filters;
  }>();
  const [publicPreview, setPublicPreview] = useState<{
    report: FrozenReport;
    filters: Filters;
    workspace: string;
  }>();
  const [publicUrl, setPublicUrl] = useState("");
  const [publicConsent, setPublicConsent] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [metricKey, setMetricKey] = useState("app_open_action");
  const [trafficChoice, setTrafficChoice] = useState<"demo" | "unclassified">(
    "unclassified",
  );
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const pending = useRef(false),
    generation = useRef(0),
    live = useRef(true);
  const setting = snapshot?.reply.setting;
  const dirty = Boolean(setting && setting.traffic !== trafficChoice);
  const applied = snapshot?.filters;
  const changedFilters = Boolean(
    applied && JSON.stringify(filters) !== JSON.stringify(applied),
  );
  useNavigationGuard({
    changed: dirty || uncertain,
    pending: writing,
    onPending: () =>
      setError("Wait for this outcome request to finish before leaving."),
  });
  const load = async (requested: Filters) => {
    if (pending.current) return;
    if (
      dirty &&
      !window.confirm(
        "Refresh this report and discard the unsaved future-traffic choice?",
      )
    )
      return;
    pending.current = true;
    setPublicPreview(undefined);
    setPublicUrl("");
    setPublicConsent(false);
    setBusy(true);
    setError("");
    setMessage("");
    const request = ++generation.current;
    try {
      const workspace =
        snapshot?.reply.workspace.id ?? workspaceSelection(search);
      const raw = await outcomeCall("report", {
        ...requested,
        ...(workspace ? { workspace } : {}),
      });
      if (!live.current || request !== generation.current || !("report" in raw))
        return;
      const reply = raw as ReportReply;
      setSnapshot({ reply, filters: { ...requested } });
      setTrafficChoice(reply.setting?.traffic ?? "unclassified");
      setUncertain(false);
      setFiltersOpen(false);
    } catch (cause) {
      if (live.current && request === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The report is unavailable. This is not a zero count.",
        );
    } finally {
      if (live.current && request === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    live.current = true;
    void load(filtersFromSearch(search));
    return () => {
      live.current = false;
      generation.current++;
      pending.current = false;
    };
  }, []);
  const change = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "stack" ? { instance: "" } : {}),
    }));
  const saveTraffic = async () => {
    if (
      pending.current ||
      !snapshot ||
      !setting ||
      !dirty ||
      uncertain ||
      changedFilters
    )
      return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const submitted = trafficChoice;
    setWriting(true);
    try {
      const raw = await outcomeCall("setTraffic", {
        workspace: snapshot.reply.workspace.id,
        stack: setting.stack,
        expectedRevision: setting.revision,
        traffic: submitted,
      });
      if (!live.current || !("setting" in raw) || !raw.setting) return;
      setSnapshot((current) =>
        current && current.reply.setting?.stack === setting.stack
          ? { ...current, reply: { ...current.reply, setting: raw.setting! } }
          : current,
      );
      setMessage(
        "Future recording classification saved. Existing counts were not rewritten.",
      );
    } catch (cause) {
      if (live.current) {
        setUncertain(true);
        setError(
          (cause instanceof Error
            ? cause.message
            : "The acknowledgement is unavailable.") +
            " Your choice is retained. Refresh to check the saved classification before another write.",
        );
      }
    } finally {
      pending.current = false;
      if (live.current) {
        setBusy(false);
        setWriting(false);
      }
    }
  };
  const download = async () => {
    if (!snapshot || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const raw = await outcomeCall("export", {
        ...snapshot.filters,
        workspace: snapshot.reply.workspace.id,
      });
      if (!live.current || !("export" in raw)) return;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(raw.export, null, 2) + "\n"], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `composer-outcomes-${raw.export.period.from}-${raw.export.period.to}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Aggregate export downloaded for the displayed scope. Its query ran at the export timestamp.",
      );
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The export did not complete.",
        );
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  const shareAggregate = async (publish = false) => {
    if (!snapshot || pending.current || changedFilters || dirty || uncertain)
      return;
    if (publish && (!publicPreview || !publicConsent)) return;
    pending.current = true;
    setBusy(true);
    setWriting(true);
    setError("");
    setMessage("");
    try {
      const fields =
        publish && publicPreview
          ? { ...publicPreview.filters, workspace: publicPreview.workspace }
          : { ...snapshot.filters, workspace: snapshot.reply.workspace.id };
      const result = await publicOutcomeCall(
        publish ? "publishPublicReport" : "previewPublicReport",
        {
          ...fields,
          ...(publish
            ? { expectedReport: publicPreview!.report.id, consent: true }
            : {}),
        },
      );
      if (!live.current) return;
      if (publish) {
        setPublicUrl(result.url!);
        setMessage(
          "The permitted aggregate is now public at the frozen report link.",
        );
      } else {
        setPublicPreview({
          report: result.report,
          filters: { ...snapshot.filters },
          workspace: snapshot.reply.workspace.id,
        });
        setPublicConsent(false);
        setPublicUrl("");
      }
    } catch (cause) {
      if (live.current) {
        setPublicPreview(undefined);
        setPublicConsent(false);
        setError(
          cause instanceof Error
            ? cause.message
            : "The public report did not complete. Preview again before retrying.",
        );
      }
    } finally {
      pending.current = false;
      if (live.current) {
        setBusy(false);
        setWriting(false);
      }
    }
  };
  const report = snapshot?.reply.report,
    metric = report?.metrics.find((value) => value.key === metricKey);
  const stacks = snapshot?.reply.options.stacks ?? [],
    instances = snapshot?.reply.options.instances ?? [];
  return (
    <section className="composer-outcomes" aria-busy={busy}>
      <header className="co-heading">
        <div>
          <h1>Workspace outcomes</h1>
          <p>
            What was recorded, where it happened, and what the evidence can tell
            you.
          </p>
        </div>
        <div className="co-heading-links">
          {snapshot && report?.scope.stack && (
            <a
              href={`/_emdash/admin/plugins/composer-stacks/stacks?workspace=${snapshot.reply.workspace.id}&stack=${report.scope.stack}`}
            >
              Back to this stack
            </a>
          )}
          {snapshot && (
            <a
              href={`/_emdash/admin/plugins/composer-stacks/enquiries?workspace=${snapshot.reply.workspace.id}`}
            >
              Private enquiries
            </a>
          )}
          <a
            href={`/_emdash/admin/plugins/composer-stacks/workspaces${snapshot ? "?workspace=" + snapshot.reply.workspace.id : ""}`}
          >
            Workspace access
          </a>
        </div>
      </header>
      <p className="co-scope">
        {snapshot ? (
          <>
            <strong>{snapshot.reply.workspace.name}</strong> ·{" "}
            {snapshot.reply.workspace.role} access · private to this workspace
          </>
        ) : (
          "Checking workspace membership…"
        )}
      </p>
      <div className="co-report-tools">
        <button
          type="button"
          disabled={busy}
          onClick={() => void load(snapshot?.filters ?? filters)}
        >
          {busy
            ? "Loading…"
            : uncertain
              ? "Check saved classification"
              : "Refresh displayed scope"}
        </button>
      </div>
      {snapshot?.reply.workspace.role === "owner" &&
        report?.scope.stack &&
        report.scope.instance && (
          <section
            className="co-public-story"
            aria-labelledby="co-public-story-title"
          >
            <h2 id="co-public-story-title">
              Share a permitted Open-action aggregate
            </h2>
            <p>
              Preview the exact counts, dates and traffic classification.
              Publication excludes workspace names, instance labels, record
              bodies and private scope identifiers.
            </p>
            <button
              type="button"
              disabled={busy || changedFilters || dirty || uncertain}
              onClick={() => void shareAggregate()}
            >
              Preview public aggregate
            </button>
            {publicPreview && (
              <div>
                <h3>{publicPreview.report.headline}</h3>
                <p>
                  {publicPreview.report.value} {publicPreview.report.unit} ·{" "}
                  {publicPreview.report.period.from} to{" "}
                  {publicPreview.report.period.to} UTC ·{" "}
                  {publicPreview.report.origin?.traffic} traffic
                </p>
                <p>{publicPreview.report.detail}</p>
                <p>
                  {publicPreview.report.coverage.quality} recorded lower bound.
                  Daily values, coverage and source revision are included.
                </p>
                <details>
                  <summary>Inspect the exact public snapshot</summary>
                  <pre
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {JSON.stringify(publicPreview.report, null, 2)}
                  </pre>
                </details>
                {!publicUrl && (
                  <>
                    <label>
                      <input
                        type="checkbox"
                        checked={publicConsent}
                        disabled={busy}
                        onChange={(event) =>
                          setPublicConsent(event.target.checked)
                        }
                      />{" "}
                      I permit this aggregate to become public.
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !publicConsent ||
                        changedFilters ||
                        dirty ||
                        uncertain
                      }
                      onClick={() => void shareAggregate(true)}
                    >
                      Publish permitted report
                    </button>
                  </>
                )}
              </div>
            )}
            {publicUrl && (
              <p>
                <a href={publicUrl}>Open the frozen public report</a>
              </p>
            )}
          </section>
        )}
      <details
        className="co-filter-drawer"
        open={filtersOpen}
        onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
      >
        <summary>Choose a stack, period or traffic</summary>
        <form
          className="co-filters"
          onSubmit={(event) => {
            event.preventDefault();
            void load(filters);
          }}
        >
          <label>
            Stack
            <select
              aria-label="Stack"
              value={filters.stack}
              disabled={busy}
              onChange={(event) => change("stack", event.target.value)}
            >
              <option value="">All workspace stacks</option>
              {stacks.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.name} · {value.status}
                </option>
              ))}
            </select>
          </label>
          <label>
            App instance
            <select
              aria-label="App instance"
              value={filters.instance}
              disabled={
                busy || !filters.stack || filters.stack !== applied?.stack
              }
              onChange={(event) => change("instance", event.target.value)}
            >
              <option value="">All instances</option>
              {instances.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.label} · {value.app}
                </option>
              ))}
            </select>
          </label>
          <label>
            Window
            <select
              aria-label="Window"
              value={filters.days}
              disabled={busy}
              onChange={(event) =>
                change("days", event.target.value as Filters["days"])
              }
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <label>
            Through
            <select
              aria-label="Through"
              value={filters.end}
              disabled={busy}
              onChange={(event) =>
                change("end", event.target.value as Filters["end"])
              }
            >
              <option value="today">Today · partial</option>
              <option value="yesterday">Yesterday · complete UTC days</option>
            </select>
          </label>
          <label>
            Recorded traffic
            <select
              aria-label="Recorded traffic"
              value={filters.traffic}
              disabled={busy}
              onChange={(event) =>
                change("traffic", event.target.value as Filters["traffic"])
              }
            >
              <option value="unclassified">Unclassified</option>
              <option value="demo">Declared demonstration</option>
              <option value="all">Both classifications</option>
            </select>
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Loading…" : "Apply filters"}
          </button>
        </form>
      </details>
      {error && (
        <p className="co-error" role="alert">
          {error}
          {report &&
            " The previous report remains below with its original scope."}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {report && (
        <>
          <div className="co-period">
            <h2>
              {dayLabel(report.period.from)}–{dayLabel(report.period.to)}{" "}
              <span>UTC</span>
            </h2>
            <button
              type="button"
              disabled={busy}
              onClick={() => void download()}
            >
              Export displayed scope
            </button>
          </div>
          <p className="co-muted">
            {report.scope.stack
              ? (stacks.find((value) => value.id === report.scope.stack)
                  ?.name ?? report.scope.stack)
              : "All workspace stacks"}
            {report.scope.instance
              ? ` / ${instances.find((value) => value.id === report.scope.instance)?.label ?? report.scope.instance}`
              : " / all instances"}{" "}
            ·{" "}
            {report.traffic === "demo"
              ? "declared demonstrations"
              : report.traffic === "all"
                ? "both traffic classifications"
                : "unclassified traffic"}
            . Updated{" "}
            {new Date(report.generatedAt).toLocaleString("en-AU", {
              timeZone: "UTC",
            })}{" "}
            UTC.{changedFilters && " Filters above have not been applied."}
          </p>
          <div
            className="co-signals"
            role="group"
            aria-label="Choose one outcome signal"
          >
            {report.metrics.map((value) => (
              <button
                type="button"
                key={value.key}
                aria-pressed={metricKey === value.key}
                onClick={() => setMetricKey(value.key)}
              >
                <span>{value.label}</span>
                <strong>{quantity(value.value)}</strong>
                <small>{quality[value.quality]}</small>
              </button>
            ))}
          </div>
          {metric && (
            <div className="co-analysis">
              <div>
                <Timeline
                  key={`${metric.key}:${report.period.from}`}
                  metric={metric}
                />
                <details className="co-table">
                  <summary>Daily values as a table</summary>
                  <table>
                    <caption>{metric.label} · UTC</caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Recorded count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metric.daily.map((value) => (
                        <tr key={value.date}>
                          <th scope="row">{value.date}</th>
                          <td>{quantity(value.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>
              <aside className="co-definition">
                <h3>Read this signal</h3>
                <p>{metric.definition}</p>
                <p>
                  <strong>{quality[metric.quality]}.</strong>
                  {metric.firstObserved &&
                    ` First retained observation: ${metric.firstObserved}.`}
                </p>
                {metric.key === "retained_snapshots" && (
                  <p>
                    The traffic filter does not classify these historical
                    records.
                  </p>
                )}
                <h3>Previous window</h3>
                <p>
                  {report.previous.from}–{report.previous.to}:{" "}
                  <strong>{quantity(metric.previous)}</strong>
                </p>
                <p>
                  {metric.delta === null
                    ? "A change comparison is unavailable until both UTC windows have covered history."
                    : `${metric.delta > 0 ? "+" : ""}${metric.delta} recorded difference${metric.percent === null ? "; percentage unavailable with a zero previous count" : ` (${metric.percent > 0 ? "+" : ""}${metric.percent}%)`}.`}
                </p>
              </aside>
            </div>
          )}
          <section className="co-section">
            <h2>Where recorded actions happened</h2>
            <p>
              Up to {report.limits.targetRows} instance/signal rows. These are
              counts, not a conversion path.
            </p>
            {report.targets.length ? (
              <div className="co-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Stack / instance</th>
                      <th scope="col">Signal</th>
                      <th scope="col">Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.targets.map((value) => (
                      <tr
                        key={`${value.stack}:${value.instance}:${value.event}`}
                      >
                        <th scope="row">
                          {stacks.find((item) => item.id === value.stack)
                            ?.name ?? value.stack}
                          <small>
                            {instances.find(
                              (item) => item.id === value.instance,
                            )?.label ?? value.instance}
                          </small>
                        </th>
                        <td>
                          {
                            report.metrics.find(
                              (item) => item.key === value.event,
                            )?.label
                          }
                        </td>
                        <td>{quantity(value.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                No recorded action rows are retained for this selection. Missing
                history is not a measured zero.
              </p>
            )}
          </section>
          {setting && snapshot.reply.workspace.role === "owner" && (
            <section className="co-section co-classification">
              <h2>Classify future recording</h2>
              <p>
                For{" "}
                <strong>
                  {stacks.find((value) => value.id === setting.stack)?.name ??
                    setting.stack}
                </strong>{" "}
                only. Choose demonstration for deliberate tests or release
                exercises. Earlier activity stays as recorded; unclassified does
                not mean customer demand.
              </p>
              <label>
                Future traffic
                <select
                  aria-label="Future traffic"
                  value={trafficChoice}
                  disabled={busy || changedFilters}
                  onChange={(event) =>
                    setTrafficChoice(event.target.value as typeof trafficChoice)
                  }
                >
                  <option value="unclassified">Unclassified</option>
                  <option value="demo">Declared demonstration</option>
                </select>
              </label>
              <button
                type="button"
                disabled={busy || !dirty || uncertain || changedFilters}
                onClick={() => void saveTraffic()}
              >
                Save future classification
              </button>
              {dirty && <p>Your unsaved choice is retained here.</p>}
              {uncertain && (
                <p>
                  Refresh this report to reconcile the saved classification
                  before another change.
                </p>
              )}
            </section>
          )}
          <section className="co-section co-next">
            <h2>Next useful action</h2>
            <p>
              The report shows recorded activity. Use the existing owner
              surfaces to inspect the records, change the stack or compare the
              public aggregate.
            </p>
            <div className="co-actions">
              {report.scope.stack && (
                <a
                  className="button secondary"
                  href={`/_emdash/admin/plugins/composer-stacks/stacks?workspace=${snapshot.reply.workspace.id}&stack=${report.scope.stack}`}
                >
                  Open the stack context
                </a>
              )}
              <a
                className="button secondary"
                href={`/_emdash/admin/plugins/composer-stacks/enquiries?workspace=${snapshot.reply.workspace.id}`}
              >
                Review private enquiries
              </a>
              <a
                className="button secondary"
                href={`/activity?days=${report.period.days}`}
              >
                Compare public activity
              </a>
            </div>
            <p className="co-muted">
              A reviewed enquiry is an owner decision, not a sale, reply or
              customer acquisition. Public activity uses a separate aggregate
              and cannot be attributed to this workspace.
            </p>
          </section>
          <section className="co-section">
            <h2>Evidence and limits</h2>
            <p>
              These are retained action counts. Missing history is not a
              measured zero, and demonstration traffic is separate from
              unclassified activity.
            </p>
            <details>
              <summary>How these numbers work</summary>
              <ul>
                {report.limits.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p>
                Action aggregates and idempotency receipts expire after{" "}
                {report.limits.retentionDays} UTC days. At most{" "}
                {report.limits.dailyCap} new outcomes per stack/day are
                retained. Navigation and moderation keep working when recording
                is unavailable.
              </p>
              <h3>Unavailable measures</h3>
              <dl>
                {report.unavailable.map((value) => (
                  <div key={value.key}>
                    <dt>{value.label}</dt>
                    <dd>{value.reason}</dd>
                  </div>
                ))}
              </dl>
              <p>
                <a href="/activity">Public activity</a> uses its own public
                aggregate definitions; it is not workspace attribution.
              </p>
            </details>
          </section>
        </>
      )}
    </section>
  );
}
