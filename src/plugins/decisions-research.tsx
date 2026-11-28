import { useEffect, useState, type SubmitEvent } from "react";
import type { z } from "zod";
import type {
  researchInput,
  ResearchReply,
} from "../lib/decision-research-contract.ts";

export const researchViews = ["projects", "share", "feedback"] as const;
export type ResearchView = (typeof researchViews)[number];
const percent = new Intl.NumberFormat("en-AU", {
  style: "percent",
  maximumFractionDigits: 1,
});
const labels = {
  artwork: "Artwork",
  film: "Film",
  experience: "Experience",
  example: "Example",
};
const kindChoices = { all: "All types", ...labels };
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";

export function DecisionResearch({
  view,
  load,
  ask,
  onGo,
}: {
  view: ResearchView;
  load: (
    input: z.infer<typeof researchInput>,
    signal: AbortSignal,
  ) => Promise<ResearchReply>;
  ask: (id: string, revision: string) => Promise<string>;
  onGo: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<keyof typeof kindChoices>("all");
  const [project, setProject] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ResearchReply>();
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setBusy(true);
    setError("");
    const filters =
      view === "share" ? { kind, ...(project ? { project } : {}) } : {};
    void load({ view, ...filters, query: search, page }, signal)
      .then((value) => {
        if (!signal.aborted) setResult(value);
      })
      .catch((failure) => {
        if (!signal.aborted) setError(errorMessage(failure));
      })
      .finally(() => {
        if (!signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [view, load, search, kind, project, page, attempt]);

  function searchNow(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  }

  async function openArtwork(id: string, revision: string) {
    setCreating(id);
    setError("");
    try {
      onGo(await ask(id, revision));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setCreating("");
    }
  }

  return (
    <section className="decision-research" aria-labelledby="research-title">
      <h2 id="research-title" tabIndex={-1} data-decision-heading>
        {view === "projects"
          ? "Project interviews"
          : view === "share"
            ? "Share index"
            : "Saved feedback"}
      </h2>
      {view === "projects" && (
        <p>
          Pick a project or tell us what good looks like to you. Each interview
          has its own progress.
        </p>
      )}
      {view === "share" && (
        <p>
          Search the live public catalogue. Clef suggests editorial roles from
          metadata. Open the piece to judge it yourself.
        </p>
      )}
      {view === "feedback" && (
        <p>
          Your saved decision responses and Share reactions, most recent first.
        </p>
      )}
      {view !== "projects" && (
        <form className="decision-research-form" onSubmit={searchNow}>
          <label>
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              maxLength={100}
            />
          </label>
          {view === "share" && (
            <>
              <label>
                Type
                <select
                  value={kind}
                  onChange={(event) => {
                    setKind(
                      event.currentTarget.value as keyof typeof kindChoices,
                    );
                    setProject("");
                    setPage(1);
                  }}
                >
                  {Object.entries(kindChoices).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project
                <select
                  value={project}
                  onChange={(event) => {
                    setProject(event.currentTarget.value);
                    setPage(1);
                  }}
                >
                  <option value="">All projects</option>
                  {result?.view === "share" &&
                    result.projects.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          <button type="submit" className="decision-primary">
            Search
          </button>
        </form>
      )}
      {busy && <p role="status">Loading…</p>}
      {error && (
        <div className="decision-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {!busy && result?.view === "projects" && (
        <ul className="decision-research-list">
          {result.projects.map((item) => (
            <li key={item.id}>
              <div className="decision-research-row">
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.job}</p>
                </div>
                {item.start && (
                  <button
                    type="button"
                    onClick={() => onGo(item.start!)}
                    aria-label={`Review ${item.name}`}
                  >
                    {item.answered
                      ? `${item.answered} of ${item.questions} reviewed`
                      : `Start · ${item.questions} questions`}
                  </button>
                )}
              </div>
              <details>
                <summary>
                  Evidence and project link
                  {item.lifecycle === "active" || item.lifecycle === "personal"
                    ? ""
                    : ` · ${item.lifecycle}`}
                </summary>
                <p>{item.proof}</p>
                {item.assessment && (
                  <p>
                    Clef follow-up: {item.assessment.followup} ·{" "}
                    {percent.format(item.assessment.confidence)} confidence.
                    Evidence rubric: {item.assessment.proofScore.toFixed(1)} of
                    4. Owner example signal:{" "}
                    {percent.format(item.assessment.ownerExample)}.
                  </p>
                )}
                <a href={item.url} target="_blank" rel="noreferrer">
                  Open {item.name}
                </a>
              </details>
            </li>
          ))}
        </ul>
      )}
      {!busy && result?.view === "share" && (
        <>
          <p role="status">{result.total.toLocaleString()} matches</p>
          <ul className="decision-research-list">
            {result.items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <div className="decision-research-row">
                  <div>
                    <p className="decision-research-meta">
                      {labels[item.kind]} · {item.project}
                    </p>
                    <h3>
                      <a href={item.href} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    </h3>
                    {item.description && <p>{item.description}</p>}
                    {item.assessment && (
                      <p>
                        Clef suggests {item.assessment.label.toLowerCase()} ·{" "}
                        {percent.format(item.assessment.confidence)} confidence
                      </p>
                    )}
                    {item.kind !== "artwork" && item.feedbackHref && (
                      <a
                        href={item.feedbackHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open film feedback
                      </a>
                    )}
                  </div>
                  {item.kind === "artwork" && item.revision && (
                    <button
                      type="button"
                      disabled={Boolean(creating)}
                      aria-label={`Review ${item.title}`}
                      onClick={() => void openArtwork(item.id, item.revision!)}
                    >
                      {creating === item.id ? "Opening…" : "Review artwork"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!result.items.length && (
            <p>Try a different title, project or type.</p>
          )}
        </>
      )}
      {!busy && result?.view === "feedback" && (
        <ul className="decision-research-list">
          {result.items.map((item) => (
            <li key={`${item.source}-${item.id}`}>
              <p className="decision-research-meta">
                {item.source === "share" ? "Share" : "Decision"}
              </p>
              <h3>
                <a href={item.href}>{item.title}</a>
              </h3>
              {item.choices.length > 0 && <p>{item.choices.join(" · ")}</p>}
              {item.note && (
                <p className="decision-feedback-note">{item.note}</p>
              )}
            </li>
          ))}
          {!result.items.length && <li>No saved feedback matches.</li>}
        </ul>
      )}
      {!busy && result && result.view !== "projects" && (
        <div className="decision-actions">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous page
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            disabled={!result.hasMore}
            onClick={() => setPage((value) => value + 1)}
          >
            Next page
          </button>
        </div>
      )}
    </section>
  );
}
