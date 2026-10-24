import { useState } from "react";
import traceJson from "../lib/effect/run-trace.json";
import {
  LINKCHECK_COMMIT,
  copyText,
  linkcheckSource,
  outcomeLine,
  progressLine,
} from "../lib/effect/linkcheck.mjs";
import "../styles/effect-demo.css";

type PhaseState = "pass" | "block" | "review";
type Phase = {
  id: string;
  title: string;
  detail: string;
  state: PhaseState;
  reads: number;
  code?: string;
  blocked?: boolean;
};
type Target = {
  target: string;
  label: string;
  status: "verified" | "failed" | "uncertain";
  attempts: number;
  code: string;
  message: string;
  recovery: string;
  reconciled: boolean;
  findings: { pass: number; fix: number; review: number } | null;
  images: { verified: number; failed: number; missing: number } | null;
  bytes: number | null;
};
type Report = {
  status: "complete" | "partial" | "failed";
  totals: {
    verified: number;
    failed: number;
    uncertain: number;
    attempts: number;
  };
  recovery: string;
  limits: {
    targets: number;
    concurrency: number;
    attemptsPerTarget: number;
    attemptTimeout: string;
    retry: string;
    persisted: boolean;
  };
  targets: Target[];
};
type Scenario = {
  id: string;
  name: string;
  question: string;
  expectation: string;
  request: { contract: number; targets: string[] };
  scope: string;
  blocksAt: string | null;
  script: string;
  outcome:
    | { kind: "refused"; code: string; message: string; target: string | null }
    | { kind: "report"; report: Report };
  observed: {
    inspectorCalls: number;
    peakConcurrency: number;
    attempts: Record<string, number>;
  };
  phases: Phase[];
};
type Trace = {
  engine: {
    repository: string;
    module: string;
    tests: string;
    effect: string;
    label: string;
  };
  limits: Report["limits"];
  scenarios: Scenario[];
};

const trace = traceJson as unknown as Trace;
const scenarios = trace.scenarios;

const statusWord: Record<Target["status"], string> = {
  verified: "Verified",
  failed: "Needs a fix",
  uncertain: "Uncertain",
};

const reportWord: Record<Report["status"], string> = {
  complete: "Every page read",
  partial: "Partial evidence",
  failed: "No page read",
};

function TargetCard({ target }: { target: Target }) {
  return (
    <li className={`effect-target is-${target.status}`}>
      <div className="effect-target-head">
        <div>
          <p className="effect-target-label">{target.label}</p>
          <p className="effect-target-url">{target.target}</p>
        </div>
        <p className={`effect-chip is-${target.status}`}>
          {statusWord[target.status]}
        </p>
      </div>
      <p className="effect-target-message">{target.message}</p>
      <div className="effect-target-meta">
        <span>
          <code>{target.code}</code>
        </span>
        <span>
          {target.attempts} attempt{target.attempts === 1 ? "" : "s"}
          {target.reconciled ? " · repeated read succeeded" : ""}
        </span>
      </div>
      {target.status !== "verified" && (
        <p className="effect-target-recovery">{target.recovery}</p>
      )}
    </li>
  );
}

export default function EffectRunDemo() {
  const [selected, setSelected] = useState(scenarios[0].id);
  const [revealed, setRevealed] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const scenario =
    scenarios.find((entry) => entry.id === selected) ?? scenarios[0];
  const complete = revealed >= scenario.phases.length;
  const nextLabel =
    revealed === 0 ? "Run check" : complete ? "Run again" : "Next step";

  function choose(id: string) {
    setSelected(id);
    setRevealed(0);
    setCopyStatus("");
  }

  function advance() {
    setCopyStatus("");
    setRevealed((count) =>
      count >= scenario.phases.length ? 0 : count + 1,
    );
  }

  async function copy() {
    const summary = copyText(scenario, trace.engine, trace.limits);
    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus("Recorded summary copied with its source links.");
    } catch {
      setCopyStatus("Copy is unavailable here. The summary is in the panel below.");
    }
  }

  return (
    <div className="effect-demo">
      <div className="effect-demo-intro">
        <fieldset className="effect-scenarios" id="effect-scenarios">
          <legend>Choose a recorded run</legend>
          {scenarios.map((entry) => (
            <label
              className={`effect-scenario${entry.id === selected ? " is-selected" : ""}`}
              key={entry.id}
            >
              <input
                type="radio"
                name="effect-scenario"
                value={entry.id}
                checked={entry.id === selected}
                onChange={() => choose(entry.id)}
              />
              <span>
                <strong>{entry.name}</strong>
                <small>{entry.question}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <a className="effect-jump" href="#effect-run">
          Go to the run
        </a>
        <p className="effect-limits">
          <span>{trace.limits.targets} targets</span>
          <span>{trace.limits.concurrency} reads at a time</span>
          <span>{trace.limits.attemptsPerTarget} attempts per target</span>
          <span>Not persisted</span>
        </p>
      </div>

      <section className="effect-run" aria-labelledby="effect-run-title">
        <div className="effect-run-head">
          <div>
            <p className="effect-kicker">Recorded run · synthetic</p>
            <h2 id="effect-run-title">{scenario.name}</h2>
            <a className="effect-change" href="#effect-scenarios">
              Change run
            </a>
          </div>
          <p className={`effect-outcome-chip is-${complete ? "done" : "idle"}`}>
            {complete ? "Finished" : `${revealed}/${scenario.phases.length} steps`}
          </p>
        </div>
        <p className="effect-script">
          Scripted origin: {scenario.script}. This page replays the recorded
          phases; nothing is fetched here.
        </p>

        <div className="effect-controls">
          <button type="button" onClick={advance}>
            {nextLabel}
          </button>
          {!complete && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setRevealed(0);
                setCopyStatus("");
              }}
              disabled={revealed === 0}
            >
              Start over
            </button>
          )}
        </div>
        <p className="effect-progress" role="status" aria-live="polite">
          {progressLine(scenario, revealed)}
        </p>

        <ol className="effect-phases">
          {scenario.phases.map((phase, index) => {
            const shown = index < revealed;
            const next = index === revealed;
            return (
              <li
                key={phase.id}
                className={`effect-phase${shown ? ` is-${phase.state}` : ""}${next ? " is-next" : ""}`}
              >
                <div className="effect-phase-head">
                  <span className="effect-phase-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3>{phase.title}</h3>
                  <span className="effect-phase-state">
                    {shown
                      ? phase.state === "block"
                        ? "Blocked"
                        : phase.state === "review"
                          ? "Review"
                          : "Done"
                      : next
                        ? "Next"
                        : "Not reached"}
                  </span>
                </div>
                {shown ? (
                  <p>{phase.detail}</p>
                ) : (
                  <p className="effect-phase-pending">
                    {next
                      ? "Waiting for your next step."
                      : "Kept out of the run so far."}
                  </p>
                )}
                {shown && phase.code && (
                  <p className="effect-phase-code">
                    <code>{phase.code}</code>
                  </p>
                )}
              </li>
            );
          })}
        </ol>

        {complete && (
          <div className="effect-result">
            <div className="effect-result-head">
              <div>
                <p className="effect-kicker">Result</p>
                <h3>
                  {scenario.outcome.kind === "refused"
                    ? "Refused before any read"
                    : reportWord[scenario.outcome.report.status]}
                </h3>
              </div>
              <p className="effect-result-line">{outcomeLine(scenario)}</p>
            </div>

            {scenario.outcome.kind === "refused" ? (
              <div className="effect-refusal">
                <p>{scenario.outcome.message}</p>
                <p className="effect-note">
                  Reads attempted: {scenario.observed.inspectorCalls}. The batch
                  rejects the request instead of checking the pages it can.
                </p>
              </div>
            ) : (
              <>
                <div className="effect-totals">
                  <dl>
                    <div>
                      <dt>Verified</dt>
                      <dd>{scenario.outcome.report.totals.verified}</dd>
                    </div>
                    <div>
                      <dt>Needs a fix</dt>
                      <dd>{scenario.outcome.report.totals.failed}</dd>
                    </div>
                    <div>
                      <dt>Uncertain</dt>
                      <dd>{scenario.outcome.report.totals.uncertain}</dd>
                    </div>
                    <div>
                      <dt>Attempts</dt>
                      <dd>{scenario.outcome.report.totals.attempts}</dd>
                    </div>
                  </dl>
                </div>
                <ul className="effect-targets">
                  {scenario.outcome.report.targets.map((target) => (
                    <TargetCard target={target} key={target.target} />
                  ))}
                </ul>
                <p className="effect-recovery">
                  <strong>Next step.</strong> {scenario.outcome.report.recovery}
                </p>
              </>
            )}

            <div className="effect-share">
              <button type="button" className="secondary" onClick={copy}>
                Copy run summary
              </button>
              <span className="effect-copy-status" role="status">
                {copyStatus}
              </span>
              <details>
                <summary>Run summary text</summary>
                <pre>{copyText(scenario, trace.engine, trace.limits)}</pre>
              </details>
            </div>
          </div>
        )}
      </section>

      <p className="effect-provenance">
        Recorded by executing Link Check&rsquo;s batch runner with scripted
        inspectors at{" "}
        <a href={linkcheckSource(trace.engine.module)}>
          <code>{trace.engine.module}</code>
        </a>{" "}
        (Effect {trace.engine.effect}, commit {LINKCHECK_COMMIT.slice(0, 7)}), with{" "}
        <a href={linkcheckSource(trace.engine.tests)}>
          <code>{trace.engine.tests}</code>
        </a>{" "}
        guarding the trace. No network request, no persisted report and no live
        inspection.
      </p>
    </div>
  );
}
