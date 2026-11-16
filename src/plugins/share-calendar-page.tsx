import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  buildShareCalendarIcs,
  calendarFilename,
  isSafeShareLink,
  scheduleLabels,
  shareCalendarSnapshot,
  SHARE_CHANNELS,
  SHARE_CHANNEL_LABELS,
  SHARE_STATES,
  SHARE_STATE_LABELS,
  type ShareCalendarItem,
  type ShareCalendarSnapshot,
  type ShareChannel,
} from "../lib/share-calendar";
import { confirmWorkspace, workspaceSelection } from "./stacks/workspace-scope";
import "./share-calendar-page.css";

const base = "/_emdash/api/plugins/composer-stacks/";

function errorMessage(raw: unknown, fallback: string) {
  return raw &&
    typeof raw === "object" &&
    "message" in raw &&
    typeof raw.message === "string"
    ? raw.message
    : fallback;
}

async function calendarCall(
  action: string,
  workspace?: string,
  fields: Record<string, unknown> = {},
): Promise<ShareCalendarSnapshot> {
  const read = action === "list";
  const response = await apiFetch(
    base +
      (read
        ? "shareCalendarRead?" +
          new URLSearchParams({ action, ...(workspace ? { workspace } : {}) })
        : "shareCalendarWrite"),
    read
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...fields, action, workspace }),
        },
  );
  const raw = await parseApiResponse<unknown>(
    response,
    "The share calendar could not be confirmed. Refresh before retrying.",
  );
  const parsed = shareCalendarSnapshot.safeParse(raw);
  if (!parsed.success)
    throw Error(
      errorMessage(
        raw,
        "The share calendar response could not be validated. Refresh before retrying.",
      ),
    );
  confirmWorkspace(workspace, parsed.data.workspace.id);
  return parsed.data;
}

function localInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number, size = 2) => String(part).padStart(size, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

function displayDate(value: string | null) {
  if (!value) return "No date";
  const labels = scheduleLabels(value);
  return labels ? `${labels.melbourne} · ${labels.utc}` : "Unreadable date";
}

function stateNote(state: ShareCalendarItem["state"]) {
  return SHARE_STATES.find((entry) => entry.id === state)?.note ?? "";
}

function captionAndLink(item: ShareCalendarItem) {
  return item.caption + (item.link ? "\n\n" + item.link : "");
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.inset = "0 auto auto -9999px";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

export function ShareCalendarPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <ShareCalendar key={search} search={search} />;
}

function ShareCalendar({ search }: { search: string }) {
  const [snapshot, setSnapshot] = useState<ShareCalendarSnapshot>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [channel, setChannel] = useState<ShareChannel>("instagram");
  const [caption, setCaption] = useState("");
  const [link, setLink] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [editing, setEditing] = useState<ShareCalendarItem>();
  const alive = useRef(true);
  const pending = useRef(false);
  const selection = useRef<string | undefined>(undefined);
  const invalidScope = useRef(false);

  const sources = snapshot?.sources ?? [];
  const source = sources.find((entry) => entry.id === sourceId);
  const canWrite = Boolean(snapshot && snapshot.workspace.role !== "viewer");
  const scheduled = useMemo(
    () =>
      (snapshot?.items ?? []).filter(
        (item) =>
          item.state === "scheduled" && item.sourceCurrent && item.scheduledAt,
      ),
    [snapshot],
  );

  function fillFromSource(id: string, current?: ShareCalendarItem) {
    setSourceId(id);
    const next = sources.find((entry) => entry.id === id);
    if (current) {
      setChannel(current.channel);
      setCaption(current.caption);
      setLink(current.link);
      setScheduledLocal(localInput(current.scheduledAt));
      return;
    }
    setChannel("instagram");
    setCaption(next?.description ?? "");
    setLink(next?.url ?? "");
    setScheduledLocal("");
  }

  async function load() {
    setError("");
    setLoading(true);
    try {
      const result = await calendarCall("list", selection.current);
      if (!alive.current) return;
      setSnapshot(result);
      if (!editing && !sourceId && result.sources[0]) {
        setSourceId(result.sources[0].id);
        setCaption(result.sources[0].description);
        setLink(result.sources[0].url);
      }
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The share calendar could not be opened. Refresh before retrying.",
        );
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  useEffect(() => {
    alive.current = true;
    try {
      selection.current = workspaceSelection(search);
      void load();
    } catch (cause) {
      invalidScope.current = true;
      setLoading(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "Choose a workspace from Workspace access.",
      );
    }
    return () => {
      alive.current = false;
    };
    // The route search is the only scope input; the page remounts for a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function mutate(
    action: string,
    fields: Record<string, unknown>,
    message: string,
  ) {
    if (pending.current || invalidScope.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await calendarCall(action, selection.current, fields);
      if (!alive.current) return false;
      setSnapshot(result);
      setNotice(message);
      return true;
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The change could not be confirmed. Refresh before retrying.",
        );
      return false;
    } finally {
      if (alive.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!snapshot) return;
    if (!caption.trim()) {
      setError("Write a caption before saving this share.");
      return;
    }
    if (link.trim() && !isSafeShareLink(link.trim())) {
      setError(
        "Use a real http or https link, without a username or password.",
      );
      return;
    }
    let scheduledAt: string | null = null;
    if (scheduledLocal) {
      const time = new Date(scheduledLocal);
      if (Number.isNaN(time.getTime())) {
        setError("Choose a real date and time, or leave the date empty.");
        return;
      }
      scheduledAt = time.toISOString();
    }
    const fields = {
      channel,
      caption: caption.trim(),
      link: link.trim(),
      scheduledAt,
    };
    const verb = scheduledAt ? "Scheduled" : "Draft saved";
    const detail = scheduledAt ? scheduleLabels(scheduledAt) : null;
    const message = detail
      ? `${verb} for ${detail.melbourne} · ${detail.utc}. Composer will not post it.`
      : `${verb}. Nothing is on the calendar and nothing was posted.`;
    const saved = editing
      ? await mutate(
          "save",
          {
            item: editing.id,
            expectedRevision: editing.revision,
            ...fields,
          },
          message,
        )
      : await mutate("create", { stack: sourceId, ...fields }, message);
    if (saved) {
      setEditing(undefined);
      const next = snapshot.sources[0];
      if (next) {
        setSourceId(next.id);
        setChannel("instagram");
        setCaption(next.description);
        setLink(next.url);
      }
      setScheduledLocal("");
    }
  }

  async function shared(item: ShareCalendarItem, after: string) {
    if (item.state === "shared") {
      setNotice(after + " This item was already recorded as shared locally.");
      return;
    }
    const saved = await mutate(
      "shared",
      { item: item.id, expectedRevision: item.revision },
      after + " Recorded as shared locally. Composer did not post it.",
    );
    if (!saved)
      setNotice(
        after +
          " The local share receipt could not be saved; refresh before relying on the item state.",
      );
  }

  async function copyItem(item: ShareCalendarItem) {
    if (!item.sourceCurrent) return;
    const copied = await copyText(captionAndLink(item));
    if (!copied) {
      setError(
        "The browser did not allow a copy. Select the caption and copy it yourself.",
      );
      return;
    }
    if (!canWrite) {
      setNotice("Caption and link copied. Nothing was posted.");
      return;
    }
    await shared(item, "Caption and link copied.");
  }

  function downloadCalendar() {
    if (!snapshot) return;
    if (!scheduled.length) {
      setNotice("Add a scheduled share before downloading the calendar.");
      return;
    }
    try {
      const ics = buildShareCalendarIcs(
        scheduled.map((item) => ({
          id: item.id,
          revision: item.revision,
          channel: item.channel,
          caption: item.caption,
          link: item.link,
          scheduledAt: item.scheduledAt!,
          stackName: item.stackName,
        })),
        {
          now: new Date(),
          calendarName: "Share calendar · " + snapshot.workspace.name,
        },
      );
      const url = URL.createObjectURL(
        new Blob([ics], { type: "text/calendar;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = calendarFilename(snapshot.workspace.name);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice(
        `Downloaded ${scheduled.length} scheduled share${scheduled.length === 1 ? "" : "s"} as an .ics calendar. The file uses UTC.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The calendar file could not be prepared. Refresh before retrying.",
      );
    }
  }

  const preview = scheduledLocal
    ? (() => {
        const time = new Date(scheduledLocal);
        if (Number.isNaN(time.getTime())) return null;
        return scheduleLabels(time.toISOString());
      })()
    : null;

  return (
    <section className="composer-share-calendar">
      <div className="sc-heading">
        <div>
          <p className="sc-kicker">Composer · owner calendar</p>
          <h1>Share calendar</h1>
        </div>
        {snapshot && (
          <p className="sc-scope">
            {snapshot.workspace.name} · {snapshot.workspace.role}
          </p>
        )}
      </div>
      <p className="sc-lede">
        Prepare a caption and a date for a published stack. The calendar records
        local preparation and handoff only: it does not connect to a social
        network, publish a post or confirm that a destination app accepted one.
      </p>
      <p className="sc-boundary">
        Times show Australia/Melbourne and UTC. The .ics export uses UTC, so a
        calendar app shows the same instant in your own zone.
      </p>
      <p role="status" aria-live="polite" className="sc-notice">
        {notice}
      </p>
      {error && (
        <div role="alert" className="sc-error">
          <p>{error}</p>
        </div>
      )}
      {loading && (
        <p role="status">Loading published stacks and saved shares…</p>
      )}
      {snapshot && !sources.length && !loading && (
        <div className="sc-empty">
          <h2>No published stack has a share card yet</h2>
          <p>
            Publish a stack with at least one visible app. Its immutable
            publication supplies the share card, address and description used
            here. Drafts never appear on this calendar.
          </p>
          <a
            className="sc-primary"
            href="/_emdash/admin/plugins/composer-stacks/stacks"
          >
            Open creator stacks
          </a>
        </div>
      )}
      {snapshot && sources.length > 0 && (
        <div className="sc-layout">
          <div className="sc-prepare" id="sc-prepare">
            <h2>{editing ? "Edit share" : "Prepare a share"}</h2>
            <p className="sc-hint">
              {editing
                ? "Editing content clears a previous local-share receipt; save and record it again when you hand it off."
                : "Choosing a published stack fills the caption and link from its current publication. Edit them before scheduling."}
            </p>
            <form onSubmit={submit} className="sc-form">
              <label className="sc-field">
                Published source
                <select
                  value={sourceId}
                  disabled={Boolean(editing) || busy || !canWrite}
                  onChange={(event) => fillFromSource(event.target.value)}
                  required
                >
                  {sources.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · revision {entry.publication}
                    </option>
                  ))}
                </select>
              </label>
              {source && (
                <div className="sc-source">
                  <img
                    src={source.imagePath}
                    alt={source.imageAlt}
                    width="1200"
                    height="630"
                    loading="lazy"
                  />
                  <div>
                    <p>
                      <strong>Published revision {source.publication}</strong>
                      {source.publishedAt
                        ? " · " + displayDate(source.publishedAt)
                        : ""}
                    </p>
                    <p className="sc-hint">
                      {source.apps.length
                        ? "Visible apps: " + source.apps.join(", ") + "."
                        : "This publication has no visible apps."}
                    </p>
                    <a
                      className="sc-text-link"
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open the published page
                    </a>
                  </div>
                </div>
              )}
              <label className="sc-field">
                Channel label
                <select
                  value={channel}
                  disabled={busy || !canWrite}
                  onChange={(event) =>
                    setChannel(event.target.value as ShareChannel)
                  }
                >
                  {SHARE_CHANNELS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="sc-hint sc-channel-note">
                {SHARE_CHANNELS.find((entry) => entry.id === channel)?.note}
              </p>
              <label className="sc-field">
                Caption
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={2200}
                  rows={6}
                  disabled={busy || !canWrite}
                  required
                />
              </label>
              <p className="sc-count">{caption.length} / 2200 characters</p>
              <label className="sc-field">
                Link
                <input
                  type="url"
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  maxLength={2048}
                  placeholder="https://composer.loftwah.com/s/your-stack"
                  disabled={busy || !canWrite}
                />
              </label>
              <label className="sc-field">
                Date and time (leave empty for a draft)
                <input
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(event) => setScheduledLocal(event.target.value)}
                  disabled={busy || !canWrite}
                />
              </label>
              {preview && (
                <p className="sc-preview-time">
                  Melbourne {preview.melbourne} · UTC {preview.utc}
                </p>
              )}
              <div className="sc-actions">
                <button
                  type="submit"
                  className="sc-primary"
                  disabled={busy || !canWrite || !sourceId}
                >
                  {scheduledLocal
                    ? editing
                      ? "Save scheduled changes"
                      : "Schedule share"
                    : editing
                      ? "Save draft changes"
                      : "Save draft"}
                </button>
                {editing && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(undefined);
                      const next = sources[0];
                      if (next) fillFromSource(next.id);
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
              {!canWrite && (
                <p className="sc-hint">
                  A viewer can read and export this calendar. Saving and local
                  share receipts need the save capability.
                </p>
              )}
            </form>
          </div>
          <div className="sc-calendar">
            <div className="sc-calendar-heading">
              <div>
                <h2>Calendar</h2>
                <p className="sc-hint">
                  {scheduled.length} scheduled ·{" "}
                  {
                    snapshot.items.filter((item) => item.state === "shared")
                      .length
                  }{" "}
                  shared locally
                </p>
              </div>
              <button
                type="button"
                onClick={downloadCalendar}
                disabled={busy || !scheduled.length}
              >
                Download .ics
              </button>
            </div>
            {!snapshot.items.length && (
              <div className="sc-empty sc-empty-list">
                <h3>Nothing prepared yet</h3>
                <p>
                  Use the form to write the first caption. Leave the date empty
                  to keep it a draft, or add a date to put it on the calendar.
                  Nothing is sent anywhere.
                </p>
              </div>
            )}
            <ol className="sc-items">
              {snapshot.items.map((item) => {
                const labels = item.scheduledAt
                  ? scheduleLabels(item.scheduledAt)
                  : null;
                return (
                  <li
                    key={item.id}
                    className={`sc-item sc-state-${item.state}`}
                  >
                    <div className="sc-item-top">
                      <span className={`sc-badge sc-badge-${item.state}`}>
                        {SHARE_STATE_LABELS[item.state]}
                      </span>
                      <span className="sc-channel">
                        {SHARE_CHANNEL_LABELS[item.channel]}
                      </span>
                      {labels && (
                        <span className="sc-when">
                          {labels.melbourne} · {labels.utc}
                        </span>
                      )}
                    </div>
                    <p className="sc-source-line">
                      <strong>{item.stackName}</strong> · published revision{" "}
                      {item.publication}
                      {!item.sourceCurrent &&
                        " · source changed or no longer public"}
                    </p>
                    <p className={`sc-caption sc-caption-${item.state}`}>
                      {item.caption}
                    </p>
                    {item.link && (
                      <p className="sc-item-link">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.link}
                        </a>
                      </p>
                    )}
                    <p className="sc-hint">{stateNote(item.state)}</p>
                    {item.state === "scheduled" &&
                      item.scheduledAt &&
                      item.scheduledAt < snapshot.now && (
                        <p className="sc-hint">
                          This time has passed. Composer still cannot tell
                          whether you shared it; record a local share only after
                          you do.
                        </p>
                      )}
                    {item.sharedAt && (
                      <p className="sc-hint">
                        Local share recorded {displayDate(item.sharedAt)}
                      </p>
                    )}
                    {!item.sourceCurrent && (
                      <p className="sc-stale">
                        This item points at a publication that has changed or is
                        no longer public. Refresh it from the current
                        publication before copying, downloading or exporting.
                      </p>
                    )}
                    <div className="sc-actions">
                      <button
                        type="button"
                        disabled={busy || !item.sourceCurrent}
                        onClick={() => void copyItem(item)}
                      >
                        Copy caption + link
                      </button>
                      {item.sourceCurrent && (
                        <a
                          className="sc-download"
                          href={
                            sources.find((entry) => entry.id === item.stack)
                              ?.imagePath ?? ""
                          }
                          download={`${item.stackSlug}-r${item.publication}-share-card.png`}
                          aria-disabled={!canWrite || busy}
                          onClick={(event) => {
                            if (!canWrite || busy) {
                              event.preventDefault();
                              return;
                            }
                            void shared(item, "Share image download started.");
                          }}
                        >
                          Download share image
                        </a>
                      )}
                      {!item.sourceCurrent && canWrite && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              "refresh",
                              {
                                item: item.id,
                                expectedRevision: item.revision,
                              },
                              "Source refreshed from the current published revision.",
                            )
                          }
                        >
                          Refresh source
                        </button>
                      )}
                      {item.state === "shared" && canWrite && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              "reopen",
                              {
                                item: item.id,
                                expectedRevision: item.revision,
                              },
                              "Reopened. It is no longer marked as shared locally.",
                            )
                          }
                        >
                          Reopen
                        </button>
                      )}
                      {canWrite && item.sourceCurrent && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditing(item);
                            fillFromSource(item.stack, item);
                            document
                              .getElementById("sc-prepare")
                              ?.scrollIntoView({ block: "start" });
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {canWrite && (
                        <button
                          type="button"
                          className="sc-danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Delete this share item? The published stack and its share card are untouched.",
                              )
                            )
                              void mutate(
                                "delete",
                                {
                                  item: item.id,
                                  expectedRevision: item.revision,
                                },
                                "Share item deleted. The published stack is untouched.",
                              );
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="sc-export-note">
              <h3>Calendar export</h3>
              <p>
                The .ics file contains only scheduled items whose published
                source is still current. Drafts and locally shared items stay
                out. Each event is thirty minutes, begins at the recorded
                instant and says that you perform the share yourself.
              </p>
              <button
                type="button"
                onClick={downloadCalendar}
                disabled={busy || !scheduled.length}
              >
                Download calendar (.ics)
              </button>
            </div>
          </div>
        </div>
      )}
      {snapshot && (
        <p className="sc-footnote">
          Every route is owner-authenticated and scoped to this workspace.
          Deleting a stack removes its calendar items; unpublishing one leaves
          them visible here but blocks new copies and exports until you refresh
          the source.
        </p>
      )}
    </section>
  );
}
