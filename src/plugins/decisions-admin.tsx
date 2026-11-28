import { useEffect, useState, type SubmitEvent } from "react";
import type { PluginAdminExports } from "emdash";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { useLocation } from "@tanstack/react-router";
import {
  adminDecisions,
  decisionPreview,
  type DecisionDetail,
  type DecisionResponse,
  type DecisionSummary,
} from "../lib/portfolio-decision-contract";
import "./decisions-admin.css";

class StaleDecisionResponse extends Error {}

const endpoint = "/_emdash/api/plugins/composer-decisions/";
const percentage = new Intl.NumberFormat("en-AU", {
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

function DecisionList({
  decisions,
  current,
}: {
  decisions: DecisionSummary[];
  current: string | undefined;
}) {
  const projects = new Map<string, DecisionSummary[]>();
  for (const decision of decisions) {
    const group = projects.get(decision.project) ?? [];
    group.push(decision);
    projects.set(decision.project, group);
  }
  return (
    <nav className="decision-index" aria-label="Decision queue">
      {Array.from(projects, ([project, entries]) => (
        <section key={project}>
          <h2>{project}</h2>
          <ul>
            {entries.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`${adminDecisions}?id=${entry.id}`}
                  aria-current={entry.id === current ? "page" : undefined}
                >
                  {entry.question}
                  {entry.status !== "open" && (
                    <small>
                      {entry.status === "selected"
                        ? "Answered"
                        : "Context saved"}
                    </small>
                  )}
                  {entry.status === "open" && entry.hasArtwork && (
                    <small>Artwork comparison</small>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function DecisionForm({
  detail,
  onSave,
}: {
  detail: DecisionDetail;
  onSave: (response: DecisionResponse) => void;
}) {
  const { decision, response } = detail;
  const [selected, setSelected] = useState(response?.selected ?? []);
  const [note, setNote] = useState(response?.note ?? "");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState<DecisionResponse>();
  const { maxSelections, options, recommendation } = decision;
  const showArt = options.some((option) => option.preview);
  const single = maxSelections === 1;
  const unchanged =
    note.trim() === (response?.note ?? "") &&
    selected.length === (response?.selected.length ?? 0) &&
    selected.every((id) => response?.selected.includes(id));
  const preferred = options.find(
    (option) => option.id === recommendation.choice,
  );

  function choose(id: string, checked: boolean) {
    setResult("");
    if (single) setSelected([id]);
    else
      setSelected((current) =>
        checked ? [...current, id] : current.filter((value) => value !== id),
      );
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setResult("");
    try {
      const saved = await call<{ response: DecisionResponse }>("record", {
        id: decision.id,
        selected,
        note,
        revision: response?.revision ?? 0,
      });
      onSave(saved.response);
      setConflict(undefined);
      setNote(saved.response.note);
      setResult(
        saved.response.selected.length ? "Decision saved." : "Context saved.",
      );
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
          setError(
            `Your draft is still here. The latest response could not be loaded. ${errorMessage(refreshFailure)}`,
          );
        }
      } else {
        setError(errorMessage(failure));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="decision-review">
      <h2>{decision.question}</h2>
      <p className="decision-context">{decision.context}</p>
      <section className="decision-recommendation" aria-label="Recommendation">
        <p>
          <strong>Recommendation</strong> {preferred?.title}
        </p>
        <p>
          <strong>
            Confidence {percentage.format(recommendation.confidence)}
          </strong>{" "}
          · {recommendation.basis}
        </p>
      </section>
      <form onSubmit={submit}>
        <fieldset disabled={pending}>
          <legend>
            {single
              ? "Choose one option"
              : `Choose up to ${maxSelections} options`}
          </legend>
          <div
            className={
              showArt
                ? "decision-options decision-options-art"
                : "decision-options"
            }
          >
            {options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <section
                  key={option.id}
                  className="decision-option"
                  data-selected={checked || undefined}
                >
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
                        alt={option.pitch}
                        width="1200"
                        height="630"
                      />
                    </a>
                  )}
                  <div className="decision-option-copy">
                    <label className="decision-choice">
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={single ? `option-${decision.id}` : undefined}
                        checked={checked}
                        disabled={
                          !single &&
                          !checked &&
                          selected.length >= maxSelections
                        }
                        onChange={(event) =>
                          choose(option.id, event.currentTarget.checked)
                        }
                      />
                      <span>{option.title}</span>
                    </label>
                    {option.weight !== undefined && (
                      <p className="decision-weight">
                        Clef option weight {percentage.format(option.weight)}
                      </p>
                    )}
                    <p>{option.pitch}</p>
                    <dl>
                      <dt>Expected outcome</dt>
                      <dd>{option.outcome}</dd>
                      <dt>Pro</dt>
                      <dd>{option.pro}</dd>
                      <dt>Con</dt>
                      <dd>{option.con}</dd>
                    </dl>
                  </div>
                </section>
              );
            })}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              className="decision-clear"
              onClick={() => {
                setSelected([]);
                setResult("");
              }}
            >
              Clear choices
            </button>
          )}
          <div className="decision-note">
            <label htmlFor="decision-note">Extra context</label>
            <p id="decision-note-hint">
              Add constraints, combine ideas or leave context on its own.
            </p>
            <textarea
              id="decision-note"
              aria-describedby="decision-note-hint"
              value={note}
              maxLength={4000}
              onChange={(event) => {
                setNote(event.currentTarget.value);
                setResult("");
              }}
              rows={4}
            />
          </div>
        </fieldset>
        {conflict && (
          <div className="decision-recommendation" role="status">
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
          </div>
        )}
        <div className="decision-actions">
          {conflict && (
            <button
              type="button"
              className="decision-clear"
              disabled={pending}
              onClick={() => {
                setSelected(conflict.selected);
                setNote(conflict.note);
                setConflict(undefined);
              }}
            >
              Use saved response
            </button>
          )}
          <button
            type="submit"
            disabled={
              pending || unchanged || (!selected.length && !note.trim())
            }
          >
            {pending
              ? "Saving…"
              : !selected.length && note.trim()
                ? "Save context"
                : conflict
                  ? "Save my choices"
                  : "Save decision"}
          </button>
          {result && <span role="status">{result}</span>}
        </div>
        {error && (
          <p className="decision-error" role="alert">
            {error}
          </p>
        )}
      </form>
      <details className="decision-sources">
        <summary>Sources</summary>
        <ul>
          {decision.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function DecisionsPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  const requested = new URLSearchParams(search).get("id");
  const [decisions, setDecisions] = useState<DecisionSummary[]>([]);
  const [detail, setDetail] = useState<DecisionDetail>();
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

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
      const id = requested ?? index.decisions[0]?.id;
      const next = id
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
  }, [requested, attempt]);

  return (
    <main className="portfolio-decisions">
      <header>
        <h1>Decisions</h1>
        <p>
          Compare projects, artwork and next steps. Your answers stay private.
        </p>
      </header>
      <div className="decision-workspace">
        {decisions.length > 0 && (
          <DecisionList
            decisions={decisions}
            current={requested ?? detail?.decision.id}
          />
        )}
        <div className="decision-body" aria-busy={loading}>
          {loading && <p role="status">Loading decisions…</p>}
          {!loading && loadError && (
            <div role="alert">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !loadError && detail && (
            <DecisionForm
              key={detail.decision.id}
              detail={detail}
              onSave={(response) => {
                setDetail({ ...detail, response });
                setDecisions((current) =>
                  current.map((item) =>
                    item.id !== detail.decision.id
                      ? item
                      : {
                          ...item,
                          status: response.selected.length
                            ? "selected"
                            : "context",
                        },
                  ),
                );
              }}
            />
          )}
          {!loading && !loadError && !detail && (
            <p>There are no decisions ready to review.</p>
          )}
        </div>
      </div>
    </main>
  );
}

export const pages: PluginAdminExports["pages"] = { "/review": DecisionsPage };
