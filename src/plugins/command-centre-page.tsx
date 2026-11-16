import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  commandCentreReport,
  utcClock,
  type CommandCentreReport,
  type CommandCentreRepo,
  type CommandCentreUnknownSection,
} from "../lib/command-centre-contract";
import "./command-centre-page.css";

const base = "/_emdash/api/plugins/composer-stacks/commandCentreRead";

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
            {section.latest.publishedAt
              ? `Published ${stamp(section.latest.publishedAt)}`
              : "GitHub recorded no publication date."}
          </p>
        </>
      ) : (
        <p className="cc-stat-none">No published release</p>
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
        <p className="cc-bounded">Real repository labels only</p>
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
              <p className="cc-issue-meta">Updated {stamp(issue.updatedAt)}</p>
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
            <strong>No open issues.</strong> GitHub reported no open issues for
            this repository at {stamp(checkedAt)}.
          </p>
          <p>
            <a
              href={repo.url + "/issues/new/choose"}
              rel="noreferrer noopener"
              target="_blank"
            >
              Open the issue chooser on GitHub
            </a>{" "}
            to start the first one.
          </p>
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

export function CommandCentreBoard({
  report,
}: {
  report: CommandCentreReport;
}) {
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
            Open on GitHub
          </a>
        </p>
        <p className="cc-meta">
          Fetched {stamp(report.fetchedAt)} ·{" "}
          {report.cached
            ? `served from the ${report.cacheSeconds}-second cache`
            : "not cached"}{" "}
          ·{" "}
          {repo.complete
            ? "every section was read"
            : "partial read — unknown sections stay unknown"}
        </p>
        {report.rateLimit.remaining !== null && (
          <p className="cc-rate">
            GitHub quota: {report.rateLimit.remaining}
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

      <section className="cc-stats" aria-label="Repository state">
        <CountStat
          label="Open issues"
          value={repo.issues.count}
          checkedAt={repo.checkedAt}
          href={repo.url + "/issues"}
          note="Pull requests are counted separately."
        />
        <CountStat
          label="Open pull requests"
          value={repo.pullRequests}
          checkedAt={repo.checkedAt}
          href={repo.url + "/pulls"}
        />
        <ReleaseStat section={repo.release} checkedAt={repo.checkedAt} />
        <CommitStat
          section={repo.commit}
          repo={repo}
          checkedAt={repo.checkedAt}
        />
      </section>

      <BlockedSection section={repo.blocked} checkedAt={repo.checkedAt} />
      <RecentIssues repo={repo} checkedAt={repo.checkedAt} />

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
            No GitHub credential is configured, so the longer window keeps the
            public 60-request hourly quota realistic. A cached read can be up to{" "}
            {Math.floor(report.cacheSeconds / 60)} minutes old.
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
        const response = await apiFetch(
          base + (repo ? "?repo=" + encodeURIComponent(repo) : ""),
          { cache: "no-store", signal: controller.signal },
        );
        const raw = await parseApiResponse<unknown>(
          response,
          "The command centre is unavailable. Sign in as a creator and try again.",
        );
        const parsed = commandCentreReport.safeParse(raw);
        if (!parsed.success) throw new Error("invalid");
        if (!controller.signal.aborted) setReport(parsed.data);
      } catch {
        if (!controller.signal.aborted)
          setError(
            "The command centre could not be read. No GitHub state is shown as zero or complete. Try again.",
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
          Real GitHub issue, pull request, release and blocked state for the
          maintained Composer repositories. Read-only: nothing here writes to
          GitHub, approves work or forecasts delivery.
        </p>
      </header>

      {!report && !error && <p role="status">Reading GitHub…</p>}

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
