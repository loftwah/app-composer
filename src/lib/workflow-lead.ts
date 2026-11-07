import type {
  WorkflowKind,
  WorkflowRun,
  WorkflowSnapshot,
} from "./workflow-contract.ts";

export type WorkflowRecipe = WorkflowSnapshot["recipes"][number];

/** The single state the page leads with. Every variant maps to an action the
 * existing workflow contract already supports. */
export type WorkflowLead =
  | { kind: "attention"; recipe: WorkflowRecipe; run: WorkflowRun }
  | {
      kind: "finished";
      recipe: WorkflowRecipe;
      run: WorkflowRun;
      scanAvailable: boolean;
    }
  | { kind: "waiting"; recipe: WorkflowRecipe }
  | { kind: "paused"; recipe: WorkflowRecipe };

/** SQLite CURRENT_TIMESTAMP is UTC without a zone marker. Normalise the stored
 * value before formatting it in the owner time convention. */
export function workflowIsoTime(value: string) {
  const text = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : value;
}

/** Real runs lead the page. Sample runs stay labelled in history: they are
 * deterministic fictional activity, not the workspace's current state. */
export function workflowLead(snapshot: WorkflowSnapshot): WorkflowLead {
  const recipe = (id: WorkflowKind) =>
    snapshot.recipes.find((value) => value.id === id)!;
  const runs = snapshot.runs
    .filter((run) => !run.synthetic)
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.id.localeCompare(left.id),
    );
  const actionable = (run: WorkflowRun) => recipe(run.recipe).enabled;

  const attention = runs.find(
    (run) =>
      run.state === "needs-attention" && run.retryable && actionable(run),
  );
  if (attention)
    return {
      kind: "attention",
      recipe: recipe(attention.recipe),
      run: attention,
    };

  const finished = runs.find(
    (run) => run.state === "finished" && Boolean(run.result || actionable(run)),
  );
  if (finished)
    return {
      kind: "finished",
      recipe: recipe(finished.recipe),
      run: finished,
      scanAvailable: recipe(finished.recipe).enabled,
    };

  const waiting = snapshot.recipes.find((value) => value.enabled);
  if (waiting) return { kind: "waiting", recipe: waiting };

  return { kind: "paused", recipe: snapshot.recipes[0]! };
}
