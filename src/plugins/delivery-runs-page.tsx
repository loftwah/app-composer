import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  deliveryLabels,
  deliveryRunList,
  runnerLabels,
  type DeliveryRun,
  type DeliveryRunList,
} from "../lib/delivery-runs-contract";
import "./delivery-runs-page.css";

const liveSchemaMessage =
  "The live source could not be re-read from this page. That does not contradict or confirm the receipt.";

function instant(value: string): Date | null {
  const normalised = value.endsWith("Z") ? value : `${value}Z`;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stamp(value: string | null) {
  if (!value) return "Not recorded";
  const date = instant(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-AU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function duration(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function StateChip({ state }: { state: DeliveryRun["state"] }) {
  return (
    <span className="dr-chip" data-state={state}>
      {state}
    </span>
  );
}

function LiveComparison({
  run,
  liveCommit,
  liveError,
}: {
  run: DeliveryRun;
  liveCommit: string | null;
  liveError: string;
}) {
  if (!run.releasePerformed)
    return (
      <p className="dr-live" data-state="none">
        This receipt makes no release claim. Nothing was uploaded, so there is
        no production result to compare.
      </p>
    );
  if (liveError)
    return (
      <p className="dr-live" data-state="unavailable">
        {liveError} The recorded release claim is unchanged by this failure.
      </p>
    );
  if (!liveCommit)
    return (
      <p className="dr-live" data-state="unavailable">
        Re-reading the live source…
      </p>
    );
  if (run.commit && liveCommit === run.commit)
    return (
      <p className="dr-live" data-state="matches">
        <strong>Live source matches this receipt.</strong> /build.json reports{" "}
        <code>{liveCommit.slice(0, 12)}</code>, the same commit this release
        recorded. This is a fresh read in your browser, not a stored approval.
      </p>
    );
  return (
    <p className="dr-live" data-state="differs">
      <strong>The live source differs from this receipt.</strong> /build.json
      reports <code>{(liveCommit ?? "").slice(0, 12)}</code>, while this receipt
      recorded <code>{(run.commit ?? "no commit").slice(0, 12)}</code>. A later
      release may have replaced it; do not read this receipt as the current
      production identity.
    </p>
  );
}

function RunDetail({
  run,
  liveCommit,
  liveError,
}: {
  run: DeliveryRun;
  liveCommit: string | null;
  liveError: string;
}) {
  const checks = run.receipt.steps.filter((step) => step.state === "passed");
  const failures = run.receipt.steps.filter((step) => step.state !== "passed");
  return (
    <article className="dr-run" aria-labelledby="dr-run-title">
      <header>
        <p className="dr-kicker">
          {deliveryLabels[run.mode]} · recorded {stamp(run.recordedAt)} by{" "}
          {run.recordedBy}
        </p>
        <div className="dr-run-heading">
          <h2 id="dr-run-title">{runnerLabels[run.runner]}</h2>
          <StateChip state={run.state} />
        </div>
        <p className="dr-run-id">
          {run.runUrl ? (
            <a href={run.runUrl} rel="noreferrer noopener" target="_blank">
              {run.runId ?? run.runUrl}
            </a>
          ) : (
            (run.runId ?? (run.runner === "local" ? "Local session" : "No run id recorded"))
          )}
        </p>
      </header>
      {run.state !== "passed" && run.receipt.error && (
        <p className="dr-error" role="alert">
          <strong>{run.receipt.error.code}</strong> — {run.receipt.error.message}
        </p>
      )}
      <dl className="dr-facts">
        <div>
          <dt>Source</dt>
          <dd>
            {run.repository ?? "No repository"} · {run.branch ?? "no branch"}
            {run.commit ? ` · ${run.commit.slice(0, 12)}` : ""}
          </dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>
            {run.worker ?? "No Worker"} · {run.environment ?? "no environment"} ·{" "}
            {run.origin ?? "no origin"}
          </dd>
        </div>
        <div>
          <dt>Checks that ran</dt>
          <dd>
            {checks.length
              ? checks
                  .map(
                    (step) =>
                      `${step.label} (${step.command}, ${duration(step.durationMs)})`,
                  )
                  .join(" · ")
              : "No passing step was recorded"}
          </dd>
        </div>
        {failures.length > 0 && (
          <div>
            <dt>Failed or refused steps</dt>
            <dd>
              {failures
                .map((step) => `${step.label}: ${step.error ?? step.state}`)
                .join(" · ")}
            </dd>
          </div>
        )}
        <div>
          <dt>Artefact identity</dt>
          <dd>
            {run.artefactDigest
              ? `${run.artefactDigest} · ${run.artefactFiles ?? 0} files`
              : "No build artefact was recorded"}
            {run.candidateDigest
              ? ` · candidate ${run.candidateDigest}`
              : ""}
          </dd>
        </div>
        <div>
          <dt>Release</dt>
          <dd>
            {run.releasePerformed
              ? `Performed via ${run.receipt.release.command ?? "the guarded release"}`
              : run.receipt.release.attempted
                ? "Attempted; no confirmed release"
                : "Not attempted"}
            {" · "}
            {run.verificationPerformed
              ? `verified via ${run.receipt.verification.verifier}`
              : "no independent live read recorded"}
          </dd>
        </div>
        <div>
          <dt>Generated</dt>
          <dd>{stamp(run.generatedAt)}</dd>
        </div>
      </dl>
      <LiveComparison run={run} liveCommit={liveCommit} liveError={liveError} />
      <p className="dr-next">{run.receipt.nextAction ?? "No next action recorded."}</p>
      <details className="dr-bounded">
        <summary>Inspect the bounded receipt</summary>
        <pre>{JSON.stringify(run.receipt, null, 2)}</pre>
      </details>
    </article>
  );
}

export function DeliveryRunsPage() {
  const [report, setReport] = useState<DeliveryRunList>();
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [importText, setImportText] = useState("");
  const [importState, setImportState] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveCommit, setLiveCommit] = useState<string | null>(null);
  const [liveError, setLiveError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setReport(undefined);
    void (async () => {
      try {
        const response = await apiFetch(
          "/_emdash/api/plugins/composer-stacks/deliveryRead",
          { cache: "no-store", signal: controller.signal },
        );
        const raw = await parseApiResponse<unknown>(
          response,
          "The private Delivery runs view is unavailable. Sign in as an administrator and try again.",
        );
        const parsed = deliveryRunList.parse(raw);
        if (!controller.signal.aborted) {
          setReport(parsed);
          const requested = new URLSearchParams(window.location.search).get(
            "run",
          );
          setSelectedId(
            requested && parsed.runs.some((run) => run.id === requested)
              ? requested
              : (parsed.runs[0]?.id ?? ""),
          );
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            "The private Delivery runs view could not be loaded. No receipt, release or verification state is available. Try again.",
          );
      }
    })();
    return () => controller.abort();
  }, [generation]);

  useEffect(() => {
    const controller = new AbortController();
    setLiveCommit(null);
    setLiveError("");
    void (async () => {
      try {
        const response = await fetch("/build.json", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("unavailable");
        const body = (await response.json()) as { commit?: unknown };
        if (typeof body.commit !== "string" || !/^[a-f0-9]{40}$/.test(body.commit))
          throw new Error("unavailable");
        if (!controller.signal.aborted) setLiveCommit(body.commit);
      } catch {
        if (!controller.signal.aborted) setLiveError(liveSchemaMessage);
      }
    })();
    return () => controller.abort();
  }, [generation]);

  const runs = report?.runs ?? [];
  const selected = useMemo(
    () => runs.find((run) => run.id === selectedId) ?? runs[0],
    [runs, selectedId],
  );

  function chooseRun(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("run", id);
    window.history.pushState(null, "", url);
  }

  async function record() {
    if (!importText.trim()) {
      setImportState("Paste or open the receipt file written by the delivery journey first.");
      return;
    }
    let receipt: unknown;
    try {
      receipt = JSON.parse(importText);
    } catch {
      setImportState("That file is not valid JSON. Nothing was recorded.");
      return;
    }
    setBusy(true);
    setImportState("");
    try {
      const response = await apiFetch(
        "/_emdash/api/plugins/composer-stacks/deliveryWrite",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "record", receipt }),
        },
      );
      const raw = await parseApiResponse<unknown>(
        response,
        "That receipt could not be recorded. Nothing was approved, deployed or verified.",
      );
      const parsed = raw as { created?: boolean };
      setImportText("");
      if (fileInput.current) fileInput.current.value = "";
      setGeneration((value) => value + 1);
      setImportState(
        parsed.created === false
          ? "That exact receipt was already recorded. The existing row was kept."
          : "Receipt recorded. Recording is evidence only; it is not release approval or a live verification.",
      );
    } catch {
      setImportState(
        "That receipt was refused. Use a complete app-composer.delivery-receipt/1 file from the supported journey. Nothing was recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openFile(file: File | undefined) {
    if (!file) return;
    try {
      setImportText(await file.text());
      setImportState("Receipt loaded from the selected file. Review it, then record it.");
    } catch {
      setImportState("That file could not be read. Nothing was recorded.");
    }
  }

  return (
    <section className="composer-delivery" aria-labelledby="delivery-title">
      <header>
        <h1 id="delivery-title">Delivery runs</h1>
        <p>
          Record what a local session or an existing runner actually ran, then
          compare a release claim with the live source.
        </p>
        <p>Composer production · administrator-only · evidence, not approval</p>
      </header>

      {!report && !error && <p role="status">Loading recorded delivery runs…</p>}
      {error && (
        <div role="alert" className="dr-alert">
          <p>{error}</p>
          <button onClick={() => setGeneration((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}

      {report && selected && (
        <section className="dr-next" aria-labelledby="dr-next-title">
          <p className="dr-kicker">Selected run</p>
          <RunDetail
            run={selected}
            liveCommit={liveCommit}
            liveError={liveError}
          />
        </section>
      )}

      {report && !selected && (
        <section className="dr-empty" aria-labelledby="dr-empty-title">
          <h2 id="dr-empty-title">No delivery run recorded yet</h2>
          <p>
            Run the journey on your machine or through your existing runner,
            then record its printed receipt here. The receipt is bounded and
            contains no tokens or command output.
          </p>
          <pre>
            node scripts/delivery-journey.mjs --candidate --receipt
            output/delivery/candidate.json
          </pre>
        </section>
      )}

      <section className="dr-record" aria-labelledby="dr-record-title">
        <h2 id="dr-record-title">Record a receipt</h2>
        <p>
          Paste the receipt JSON or open the file the journey wrote. Recording
          never deploys, never approves content and never turns a failed step
          green.
        </p>
        <label htmlFor="dr-receipt">Receipt file</label>
        <input
          id="dr-receipt"
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(event) => void openFile(event.target.files?.[0])}
        />
        <label htmlFor="dr-receipt-text">Receipt JSON</label>
        <textarea
          id="dr-receipt-text"
          value={importText}
          rows={6}
          spellCheck={false}
          onChange={(event) => setImportText(event.target.value)}
          placeholder='{"schema":"app-composer.delivery-receipt/1", …}'
        />
        <div className="dr-actions">
          <button onClick={() => void record()} disabled={busy}>
            {busy ? "Recording…" : "Record receipt"}
          </button>
          <button
            className="dr-secondary"
            onClick={() => {
              setImportText("");
              setImportState("");
              if (fileInput.current) fileInput.current.value = "";
            }}
            disabled={busy}
          >
            Clear
          </button>
        </div>
        {importState && <p role="status">{importState}</p>}
      </section>

      {runs.length > 0 && (
        <section className="dr-list" aria-labelledby="dr-list-title">
          <h2 id="dr-list-title">Recorded runs</h2>
          <p>
            {report?.retention.stored ?? runs.length} of{" "}
            {report?.retention.maximum ?? 20} retained. Newer receipts replace
            older ones.
          </p>
          <ul>
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  className="dr-item"
                  data-selected={run.id === selected?.id}
                  onClick={() => chooseRun(run.id)}
                >
                  <span className="dr-item-runner">
                    {runnerLabels[run.runner]}
                  </span>
                  <span className="dr-item-mode">{deliveryLabels[run.mode]}</span>
                  <StateChip state={run.state} />
                  <span className="dr-item-commit">
                    {run.commit ? run.commit.slice(0, 12) : "no commit"} ·{" "}
                    {stamp(run.generatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dr-limits" aria-labelledby="dr-limits-title">
        <h2 id="dr-limits-title">What this view does not do</h2>
        <ul>
          {(report?.limits ?? []).map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
