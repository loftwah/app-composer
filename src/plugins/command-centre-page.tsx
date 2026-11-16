import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  commandCentreReport,
  utcClock,
  type CommandCentreForecast,
  type CommandCentreForecastObservations,
  type CommandCentreHistoryItem,
  type CommandCentreIssueReference,
  type CommandCentrePlanItem,
  type CommandCentreReport,
  type CommandCentreRepo,
  type CommandCentreUnknownSection,
} from "../lib/command-centre-contract";
import "./command-centre-page.css";

const base = "/_emdash/api/plugins/composer-stacks/commandCentreRead";

// The page uses EmDash's apiFetch and parseApiResponse so the request carries
// `X-EmDash-Request: 1` and the `{ success, data }` envelope is unwrapped before
// the contract validates the report.
export async function loadCommandCentre(
  repo: string,
  signal: AbortSignal,
): Promise<CommandCentreReport> {
  const response = await apiFetch(
    base + (repo ? "?repo=" + encodeURIComponent(repo) : ""),
    { cache: "no-store", signal },
  );
  const raw = await parseApiResponse<unknown>(
    response,
    "The command centre is unavailable. Sign in as a creator and try again.",
  );
  const parsed = commandCentreReport.safeParse(raw);
  if (!parsed.success)
    throw new Error("The command centre returned an unexpected shape.");
  return parsed.data;
}

function stamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "an unreadable time";
  return new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function dayStamp(value: string | null) {
  if (!value) return "an unreadable date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "an unreadable date";
  return new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function Unknown({
  section,
  checkedAt,
}: {
  section: CommandCentreUnknownSection;
  checkedAt: string;
}) {
  return (
    <p className="cc-unknown" data-state="unknown">
      <strong>Unknown</strong> — checked at {utcClock(checkedAt)} UTC.{" "}
      {section.reason}
    </p>
  );
}

function CountStat({
  label,
  value,
  checkedAt,
  href,
  note,
}: {
  label: string;
  value: CommandCentreRepo["issues"]["count"];
  checkedAt: string;
  href: string;
  note?: string;
}) {
  return (
    <article className="cc-stat" data-state={value.state}>
      <p className="cc-stat-label">{label}</p>
      {value.state === "ok" ? (
        <p className="cc-stat-value">
          <a href={href} rel="noreferrer noopener" target="_blank">
            {value.value}
          </a>
        </p>
      ) : (
        <Unknown section={value} checkedAt={checkedAt} />
      )}
      {note && <p className="cc-stat-note">{note}</p>}
    </article>
  );
}

function ReleaseStat({
  section,
  checkedAt,
}: {
  section: CommandCentreRepo["release"];
  checkedAt: string;
}) {
  return (
    <article className="cc-stat" data-state={section.state}>
      <p className="cc-stat-label">Latest release</p>
      {section.state === "unknown" ? (
        <Unknown section={section} checkedAt={checkedAt} />
      ) : section.latest ? (
        <>
          <p className="cc-stat-value">
            <a
              href={section.latest.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              {section.latest.tag}
            </a>
          </p>
          <p className="cc-stat-note">
            {section.latest.prerelease ? "Pre-release · " : ""}
            {section.latest.publishedAt
              ? `Published ${stamp(section.latest.publishedAt)}`
              : "The source recorded no publication date."}
          </p>
        </>
      ) : (
        <p className="cc-stat-none">No release recorded</p>
      )}
    </article>
  );
}

function CommitStat({
  section,
  repo,
  checkedAt,
}: {
  section: CommandCentreRepo["commit"];
  repo: CommandCentreRepo;
  checkedAt: string;
}) {
  return (
    <article className="cc-stat" data-state={section.state}>
      <p className="cc-stat-label">Latest commit</p>
      {section.state === "unknown" ? (
        <Unknown section={section} checkedAt={checkedAt} />
      ) : section.latest ? (
        <>
          <p className="cc-stat-value cc-sha">
            <a
              href={section.latest.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              {section.latest.sha.slice(0, 12)}
            </a>
          </p>
          <p className="cc-stat-note">
            {repo.defaultBranch ?? "Default branch"} ·{" "}
            {stamp(section.latest.committedAt)}
          </p>
        </>
      ) : (
        <p className="cc-stat-none">No commit reported</p>
      )}
    </article>
  );
}

function CopyLink({ url, label = "Copy link" }: { url: string; label?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <span className="cc-copy-wrap">
      <button
        type="button"
        className="cc-copy"
        onClick={() => {
          void (async () => {
            try {
              await navigator.clipboard.writeText(url);
              setStatus("copied");
            } catch {
              setStatus("failed");
            }
          })();
        }}
      >
        {status === "copied" ? "Copied" : label}
      </button>
      <span className="cc-copy-status" role="status" aria-live="polite">
        {status === "copied"
          ? "Link copied to the clipboard."
          : status === "failed"
            ? "Copy was blocked. Open the link instead."
            : ""}
      </span>
    </span>
  );
}

function BlockedSection({
  section,
  checkedAt,
}: {
  section: CommandCentreRepo["blocked"];
  checkedAt: string;
}) {
  return (
    <section className="cc-section" aria-labelledby="cc-blocked-title">
      <div className="cc-section-head">
        <h3 id="cc-blocked-title">Blocked and needs attention</h3>
        <p className="cc-bounded">Real source labels only</p>
      </div>
      {section.state === "unknown" ? (
        <Unknown section={section} checkedAt={checkedAt} />
      ) : section.state === "ok" && section.labels.length === 0 ? (
        <p className="cc-none" data-state="none">
          None — this repository defines no blocked or needs-attention label.
        </p>
      ) : (
        <ul className="cc-blocked-list">
          {section.labels.map((label) => (
            <li key={label.name}>
              <code>{label.name}</code>
              <span>
                {label.count} open issue{label.count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentIssues({
  repo,
  checkedAt,
}: {
  repo: CommandCentreRepo;
  checkedAt: string;
}) {
  const recent = repo.issues.recent;
  const count = repo.issues.count;
  return (
    <section className="cc-section" aria-labelledby="cc-recent-title">
      <div className="cc-section-head">
        <h3 id="cc-recent-title">Recently updated open issues</h3>
        {recent.state === "ok" && (
          <p className="cc-bounded">
            Up to five · one page of {recent.scanned} open items
          </p>
        )}
      </div>
      {recent.state === "unknown" ? (
        <Unknown section={recent} checkedAt={checkedAt} />
      ) : recent.items.length > 0 ? (
        <ol className="cc-issues">
          {recent.items.map((issue) => (
            <li key={issue.number}>
              <p className="cc-issue-title">
                <a href={issue.url} rel="noreferrer noopener" target="_blank">
                  <span className="cc-issue-number">#{issue.number}</span>{" "}
                  {issue.title}
                </a>
              </p>
              <p className="cc-issue-meta">
                Updated {stamp(issue.updatedAt)}
                {issue.reopened ? " · reopened" : ""}
              </p>
              {issue.labels.length > 0 && (
                <ul className="cc-labels" aria-label="Issue labels">
                  {issue.labels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : count.state === "ok" && count.value === 0 ? (
        <div className="cc-empty" data-state="empty">
          <p>
            <strong>No open issues.</strong> The source reported no open issues
            for this repository at {stamp(checkedAt)}.
          </p>
          {repo.links.newIssue && (
            <p>
              <a
                href={repo.links.newIssue}
                rel="noreferrer noopener"
                target="_blank"
              >
                Open the issue chooser
              </a>{" "}
              to start the first one.
            </p>
          )}
        </div>
      ) : (
        <p className="cc-none" data-state="none">
          No open issue appeared in the bounded window.{" "}
          {recent.complete
            ? "This read found no incoming issues."
            : "This is not a claim that nothing is open; the window was full of pull requests."}
        </p>
      )}
      {recent.state === "ok" && !recent.complete && recent.items.length > 0 && (
        <p className="cc-hint">
          The 100-item window was full, so only the five most recently updated
          issues are shown.
        </p>
      )}
    </section>
  );
}

function referenceLabel(reference: CommandCentreIssueReference, repo: string) {
  const title = reference.title ? ` — ${reference.title}` : "";
  return `${reference.repository === repo ? `#${reference.number}` : `${reference.repository}#${reference.number}`}${title}`;
}

function ReferenceLink({
  reference,
  repo,
}: {
  reference: CommandCentreIssueReference;
  repo: string;
}) {
  const label = referenceLabel(reference, repo);
  if (!reference.url) return <code>{label}</code>;
  return (
    <a href={reference.url} rel="noreferrer noopener" target="_blank">
      {label}
    </a>
  );
}

function planRow(
  item: CommandCentrePlanItem,
  repo: string,
): ReactNode {
  const relationships: React.ReactNode[] = [];
  if (item.parent)
    relationships.push(
      <li key="parent">
        <span className="cc-relation-kind">Parent</span>{" "}
        <ReferenceLink reference={item.parent} repo={repo} />
      </li>,
    );
  for (const child of item.children)
    relationships.push(
      <li key={`child-${child.repository}-${child.number}`}>
        <span className="cc-relation-kind">Sub-issue</span>{" "}
        <ReferenceLink reference={child} repo={repo} />
      </li>,
    );
  for (const blocker of item.blockers)
    relationships.push(
      <li key={`blocker-${blocker.repository}-${blocker.number}`}>
        <span className="cc-relation-kind">Blocked by</span>{" "}
        <ReferenceLink reference={blocker} repo={repo} />
      </li>,
    );
  for (const pull of item.pullRequests)
    relationships.push(
      <li key={`pull-${pull.repository}-${pull.number}`}>
        <span className="cc-relation-kind">Pull request</span>{" "}
        <ReferenceLink reference={pull} repo={repo} />{" "}
        <span className="cc-relation-note">state not read</span>
      </li>,
    );

  const blocked = item.blockedByLabel
    ? "Blocked label"
    : item.blockers.length
      ? "Declared blocker"
      : item.reopened
        ? "Reopened"
        : "—";

  return (
    <tr key={item.number}>
      <th scope="row" data-label="Issue">
        <a href={item.url} rel="noreferrer noopener" target="_blank">
          <span className="cc-issue-number">#{item.number}</span> {item.title}
        </a>
        <span className="cc-row-meta">
          Updated {stamp(item.updatedAt)}
          {item.reopened ? " · reopened" : ""}
        </span>
        {item.labels.length > 0 && (
          <span className="cc-row-labels">{item.labels.join(" · ")}</span>
        )}
      </th>
      <td data-label="Milestone">
        {item.milestone ? (
          <>
            {item.milestone.url ? (
              <a
                href={item.milestone.url}
                rel="noreferrer noopener"
                target="_blank"
              >
                {item.milestone.title}
              </a>
            ) : (
              item.milestone.title
            )}
            {item.milestone.dueOn && (
              <span className="cc-row-meta">
                Due {dayStamp(item.milestone.dueOn)}
              </span>
            )}
          </>
        ) : (
          <span className="cc-row-meta">Not recorded</span>
        )}
      </td>
      <td data-label="Relationships">
        {relationships.length > 0 ? (
          <ul className="cc-relations">{relationships}</ul>
        ) : item.linkState === "unknown" ? (
          <span className="cc-row-meta">
            Unknown — the issue body was not read.
          </span>
        ) : (
          <span className="cc-row-meta">
            No explicit parent, sub-issue, blocker or pull-request reference.
          </span>
        )}
      </td>
      <td data-label="Attention">
        <span className="cc-row-meta">{blocked}</span>
      </td>
      <td data-label="Actions">
        <span className="cc-actions">
          <a
            href={item.url}
            rel="noreferrer noopener"
            target="_blank"
            className="cc-action"
          >
            Open issue
          </a>
          {item.pullRequests[0]?.url && (
            <a
              href={item.pullRequests[0].url}
              rel="noreferrer noopener"
              target="_blank"
              className="cc-action"
            >
              Review PR
            </a>
          )}
          <CopyLink url={item.url} />
        </span>
      </td>
    </tr>
  );
}

function PlanLens({ report }: { report: CommandCentreReport }) {
  const repo = report.repo;
  const plan = repo.plan;
  return (
    <section className="cc-section cc-lens" aria-labelledby="cc-plan-title">
      <div className="cc-section-head">
        <h3 id="cc-plan-title">Plan and dependencies</h3>
        {plan.state === "ok" && (
          <p className="cc-bounded">
            {plan.items.length} open items ·{" "}
            {plan.complete ? "complete open-issue sample" : "bounded sample"} ·
            one page of {plan.scanned}
          </p>
        )}
      </div>
      {plan.state === "unknown" ? (
        <Unknown section={plan} checkedAt={repo.checkedAt} />
      ) : plan.items.length === 0 ? (
        plan.complete ? (
          <div className="cc-empty" data-state="empty">
            <p>
              <strong>No open issues.</strong> There is no plan to outline for
              this repository at {stamp(repo.checkedAt)}.
            </p>
            {repo.links.newIssue && (
              <p>
                <a
                  href={repo.links.newIssue}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  Open the issue chooser
                </a>{" "}
                to start the first one.
              </p>
            )}
          </div>
        ) : (
          <p className="cc-none" data-state="none">
            No open issue appeared in the sampled page. The page was bounded, so
            this is not a claim that nothing is open.
          </p>
        )
      ) : (
        <>
          <p className="cc-hint">{plan.relationshipBasis}</p>
          {plan.milestones.length > 0 ? (
            <div className="cc-milestones">
              <h4>Grouped by milestone</h4>
              <ul>
                {plan.milestones.map((milestone) => (
                  <li key={milestone.title}>
                    <span>{milestone.title}</span>
                    <span className="cc-row-meta">
                      {milestone.openIssues} open
                      {milestone.blockedIssues
                        ? ` · ${milestone.blockedIssues} blocked or with a declared blocker`
                        : ""}
                      {milestone.dueOn
                        ? ` · due ${dayStamp(milestone.dueOn)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="cc-hint">
                Grouping only. Order inside a milestone is not a schedule.
              </p>
            </div>
          ) : (
            <p className="cc-none" data-state="none">
              No milestone is recorded on the sampled open issues. This view
              does not invent one.
            </p>
          )}
          {!plan.complete && (
            <p className="cc-hint">
              Only the {plan.items.length} most recently updated open issues
              were sampled; this table is not the whole backlog.
            </p>
          )}
          <div
            className="cc-table-scroll"
            role="region"
            aria-label="Plan table, horizontally scrollable on narrow screens"
            tabIndex={0}
          >
            <table className="cc-table">
              <caption>
                Open issues with explicit milestones, relationships and
                blockers. Pull-request state and native sub-issue fields are not
                read.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Issue</th>
                  <th scope="col">Milestone</th>
                  <th scope="col">Relationships</th>
                  <th scope="col">Attention</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((item) => planRow(item, repo.repository))}
              </tbody>
            </table>
          </div>
          <p className="cc-hint">
            Every relationship above is a link or a declared reference. Nothing
            is promoted into a dependency by prose alone.
          </p>
        </>
      )}
    </section>
  );
}

function observation(value: string | number | null, fallback = "Unknown") {
  return value === null ? fallback : String(value);
}

function Observations({
  observations,
}: {
  observations: CommandCentreForecastObservations;
}) {
  const measuredWindow = observations.windowDays !== null;
  return (
    <dl className="cc-observations">
      <div>
        <dt>Observation window</dt>
        <dd>
          {measuredWindow
            ? `${observations.windowDays} days from ${dayStamp(observations.windowStartsAt)}`
            : "Not enough complete weeks"}
        </dd>
      </div>
      <div>
        <dt>Sampled closed issues</dt>
        <dd>{observation(observations.sampledClosed)}</dd>
      </div>
      <div>
        <dt>Sampled span</dt>
        <dd>
          {observations.sampledSpanDays === null
            ? "Unknown"
            : `${observations.sampledSpanDays} days`}
        </dd>
      </div>
      <div>
        <dt>Closure coverage</dt>
        <dd>
          {observations.windowCoverage === "complete"
            ? "Complete for the measured window"
            : observations.windowCoverage === "partial"
              ? "Partial — more than 100 closed items were recently updated"
              : "Unknown"}
        </dd>
      </div>
      <div>
        <dt>Completed</dt>
        <dd>
          {observation(observations.sampledCompleted)}{" "}
          <span className="cc-observation-note">
            with the source's completed reason
          </span>
        </dd>
      </div>
      <div>
        <dt>Not planned / duplicate</dt>
        <dd>
          {observation(observations.notPlanned)} /{" "}
          {observation(observations.duplicate)}
        </dd>
      </div>
      <div>
        <dt>Unclassified closures</dt>
        <dd>
          {observation(observations.unclassified)}{" "}
          <span className="cc-observation-note">
            no recognised reason; excluded from completed
          </span>
        </dd>
      </div>
      <div>
        <dt>Missing close timestamps</dt>
        <dd>
          {observation(observations.missingTimestamps)}{" "}
          <span className="cc-observation-note">excluded from the rate</span>
        </dd>
      </div>
      <div>
        <dt>Throughput</dt>
        <dd>
          {observations.perWeek === null
            ? "Unknown"
            : `${observations.perWeek} completed per week`}
        </dd>
      </div>
      <div>
        <dt>Median cycle time</dt>
        <dd>
          {observations.medianCycleDays === null
            ? "Unknown — timestamps are missing or fewer than three samples"
            : `${observations.medianCycleDays} days (n=${observations.cycleSample})`}
        </dd>
      </div>
      <div>
        <dt>Open backlog</dt>
        <dd>{observation(observations.backlog)}</dd>
      </div>
      <div>
        <dt>Reopened in sample</dt>
        <dd>
          {observations.reopens === null
            ? "Unknown"
            : observations.reopensComplete === false
              ? `${observations.reopens} observed; the open sample is bounded`
              : observations.reopens}
        </dd>
      </div>
      <div>
        <dt>Bulk closure day</dt>
        <dd>
          {observations.bulkClosure
            ? `${observations.bulkClosure.date} · ${observations.bulkClosure.count} issues`
            : measuredWindow
              ? "None observed"
              : "Not measured"}
        </dd>
      </div>
      <div>
        <dt>Recent scope</dt>
        <dd>
          {observations.scope
            ? `${observations.scope.state} — ${observations.scope.notes.join(" ")}`
            : "Unknown"}
        </dd>
      </div>
      <div>
        <dt>Completed with a release link</dt>
        <dd>
          {observation(observations.releaseLinked)}{" "}
          <span className="cc-observation-note">
            a release link is not a live check
          </span>
        </dd>
      </div>
    </dl>
  );
}

function ForecastView({
  forecast,
  checkedAt,
}: {
  forecast: CommandCentreForecast;
  checkedAt: string;
}) {
  if (forecast.state === "unknown") {
    return (
      <section
        className="cc-forecast"
        data-state="unknown"
        aria-labelledby="cc-forecast-title"
      >
        <h4 id="cc-forecast-title">Cautious completion window</h4>
        <p className="cc-unknown">
          <strong>Unknown</strong> — checked at {utcClock(checkedAt)} UTC.{" "}
          {forecast.reason}
        </p>
        <p className="cc-hint">
          No date is shown, because this history does not support one.
        </p>
        <Observations observations={forecast.observations} />
        {forecast.notes.length > 0 && (
          <ul className="cc-notes">
            {forecast.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  return (
    <section
      className="cc-forecast"
      data-state="ok"
      aria-labelledby="cc-forecast-title"
    >
      <h4 id="cc-forecast-title">Cautious completion window</h4>
      {forecast.interval ? (
        <>
          <p className="cc-forecast-band">
            {dayStamp(forecast.interval.earliestAt)} –{" "}
            {dayStamp(forecast.interval.latestAt)}
          </p>
          <p className="cc-hint">
            {forecast.interval.confidence} confidence ·{" "}
            {forecast.interval.earliestDays}–{forecast.interval.latestDays} days
            from {dayStamp(forecast.observedAt)} UTC
            {forecast.interval.beyondYear
              ? " · beyond 12 months at the observed rate"
              : ""}
            .
          </p>
          <p className="cc-hint">{forecast.interval.method}</p>
        </>
      ) : (
        <p className="cc-none" data-state="none">
          No open issues in the confirmed backlog, so there is no completion
          window to project.
        </p>
      )}
      <Observations observations={forecast.observations} />
      {forecast.notes.length > 0 && (
        <ul className="cc-notes">
          {forecast.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function reasonLabel(reason: CommandCentreHistoryItem["stateReason"]) {
  if (reason === "completed") return "Completed";
  if (reason === "not_planned") return "Not planned";
  if (reason === "duplicate") return "Duplicate";
  if (reason === "reopened") return "Reopened";
  if (reason === "unknown") return "Reason not recognised";
  return "No reason recorded";
}

function HistoryLens({ repo }: { repo: CommandCentreRepo }) {
  const history = repo.history;
  return (
    <section className="cc-section" aria-labelledby="cc-history-title">
      <div className="cc-section-head">
        <h4 id="cc-history-title">Recent completions</h4>
        {history.state === "ok" && (
          <p className="cc-bounded">
            {history.recent.length} shown · {history.closed} closed in one page
            of {history.scanned}
          </p>
        )}
      </div>
      {history.state === "unknown" ? (
        <Unknown section={history} checkedAt={repo.checkedAt} />
      ) : history.recent.length === 0 ? (
        <div className="cc-empty" data-state="empty">
          <p>
            <strong>No closed issues in this read.</strong>{" "}
            {history.complete
              ? "The source returned no closed item, so there is no completion history yet."
              : "The bounded window returned no closed issue; that is not proof that none exist."}
          </p>
        </div>
      ) : (
        <>
          <div
            className="cc-table-scroll"
            role="region"
            aria-label="Recent completions table, horizontally scrollable on narrow screens"
            tabIndex={0}
          >
            <table className="cc-table">
              <caption>
                Recently closed issues. A closure is not a live deployment, and
                a linked release is publication evidence only.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Issue</th>
                  <th scope="col">Closed</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Release</th>
                </tr>
              </thead>
              <tbody>
                {history.recent.map((item) => (
                  <tr key={item.number}>
                    <th scope="row">
                      <a
                        href={item.url}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        <span className="cc-issue-number">
                          #{item.number}
                        </span>{" "}
                        {item.title}
                      </a>
                      {item.milestone && (
                        <span className="cc-row-meta">
                          Milestone: {item.milestone}
                        </span>
                      )}
                      <span className="cc-actions">
                        <a
                          href={item.url}
                          rel="noreferrer noopener"
                          target="_blank"
                          className="cc-action"
                        >
                          Open issue
                        </a>
                        <CopyLink url={item.url} />
                      </span>
                    </th>
                    <td data-label="Closed">
                      {item.closedAt
                        ? stamp(item.closedAt)
                        : "Close timestamp missing"}
                    </td>
                    <td data-label="Reason">{reasonLabel(item.stateReason)}</td>
                    <td data-label="Release">
                      {item.linkedRelease ? (
                        <>
                          <a
                            href={item.linkedRelease.url}
                            rel="noreferrer noopener"
                            target="_blank"
                          >
                            {item.linkedRelease.tag}
                          </a>
                          <span className="cc-row-meta">not a live check</span>
                        </>
                      ) : (
                        <span className="cc-row-meta">
                          No release linked in this read
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.complete && (
            <p className="cc-hint">
              More than 100 closed items were recently updated, so this list is
              a bounded sample.
            </p>
          )}
          <p className="cc-hint">
            Closed means the source recorded a closure. It is never presented as
            verified live.
          </p>
        </>
      )}
    </section>
  );
}

function ReleasesLens({ repo }: { repo: CommandCentreRepo }) {
  const releases = repo.releases;
  return (
    <section className="cc-section" aria-labelledby="cc-releases-title">
      <div className="cc-section-head">
        <h4 id="cc-releases-title">Recent releases and source activity</h4>
        {releases.state === "ok" && (
          <p className="cc-bounded">Up to five releases</p>
        )}
      </div>
      {releases.state === "unknown" ? (
        <Unknown section={releases} checkedAt={repo.checkedAt} />
      ) : releases.items.length === 0 ? (
        <p className="cc-none" data-state="none">
          No release was returned for this repository. That is not a claim that
          nothing shipped; it means no release record was read.
        </p>
      ) : (
        <ol className="cc-releases">
          {releases.items.map((release) => (
            <li key={release.tag}>
              <p className="cc-release-title">
                <a
                  href={release.url}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {release.tag}
                </a>
                {release.name ? ` — ${release.name}` : ""}
                {release.prerelease ? (
                  <span className="cc-badge">Pre-release</span>
                ) : null}
              </p>
              <p className="cc-issue-meta">
                {release.publishedAt
                  ? `Published ${stamp(release.publishedAt)}`
                  : "No publication date recorded"}
              </p>
              {release.issues.length > 0 && (
                <p className="cc-issue-meta">
                  Release notes reference{" "}
                  {release.issues.map((entry, index) => (
                    <span key={entry.number}>
                      {index > 0 ? ", " : ""}
                      <a
                        href={entry.url}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        #{entry.number}
                      </a>
                    </span>
                  ))}
                  . A reference is authored text, not a live check.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="cc-source-activity">
        <h4>Latest default-branch commit</h4>
        {repo.commit.state === "unknown" ? (
          <Unknown section={repo.commit} checkedAt={repo.checkedAt} />
        ) : repo.commit.latest ? (
          <p>
            <a
              href={repo.commit.latest.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              {repo.commit.latest.sha.slice(0, 12)}
            </a>{" "}
            on {repo.defaultBranch ?? "the default branch"} ·{" "}
            {stamp(repo.commit.latest.committedAt)}
          </p>
        ) : (
          <p className="cc-none">No commit reported.</p>
        )}
      </div>
    </section>
  );
}

function DeliveryLens({ report }: { report: CommandCentreReport }) {
  const repo = report.repo;
  const pullCount = repo.pullRequests;
  return (
    <section className="cc-section cc-lens" aria-labelledby="cc-delivery-title">
      <div className="cc-section-head">
        <h3 id="cc-delivery-title">Delivery and outlook</h3>
        <p className="cc-bounded">
          Measured closures only · no merged or released claim is "live"
        </p>
      </div>
      <section className="cc-stats cc-stats-compact" aria-label="Delivery state">
        <CountStat
          label="Open issues"
          value={repo.issues.count}
          checkedAt={repo.checkedAt}
          href={repo.links.issues}
          note="The confirmed backlog."
        />
        <CountStat
          label="Open pull requests"
          value={repo.pullRequests}
          checkedAt={repo.checkedAt}
          href={repo.links.pullRequests}
          note="Counted separately from issues."
        />
        <article className="cc-stat" data-state="ok">
          <p className="cc-stat-label">Completion basis</p>
          <p className="cc-stat-none">Closed issue</p>
          <p className="cc-stat-note">
            Not a deployment, merge or live check.
          </p>
        </article>
      </section>
      <ForecastView forecast={repo.forecast} checkedAt={repo.checkedAt} />
      <HistoryLens repo={repo} />
      <ReleasesLens repo={repo} />
      <section className="cc-next" aria-labelledby="cc-next-title">
        <h4 id="cc-next-title">Next actions</h4>
        <ul className="cc-action-links">
          <li>
            <a
              href={repo.links.issues}
              rel="noreferrer noopener"
              target="_blank"
            >
              Open the issue list
            </a>
          </li>
          <li>
            {pullCount.state === "unknown" ? (
              <span>Pull request count unknown</span>
            ) : pullCount.value > 0 ? (
              <a
                href={repo.links.pullRequests}
                rel="noreferrer noopener"
                target="_blank"
              >
                Review {pullCount.value} open pull request
                {pullCount.value === 1 ? "" : "s"}
              </a>
            ) : (
              <span>No open pull request to review</span>
            )}
          </li>
          {repo.links.newIssue && (
            <li>
              <a
                href={repo.links.newIssue}
                rel="noreferrer noopener"
                target="_blank"
              >
                Open a new issue
              </a>
            </li>
          )}
        </ul>
        <p className="cc-hint">
          These are links only. This view never writes, approves, merges or
          deploys.
        </p>
      </section>
    </section>
  );
}

const views = [
  { id: "pulse", label: "Pulse" },
  { id: "plan", label: "Plan" },
  { id: "delivery", label: "Delivery" },
] as const;

export type CommandCentreView = (typeof views)[number]["id"];

function TabList({
  view,
  onChange,
}: {
  view: CommandCentreView;
  onChange: (next: CommandCentreView) => void;
}) {
  return (
    <div
      className="cc-tabs"
      role="tablist"
      aria-label="Command centre views"
    >
      {views.map((entry) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          id={`cc-tab-${entry.id}`}
          aria-selected={view === entry.id}
          aria-controls={`cc-panel-${entry.id}`}
          tabIndex={view === entry.id ? 0 : -1}
          onClick={() => onChange(entry.id)}
          onKeyDown={(event) => {
            const index = views.findIndex((candidate) => candidate.id === view);
            let next = index;
            if (event.key === "ArrowRight")
              next = (index + 1) % views.length;
            else if (event.key === "ArrowLeft")
              next = (index - 1 + views.length) % views.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = views.length - 1;
            else return;
            event.preventDefault();
            const target = views[next];
            if (!target) return;
            onChange(target.id);
            document.getElementById(`cc-tab-${target.id}`)?.focus();
          }}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

function PulseLens({ report }: { report: CommandCentreReport }) {
  const repo = report.repo;
  const forecast = repo.forecast;
  return (
    <>
      <section className="cc-stats" aria-label="Repository state">
        <CountStat
          label="Open issues"
          value={repo.issues.count}
          checkedAt={repo.checkedAt}
          href={repo.links.issues}
          note="Pull requests are counted separately."
        />
        <CountStat
          label="Open pull requests"
          value={repo.pullRequests}
          checkedAt={repo.checkedAt}
          href={repo.links.pullRequests}
        />
        <ReleaseStat section={repo.release} checkedAt={repo.checkedAt} />
        <CommitStat
          section={repo.commit}
          repo={repo}
          checkedAt={repo.checkedAt}
        />
        <article className="cc-stat" data-state={forecast.state}>
          <p className="cc-stat-label">Completion outlook</p>
          {forecast.state === "ok" && forecast.interval ? (
            <>
              <p className="cc-stat-value cc-stat-window">
                {dayStamp(forecast.interval.earliestAt)} –{" "}
                {dayStamp(forecast.interval.latestAt)}
              </p>
              <p className="cc-stat-note">
                {forecast.interval.confidence} confidence · see Delivery for the
                method
              </p>
            </>
          ) : forecast.state === "ok" ? (
            <>
              <p className="cc-stat-none">No open work</p>
              <p className="cc-stat-note">The confirmed backlog is empty.</p>
            </>
          ) : (
            <Unknown
              section={{ state: "unknown", reason: forecast.reason }}
              checkedAt={repo.checkedAt}
            />
          )}
        </article>
      </section>
      <BlockedSection section={repo.blocked} checkedAt={repo.checkedAt} />
      <RecentIssues repo={repo} checkedAt={repo.checkedAt} />
    </>
  );
}

export function CommandCentreBoard({
  report,
  initialView = "pulse",
}: {
  report: CommandCentreReport;
  initialView?: CommandCentreView;
}) {
  const [view, setView] = useState<CommandCentreView>(initialView);
  const repo = report.repo;
  const selected = report.repositories.find(
    (entry) => entry.repository === report.selected,
  );
  return (
    <>
      <nav className="cc-switcher" aria-label="Project">
        <p className="cc-switcher-label">Projects</p>
        <ul>
          {report.repositories.map((entry) => (
            <li key={entry.repository}>
              <a
                href={"?repo=" + encodeURIComponent(entry.repository)}
                aria-current={
                  entry.repository === report.selected ? "page" : undefined
                }
              >
                <span>{entry.label}</span>
                <code>{entry.repository}</code>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <header className="cc-board-head">
        <p className="cc-kicker">
          {report.cached
            ? `Cached read · ${report.cacheAgeSeconds}s old`
            : "Live read in this request"}
        </p>
        <h2>{selected?.label ?? repo.repository}</h2>
        <p className="cc-repo">
          <code>{repo.repository}</code>
          <span aria-hidden="true"> · </span>
          <a href={repo.url} rel="noreferrer noopener" target="_blank">
            Open repository
          </a>
          <span aria-hidden="true"> · </span>
          <span>Source: {report.source.label}</span>
        </p>
        <p className="cc-meta">
          Fetched {stamp(report.fetchedAt)} ·{" "}
          {report.cached
            ? `served from the ${report.cacheSeconds}-second cache`
            : "not cached"}{" "}
          ·{" "}
          {repo.complete
            ? "every read section was confirmed"
            : "partial read — unknown sections stay unknown"}
        </p>
        {report.rateLimit.remaining !== null && (
          <p className="cc-rate">
            {report.source.label} quota: {report.rateLimit.remaining}
            {report.rateLimit.limit !== null
              ? ` of ${report.rateLimit.limit}`
              : ""}{" "}
            left
            {report.rateLimit.resetAt
              ? ` · resets ${utcClock(report.rateLimit.resetAt)} UTC`
              : ""}
            .
          </p>
        )}
        {repo.archived === true && (
          <p className="cc-archived">
            This repository is archived. Its open state is historical.
          </p>
        )}
        {repo.archived === null && (
          <p className="cc-hint">
            Repository metadata could not be confirmed, so the archived state is
            unknown.
          </p>
        )}
      </header>

      <TabList view={view} onChange={setView} />
      <div
        className="cc-panel"
        role="tabpanel"
        id={`cc-panel-${view}`}
        aria-labelledby={`cc-tab-${view}`}
        tabIndex={0}
      >
        {view === "pulse" && <PulseLens report={report} />}
        {view === "plan" && <PlanLens report={report} />}
        {view === "delivery" && <DeliveryLens report={report} />}
      </div>

      <section className="cc-limits" aria-labelledby="cc-limits-title">
        <h3 id="cc-limits-title">What this view does not do</h3>
        <ul>
          {report.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>

      <footer className="cc-foot">
        <p>
          Effective cache: {report.cacheSeconds}-second window · this response
          is{" "}
          {report.cached
            ? `${report.cacheAgeSeconds} seconds old`
            : "fresh in this request"}
          .
        </p>
        {report.cacheSeconds > 60 && (
          <p>
            No {report.source.label} credential is configured, so the longer
            window keeps the public 60-request hourly quota realistic. A cached
            read can be up to {Math.floor(report.cacheSeconds / 60)} minutes old.
          </p>
        )}
      </footer>
    </>
  );
}

export function CommandCentrePage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <CommandCentre key={search} search={search} />;
}

function CommandCentre({ search }: { search: string }) {
  const [report, setReport] = useState<CommandCentreReport>();
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const repo = new URLSearchParams(search).get("repo") ?? "";
    setReport(undefined);
    setError("");
    void (async () => {
      try {
        const next = await loadCommandCentre(repo, controller.signal);
        if (!controller.signal.aborted) setReport(next);
      } catch {
        if (!controller.signal.aborted)
          setError(
            "The command centre could not be read. No source state is shown as zero or complete. Try again.",
          );
      }
    })();
    return () => controller.abort();
  }, [search, generation]);

  return (
    <section
      className="composer-command"
      aria-labelledby="command-centre-title"
    >
      <header className="cc-page-head">
        <p className="cc-kicker">Composer · first-party repositories</p>
        <h1 id="command-centre-title">Command centre</h1>
        <p className="cc-lede">
          Real issue, pull request, release and blocked state for the maintained
          Composer repositories. Read-only: nothing here writes, approves,
          deploys or turns a closure into a live claim. Plan and Delivery add
          explicit relationships and a cautious, evidence-based outlook.
        </p>
      </header>

      {!report && !error && <p role="status">Reading the source…</p>}

      {error && (
        <div role="alert" className="cc-alert">
          <p>{error}</p>
          <button onClick={() => setGeneration((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}

      {report && <CommandCentreBoard report={report} />}
    </section>
  );
}
