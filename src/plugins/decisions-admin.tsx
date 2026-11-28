import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useBlocker, useLocation, useRouter } from "@tanstack/react-router";
import type { PluginAdminExports } from "emdash";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  adminDecisions,
  decisionPreview,
  decisionImageTypes,
  decisionImageUrl,
  decisionMediaUrl,
  decisionReactionLabels,
  maxDecisionImageBytes,
  specialDecisionChoices,
  type DecisionReaction,
  type DecisionDetail,
  type DecisionResponse,
  type DecisionSummary,
} from "../lib/portfolio-decision-contract";
import {
  DecisionResearch,
  researchViews,
  type ResearchView,
} from "./decisions-research";
import type {
  researchInput,
  ResearchReply,
} from "../lib/decision-research-contract";
import type { z } from "zod";
import { DecisionResponseContent } from "./decision-response-content";
import "./decisions-admin.css";

class StaleDecisionResponse extends Error {}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () =>
      reject(new Error("The image could not be read. Choose it again."));
    reader.readAsDataURL(file);
  });
}

const overview = "overview";
const isResearchView = (value: string | null): value is ResearchView =>
  researchViews.some((view) => view === value);
function questionLocation(id: string) {
  const query = new URLSearchParams(
    id === overview || isResearchView(id) ? { view: id } : { id },
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
  route: "read" | "record" | "research" | "artwork",
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
  if (route === "record" && result.status === 409) {
    const body = (await result
      .clone()
      .json()
      .catch(() => null)) as { error?: { code?: string } } | null;
    if (body?.error?.code === "STALE_RESPONSE")
      throw new StaleDecisionResponse("A newer response exists.");
  }
  return parseApiResponse<T>(
    result,
    "The decision could not be loaded or saved.",
  );
}

const loadResearch = (
  input: z.infer<typeof researchInput>,
  signal: AbortSignal,
) => call<ResearchReply>("research", input, signal);
const startArtwork = async (assetId: string, revision: string) =>
  (await call<{ decision: { id: string } }>("artwork", { assetId, revision }))
    .decision.id;

const statuses = {
  open: "Unanswered",
  context: "Feedback saved",
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
  backTo,
}: {
  detail: DecisionDetail;
  position: number;
  previous?: string;
  next?: string;
  onSave: (response: DecisionResponse, announce?: boolean) => void;
  onGo: (id: string) => void;
  backTo: string;
}) {
  const { decision, response } = detail;
  const [selected, setSelected] = useState(response?.selected ?? []);
  const [note, setNote] = useState(response?.note ?? "");
  const [reaction, setReaction] = useState(response?.reaction ?? null);
  const [media, setMedia] = useState(response?.media ?? []);
  const [image, setImage] = useState<File | null | undefined>();
  const [history, setHistory] = useState(detail.earlier);
  const [moreHistory, setMoreHistory] = useState(detail.historyHasMore);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState<DecisionResponse>();
  const moving = useRef(false);
  const { maxSelections, options, recommendation } = decision;
  const single = maxSelections === 1;
  const special = specialDecisionChoices(decision);
  const mediaLinks = media.map((entry) => entry.trim()).filter(Boolean);
  const savedImage = image === undefined ? response?.image : null;
  const isDirty =
    note.trim() !== (response?.note ?? "") ||
    reaction !== (response?.reaction ?? null) ||
    JSON.stringify(mediaLinks) !== JSON.stringify(response?.media ?? []) ||
    image !== undefined ||
    selected.length !== (response?.selected.length ?? 0) ||
    selected.some((id) => !response?.selected.includes(id));
  const empty =
    !selected.length &&
    !note.trim() &&
    !reaction &&
    !mediaLinks.length &&
    !image &&
    !savedImage;
  const preferred = options.find(
    (option) => option.id === recommendation?.choice,
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
      setError("Choose an answer or leave feedback, or select Undo changes.");
      return;
    }
    if (mediaLinks.some((url) => !decisionMediaUrl.safeParse(url).success)) {
      setError(
        "Use HTTPS links without credentials. Check the media links and try again.",
      );
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
          reaction,
          media: mediaLinks,
          ...(image === undefined
            ? {}
            : {
                image: image
                  ? {
                      name: image.name,
                      type: image.type,
                      data: await readImage(image),
                    }
                  : null,
              }),
          revision: response?.revision ?? 0,
        });
        onSave(saved.response);
        restore(saved.response);
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
            const saved = latest.response;
            if (reaction === (response?.reaction ?? null))
              setReaction(saved.reaction);
            if (
              JSON.stringify(mediaLinks) ===
              JSON.stringify(response?.media ?? [])
            )
              setMedia(saved.media);
            if (note.trim() === (response?.note ?? "")) setNote(saved.note);
            if (
              selected.length === (response?.selected.length ?? 0) &&
              selected.every((id) => response?.selected.includes(id))
            )
              setSelected(saved.selected);
            setHistory(latest.earlier);
            setMoreHistory(latest.historyHasMore);
            setConflict(saved);
            onSave(saved, false);
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

  function restore(saved?: DecisionResponse | null) {
    setSelected(saved?.selected ?? []);
    setNote(saved?.note ?? "");
    setReaction(saved?.reaction ?? null);
    setMedia(saved?.media ?? []);
    setImage(undefined);
    setConflict(undefined);
    setError("");
  }

  function setChoice(id: string, checked: boolean) {
    setError("");
    setSelected((current) => {
      if (single || special.some((option) => option.id === id))
        return checked ? [id] : [];
      const ordinary = current.filter(
        (value) => !special.some((option) => option.id === value),
      );
      return checked
        ? [...ordinary, id]
        : ordinary.filter((value) => value !== id);
    });
  }

  async function loadEarlier() {
    const oldest = history.at(-1);
    if (!oldest || historyLoading) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const page = await call<{
        revisions: DecisionResponse[];
        hasMore: boolean;
      }>("read", { id: decision.id, beforeRevision: oldest.revision });
      setHistory([...history, ...page.revisions]);
      setMoreHistory(page.hasMore);
    } catch (error) {
      setHistoryError(errorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  }

  const advance = next ?? backTo;
  const backLabel =
    backTo === "share"
      ? "Share index"
      : backTo === "projects"
        ? "Projects"
        : "Question list";
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
        {decision.category && <span>{decision.category}</span>}
        {decision.archived && <span>Earlier question</span>}
        {response && (
          <span data-status={response.selected.length ? "selected" : "context"}>
            {response.selected.length ? "Answer saved" : "Feedback saved"}
          </span>
        )}
      </div>
      <h2 tabIndex={-1} data-decision-heading>
        {decision.question}
      </h2>
      <p className="decision-context">{decision.context}</p>
      {detail.previousBrief && (
        <details className="decision-evidence">
          <summary>Feedback from the earlier question</summary>
          <div className="decision-evidence-inner">
            <a href={detail.previousBrief.url}>
              {detail.previousBrief.question}
            </a>
            {detail.previousBrief.response ? (
              <DecisionResponseContent
                decision={detail.previousBrief.decision}
                response={detail.previousBrief.response}
              />
            ) : (
              <p>No feedback saved on the earlier question.</p>
            )}
          </div>
        </details>
      )}
      {detail.followUps.length > 0 && (
        <ul className="decision-media-links" aria-label="Follow-up questions">
          {detail.followUps.map((brief) => (
            <li key={brief.id}>
              <a href={brief.url}>Follow-up · {brief.question}</a>
            </li>
          ))}
        </ul>
      )}
      {decision.interview === "artwork" && (
        <p className="decision-context">
          <a href={decision.sources[0]?.url} target="_blank" rel="noreferrer">
            Open the original artwork
          </a>
        </p>
      )}
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
                        !single &&
                        !checked &&
                        selected.length >= maxSelections &&
                        !special.some((choice) => selected.includes(choice.id))
                      }
                      aria-label={option.title}
                      onChange={(event) =>
                        setChoice(option.id, event.currentTarget.checked)
                      }
                    />
                    <span>
                      <strong>{option.title}</strong>
                      {option.pitch && <small>{option.pitch}</small>}
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
          <div className="decision-special-choices">
            {special.map((option) => (
              <label key={option.id} className="decision-choice">
                <input
                  type={single ? "radio" : "checkbox"}
                  name={single ? `option-${decision.id}` : undefined}
                  checked={selected.includes(option.id)}
                  onChange={(event) =>
                    setChoice(option.id, event.currentTarget.checked)
                  }
                />
                <span>{option.title}</span>
              </label>
            ))}
          </div>
          <div className="decision-choice-tools">
            {selected.length > 0 && (
              <button type="button" onClick={() => setSelected([])}>
                Clear choices
              </button>
            )}
            {isDirty && (
              <button type="button" onClick={() => restore(response)}>
                Undo changes
              </button>
            )}
          </div>
          {recommendation && (
            <details className="decision-evidence">
              <summary>
                <span className="decision-recommendation-label">
                  {recommendation.method === "clef"
                    ? "Clef suggests"
                    : "Suggested answer"}
                  {preferred && <> · {preferred.title}</>}
                </span>
                <span className="decision-recommendation-detail">
                  Reasoning, trade-offs and sources
                </span>
              </summary>
              <div className="decision-evidence-inner">
                <p>{recommendation.basis}</p>
                <p>
                  {percent.format(recommendation.confidence)} reported
                  confidence
                </p>
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
          )}
          {!recommendation &&
            decision.interview !== "artwork" &&
            decision.sources.length > 0 && (
              <details className="decision-evidence">
                <summary>Sources and examples</summary>
                <ul className="decision-evidence-inner">
                  {decision.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          <fieldset className="decision-reaction">
            <legend>How was this question?</legend>
            {Object.entries(decisionReactionLabels).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={reaction === value}
                onClick={() =>
                  setReaction(
                    reaction === value ? null : (value as DecisionReaction),
                  )
                }
              >
                {label}
              </button>
            ))}
          </fieldset>
          <div className="decision-note">
            <label htmlFor="decision-note">
              Thoughts or feelings <span>Optional</span>
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
            <p>
              You can leave feedback without picking an answer. It stays in your
              private decision history.
            </p>
          </div>
          <details className="decision-evidence">
            <summary>
              Attach media
              {(savedImage || image || mediaLinks.length > 0) && (
                <>
                  {" "}
                  · {Number(Boolean(savedImage || image)) +
                    mediaLinks.length}{" "}
                  added
                </>
              )}
            </summary>
            <div className="decision-attachments">
              <label htmlFor="decision-image">Image or screenshot</label>
              <input
                id="decision-image"
                type="file"
                accept={decisionImageTypes.join(",")}
                aria-describedby="decision-image-hint"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  input.value = "";
                  if (!file) return;
                  if (
                    file.size > maxDecisionImageBytes ||
                    !decisionImageTypes.some((type) => type === file.type)
                  ) {
                    setError("Choose a PNG, JPEG or WebP image up to 512 KB.");
                    return;
                  }
                  setImage(file);
                  setError("");
                }}
              />
              <p id="decision-image-hint">
                PNG, JPEG or WebP up to 512 KB. Use a link for audio, video or
                larger files.
              </p>
              {(image || savedImage) && (
                <p>
                  {image?.name ??
                    (savedImage && (
                      <a
                        href={decisionImageUrl(
                          decision.id,
                          savedImage.revision,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {savedImage.name}
                      </a>
                    ))}{" "}
                  <button
                    type="button"
                    onClick={() => setImage(response?.image ? null : undefined)}
                  >
                    Remove from this response
                  </button>
                </p>
              )}
              {media.map((url, index) => (
                <div className="decision-attachment-row" key={index}>
                  <label>
                    Media link {index + 1}
                    <input
                      type="url"
                      value={url}
                      maxLength={2048}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setMedia(
                          media.map((entry, offset) =>
                            index === offset ? value : entry,
                          ),
                        );
                        setError("");
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove media link ${index + 1}`}
                    onClick={() =>
                      setMedia(media.filter((_, offset) => index !== offset))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              {media.length < 4 && (
                <button type="button" onClick={() => setMedia([...media, ""])}>
                  Add a media link
                </button>
              )}
            </div>
          </details>
        </fieldset>
        {conflict && (
          <div className="decision-conflict" role="status">
            <p>
              <strong>A newer response was saved.</strong> Your draft is still
              in the form.
            </p>
            <DecisionResponseContent decision={decision} response={conflict} />
            <button type="button" onClick={() => restore(conflict)}>
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
            onClick={() => void move(backTo)}
          >
            {backLabel}
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
      {history.length > 0 && (
        <details className="decision-evidence">
          <summary>Earlier responses for this question</summary>
          <ol className="decision-history">
            {history.map((entry) => (
              <li key={entry.revision}>
                <time dateTime={entry.savedAt}>
                  {new Date(entry.savedAt).toLocaleString("en-AU")}
                </time>
                <DecisionResponseContent decision={decision} response={entry} />
              </li>
            ))}
          </ol>
          {moreHistory && (
            <button
              type="button"
              disabled={historyLoading}
              onClick={() => void loadEarlier()}
            >
              {historyLoading ? "Loading…" : "Load earlier responses"}
            </button>
          )}
          {historyError && <p role="alert">{historyError}</p>}
        </details>
      )}
    </article>
  );
}

function DecisionsPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const research = isResearchView(view) ? view : null;
  const requested =
    research ?? (view === overview ? overview : params.get("id"));
  const router = useRouter();
  const [decisions, setDecisions] = useState<DecisionSummary[]>([]);
  const [detail, setDetail] = useState<DecisionDetail>();
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("");
  const content = useRef<HTMLElement>(null);
  const focusNext = useRef(false);

  function go(id: string, ignoreBlocker = true) {
    focusNext.current = true;
    router.history.push(questionLocation(id), undefined, { ignoreBlocker });
  }

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setLoadError("");
    if (research) {
      setDetail(undefined);
      setLoading(false);
      return () => controller.abort();
    }
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
          (entry) =>
            !entry.archived && !entry.interview && entry.status === "open",
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
  }, [requested, research, attempt, router.history]);

  useEffect(() => {
    if (!loading && focusNext.current) {
      focusNext.current = false;
      content.current
        ?.querySelector<HTMLElement>("[data-decision-heading]")
        ?.focus({ preventScroll: true });
      content.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [loading]);

  const interview = detail?.decision.interview;
  const primaryQuestions = decisions.filter((entry) => !entry.interview);
  const active = (
    interview
      ? decisions.filter((entry) => entry.interview === interview)
      : primaryQuestions
  ).filter((entry) => !entry.archived);
  const backTo =
    interview === "artwork" ? "share" : interview ? "projects" : overview;
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
          {!research && active.length > 0 && (
            <p>
              {completed} of {active.length} current questions reviewed
            </p>
          )}
        </div>
        {!research && active.length > 0 && (
          <progress
            aria-label="Questions reviewed"
            value={completed}
            max={active.length}
          />
        )}
      </header>
      <nav className="decision-research-nav" aria-label="Decision sections">
        <button
          type="button"
          aria-current={!research && !interview ? "page" : undefined}
          onClick={() => go(overview, false)}
        >
          Reviews
        </button>
        <button
          type="button"
          aria-current={
            research === "projects" ||
            Boolean(interview && interview !== "artwork")
              ? "page"
              : undefined
          }
          onClick={() => go("projects", false)}
        >
          Projects & preferences
        </button>
        <button
          type="button"
          aria-current={
            research === "share" || interview === "artwork" ? "page" : undefined
          }
          onClick={() => go("share", false)}
        >
          Share index
        </button>
        <button
          type="button"
          aria-current={research === "feedback" ? "page" : undefined}
          onClick={() => go("feedback", false)}
        >
          Saved feedback
        </button>
      </nav>
      {research && (
        <DecisionResearch
          key={research}
          view={research}
          load={loadResearch}
          ask={startArtwork}
          onGo={go}
        />
      )}
      <p className="decision-saved-status" role="status">
        {status}
      </p>
      {!research &&
        !interview &&
        earlierResponses > 0 &&
        requested !== overview && (
          <p className="decision-previous-responses">
            {earlierResponses} earlier{" "}
            {earlierResponses === 1 ? "response" : "responses"} saved. Open the
            question list to review them.
          </p>
        )}
      {!research && (
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
                backTo={backTo}
                onSave={(response, announce = true) => {
                  setDetail({ ...detail, response });
                  if (announce)
                    setStatus(
                      response.selected.length
                        ? "Answer saved"
                        : "Feedback saved",
                    );
                }}
              />
            </>
          )}
          {!loading && !loadError && !detail && (
            <QuestionIndex
              decisions={primaryQuestions}
              onGo={(id) => void go(id)}
            />
          )}
        </div>
      )}
    </section>
  );
}

export const pages: PluginAdminExports["pages"] = { "/review": DecisionsPage };
