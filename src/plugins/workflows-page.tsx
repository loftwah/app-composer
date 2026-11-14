import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import {
  exportWorkflow,
  workflowExport,
  workflowRecipes,
  type WorkflowKind,
  type WorkflowSnapshot,
  type WorkflowRun,
} from "../lib/workflow-contract";
import { workflowLead, workflowIsoTime, type WorkflowLead } from "../lib/workflow-lead";
import { utcTime } from "../lib/admin-time";
import { workflowCall } from "./workflows/api";
import { workspaceSelection } from "./stacks/workspace-scope";
import "./workflows-page.css";
import { focusStoredRecord } from "./record-anchor";

export function WorkflowsPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <Workflows key={search} search={search} />;
}

function leadTitle(lead: WorkflowLead) {
  if (lead.kind === "attention")
    return lead.run.result?.title ?? "A workflow run needs attention";
  if (lead.kind === "finished")
    return lead.run.result?.title ?? lead.recipe.name;
  return lead.recipe.name;
}

function leadState(lead: WorkflowLead) {
  if (lead.kind === "attention") return "Needs attention";
  if (lead.kind === "finished") return "Finished";
  if (lead.kind === "waiting") return "Waiting for events";
  return "Paused";
}

export function Workflows({ search }: { search: string }) {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot>();
  const anchorFocused = useRef(false);
  useEffect(() => {
    if (snapshot && !anchorFocused.current)
      anchorFocused.current = focusStoredRecord("workflow-run-");
  }, [snapshot]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [manual, setManual] = useState("");
  const pending = useRef(false),
    alive = useRef(true),
    generation = useRef(0);
  const selection = useRef<string | undefined>(undefined);
  const invalidScope = useRef(false);
  const sampleOperations = useRef<Record<string, string>>({});
  const canWrite = Boolean(snapshot && snapshot.workspace.role !== "viewer");

  async function run(
    action: string,
    fields: Record<string, unknown> = {},
    message = "",
  ) {
    if (pending.current || invalidScope.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const epoch = ++generation.current;
    try {
      const result = await workflowCall(action, selection.current, fields);
      if (!alive.current || epoch !== generation.current) return false;
      selection.current = result.workspace.id;
      setSnapshot(result);
      setNames((previous) =>
        Object.fromEntries(
          result.recipes.map((recipe) => [
            recipe.id,
            previous[recipe.id] ?? recipe.name,
          ]),
        ),
      );
      if (message) setNotice(message);
      return true;
    } catch (cause) {
      if (alive.current && epoch === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "This workflow could not be confirmed. Refresh before retrying.",
        );
      return false;
    } finally {
      if (alive.current && epoch === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    try {
      selection.current = workspaceSelection(search);
      void run("list");
    } catch (cause) {
      invalidScope.current = true;
      setError(
        cause instanceof Error
          ? cause.message
          : "Choose a workspace from Workspace access.",
      );
    }
    return () => {
      alive.current = false;
      generation.current++;
      pending.current = false;
    };
  }, []);

  function save(recipe: WorkflowKind, enabled: boolean) {
    const current = snapshot?.recipes.find((value) => value.id === recipe);
    if (!current) return;
    if (!names[recipe]?.trim()) {
      setError("Give this recipe a name before saving.");
      return;
    }
    void run(
      "save",
      {
        recipe,
        expectedRevision: current.revision,
        name: names[recipe],
        enabled,
      },
      enabled
        ? "Recipe turned on. It can prepare drafts for supported events. Use Scan now to check existing records or catch missed events."
        : "Recipe saved and paused. New scans and retries of real records are stopped.",
    );
  }
  async function sample(recipe: WorkflowKind, fail: boolean) {
    const key = `${recipe}:${fail}`;
    sampleOperations.current[key] ??= crypto.randomUUID();
    if (
      await run(
        "sample",
        { recipe, operation: sampleOperations.current[key], fail },
        fail
          ? "The sample failure is saved in history. Open it and restore the sample to exercise recovery."
          : "The sample result is saved in history. No live records or provider were changed.",
      )
    )
      delete sampleOperations.current[key];
  }
  function scan(recipe: WorkflowKind) {
    const current = snapshot?.recipes.find((value) => value.id === recipe);
    if (!current) return;
    void run(
      "scan",
      { recipe, expectedRevision: current.revision },
      "Scan finished. Records already in the history were not repeated for the same revision.",
    );
  }
  function download(name: string, value: unknown) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyResult(run: WorkflowRun) {
    if (!run.result) return;
    const text = `${run.result.title}\n\n${run.result.body}\n\n${new URL(run.result.href, "https://composer.loftwah.com").href}`;
    try {
      await navigator.clipboard.writeText(text);
      setNotice(
        "Draft copied. Check the source and its limits before sharing.",
      );
      setManual("");
    } catch {
      setManual(text);
      setNotice(
        "Your browser could not copy this. Select and copy the draft below.",
      );
    }
  }
  async function importRecipe(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8000)
        throw Error("Choose a recipe JSON file smaller than 8 KB.");
      const imported = workflowExport.parse(JSON.parse(await file.text()));
      if (!alive.current) return;
      setNames((previous) => ({
        ...previous,
        [imported.recipe]: imported.name,
      }));
      setNotice(
        "Recipe name and type loaded into the editor. Save it paused to review it, then turn it on when ready. The import grants no access and contains no credentials.",
      );
      setError("");
    } catch {
      if (alive.current)
        setError(
          "This file could not be imported. Use a version 1 Composer recipe with matching trigger and action, and no secrets. Existing recipes are unchanged.",
        );
    }
  }

  const lead = snapshot ? workflowLead(snapshot) : null;

  return (
    <div className="composer-workflows" aria-busy={busy}>
      <div className="cw-heading">
        <div>
          <h1>Workflows</h1>
          <p>
            Prepare a summary after a publication, or an item to help you
            review a failed platform request.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || invalidScope.current}
          onClick={() =>
            void run("list", {}, "Saved recipes and history refreshed.")
          }
        >
          Refresh
        </button>
      </div>
      {!snapshot && !error && (
        <p className="cw-status" role="status">
          Confirming the selected workspace…
        </p>
      )}
      {error && (
        <p className="cw-error" role="alert">
          {error}
        </p>
      )}
      {snapshot && (
        <p className="cw-status" role="status">
          {busy ? "Checking the saved recipe and source…" : notice}
        </p>
      )}
      {snapshot && lead && (
        <section className="cw-next" aria-labelledby="cw-next-title">
          <p className="cw-kicker">Next</p>
          <h2 id="cw-next-title">{leadTitle(lead)}</h2>
          <p className="cw-lead-state">{leadState(lead)}</p>
          <p className="cw-lead-facts">
            <span>
              Recipe <strong>{lead.recipe.name}</strong>
            </span>
            {(lead.kind === "attention" || lead.kind === "finished") && (
              <>
                <span>
                  Event <code>{lead.run.event}</code>
                </span>
                <span>
                  Observed{" "}
                  <time dateTime={workflowIsoTime(lead.run.createdAt)}>
                    {utcTime(workflowIsoTime(lead.run.createdAt))}
                  </time>
                </span>
              </>
            )}
            <span>
              State <strong>{leadState(lead)}</strong>
            </span>
          </p>
          <div className="cw-actions">
            {lead.kind === "attention" && (
              <button
                type="button"
                className="cw-primary"
                disabled={busy || !canWrite}
                onClick={() => void runAction(lead.run)}
              >
                {lead.run.synthetic
                  ? "Restore sample & retry"
                  : "Recheck source & retry"}
              </button>
            )}
            {lead.kind === "attention" && lead.run.result && (
              <a href={lead.run.result.href}>Open result</a>
            )}
            {lead.kind === "finished" && lead.run.result && (
              <a className="cw-primary" href={lead.run.result.href}>
                Open result
              </a>
            )}
            {lead.kind === "finished" && lead.scanAvailable && (
              <button
                type="button"
                disabled={busy || !canWrite}
                onClick={() => scan(lead.recipe.id)}
              >
                Scan now
              </button>
            )}
            {lead.kind === "waiting" && (
              <button
                type="button"
                className="cw-primary"
                disabled={busy || !canWrite}
                onClick={() => scan(lead.recipe.id)}
              >
                Scan now
              </button>
            )}
            {lead.kind === "paused" && (
              <button
                type="button"
                className="cw-primary"
                disabled={busy || !canWrite}
                onClick={() => save(lead.recipe.id, true)}
              >
                Save & turn on
              </button>
            )}
          </div>
          <p>
            {lead.kind === "attention"
              ? lead.run.message
              : lead.kind === "finished"
                ? (lead.run.result?.body ?? lead.run.message)
                : lead.kind === "waiting"
                  ? "No run is saved here yet. Scan now checks current records and prepares a draft when it finds a match."
                  : !lead.recipe.scopeMatches
                    ? "This recipe belongs to another account or environment. Save & turn on will save it for the account and environment selected here."
                    : "This recipe is paused: it will not scan or retry real records. Save & turn on to resume handling supported events."}
          </p>
          <p className="cw-meta">
            Workspace <strong>{snapshot.workspace.name}</strong> ·{" "}
            {snapshot.workspace.role} ·{" "}
            <strong>{snapshot.target.environment}</strong> · Account{" "}
            <code>{snapshot.target.account}</code>
          </p>
          {!canWrite && (
            <p className="cw-muted">
              Your {snapshot.workspace.role} role can read this state. A
              workspace owner or editor must take the action.
            </p>
          )}
        </section>
      )}
      <p className="cw-mode">
        When a supported publication or platform change is saved, an enabled
        recipe can prepare a draft. Scan now checks up to 20 current records
        for missed follow-ups. These recipes do not schedule background work,
        send email, publish a post or fix a failed request.
      </p>
      <div className="cw-links">
        <a href="/_emdash/admin/plugins/composer-stacks/workspaces">
          Workspace access
        </a>
        <a href="/prompts#workflow">Prepare a workflow prompt</a>
        <a href="/resources/hook#resource">Hooks and external examples</a>
      </div>
      {snapshot && (
        <>
          <section className="cw-recipes" aria-label="Native recipes">
            {workflowRecipes.map((recipe) => {
              const saved = snapshot.recipes.find(
                (value) => value.id === recipe.id,
              )!;
              const history = snapshot.runs.filter(
                (run) => run.recipe === recipe.id,
              );
              return (
                <article key={recipe.id} className="cw-recipe">
                  <div className="cw-recipe-title">
                    <h2>{recipe.name}</h2>
                    <span>
                      {saved.enabled ? "Waiting for events" : "Paused"}
                    </span>
                  </div>
                  <dl className="cw-rule">
                    <div>
                      <dt>When</dt>
                      <dd>{recipe.when}</dd>
                    </div>
                    <div>
                      <dt>If</dt>
                      <dd>{recipe.condition}</dd>
                    </div>
                    <div>
                      <dt>Do</dt>
                      <dd>{recipe.action}</dd>
                    </div>
                  </dl>
                  <p>{recipe.help}</p>
                  {!saved.scopeMatches && (
                    <p className="cw-error">
                      This recipe was saved for another account or environment.
                      Review the selected target before saving it here.
                    </p>
                  )}
                  <label htmlFor={`workflow-name-${recipe.id}`}>
                    Name in your admin
                    <input
                      id={`workflow-name-${recipe.id}`}
                      value={names[recipe.id] ?? saved.name}
                      maxLength={80}
                      disabled={busy || !canWrite}
                      onChange={(event) =>
                        setNames((previous) => ({
                          ...previous,
                          [recipe.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="cw-actions">
                    <button
                      type="button"
                      disabled={busy || !canWrite}
                      onClick={() => save(recipe.id, true)}
                    >
                      {saved.enabled ? "Save & keep on" : "Save & turn on"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !canWrite}
                      onClick={() => save(recipe.id, false)}
                    >
                      {saved.enabled ? "Pause" : "Save paused"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !canWrite || !saved.enabled}
                      onClick={() => scan(recipe.id)}
                    >
                      Scan now
                    </button>
                  </div>
                  <div className="cw-actions cw-secondary">
                    <button
                      type="button"
                      disabled={busy || !canWrite}
                      onClick={() => void sample(recipe.id, false)}
                    >
                      Try with sample data
                    </button>
                    <button
                      type="button"
                      disabled={busy || !canWrite}
                      onClick={() => void sample(recipe.id, true)}
                    >
                      Try an unavailable source
                    </button>
                    <button
                      type="button"
                      disabled={
                        busy || !(names[recipe.id] ?? saved.name).trim()
                      }
                      onClick={() =>
                        download(
                          `composer-${recipe.id}.json`,
                          exportWorkflow(
                            recipe.id,
                            names[recipe.id] ?? saved.name,
                          ),
                        )
                      }
                    >
                      Export recipe
                    </button>
                  </div>
                  <p className="cw-history-label">
                    {history.length} {history.length === 1 ? "run" : "runs"} in
                    recent history
                  </p>
                </article>
              );
            })}
          </section>
          <section className="cw-history" aria-labelledby="workflow-history">
            <div className="cw-heading">
              <h2 id="workflow-history">Recent runs</h2>
              <label className="cw-import">
                Import recipe
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={busy || !canWrite}
                  onChange={(event) => {
                    void importRecipe(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <p>
              The latest 50 runs appear here; each workspace can retain up to 500 real runs.
              Each source revision has one result. Sample runs are labelled and
              do not count as live activity.
            </p>
            {!snapshot.runs.length && (
              <p className="cw-empty">
                Try a sample to inspect the result. Turn on a recipe and scan
                when your workspace has a publication or a failed platform
                request.
              </p>
            )}
            {snapshot.runs.map((run) => (
              <article
                key={run.id}
                id={`workflow-run-${run.id}`}
                className="cw-run"
              >
                <div className="cw-run-title">
                  <h3>
                    {run.result?.title ??
                      workflowRecipes.find(
                        (recipe) => recipe.id === run.recipe,
                      )!.name}
                  </h3>
                  <span>
                    {run.state === "finished" ? "Finished" : "Needs attention"}
                    {run.synthetic ? " · Sample data" : ""}
                  </span>
                </div>
                <p>{run.message}</p>
                <ol className="cw-steps">
                  {run.steps.map((step) => (
                    <li key={step}>
                      {
                        {
                          observed: "Source event retained",
                          "source-checked": "Source checked",
                          "draft-prepared": "Draft prepared",
                        }[step]
                      }
                    </li>
                  ))}
                </ol>
                {run.result && (
                  <div className="cw-result">
                    <p>{run.result.body}</p>
                    <div className="cw-actions">
                      <a href={run.result.href}>Open the source</a>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void copyResult(run)}
                      >
                        Copy draft
                      </button>
                    </div>
                  </div>
                )}
                {run.retryable && (
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !canWrite ||
                      (!run.synthetic &&
                        !snapshot.recipes.find(
                          (recipe) => recipe.id === run.recipe,
                        )?.enabled)
                    }
                    onClick={() => void runAction(run)}
                  >
                    {run.synthetic
                      ? "Restore sample & retry"
                      : "Recheck source & retry"}
                  </button>
                )}
                <details className="cw-details">
                  <summary>Operation details</summary>
                  <dl>
                    <dt>Source</dt>
                    <dd>
                      <code>{run.source}</code> · revision {run.sourceRevision}
                    </dd>
                    <dt>Event</dt>
                    <dd>
                      <code>{run.event}</code>
                    </dd>
                    <dt>Run</dt>
                    <dd>
                      <code>{run.id}</code> · revision {run.revision}
                    </dd>
                    <dt>Attempts</dt>
                    <dd>{run.attempts} of 3</dd>
                    <dt>Recipe revision</dt>
                    <dd>{run.recipeRevision}</dd>
                    <dt>Created</dt>
                    <dd>{run.createdAt} UTC</dd>
                  </dl>
                </details>
              </article>
            ))}
          </section>
        </>
      )}
      {manual && (
        <label className="cw-manual">
          Manual copy — select this draft
          <textarea
            value={manual}
            readOnly
            rows={8}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
    </div>
  );

  async function runAction(item: WorkflowRun) {
    await run(
      "retry",
      { run: item.id, expectedRevision: item.revision },
      "The saved source was checked again. Completed steps were not sent to an external provider.",
    );
  }
}
