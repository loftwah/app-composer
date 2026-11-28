import { useEffect, useState, type SubmitEvent } from "react";
import type { z } from "zod";
import {
  decisionCategories,
  decisionReactionLabels,
} from "../lib/portfolio-decision-contract";
import { DecisionMedia } from "./decision-response-content";
import {
  socialLabels,
  socialStatuses,
  type SocialStatus,
  type researchInput,
  type ResearchReply,
} from "../lib/decision-research-contract.ts";
import { DecisionIntelligencePanel } from "./decision-intelligence-panel";

export const researchViews = [
  "intel",
  "projects",
  "share",
  "feedback",
] as const;
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
  initialSocial,
  initialKind,
}: {
  view: ResearchView;
  load: (
    input: z.infer<typeof researchInput>,
    signal: AbortSignal,
  ) => Promise<ResearchReply>;
  ask: (id: string, revision: string) => Promise<string>;
  onGo: (id: string) => void;
  initialSocial: string | null;
  initialKind: string | null;
}) {
  const params =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const initialQuery =
    view === "share" ? (params.get("query") ?? "").trim().slice(0, 100) : "";
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  const [sort, setSort] = useState(
    view === "share" && params.get("sort") === "clef" ? "clef" : "",
  );
  const [social, setSocial] = useState<SocialStatus | "">(
    socialStatuses.find((status) => status === initialSocial) ?? "",
  );
  const [kind, setKind] = useState<keyof typeof kindChoices>(
    social
      ? "artwork"
      : initialKind && Object.hasOwn(kindChoices, initialKind)
        ? (initialKind as keyof typeof kindChoices)
        : "all",
  );
  const urlProject = params.get("project") ?? "";
  const [project, setProject] = useState(
    view === "share" && /^[a-z0-9][a-z0-9-]{0,127}$/.test(urlProject)
      ? urlProject
      : "",
  );
  const [category, setCategory] = useState<
    (typeof decisionCategories)[number] | ""
  >("");
  const [page, setPage] = useState(
    view === "share"
      ? Math.min(
          1000,
          Math.max(1, Number.parseInt(params.get("page") ?? "", 10) || 1),
        )
      : 1,
  );
  const [result, setResult] = useState<ResearchReply>();
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (view !== "share") return;
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({
      query: search,
      kind: kind === "all" ? "" : kind,
      project,
      social,
      sort,
      page: page === 1 ? "" : String(page),
    })) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href !== window.location.href)
      window.history.replaceState(window.history.state, "", url);
  }, [view, search, kind, project, social, sort, page]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setBusy(true);
    setError("");
    const filters =
      view === "share"
        ? {
            kind,
            ...(project ? { project } : {}),
            ...(social ? { social } : {}),
            ...(sort === "clef" ? { sort: "clef" as const } : {}),
          }
        : view === "feedback"
          ? {
              ...(project ? { feedbackProject: project } : {}),
              ...(category ? { category } : {}),
            }
          : {};
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
  }, [
    view,
    load,
    search,
    kind,
    project,
    category,
    page,
    attempt,
    social,
    sort,
  ]);

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
        {view === "intel"
          ? "Intelligence"
          : view === "projects"
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
          Find public artwork, films and examples.{" "}
          {sort === "clef"
            ? "Clef’s best orders reviewed artwork by first impression in a social feed. Other work follows."
            : "Social review labels apply to the artwork revision Clef saw."}
        </p>
      )}
      {view === "feedback" && (
        <p>
          Your saved decision responses and Share reactions, most recent first.
        </p>
      )}
      {(view === "share" || view === "feedback") && (
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
                    setSocial("");
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
                Sort
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.currentTarget.value);
                    setPage(1);
                  }}
                >
                  <option value="">Catalogue order</option>
                  <option value="clef">Clef’s best</option>
                </select>
              </label>
              <label>
                Social review
                <select
                  value={social}
                  onChange={(event) => {
                    const value =
                      socialStatuses.find(
                        (status) => status === event.currentTarget.value,
                      ) ?? "";
                    setSocial(value);
                    if (value) {
                      setKind("artwork");
                      setProject("");
                    }
                    setPage(1);
                  }}
                >
                  <option value="">All reviews</option>
                  {socialStatuses.map((status) => (
                    <option key={status} value={status}>
                      {socialLabels[status]}
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
          {view === "feedback" && (
            <>
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
                  {result?.view === "feedback" &&
                    result.projects.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Category
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.currentTarget.value as typeof category);
                    setPage(1);
                  }}
                >
                  <option value="">All categories</option>
                  {decisionCategories.map((name) => (
                    <option key={name} value={name}>
                      {name}
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
      {!busy && result?.view === "intel" && (
        <DecisionIntelligencePanel result={result} onGo={onGo} />
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
                    {item.filmOpening && (
                      <p>
                        <strong>Opening review</strong> · {item.filmOpening}
                      </p>
                    )}
                    {item.social ? (
                      <details>
                        <summary>
                          Why this ranks here · {item.social.score.toFixed(2)} /
                          4
                        </summary>
                        <p>
                          <strong>{socialLabels[item.social.status]}</strong> ·{" "}
                          {item.social.placement}. {item.social.fix}.
                        </p>
                        <p>
                          Clef-flash · first impression in a social feed ·{" "}
                          {item.social.rubric}. No saved confidence estimate.
                        </p>
                        <p>
                          Review snapshot {item.social.reviewedAt.slice(0, 10)}{" "}
                          UTC · source revision{" "}
                          <code title={item.social.revision}>
                            {item.social.revision.slice(0, 12)}
                          </code>
                        </p>
                      </details>
                    ) : (
                      sort === "clef" && (
                        <p>
                          {item.kind === "artwork"
                            ? "Needs a current artwork review"
                            : "Outside the artwork ranking"}
                        </p>
                      )
                    )}
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
                {[
                  item.project ?? "Decision",
                  item.category,
                  ...(item.tags ?? []),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <h3>
                <a href={item.href}>{item.title}</a>
              </h3>
              {item.reaction && <p>{decisionReactionLabels[item.reaction]}</p>}
              {item.choices.length > 0 && <p>{item.choices.join(" · ")}</p>}
              {item.note && (
                <p className="decision-feedback-note">{item.note}</p>
              )}
              <DecisionMedia
                id={item.id}
                links={item.media}
                image={item.image}
              />
            </li>
          ))}
          {!result.items.length && <li>No saved feedback matches.</li>}
        </ul>
      )}
      {!busy &&
        result &&
        (result.view === "share" || result.view === "feedback") && (
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
