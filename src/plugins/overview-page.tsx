import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { z } from "zod";
import {
  overviewSnapshot,
  type OverviewSnapshot,
} from "../lib/overview-contract";
import {
  appLabel,
  confirmScope,
  moveScope,
  parseScopeSelection,
  scopeQuery,
  withScope,
  type ConfirmedScope,
  type ScopeSelection,
} from "../lib/admin-scope";
import {
  attentionView,
  beginRecheck,
  settleRecheck,
  type RecheckState,
  type SourceId,
} from "../lib/overview-attention";
import { adminTime, utcTime } from "../lib/admin-time";
import "./overview-page.css";

const ENDPOINT = "/_emdash/api/plugins/composer-stacks/overviewRead";
const PAGE = "/_emdash/admin/plugins/composer-stacks/overview";
const OWNER: Record<SourceId, string> = {
  platform: "/_emdash/admin/plugins/composer-stacks/platform",
  workflows: "/_emdash/admin/plugins/composer-stacks/workflows",
  resources: "/_emdash/admin/plugins/composer-stacks/resources",
  notifications: "/_emdash/admin/plugins/composer-stacks/enquiries",
};

function dismissOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== "Escape" || !event.currentTarget.open) return;
  event.currentTarget.open = false;
  const summary = event.currentTarget.querySelector("summary");
  if (summary instanceof HTMLElement) summary.focus();
  event.preventDefault();
}

export function OverviewPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <Overview key={search} search={search} />;
}

export function Overview({ search }: { search: string }) {
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recheck, setRecheck] = useState<RecheckState | null>(null);
  const active = useRef(true),
    pending = useRef(false),
    invalid = useRef(false),
    selection = useRef<ScopeSelection>({});

  async function read(source?: SourceId) {
    if (pending.current || invalid.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    if (source)
      setRecheck(beginRecheck(source, new Date().toISOString()));
    try {
      const params = new URLSearchParams({
        action: source ? "recheck" : "list",
      });
      if (source) params.set("source", source);
      if (selection.current.workspace)
        params.set("workspace", selection.current.workspace);
      if (selection.current.environment)
        params.set("environment", selection.current.environment);
      if (selection.current.app) params.set("app", selection.current.app);
      const response = await apiFetch(ENDPOINT + "?" + params, {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      const raw = await parseApiResponse<unknown>(
        response,
        "Overview could not be checked. Retry or open the owning screens.",
      );
      const envelope = z
        .object({
          ok: z.boolean(),
          message: z.string().optional(),
          source: z.string().optional(),
        })
        .parse(raw);
      if (!envelope.ok)
        throw Error(envelope.message ?? "Overview is unavailable.");
      const next = overviewSnapshot.parse(raw);
      const confirmed = confirmScope(selection.current, {
        workspace: next.workspace.id,
        environment: next.target.environment,
        app: next.selection.app,
      });
      if (!active.current) return;
      selection.current = {
        workspace: confirmed.workspace,
        environment: confirmed.environment,
        app: confirmed.app ?? undefined,
      };
      setSnapshot(next);
      if (source) {
        const checked = next.sources.find((entry) => entry.id === source);
        setRecheck(
          settleRecheck(beginRecheck(source, next.checkedAt), {
            ok: true,
            at: next.rechecked?.at ?? next.checkedAt,
            message:
              (checked?.label ?? source) +
              " rechecked. " +
              (checked?.count ?? 0) +
              " retained problem record" +
              ((checked?.count ?? 0) === 1 ? "" : "s") +
              ", read " +
              utcTime(next.rechecked?.at ?? next.checkedAt) +
              ".",
          }),
        );
      }
    } catch (cause) {
      if (!active.current) return;
      const message =
        cause instanceof Error ? cause.message : "Overview is unavailable.";
      if (source)
        setRecheck(
          settleRecheck(beginRecheck(source, new Date().toISOString()), {
            ok: false,
            at: new Date().toISOString(),
            message,
          }),
        );
      else {
        setSnapshot(undefined);
        setError(message);
      }
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  useEffect(() => {
    active.current = true;
    try {
      selection.current = parseScopeSelection(search);
      void read();
    } catch (cause) {
      invalid.current = true;
      setError(
        cause instanceof Error ? cause.message : "Choose your scope first.",
      );
    }
    return () => {
      active.current = false;
    };
    // The parent remounts this component when the URL search changes.
  }, []);

  function changeScope(key: "workspace" | "environment" | "app", value: string) {
    if (!snapshot) return;
    const current: ConfirmedScope = {
      workspace: snapshot.workspace.id,
      environment: snapshot.target.environment,
      app: snapshot.selection.app,
    };
    // A different workspace has its own environments and apps, so only its
    // confirmed id travels. The server then chooses that workspace's default.
    const target =
      key === "workspace"
        ? PAGE + "?" + new URLSearchParams({ workspace: value })
        : PAGE + "?" + scopeQuery(moveScope(current, key, value));
    window.location.assign(target);
  }

  const scope: ConfirmedScope | null = snapshot
    ? {
        workspace: snapshot.workspace.id,
        environment: snapshot.target.environment,
        app: snapshot.selection.app,
      }
    : null;
  const view = snapshot ? attentionView(snapshot) : null;
  const blocked = view?.blocked[0];
  const blockedLabel = blocked?.label ?? "this source";
  const checkedCount = snapshot
    ? snapshot.sources.filter((source) => source.status === "checked").length
    : 0;
  const recheckLabel = (id: SourceId) =>
    snapshot?.sources.find((source) => source.id === id)?.label ??
    id.replace("-", " ");

  return (
    <div className="co-overview" aria-busy={busy}>
      <header className="co-heading">
        <div>
          <h1>Needs attention</h1>
          <p>Problems this scope retained, with the record behind each one.</p>
        </div>
      </header>

      {snapshot && scope && (
        <section className="co-scope" aria-label="Selected scope">
          <ScopeField
            label="Workspace"
            value={snapshot.workspace.id}
            disabled={busy}
            options={snapshot.available.workspaces.map((workspace) => ({
              value: workspace.id,
              label: workspace.name + " · " + workspace.role,
            }))}
            fallback={snapshot.workspace.name + " · " + snapshot.workspace.role}
            onChange={(value) => changeScope("workspace", value)}
          />
          <ScopeField
            label="Environment"
            value={snapshot.target.environment}
            disabled={busy}
            options={snapshot.available.environments.map((environment) => ({
              value: environment,
              label: environment,
            }))}
            fallback={snapshot.target.environment}
            onChange={(value) => changeScope("environment", value)}
          />
          <ScopeField
            label="App"
            value={snapshot.selection.app ?? ""}
            disabled={busy}
            options={[
              ...(snapshot.available.apps.length
                ? [{ value: "", label: "All recorded apps" }]
                : []),
              ...snapshot.available.apps.map((app) => ({
                value: app.id,
                label: appLabel(app.id),
              })),
            ]}
            fallback={
              snapshot.available.apps.length
                ? "All recorded apps"
                : "No app recorded here"
            }
            onChange={(value) => changeScope("app", value)}
          />
          <p className="co-scope-account">
            <span>Account</span> <code>{snapshot.target.account}</code>
          </p>
        </section>
      )}

      {!snapshot && !error && (
        <p className="co-status" role="status">
          Reading this scope’s retained records…
        </p>
      )}
      {error && (
        <div className="co-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            disabled={busy || invalid.current}
            onClick={() => void read()}
          >
            {busy ? "Reading…" : "Retry"}
          </button>
        </div>
      )}
      {recheck?.status === "failed" && (
        <div className="co-error" role="alert">
          <p>
            <strong>{recheckLabel(recheck.source)} recheck failed.</strong>{" "}
            {recheck.message} The previous result is still shown and was not
            replaced.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void read(recheck.source)}
          >
            {busy ? "Rechecking…" : "Retry " + recheckLabel(recheck.source)}
          </button>
        </div>
      )}
      {recheck?.status === "succeeded" && (
        <p className="co-notice" role="status">
          {recheck.message}
        </p>
      )}

      {snapshot && scope && view && (
        <>
          {view.kind === "problems" && view.leader ? (
            <section className="co-next" aria-labelledby="co-next-title">
              <p className="co-kicker">Next</p>
              <h2 id="co-next-title">{view.leader.title}</h2>
              <p>{view.leader.summary}</p>
              <p className="co-meta">
                {view.leader.count} retained{" "}
                {view.leader.count === 1 ? "record" : "records"} ·{" "}
                {view.leader.app
                  ? appLabel(view.leader.app)
                  : "Workspace-wide"}{" "}
                · latest {utcTime(view.leader.lastObserved)}
              </p>
              <div className="co-actions">
                <a
                  className="co-primary"
                  href={withScope(view.leader.href, scope)}
                >
                  {view.leader.action}
                </a>
              </div>
              <details className="co-evidence" onKeyDown={dismissOnEscape}>
                <summary>Evidence behind this problem</summary>
                <dl>
                  <dt>Source</dt>
                  <dd>
                    {recheckLabel(view.leader.source)}
                    {" · "}
                    {view.leader.app
                      ? appLabel(view.leader.app)
                      : "Workspace-wide"}
                  </dd>
                  <dt>Retained records</dt>
                  <dd>
                    {view.leader.count}
                    {view.leader.count === 1 ? " record" : " records"} grouped
                    under one problem
                  </dd>
                  <dt>First observed</dt>
                  <dd>{utcTime(view.leader.firstObserved)}</dd>
                  <dt>Latest observation</dt>
                  <dd>{adminTime(view.leader.lastObserved)}</dd>
                  <dt>Read window</dt>
                  <dd>
                    {
                      snapshot.sources.find(
                        (source) => source.id === view.leader?.source,
                      )?.note
                    }
                  </dd>
                </dl>
              </details>
            </section>
          ) : view.kind === "unreadable" && blocked ? (
            <section className="co-next" aria-labelledby="co-next-title">
              <p className="co-kicker">Next</p>
              <h2 id="co-next-title">{blockedLabel} could not be read</h2>
              <p>
                No retained problem is shown from the sources that answered.
                Unavailable is not zero: retry this read or open its owning
                screen.
              </p>
              <div className="co-actions">
                <button
                  type="button"
                  className="co-primary"
                  disabled={busy}
                  onClick={() => void read(blocked.id)}
                >
                  {busy ? "Rechecking…" : "Recheck " + blockedLabel}
                </button>
                <a
                  className="co-secondary"
                  href={withScope(
                    OWNER[blocked.id] +
                      "?" +
                      new URLSearchParams({ workspace: scope.workspace }),
                    scope,
                  )}
                >
                  Open the owning screen
                </a>
              </div>
            </section>
          ) : (
            <section className="co-next" aria-labelledby="co-next-title">
              <p className="co-kicker">Next</p>
              <h2 id="co-next-title">No retained problem in this scope</h2>
              <p>
                {checkedCount} of {snapshot.sources.length} sources answered.
                Check again before treating this as a clean bill of health.
              </p>
              <div className="co-actions">
                <button
                  type="button"
                  className="co-primary"
                  disabled={busy}
                  onClick={() => void read()}
                >
                  {busy ? "Reading…" : "Check again"}
                </button>
                <a
                  className="co-secondary"
                  href={withScope(
                    "/_emdash/admin/plugins/composer-stacks/stacks?" +
                      new URLSearchParams({ workspace: scope.workspace }),
                    scope,
                  )}
                >
                  Open Creator stacks
                </a>
              </div>
            </section>
          )}

          {view.rest.length > 0 && (
            <section aria-labelledby="co-also">
              <h2 id="co-also">
                Also needs attention ({view.rest.length})
                {snapshot.selection.app && (
                  <span className="co-meta">
                    {" "}
                    · {view.appScoped} of {view.total} in{" "}
                    {appLabel(snapshot.selection.app)}
                  </span>
                )}
              </h2>
              <ul className="co-list">
                {view.rest.map((item) => (
                  <li key={item.id}>
                    <div>
                      <h3>{item.title}</h3>
                      <p className="co-meta">
                        {item.count} retained{" "}
                        {item.count === 1 ? "record" : "records"} ·{" "}
                        {item.app ? appLabel(item.app) : "Workspace-wide"} ·
                        latest {utcTime(item.lastObserved)}
                      </p>
                    </div>
                    <a href={withScope(item.href, scope)}>{item.action}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details className="co-coverage" onKeyDown={dismissOnEscape}>
            <summary>
              Coverage · {checkedCount} of {snapshot.sources.length} sources
              read
            </summary>
            <dl className="co-sources">
              {snapshot.sources.map((source) => (
                <div
                  key={source.id}
                  className={"co-source co-source-" + source.status}
                >
                  <dt>{source.label}</dt>
                  <dd>
                    <strong>
                      {source.status === "checked"
                        ? (source.count ?? 0) +
                          " retained problem record" +
                          ((source.count ?? 0) === 1 ? "" : "s")
                        : source.status === "restricted"
                          ? "Access restricted"
                          : "Unavailable"}
                    </strong>
                    <p>{source.note}</p>
                    {source.status === "restricted" ? (
                      <p className="co-muted">
                        No supported action here. Ask a workspace owner or
                        editor to read this source.
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void read(source.id)}
                      >
                        {busy && recheck?.source === source.id
                          ? "Rechecking…"
                          : source.status === "checked"
                            ? "Recheck " + source.label
                            : "Retry " + source.label}
                      </button>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="co-muted">
              Read {adminTime(snapshot.checkedAt)}. This reads supported stored
              platform, workflow, resource and notification records only. It sends no mail, performs no recovery and checks no
              provider health, enquiry count, order, connection expiry or
              backup. Sample workflow runs are excluded.
            </p>
          </details>

          {snapshot.selection.app && (
            <p className="co-muted">
              App focus narrows the order, not the evidence: workspace-wide
              records stay visible.{" "}
              <button
                type="button"
                className="co-link"
                disabled={busy}
                onClick={() => changeScope("app", "")}
              >
                Clear app focus
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ScopeField({
  label,
  value,
  options,
  fallback,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  fallback: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (options.length < 2)
    return (
      <p className="co-scope-field">
        <span>{label}</span> <strong>{fallback}</strong>
      </p>
    );
  const id = "co-scope-" + label.toLowerCase();
  return (
    <p className="co-scope-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </p>
  );
}
