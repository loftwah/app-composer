import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { z } from "zod";
import {
  overviewSnapshot,
  type OverviewSnapshot,
} from "../lib/overview-contract";
import { workspaceSelection, confirmWorkspace } from "./stacks/workspace-scope";
import "./overview-page.css";
export function OverviewPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <Overview key={search} search={search} />;
}
export function Overview({ search }: { search: string }) {
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const active = useRef(true),
    pending = useRef(false),
    selected = useRef<string | undefined>(undefined),
    invalid = useRef(false);
  async function refresh() {
    if (pending.current || invalid.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        action: "list",
        ...(selected.current ? { workspace: selected.current } : {}),
      });
      const response = await apiFetch(
        "/_emdash/api/plugins/composer-stacks/overviewRead?" + params,
        { cache: "no-store", signal: AbortSignal.timeout(20000) },
      );
      const raw = await parseApiResponse<unknown>(
        response,
        "Overview could not be checked. Retry or open the owning screens.",
      );
      const result = z
        .object({ ok: z.boolean(), message: z.string().optional() })
        .parse(raw);
      if (!result.ok) throw Error(result.message ?? "Overview is unavailable.");
      const next = overviewSnapshot.parse(raw);
      confirmWorkspace(selected.current, next.workspace.id);
      if (active.current) {
        selected.current = next.workspace.id;
        setSnapshot(next);
      }
    } catch (cause) {
      if (active.current) {
        setError(
          cause instanceof Error ? cause.message : "Overview is unavailable.",
        );
        setSnapshot(undefined);
      }
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  useEffect(() => {
    active.current = true;
    try {
      selected.current = workspaceSelection(search);
      void refresh();
    } catch (cause) {
      invalid.current = true;
      setError(
        cause instanceof Error ? cause.message : "Choose your workspace first.",
      );
    }
    return () => {
      active.current = false;
    };
  }, []);
  const format = (value: string) =>
    new Date(value).toLocaleString("en-AU", { timeZone: "UTC" });
  return (
    <div className="co-overview" aria-busy={busy}>
      <header>
        <h1>Needs attention</h1>
        <p>
          Find retained problems in your selected workspace, then open the
          screen that can handle them.
        </p>
      </header>
      <button disabled={busy || invalid.current} onClick={() => void refresh()}>
        {busy ? "Checking records…" : "Refresh overview"}
      </button>
      {error && (
        <p className="co-error" role="alert">
          {error}
        </p>
      )}
      {snapshot && (
        <>
          <p>
            <strong>{snapshot.workspace.name}</strong> ·{" "}
            {snapshot.target.environment} ·{" "}
            <span>Records checked {format(snapshot.checkedAt)} UTC</span>
          </p>
          <details>
            <summary>Selected scope</summary>
            <dl>
              <dt>Workspace</dt>
              <dd>
                <code>{snapshot.workspace.id}</code>
              </dd>
              <dt>Account</dt>
              <dd>
                <code>{snapshot.target.account}</code>
              </dd>
              <dt>Environment</dt>
              <dd>{snapshot.target.environment}</dd>
            </dl>
          </details>
          <section aria-labelledby="co-problems">
            <h2 id="co-problems">Problems to inspect</h2>
            {!snapshot.items.length && (
              <p>
                No retained problems were found in the checked sources.
                Unavailable or restricted sources are listed below; this is not
                a complete health check.
              </p>
            )}
            <ul className="co-problems">
              {snapshot.items.map((item) => (
                <li key={item.id}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <p className="co-muted">
                      {item.count} retained{" "}
                      {item.count === 1 ? "record" : "records"} · First observed{" "}
                      {format(item.firstObserved)} UTC · Latest{" "}
                      {format(item.lastObserved)} UTC
                    </p>
                  </div>
                  <a href={item.href}>{item.action}</a>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="co-coverage">
            <h2 id="co-coverage">What was checked</h2>
            <dl className="co-sources">
              {snapshot.sources.map((source) => (
                <div key={source.id}>
                  <dt>{source.label}</dt>
                  <dd>
                    <strong>
                      {source.status === "checked"
                        ? (source.count ?? 0) + " retained problem records"
                        : source.status === "restricted"
                          ? "Access restricted"
                          : "Unavailable"}
                    </strong>
                    <p>{source.note}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <p className="co-muted">
            This view reads supported stored platform, workflow and notification
            records. It sends no mail and performs no recovery. Live provider
            health, pending enquiry counts, orders, connection expiry and
            backups are not checked here. Sample workflow runs are excluded.
          </p>
        </>
      )}
    </div>
  );
}
