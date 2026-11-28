import { useEffect, useId, useRef, useState, type SubmitEvent } from "react";
import {
  feedbackEndpoint, feedbackInbox, feedbackKinds, ownerActions,
  type FeedbackTarget, type FeedbackThread,
} from "../lib/owner-feedback-contract";
import "./owner-feedback.css";

async function call<T>(payload?: object, query = new URLSearchParams(), signal?: AbortSignal) {
  const result = await fetch(feedbackEndpoint + (query.size ? "?" + query : ""), {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json", "X-EmDash-Request": "1" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
    signal,
  });
  const data = await result.json().catch(() => ({})) as T & { error?: string };
  if (!result.ok || data.error)
    throw new Error(data.error ?? "Sign in to Composer and try again.");
  return data;
}

const formatTime = (ms: number) =>
  `${Math.floor(ms / 60000)}:${(ms % 60000 / 1000).toFixed(3).padStart(6, "0")}`;

function ThreadList({ threads }: { threads: FeedbackThread[] }) {
  return <ul className="owner-feedback-list">{threads.map((thread) => (
    <li key={thread.id}>
      <a href={feedbackInbox + "?feedback=" + thread.id}>{thread.context.title}</a>
      <span>{thread.state === "closed" ? "Satisfied" : thread.next === "owner" ? "Ready for your review" : "Open"}</span>
      <p>{thread.events[0].note}</p>
    </li>
  ))}</ul>;
}

function useFeedbackWrite() {
  const retry = useRef<{ signature: string; id: string }>(null);
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function write(payload: object) {
    if (working.current) return;
    const signature = JSON.stringify(payload);
    if (retry.current?.signature !== signature)
      retry.current = { signature, id: crypto.randomUUID() };
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await call<{ thread: FeedbackThread }>({ ...payload, requestId: retry.current.id });
      retry.current = null;
      return result.thread;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return { write, busy, error };
}

export default function OwnerFeedback({ target, label, player }: {
  target: FeedbackTarget;
  label: string;
  player?: string;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<keyof typeof feedbackKinds>("improvement");
  const [incident, setIncident] = useState(false);
  const [annotation, setAnnotation] = useState("");
  const [startMs, setStartMs] = useState(0);
  const [end, setEnd] = useState("");
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [saved, setSaved] = useState("");
  const [readError, setReadError] = useState("");
  const [loading, setLoading] = useState(false);
  const { write, busy, error } = useFeedbackWrite();
  const targetJson = JSON.stringify(target);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setReadError("");
    void call<{ threads: FeedbackThread[] }>(undefined,
      new URLSearchParams({ target: targetJson }), controller.signal)
      .then((data) => setThreads(data.threads))
      .catch((err: Error) => { if (!controller.signal.aborted) setReadError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, targetJson]);

  const playhead = () => {
    const video = player ? document.getElementById(player) : null;
    return video instanceof HTMLVideoElement && video.readyState > 0 && Number.isFinite(video.currentTime)
      ? Math.min(35000, Math.round(video.currentTime * 1000))
      : target.type === "film" ? target.startMs : 0;
  };

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const exactTarget = target.type === "film" ? {
      ...target, startMs, ...(end ? { endMs: Math.round(Number(end) * 1000) } : {}),
    } : target;
    const thread = await write({ action: "open", target: exactTarget, note, kind, incident,
      ...(annotation.trim() ? { annotation: annotation.trim() } : {}),
    });
    if (!thread) return;
    setNote("");
    setEnd("");
    setIncident(false);
    setAnnotation("");
    setSaved(thread.id);
    setThreads((previous) => [thread, ...previous.filter(({ id }) => id !== thread.id)]);
  }

  return <div className="owner-feedback">
    <button ref={button} type="button" aria-expanded={open} aria-controls={id}
      onClick={() => {
        if (open) { close(); return; }
        if (player) setStartMs(playhead());
        setOpen(true);
      }}>
      {label}
    </button>
    {open && <div id={id} className="owner-feedback-panel"
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div className="owner-feedback-heading">
        <strong>Private owner feedback</strong>
        <button type="button" onClick={close}>Close</button>
      </div>
      <p className="owner-feedback-context">{target.type === "page" ? target.path : target.id} · <code>{target.revision.slice(0, 12)}</code></p>
      <form onSubmit={(event) => void submit(event)}>
        <label>What would you like to keep or change?
          <textarea rows={3} name="note" required maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {target.type === "film" && <fieldset>
          <legend>Film position</legend>
          <span>Start {formatTime(startMs)}</span>
          <button type="button" onClick={() => setStartMs(playhead())}>Use current playhead</button>
          <label>End in seconds (optional)
            <input type="number" step="0.001" min={startMs / 1000 + 0.001} max={35}
              value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </fieldset>}
        <label>Type
          <select value={kind} onChange={(event) => setKind(event.target.value as keyof typeof feedbackKinds)}>
            {Object.entries(feedbackKinds).map(([value, name]) => <option value={value} key={value}>{name}</option>)}
          </select>
        </label>
        <details>
          <summary>Add an annotation</summary>
          <label>Detail to look at
            <input type="text" maxLength={300} value={annotation} onChange={(event) => setAnnotation(event.target.value)} />
          </label>
          {annotation.trim() && <p>Preview · {annotation.trim()}</p>}
        </details>
        <label className="owner-feedback-check">
          <input type="checkbox" checked={incident} onChange={(event) => setIncident(event.target.checked)} /> Raise an incident
        </label>
        <button type="submit" disabled={busy || !note.trim()}>{busy ? "Saving…" : "Save feedback"}</button>
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Saved. <a href={feedbackInbox + "?feedback=" + saved}>Open your thread</a></p>}
      </form>
      <details>
        <summary>Feedback at this target {threads.length ? `(${threads.length})` : ""}</summary>
        {loading ? <p role="status">Loading feedback…</p> : readError ? <p role="alert">{readError}</p> :
          threads.length ? <ThreadList threads={threads} /> : <p>No feedback here yet.</p>}
      </details>
      <a href={feedbackInbox + "#owner-feedback"}>Owner Inbox</a>
    </div>}
  </div>;
}

function ThreadDetail({ initial }: { initial: FeedbackThread }) {
  const [thread, setThread] = useState(initial);
  const [note, setNote] = useState("");
  const [action, setAction] = useState<keyof typeof ownerActions>("reply");
  const [evidence, setEvidence] = useState("");
  const { write, busy, error } = useFeedbackWrite();
  const { context, events, next, state, awaiting } = thread;
  const revision = events.at(-1)!.revision;
  const actions: (keyof typeof ownerActions)[] = state === "open" ? ["reply", "attempt"] : ["reply"];
  if (context.incident) {
    if (state === "closed") actions.push("reopen");
    else {
      actions.push("keep", "return", "partial");
      if (events.some((event) => event.kind === "attempt")) actions.push("satisfied");
    }
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const updated = await write({ action, threadId: thread.id, revision, note,
      ...(action === "attempt" ? { evidence: [evidence] } : {}),
    });
    if (updated) {
      setThread(updated);
      setNote("");
      setEvidence("");
      setAction("reply");
    }
  }
  return <>
    <h3>{context.title}</h3>
    <p>{context.project} · {context.environment} · {state === "closed" ? "Satisfied" :
      next === "owner" ? (awaiting === "question" ? "Question awaiting your reply" : "Attempt delivered. Awaiting owner review.") : "Open · agent to follow up"}</p>
    <p><a href={context.url}>Open original target</a> · <code>{context.target.revision.slice(0, 12)}</code>
      {context.target.type === "film" && <>
        {" · "}{formatTime(context.target.startMs)}
        {context.target.endMs !== undefined && ` to ${formatTime(context.target.endMs)}`}
      </>}
    </p>
    {context.annotation && <p>Annotation · {context.annotation}</p>}
    <ol className="owner-feedback-history">{events.map((entry) => (
      <li key={entry.id}>
        <strong>{entry.isOwner ? "You" : entry.actor}</strong>
        {" · "}{ownerActions[entry.kind as keyof typeof ownerActions] ?? feedbackKinds[entry.kind as keyof typeof feedbackKinds] ?? entry.kind}
        {" · "}<time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("en-AU", { timeZone: "Australia/Melbourne" })}</time>
        <p>{entry.note}</p>
        {"evidence" in entry.context && entry.context.evidence?.map((url) => <a href={url} key={url}>{url}</a>)}
      </li>
    ))}</ol>
    <form onSubmit={(event) => void submit(event)}>
      <label>Action
        <select value={action} onChange={(event) => setAction(event.target.value as keyof typeof ownerActions)}>
          {actions.map((value) => <option value={value} key={value}>{ownerActions[value]}</option>)}
        </select>
      </label>
      <label>Your note
        <textarea rows={3} required maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {action === "attempt" && <label>Release, preview or evidence link
        <input type="url" required value={evidence} onChange={(event) => setEvidence(event.target.value)} />
      </label>}
      <button type="submit" disabled={busy || !note.trim()}>{busy ? "Saving…" : "Save update"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </>;
}

export function OwnerFeedbackInbox({ selected }: { selected: string | null }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading owner feedback…");
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [thread, setThread] = useState<FeedbackThread>();
  const [filter, setFilter] = useState<"all" | "incidents" | "review">("all");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("Loading owner feedback…");
    setThread(undefined);
    setThreads([]);
    const params = new URLSearchParams(selected ? { thread: selected } : { query: search });
    void call<{ thread?: FeedbackThread; threads?: FeedbackThread[] }>(undefined, params, controller.signal)
      .then((result) => {
        setStatus("");
        setThread(result.thread);
        setThreads(result.threads ?? []);
      }).catch((err: Error) => { if (!controller.signal.aborted) setStatus(err.message); });
    return () => controller.abort();
  }, [selected, search]);

  const visible = threads.filter((item) => filter === "all" || (filter === "incidents"
    ? item.context.incident && item.state === "open" : item.next === "owner"));

  return <section id="owner-feedback" className="owner-feedback owner-feedback-inbox" aria-label="Owner feedback">
    <h2>Owner feedback</h2>
    {selected ? <p><a href={feedbackInbox + "#owner-feedback"}>All owner feedback</a></p> : <>
      <form className="owner-feedback-search" onSubmit={(event) => { event.preventDefault(); setSearch(query); }}>
        <label>Search feedback
          <input type="search" value={query} maxLength={150} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="submit">Search</button>
      </form>
      <label>View
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="all">All feedback</option><option value="incidents">Open incidents</option>
          <option value="review">Needs your review</option>
        </select>
      </label>
    </>}
    {status ? <p role="status">{status}</p> : thread ?
      <ThreadDetail key={thread.id} initial={thread} /> : visible.length ?
      <ThreadList threads={visible} /> : <p>No feedback matches this view.</p>}
  </section>;
}
