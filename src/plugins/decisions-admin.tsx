import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useBlocker, useLocation, useRouter } from "@tanstack/react-router";
import type { PluginAdminExports } from "emdash";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  adminDecisions,
  decisionPreview,
  type DecisionDetail,
  type DecisionResponse,
  type DecisionSummary,
} from "../lib/portfolio-decision-contract";
import "./decisions-admin.css";

class StaleDecisionResponse extends Error {}

const overview = "overview";
function questionLocation(id: string) {
  const query = new URLSearchParams(
    id === overview ? { view: overview } : { id },
  );
  return `${adminDecisions}?${query}`;
}
const endpoint = "/_emdash/api/plugins/composer-decisions/";
const percent = new Intl.NumberFormat("en-AU", {
  style: "percent",
  maximumFractionDigits: 1,
});
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again.";

async function call<T>(
  route: "read" | "record",
  payload: object,
  signal?: AbortSignal,
) {
  const result = await apiFetch(endpoint + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
    cache: "no-store",
  });
  if (route === "record" && result.status === 409)
    throw new StaleDecisionResponse("A newer response exists.");
  return parseApiResponse<T>(
    result,
    "The decision could not be loaded or saved.",
  );
}

const statuses = {
  open: "Unanswered",
  context: "Context saved",
  selected: "Answered",
};

function QuestionIndex({
  decisions,
  onGo,
}: {
  decisions: DecisionSummary[];
  onGo: (id: string) => void;
}) {
  const sections = new Map<
    string,
    { entry: DecisionSummary; number: number }[]
  >();
  decisions.forEach((entry, index) => {
    const section = entry.archived ? "Earlier questions" : entry.project;
    const group = sections.get(section) ?? [];
    group.push({ entry, number: index + 1 });
    sections.set(section, group);
  });

  const next = decisions.find(
    (entry) => !entry.archived && entry.status === "open",
  );
  return (
    <section className="decision-index" aria-labelledby="decision-index-title">
      <div className="decision-index-heading">
        <h2 id="decision-index-title" tabIndex={-1} data-decision-heading>
          Review questions
        </h2>
        {next && (
          <button
            type="button"
            className="decision-primary"
            onClick={() => onGo(next.id)}
          >
            Continue review
          </button>
        )}
      </div>
      {Array.from(sections, ([project, entries]) => (
        <section key={project}>
          <h3>{project}</h3>
          <ul>
            {entries.map(({ entry, number }) => (
              <li key={entry.id}>
                <button type="button" onClick={() => onGo(entry.id)}>
                  <span className="decision-number">
                    {entry.archived ? "–" : number}
                  </span>
                  <span>{entry.question}</span>
                  <small data-status={entry.status}>
                    {statuses[entry.status]}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function DecisionForm({
  detail,
  position,
  previous,
  next,
  onSave,
  onGo,
}: {
  detail: DecisionDetail;
  position: number;
  previous?: string;
  next?: string;
  onSave: (response: DecisionResponse) => void;
  onGo: (id: string) => void;
}) {
  const { decision, response } = detail;
  const [selected, setSelected] = useState(response?.selected ?? []);
  const [note, setNote] = useState(response?.note ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState<DecisionResponse>();
  const moving = useRef(false);
  const { maxSelections, options, recommendation } = decision;
  const single = maxSelections === 1;
  const isDirty =
    note.trim() !== (response?.note ?? "") ||
    selected.length !== (response?.selected.length ?? 0) ||
    selected.some((id) => !response?.selected.includes(id));
  const empty = !selected.length && !note.trim();
  const preferred = options.find(
    (option) => option.id === recommendation.choice,
  );

  useBlocker({
    disabled: !isDirty && !pending,
    enableBeforeUnload: isDirty || pending,
    shouldBlockFn: () =>
      moving.current ||
      pending ||
      (isDirty &&
        !window.confirm(
          "Leave this question and discard your unsaved changes?",
        )),
  });

  async function move(id: string) {
    if (moving.current || pending) return;
    if (isDirty && empty) {
      setError("Add a choice or context, or select Undo changes.");
      return;
    }
    moving.current = true;
    setError("");
    setPending(true);
    try {
      if (isDirty) {
        const saved = await call<{ response: DecisionResponse }>("record", {
          id: decision.id,
          selected,
          note,
          revision: response?.revision ?? 0,
        });
        onSave(saved.response);
        setNote(saved.response.note);
        setConflict(undefined);
      }
      onGo(id);
    } catch (failure) {
      if (failure instanceof StaleDecisionResponse) {
        try {
          const latest = await call<DecisionDetail>("read", {
            id: decision.id,
          });
          if (latest.response) {
            setConflict(latest.response);
            onSave(latest.response);
          }
        } catch (refreshFailure) {
          setError(`Your draft is still here. ${errorMessage(refreshFailure)}`);
        }
      } else {
        setError(errorMessage(failure));
      }
    } finally {
      moving.current = false;
      setPending(false);
    }
  }

  function setChoice(id: string, checked: boolean) {
    setError("");
    setSelected((current) =>
      single
        ? [id]
        : checked
          ? [...current, id]
          : current.filter((value) => value !== id),
    );
  }

  const advance = next ?? overview;
  const primaryLabel = pending
    ? "Saving…"
    : isDirty && !empty
      ? next
        ? "Save & next"
        : "Save & review"
      : next
        ? response
          ? "Next question"
          : "Skip for now"
        : "Review questions";

  return (
    <article className="decision-question">
      <div className="decision-question-meta">
        <span>{decision.project}</span>
        {decision.archived && <span>Earlier question</span>}
        {response && (
          <span data-status={response.selected.length ? "selected" : "context"}>
            {response.selected.length ? "Answer saved" : "Context saved"}
          </span>
        )}
      </div>
      <h2 tabIndex={-1} data-decision-heading>
        {decision.question}
      </h2>
      <p className="decision-context">{decision.context}</p>
      <form
        onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
          event.preventDefault();
          void move(advance);
        }}
      >
        <fieldset disabled={pending}>
          <legend>
            {single ? "Choose one" : `Choose up to ${maxSelections}`}
          </legend>
          <ol className="decision-options">
            {options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <li
                  key={option.id}
                  className="decision-option"
                  data-selected={checked || undefined}
                >
                  <label className="decision-choice">
                    <input
                      type={single ? "radio" : "checkbox"}
                      name={single ? `option-${decision.id}` : undefined}
                      checked={checked}
                      disabled={
                        !single && !checked && selected.length >= maxSelections
                      }
                      aria-label={option.title}
                      onChange={(event) =>
                        setChoice(option.id, event.currentTarget.checked)
                      }
                    />
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.pitch}</small>
                    </span>
                  </label>
                  {option.preview && (
                    <a
                      className="decision-artwork"
                      href={decisionPreview(option.preview)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${option.title} poster at full size`}
                    >
                      <img
                        src={decisionPreview(option.preview)}
                        alt={option.title}
                        width="1200"
                        height="630"
                      />
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="decision-choice-tools">
            {selected.length > 0 && (
              <button type="button" onClick={() => setSelected([])}>
                Clear choices
              </button>
            )}
            {isDirty && (
              <button
                type="button"
                onClick={() => {
                  setSelected(response?.selected ?? []);
                  setNote(response?.note ?? "");
                  setConflict(undefined);
                  setError("");
                }}
              >
                Undo changes
              </button>
            )}
          </div>
          <details className="decision-evidence">
            <summary>Recommendation, trade-offs and sources</summary>
            <div className="decision-evidence-inner">
              <p>
                <strong>{preferred?.title}</strong> ·{" "}
                {percent.format(recommendation.confidence)} reported confidence
              </p>
              <p>{recommendation.basis}</p>
              <dl>
                {options.map((option) => (
                  <div key={option.id}>
                    <dt>
                      {option.title}{" "}
                      {option.weight !== undefined && (
                        <small>
                          · {percent.format(option.weight)} option weight
                        </small>
                      )}
                    </dt>
                    <dd>
                      <strong>Expected outcome</strong> {option.outcome}
                    </dd>
                    <dd>
                      <strong>Pro</strong> {option.pro}
                    </dd>
                    <dd>
                      <strong>Con</strong> {option.con}
                    </dd>
                  </div>
                ))}
              </dl>
              <ul>
                {decision.sources.map((source, index) => (
                  <li key={`${source.url}-${index}`}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </details>
          <div className="decision-note">
            <label htmlFor="decision-note">
              Extra context <span>Optional</span>
            </label>
            <textarea
              id="decision-note"
              value={note}
              maxLength={4000}
              rows={3}
              onChange={(event) => {
                setNote(event.currentTarget.value);
                setError("");
              }}
            />
            <p>You can leave a note on its own.</p>
          </div>
        </fieldset>
        {conflict && (
          <div className="decision-conflict" role="status">
            <p>
              <strong>A newer response was saved.</strong> Your draft is still
              in the form.
            </p>
            <p>
              Saved choices{" "}
              {conflict.selected
                .map(
                  (id) =>
                    options.find((option) => option.id === id)?.title ?? id,
                )
                .join(", ") || "None"}
            </p>
            {conflict.note && <p>Saved context {conflict.note}</p>}
            <button
              type="button"
              onClick={() => {
                setSelected(conflict.selected);
                setNote(conflict.note);
                setConflict(undefined);
              }}
            >
              Use saved response
            </button>
          </div>
        )}
        {error && (
          <p className="decision-error" role="alert">
            {error}
          </p>
        )}
        <div className="decision-actions">
          <button
            type="button"
            disabled={!previous || pending}
            onClick={() => previous && void move(previous)}
          >
            Back
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void move(overview)}
          >
            Question list
          </button>
          <button
            type="submit"
            className="decision-primary"
            disabled={pending}
            aria-label={
              position
                ? `${primaryLabel} from question ${position}`
                : primaryLabel
            }
          >
            {primaryLabel}
          </button>
        </div>
      </form>
    </article>
  );
}

function DecisionsPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  const params = new URLSearchParams(search);
  const requested =
    params.get("view") === overview ? overview : params.get("id");
  const router = useRouter();
  const [decisions, setDecisions] = useState<DecisionSummary[]>([]);
  const [detail, setDetail] = useState<DecisionDetail>();
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("");
  const content = useRef<HTMLElement>(null);
  const focusNext = useRef(false);

  function go(id: string) {
    focusNext.current = true;
    router.history.push(questionLocation(id), undefined, {
      ignoreBlocker: true,
    });
  }

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setLoadError("");
    async function load() {
      const index = await call<{ decisions: DecisionSummary[] }>(
        "read",
        {},
        signal,
      );
      if (signal.aborted) return;
      setDecisions(index.decisions);
      const id =
        requested ??
        index.decisions.find(
          (entry) => !entry.archived && entry.status === "open",
        )?.id;
      if (!requested && id) {
        router.history.replace(questionLocation(id), undefined, {
          ignoreBlocker: true,
        });
        return;
      }
      const next =
        id && id !== overview
          ? await call<DecisionDetail>("read", { id }, signal)
          : undefined;
      if (!signal.aborted) setDetail(next);
    }
    void load()
      .catch((error) => {
        if (!signal.aborted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requested, attempt, router.history]);

  useEffect(() => {
    if (!loading && focusNext.current) {
      focusNext.current = false;
      content.current
        ?.querySelector<HTMLElement>("[data-decision-heading]")
        ?.focus({ preventScroll: true });
      content.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [loading]);

  const active = decisions.filter((entry) => !entry.archived);
  const completed = active.filter((entry) => entry.status !== "open").length;
  const position = detail
    ? active.findIndex((entry) => entry.id === detail.decision.id)
    : -1;
  const earlierResponses = decisions.filter(
    (entry) => entry.archived && entry.status !== "open",
  ).length;

  return (
    <section
      className="portfolio-decisions"
      aria-labelledby="decisions-title"
      ref={content}
    >
      <header className="decision-progress">
        <div>
          <h1 id="decisions-title">Decisions</h1>
          {active.length > 0 && (
            <p>
              {completed} of {active.length} current questions reviewed
            </p>
          )}
        </div>
        {active.length > 0 && (
          <progress
            aria-label="Questions reviewed"
            value={completed}
            max={active.length}
          />
        )}
      </header>
      <p className="decision-saved-status" role="status">
        {status}
      </p>
      {earlierResponses > 0 && requested !== overview && (
        <p className="decision-previous-responses">
          {earlierResponses} earlier{" "}
          {earlierResponses === 1 ? "response" : "responses"} saved. Open the
          question list to review them.
        </p>
      )}
      <div aria-busy={loading}>
        {loading && <p role="status">Loading question…</p>}
        {!loading && loadError && (
          <div className="decision-error" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Retry
            </button>
            <button type="button" onClick={() => void go(overview)}>
              Review questions
            </button>
          </div>
        )}
        {!loading && !loadError && detail && (
          <>
            {position >= 0 && (
              <p className="decision-position">
                Question {position + 1} of {active.length}
              </p>
            )}
            <DecisionForm
              key={detail.decision.id}
              detail={detail}
              position={position + 1}
              previous={active[position - 1]?.id}
              next={position === -1 ? undefined : active[position + 1]?.id}
              onGo={go}
              onSave={(response) => {
                setDetail({ ...detail, response });
                setStatus(
                  response.selected.length ? "Answer saved" : "Context saved",
                );
              }}
            />
          </>
        )}
        {!loading && !loadError && !detail && (
          <QuestionIndex decisions={decisions} onGo={(id) => void go(id)} />
        )}
      </div>
    </section>
  );
}

export const pages: PluginAdminExports["pages"] = { "/review": DecisionsPage };
