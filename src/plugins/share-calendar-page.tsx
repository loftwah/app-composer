import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  buildShareCalendarIcs,
  calendarExportItems,
  calendarFilename,
  captionProblem,
  captionUsage,
  isSafeShareLink,
  melbourneLocalInput,
  melbourneLocalInstant,
  primaryCaptionProblem,
  scheduleLabels,
  shareCalendarSnapshot,
  SHARE_CAPTION_LOCAL_CHARACTERS,
  SHARE_CHANNELS,
  SHARE_CHANNEL_LABELS,
  SHARE_CHANNEL_LIMITS,
  SHARE_DESTINATION_MAX,
  SHARE_STATES,
  SHARE_STATE_LABELS,
  SHARE_VARIANT_MAX,
  type ShareCalendarItem,
  type ShareCalendarSnapshot,
  type ShareCalendarSource,
  type ShareCalendarVariant,
  type ShareChannel,
} from "../lib/share-calendar";
import {
  approvalPackageForItem,
  sharePackageFilename,
  sharePackageJson,
  sharePackageMarkdown,
  sharePackagePlainText,
  type ShareApprovalPackage,
} from "../lib/share-package";
import {
  BLUESKY_APPROVAL_REASON_LABELS,
  BLUESKY_SEND_UNAVAILABLE_STATEMENT,
  blueskyAccountFromIdentity,
  blueskyApprovalStatus,
  blueskyPackageForItem,
  blueskyTextForItem,
  blueskyUsage,
  createBlueskyContent,
  hasBlueskyDraft,
  type BlueskyApprovalRecord,
  type SharePackageBluesky,
} from "../lib/share-approval";
import {
  BLUESKY_CREDENTIAL_STATEMENT,
  blueskyIdentityReplySchema,
  type BlueskyIdentityResult,
} from "../lib/bluesky-account";
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

async function identityCall(
  handle: string | undefined,
  workspace?: string,
): Promise<BlueskyIdentityResult> {
  const params = new URLSearchParams({ action: "blueskyIdentity" });
  if (workspace) params.set("workspace", workspace);
  if (handle?.trim()) params.set("handle", handle.trim());
  const response = await apiFetch(
    base + "shareCalendarRead?" + params.toString(),
    { cache: "no-store" },
  );
  const raw = await parseApiResponse<unknown>(
    response,
    "The public Bluesky identity could not be checked. No identity was confirmed.",
  );
  const parsed = blueskyIdentityReplySchema.safeParse(raw);
  if (!parsed.success)
    throw Error(
      errorMessage(
        raw,
        "The public Bluesky identity response could not be validated. No identity was confirmed.",
      ),
    );
  return parsed.data.result;
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

function requestByteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
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

function ApprovalPackageView({
  id,
  value,
  busy,
  onCopy,
  onDownload,
}: {
  id: string;
  value: ShareApprovalPackage;
  busy: boolean;
  onCopy: () => void;
  onDownload: (format: "json" | "md") => void;
}) {
  return (
    <section
      id={id}
      className="sc-package"
      aria-label={`Approval package for item revision ${value.item.revision}`}
    >
      <div className="sc-package-head">
        <div>
          <h3>Approval package</h3>
          <p className="sc-hint">
            Exact saved values for one reviewer. Copying or downloading this
            package does not change the item state.
          </p>
        </div>
        <span className="sc-package-state">{value.item.stateLabel}</span>
      </div>
      <dl className="sc-package-facts">
        <div>
          <dt>Source</dt>
          <dd>
            {value.source.name} · revision {value.source.publication} ·{" "}
            {value.source.current ? "current" : "no longer current"}
          </dd>
        </div>
        <div>
          <dt>Schedule</dt>
          <dd>{value.schedule.label}</dd>
        </div>
        <div>
          <dt>Link</dt>
          <dd>{value.link ?? "not recorded"}</dd>
        </div>
        <div>
          <dt>Share image</dt>
          <dd>
            {value.shareImage.status === "available" ? (
              <>
                <a
                  href={value.shareImage.url ?? value.shareImage.path ?? ""}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {value.shareImage.path}
                </a>
                {value.shareImage.alt ? (
                  <span className="sc-package-alt">
                    {" "}
                    · {value.shareImage.alt}
                  </span>
                ) : null}
              </>
            ) : (
              "Not available. Refresh the source from its current published revision before sharing."
            )}
          </dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>
            {value.provenance.statement} Item updated{" "}
            {value.provenance.preparedAt}; item revision{" "}
            {value.provenance.itemRevision}; source revision{" "}
            {value.provenance.sourceRevision}.
          </dd>
        </div>
      </dl>
      {value.shareImage.status === "available" && value.shareImage.path ? (
        <img
          className="sc-package-image"
          src={value.shareImage.path}
          alt={value.shareImage.alt ?? ""}
          width="1200"
          height="630"
          loading="lazy"
        />
      ) : null}
      {value.destinations.map((destination) => (
        <div className="sc-package-destination" key={destination.channel}>
          <h4>
            {destination.channelLabel}
            <span className="sc-package-exact">
              {destination.exactDestinationLabel}
            </span>
          </h4>
          <p className="sc-hint">
            {destination.primary
              ? "Main caption · also the .ics description"
              : "Additional channel draft"}{" "}
            · {destination.count} / {destination.limit} {destination.unit}
            {destination.withinLimit ? "" : " · over the limit"}
          </p>
          <p className="sc-package-caption">{destination.caption}</p>
          <p className="sc-hint">
            Destination limit {destination.platformLimit} {destination.unit}.{" "}
            {destination.behaviour}
          </p>
        </div>
      ))}
      {value.bluesky && (
        <div className="sc-package-destination sc-package-bluesky">
          <h4>
            Bluesky
            <span className="sc-package-exact">
              {value.bluesky.account.handle
                ? "@" + value.bluesky.account.handle
                : "needs account"}
            </span>
          </h4>
          <p className="sc-hint">
            Public identity {value.bluesky.account.publicIdentity} · publishing
            authorised no · approval {value.bluesky.approval.label} · not sent
          </p>
          <p className="sc-hint">
            {value.bluesky.account.did
              ? "DID " + value.bluesky.account.did
              : value.bluesky.account.statement}
          </p>
          <p className="sc-package-caption">{value.bluesky.text}</p>
          <p className="sc-hint">
            {value.bluesky.count} / {value.bluesky.limit} graphemes ·{" "}
            {value.bluesky.bytes} / {value.bluesky.byteLimit} UTF-8 bytes · text
            hash <code>{value.bluesky.textHash.slice(0, 16)}…</code>
          </p>
          {value.bluesky.media[0] ? (
            <div className="sc-bluesky-media">
              <img
                src={value.bluesky.media[0].url}
                alt={value.bluesky.media[0].alt}
                width="1200"
                height="630"
                loading="lazy"
              />
              <p className="sc-hint">
                Alt: {value.bluesky.media[0].alt || "missing"} · media revision{" "}
                <code>{value.bluesky.media[0].revision}</code>
              </p>
            </div>
          ) : null}
          <p className="sc-hint">
            Link: {value.bluesky.link ?? "not recorded"} · schedule{" "}
            {value.bluesky.schedule.local ?? "not recorded"} ·{" "}
            {value.bluesky.schedule.utc ?? "not recorded"} · media descriptor
            hash <code>{value.bluesky.mediaHash.slice(0, 16)}…</code>
          </p>
          {value.bluesky.approval.reasons.length ? (
            <p className="sc-hint">
              Invalidation:{" "}
              {value.bluesky.approval.reasons
                .map((reason) => BLUESKY_APPROVAL_REASON_LABELS[reason])
                .join("; ")}
            </p>
          ) : null}
          <p className="sc-hint">{value.bluesky.send.message}</p>
        </div>
      )}
      <p className="sc-package-posting">{value.posting.statement}</p>
      <div className="sc-actions">
        <button type="button" onClick={onCopy} disabled={busy}>
          Copy package
        </button>
        <button
          type="button"
          onClick={() => onDownload("json")}
          disabled={busy}
        >
          Download JSON
        </button>
        <button type="button" onClick={() => onDownload("md")} disabled={busy}>
          Download Markdown
        </button>
      </div>
    </section>
  );
}

function blueskyIdentityLabel(identity: BlueskyIdentityResult | null) {
  if (!identity) return "Not checked";
  switch (identity.status) {
    case "resolved":
      return "Public identity resolved";
    case "needs_account":
      return "Needs account";
    case "invalid_handle":
      return "Invalid handle";
    case "not_found":
      return "Profile not found";
    case "mismatch":
      return "Handle mismatch";
    default:
      return "Not confirmed";
  }
}

function BlueskyPanel({
  item,
  source,
  approval,
  identity,
  handle,
  onHandleChange,
  onCheck,
  checking,
  now,
  onRecheck,
  onApprove,
  onCancel,
  onCheckSend,
  busy,
  canWrite,
}: {
  item: ShareCalendarItem;
  source: ShareCalendarSource | null;
  approval: BlueskyApprovalRecord | null;
  identity: BlueskyIdentityResult | null;
  handle: string;
  onHandleChange: (value: string) => void;
  onCheck: () => void;
  checking: boolean;
  now: Date;
  onRecheck: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onCheckSend: () => void;
  busy: boolean;
  canWrite: boolean;
}) {
  const [content, setContent] =
    useState<Awaited<ReturnType<typeof createBlueskyContent>>>();
  const [contentError, setContentError] = useState("");
  useEffect(() => {
    let live = true;
    setContentError("");
    createBlueskyContent(item, source, now)
      .then((next) => {
        if (live) setContent(next);
      })
      .catch((cause) => {
        if (live)
          setContentError(
            cause instanceof Error
              ? cause.message
              : "The exact Bluesky draft could not be prepared.",
          );
      });
    return () => {
      live = false;
    };
  }, [item, source, now]);
  const account = useMemo(
    () => blueskyAccountFromIdentity(identity),
    [identity],
  );
  const status = useMemo(
    () =>
      content
        ? blueskyApprovalStatus({ content, account, approval, now })
        : null,
    [content, account, approval, now],
  );
  const preview = blueskyUsage(blueskyTextForItem(item));
  const media = content?.media[0];
  return (
    <section
      className="sc-bluesky"
      aria-label={`Bluesky destination for item revision ${item.revision}`}
    >
      <div className="sc-bluesky-head">
        <div>
          <h4>Bluesky destination</h4>
          <p className="sc-hint">
            Optional channel. LinkedIn remains available above as the manual
            fallback. This panel resolves a public profile and binds an exact
            approval; it does not connect an account or post.
          </p>
        </div>
        <span className="sc-bluesky-state">
          {identity
            ? blueskyIdentityLabel(identity)
            : handle.trim()
              ? "Not checked"
              : "Needs account"}
        </span>
      </div>

      <div className="sc-bluesky-account">
        <label className="sc-field">
          Public Bluesky handle
          <input
            value={handle}
            maxLength={253}
            placeholder="name.bsky.social"
            disabled={busy}
            onChange={(event) => onHandleChange(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={onCheck}
          disabled={busy || checking || !handle.trim()}
        >
          {checking ? "Checking public profile…" : "Resolve public identity"}
        </button>
        <p className="sc-hint">
          {handle.trim()
            ? "The Composer server reads only the public AppView, with a short timeout. No password or app password is requested."
            : "Needs account: no Bluesky handle is configured. Enter the owner's public handle to check it. Composer stores no credential."}
        </p>
        {identity?.status === "resolved" && (
          <div className="sc-bluesky-identity">
            {identity.avatar ? (
              <img
                src={identity.avatar}
                alt=""
                width="48"
                height="48"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div>
              <p>
                <strong>@{identity.handle}</strong>
                {identity.displayName ? " · " + identity.displayName : ""}
              </p>
              <p className="sc-bluesky-did">DID {identity.did}</p>
              <p className="sc-hint">
                Public identity resolved · Publishing authorised:{" "}
                <strong>No</strong>. A public profile is not permission to post.
              </p>
              {identity.profileUrl && (
                <a
                  className="sc-text-link"
                  href={identity.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open the public profile
                </a>
              )}
            </div>
          </div>
        )}
        {identity && identity.status !== "resolved" && (
          <p role="status" className="sc-bluesky-failure">
            {identity.message}
          </p>
        )}
        <p className="sc-hint sc-credential-note">
          {BLUESKY_CREDENTIAL_STATEMENT}
        </p>
      </div>

      {contentError && (
        <p role="alert" className="sc-stale">
          {contentError}
        </p>
      )}
      {content && (
        <>
          <div className="sc-bluesky-preview">
            <p
              className={`sc-bluesky-text${content.usage.withinLimit ? "" : " sc-count-over"}`}
            >
              {content.text || "(No Bluesky text saved)"}
            </p>
            <p
              className={`sc-count${content.usage.withinLimit ? "" : " sc-count-over"}`}
            >
              {content.usage.count} / {content.usage.limit} graphemes ·{" "}
              {content.usage.bytes} / {content.usage.byteLimit} UTF-8 bytes
            </p>
            {media ? (
              <div className="sc-bluesky-media">
                <img
                  src={media.url}
                  alt={media.alt}
                  width="1200"
                  height="630"
                  loading="lazy"
                />
                <p className="sc-hint">
                  Alt: {media.alt || "missing"} · media revision{" "}
                  <code>{media.revision}</code> · descriptor hash{" "}
                  <code>{media.hash.slice(0, 16)}…</code>
                </p>
              </div>
            ) : (
              <p className="sc-stale">
                No public share-card image is bound. Refresh the source before
                approving.
              </p>
            )}
            <p className="sc-hint">
              Link:{" "}
              {content.link ? (
                <a
                  href={content.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {content.link}
                </a>
              ) : (
                "not recorded"
              )}
            </p>
            <p className="sc-bluesky-time">
              Australia/Melbourne {content.schedule.local ?? "not recorded"} ·
              UTC {content.schedule.utc ?? "not recorded"} · rechecked{" "}
              {displayDate(content.schedule.revalidatedAt)}
            </p>
            <button
              type="button"
              onClick={onRecheck}
              disabled={busy}
              className="sc-bluesky-recheck"
            >
              Revalidate time
            </button>
            <p className="sc-hint">{content.source.rightsNote}</p>
            {content.problems.length > 0 && (
              <ul className="sc-bluesky-problems">
                {content.problems.map((problem) => (
                  <li key={problem.code}>{problem.message}</li>
                ))}
              </ul>
            )}
          </div>
          {status && (
            <div className={`sc-bluesky-approval sc-approval-${status.state}`}>
              <div className="sc-bluesky-approval-head">
                <h4>{status.label}</h4>
                <span className="sc-notch">Not sent</span>
              </div>
              <p className="sc-hint">{status.note}</p>
              {status.reasons.length > 0 && (
                <ul className="sc-bluesky-reasons">
                  {status.reasons.map((reason) => (
                    <li key={reason}>
                      {BLUESKY_APPROVAL_REASON_LABELS[reason]}
                    </li>
                  ))}
                </ul>
              )}
              {status.approvedAt && (
                <p className="sc-hint">
                  Approved {displayDate(status.approvedAt)} · expires{" "}
                  {status.expiresAt
                    ? displayDate(status.expiresAt)
                    : "not recorded"}{" "}
                  · approval revision {status.approvalRevision ?? "none"}
                </p>
              )}
              {status.bindingHash && (
                <p className="sc-bluesky-binding">
                  Binding <code>{status.bindingHash.slice(0, 24)}…</code>
                </p>
              )}
              <p className="sc-hint">
                Counted now: {preview.count} / {preview.limit} graphemes ·{" "}
                {preview.bytes} / {preview.byteLimit} bytes.
              </p>
              <div className="sc-actions">
                <button
                  type="button"
                  className="sc-primary"
                  disabled={busy || !canWrite || !status.canApprove}
                  onClick={onApprove}
                >
                  Approve this exact revision
                </button>
                <button
                  type="button"
                  disabled={busy || !canWrite || !status.canCancel}
                  onClick={onCancel}
                >
                  Cancel approval
                </button>
                <button type="button" onClick={onCheckSend}>
                  Check send path
                </button>
              </div>
              <p className="sc-bluesky-send">
                {BLUESKY_SEND_UNAVAILABLE_STATEMENT}
              </p>
              <p className="sc-hint">
                Receipt: none recorded. An unknown outcome is shown as Unknown
                and is never retried automatically; Composer cannot claim a
                post.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
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
  const [destination, setDestination] = useState("");
  const [caption, setCaption] = useState("");
  const [variants, setVariants] = useState<ShareCalendarVariant[]>([]);
  const [link, setLink] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [editing, setEditing] = useState<ShareCalendarItem>();
  const [packageFor, setPackageFor] = useState("");
  const [packageValue, setPackageValue] = useState<ShareApprovalPackage>();
  const [blueskyHandle, setBlueskyHandle] = useState("");
  const [blueskyIdentity, setBlueskyIdentity] =
    useState<BlueskyIdentityResult | null>(null);
  const [blueskyChecking, setBlueskyChecking] = useState(false);
  const [blueskyNow, setBlueskyNow] = useState(() => new Date());
  const alive = useRef(true);
  const pending = useRef(false);
  const selection = useRef<string | undefined>(undefined);
  const invalidScope = useRef(false);

  const sources = snapshot?.sources ?? [];
  const source = sources.find((entry) => entry.id === sourceId);
  const canWrite = Boolean(snapshot && snapshot.workspace.role !== "viewer");
  const scheduled = useMemo(
    () => calendarExportItems(snapshot?.items ?? []),
    [snapshot],
  );

  function fillFromSource(id: string, current?: ShareCalendarItem) {
    setSourceId(id);
    const next = sources.find((entry) => entry.id === id);
    if (current) {
      setChannel(current.channel);
      setDestination(current.destination);
      setCaption(current.caption);
      setVariants(
        current.variants.map((variant) => ({
          channel: variant.channel,
          destination: variant.destination,
          caption: variant.caption,
        })),
      );
      setLink(current.link);
      setScheduledLocal(melbourneLocalInput(current.scheduledAt));
      return;
    }
    setChannel("instagram");
    setDestination("");
    setCaption(next?.description ?? "");
    setVariants([]);
    setLink(next?.url ?? "");
    setScheduledLocal("");
  }

  function addVariant() {
    const next = SHARE_CHANNELS.find(
      (entry) =>
        entry.id !== channel &&
        !variants.some((variant) => variant.channel === entry.id),
    );
    if (!next) return;
    setVariants((current) => [
      ...current,
      { channel: next.id, destination: "", caption: "" },
    ]);
  }

  async function load() {
    setError("");
    setLoading(true);
    try {
      const result = await calendarCall("list", selection.current);
      if (!alive.current) return;
      setSnapshot(result);
      setBlueskyHandle((current) => {
        if (current) return current;
        const approval = result.approvals[0];
        return result.bluesky.configuredHandle ?? approval?.accountHandle ?? "";
      });
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

  async function perform(action: string, fields: Record<string, unknown>) {
    const result = await calendarCall(action, selection.current, fields);
    if (!alive.current)
      throw Error("This page closed before the change could be confirmed.");
    setSnapshot(result);
    setPackageFor("");
    setPackageValue(undefined);
    return result;
  }

  async function mutate(
    action: string,
    fields: Record<string, unknown>,
    message: string,
  ): Promise<ShareCalendarSnapshot | null> {
    if (pending.current || invalidScope.current) return null;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await perform(action, fields);
      setNotice(message);
      return result;
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The change could not be confirmed. Refresh before retrying.",
        );
      return null;
    } finally {
      if (alive.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  async function checkBlueskyIdentity() {
    if (blueskyChecking) return;
    setBlueskyChecking(true);
    setError("");
    setNotice("");
    try {
      const result = await identityCall(blueskyHandle, selection.current);
      if (!alive.current) return;
      setBlueskyIdentity(result);
      if (result.status === "resolved" && result.handle)
        setBlueskyHandle(result.handle);
      setNotice(
        result.status === "resolved"
          ? `Public identity resolved for @${result.handle}. Publishing is still not authorised; nothing was sent.`
          : `${result.message} No post was sent.`,
      );
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The public Bluesky identity could not be checked.",
        );
    } finally {
      if (alive.current) setBlueskyChecking(false);
    }
  }

  async function approveBluesky(item: ShareCalendarItem) {
    const saved = await mutate(
      "blueskyApprove",
      {
        item: item.id,
        expectedRevision: item.revision,
        handle: blueskyHandle.trim(),
      },
      "Bound the exact Bluesky revision. Nothing was sent.",
    );
    if (!saved || !alive.current) return;
    const approval = saved.approvals.find((entry) => entry.itemId === item.id);
    if (approval) {
      setNotice(
        `Approved revision ${approval.draftRevision} for @${approval.accountHandle} · approval revision ${approval.approvalRevision} · expires ${displayDate(approval.expiresAt)}. Nothing was sent.`,
      );
    }
  }

  async function cancelBluesky(
    item: ShareCalendarItem,
    approval: BlueskyApprovalRecord,
  ) {
    const saved = await mutate(
      "blueskyCancel",
      {
        item: item.id,
        expectedApprovalRevision: approval.approvalRevision,
        reason: "Owner cancelled the exact Bluesky approval.",
      },
      "Cancelled the Bluesky approval. Nothing was sent.",
    );
    if (!saved || !alive.current) return;
    setNotice(
      "Cancelled the Bluesky approval. The saved text and schedule are unchanged; nothing was sent.",
    );
  }

  function checkBlueskySend(status: {
    label: string;
    send: { code: string; message: string };
  }) {
    setError("");
    setNotice(`${status.label}: ${status.send.message} (${status.send.code}).`);
  }

  async function packageBluesky(
    item: ShareCalendarItem,
  ): Promise<SharePackageBluesky | null> {
    if (!snapshot || !hasBlueskyDraft(item)) return null;
    return blueskyPackageForItem(snapshot, item, {
      identity: blueskyIdentity,
      now: new Date(),
    });
  }

  async function openPackage(item: ShareCalendarItem) {
    if (packageFor === item.id) {
      setPackageFor("");
      setPackageValue(undefined);
      return;
    }
    if (!snapshot) return;
    try {
      const bluesky = await packageBluesky(item);
      setPackageValue(approvalPackageForItem(snapshot, item, bluesky));
      setPackageFor(item.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The approval package could not be prepared. Refresh before retrying.",
      );
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || pending.current || invalidScope.current) return;
    const mainCaption = caption.trim();
    const mainProblem = primaryCaptionProblem(channel, mainCaption);
    if (mainProblem) {
      setError(mainProblem);
      return;
    }
    if (link.trim() && !isSafeShareLink(link.trim())) {
      setError(
        "Use a real http or https link, without a username or password.",
      );
      return;
    }
    const seen = new Set<ShareChannel>([channel]);
    for (const [index, variant] of variants.entries()) {
      if (seen.has(variant.channel)) {
        setError(
          "Choose each channel once. The main caption already covers " +
            SHARE_CHANNEL_LABELS[channel] +
            ".",
        );
        return;
      }
      seen.add(variant.channel);
      const problem = captionProblem(variant.channel, variant.caption);
      if (problem) {
        setError(
          `${SHARE_CHANNEL_LABELS[variant.channel]} draft ${index + 1}: ${problem}`,
        );
        return;
      }
    }
    let scheduledAt: string | null = null;
    if (scheduledLocal) {
      const time = melbourneLocalInstant(scheduledLocal);
      if (!time) {
        setError(
          "Choose a real Australia/Melbourne date and time, or leave the date empty. A daylight-saving gap is not a valid local time.",
        );
        return;
      }
      scheduledAt = time;
    }
    const desired = variants.map((variant) => ({
      channel: variant.channel,
      destination: variant.destination.trim(),
      caption: variant.caption.trim(),
    }));
    const fields = {
      channel,
      destination: destination.trim(),
      caption: mainCaption,
      link: link.trim(),
      scheduledAt,
    };
    const verb = scheduledAt ? "Scheduled" : "Draft saved";
    const detail = scheduledAt ? scheduleLabels(scheduledAt) : null;
    const message = detail
      ? `${verb} for ${detail.melbourne} · ${detail.utc}. Composer will not post it.`
      : `${verb}. Nothing is on the calendar and nothing was posted.`;

    const primaryPayload = editing
      ? {
          action: "save",
          workspace: selection.current,
          item: editing.id,
          expectedRevision: editing.revision,
          ...fields,
        }
      : {
          action: "create",
          workspace: selection.current,
          stack: sourceId,
          ...fields,
        };
    if (requestByteLength(primaryPayload) > 7900) {
      setError(
        `This save is ${requestByteLength(primaryPayload)} bytes. Composer can send at most 7,900 bytes in one request; shorten the caption or link.`,
      );
      return;
    }
    for (const draft of desired) {
      const variantPayload = {
        action: "variant",
        workspace: selection.current,
        item: editing?.id ?? "00000000-0000-4000-8000-000000000000",
        expectedRevision: 1,
        ...draft,
      };
      if (requestByteLength(variantPayload) > 7900) {
        setError(
          `The ${SHARE_CHANNEL_LABELS[draft.channel]} draft is ${requestByteLength(variantPayload)} bytes. Composer can send at most 7,900 bytes in one request; shorten that caption.`,
        );
        return;
      }
    }

    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    let current: ShareCalendarSnapshot | null = null;
    let itemId: string | null = editing?.id ?? null;
    try {
      current = await perform(
        editing ? "save" : "create",
        editing
          ? {
              item: editing.id,
              expectedRevision: editing.revision,
              ...fields,
            }
          : { stack: sourceId, ...fields },
      );
      itemId = current.changed;
      if (!itemId)
        throw Error(
          "The saved item could not be identified. Refresh before adding channel drafts.",
        );
      const first = current.items.find((entry) => entry.id === itemId);
      if (!first)
        throw Error(
          "The saved item is not in the refreshed calendar. Refresh before retrying.",
        );
      const changes: Array<{
        channel: ShareChannel;
        destination: string;
        caption: string | null;
      }> = [];
      for (const persisted of first.variants) {
        if (!desired.some((entry) => entry.channel === persisted.channel))
          changes.push({
            channel: persisted.channel,
            destination: persisted.destination,
            caption: null,
          });
      }
      for (const draft of desired) {
        const persisted = first.variants.find(
          (entry) => entry.channel === draft.channel,
        );
        if (
          !persisted ||
          persisted.caption !== draft.caption ||
          persisted.destination !== draft.destination
        )
          changes.push({
            channel: draft.channel,
            destination: draft.destination,
            caption: draft.caption,
          });
      }
      for (const change of changes) {
        const latest = current.items.find((entry) => entry.id === itemId);
        if (!latest)
          throw Error(
            "The item disappeared while its channel drafts were saving. Refresh before retrying.",
          );
        current = await perform("variant", {
          item: itemId,
          expectedRevision: latest.revision,
          channel: change.channel,
          destination: change.destination,
          caption: change.caption,
        });
      }
      const saved = current.items.find((entry) => entry.id === itemId);
      const extra = saved?.variants.length ?? 0;
      setNotice(
        `${message} ${
          extra ? `Saved ${extra} channel draft${extra === 1 ? "" : "s"}. ` : ""
        }The approval package does not post.`,
      );
      setEditing(undefined);
      setPackageFor("");
      const next = current.sources[0];
      if (next) {
        setSourceId(next.id);
        setChannel("instagram");
        setDestination("");
        setCaption(next.description);
        setVariants([]);
        setLink(next.url);
      }
      setScheduledLocal("");
    } catch (cause) {
      if (current && itemId) {
        const saved = current.items.find((entry) => entry.id === itemId);
        if (saved) setEditing(saved);
      }
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The change could not be confirmed. Refresh before retrying.",
        );
    } finally {
      if (alive.current) {
        pending.current = false;
        setBusy(false);
      }
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
      const ics = buildShareCalendarIcs(scheduled, {
        now: new Date(),
        calendarName: "Share calendar · " + snapshot.workspace.name,
      });
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

  async function downloadPackage(
    item: ShareCalendarItem,
    format: "json" | "md",
  ) {
    if (!snapshot) return;
    try {
      const bluesky = await packageBluesky(item);
      const value = approvalPackageForItem(snapshot, item, bluesky);
      const text =
        format === "json"
          ? sharePackageJson(value)
          : sharePackageMarkdown(value);
      const url = URL.createObjectURL(
        new Blob([text], {
          type:
            format === "json"
              ? "application/json;charset=utf-8"
              : "text/markdown;charset=utf-8",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = sharePackageFilename(item, format);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice(
        `Downloaded the ${format === "json" ? "JSON" : "Markdown"} approval package for revision ${item.revision}. The item state is unchanged and Composer did not post it.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The approval package could not be prepared. Refresh before retrying.",
      );
    }
  }

  async function copyPackage(item: ShareCalendarItem) {
    if (!snapshot) return;
    try {
      const bluesky = await packageBluesky(item);
      const copied = await copyText(
        sharePackagePlainText(approvalPackageForItem(snapshot, item, bluesky)),
      );
      if (!copied) {
        setError(
          "The browser did not allow a copy. Open the package and select the text yourself.",
        );
        return;
      }
      setNotice(
        "Approval package copied as plain text. The item state is unchanged and nothing was posted.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The approval package could not be copied.",
      );
    }
  }

  const preview = scheduledLocal
    ? (() => {
        const time = melbourneLocalInstant(scheduledLocal);
        return time ? scheduleLabels(time) : null;
      })()
    : null;

  const primaryUsage = captionUsage(channel, caption, true);

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
                    <option
                      key={entry.id}
                      value={entry.id}
                      disabled={variants.some(
                        (variant) => variant.channel === entry.id,
                      )}
                    >
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="sc-hint sc-channel-note">
                {SHARE_CHANNELS.find((entry) => entry.id === channel)?.note}
                {variants.some((variant) => variant.channel === channel)
                  ? " Remove the channel draft below before moving the main destination here."
                  : ""}
              </p>
              <label className="sc-field">
                Exact destination (optional)
                <input
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  maxLength={SHARE_DESTINATION_MAX}
                  placeholder="e.g. MP personal LinkedIn profile or Acme company page"
                  disabled={busy || !canWrite}
                />
              </label>
              <p className="sc-hint">
                Name the account, Page or profile a reviewer should use. Leave
                it empty and the package says “not recorded” rather than
                guessing.
              </p>
              <label className="sc-field">
                Main caption for {SHARE_CHANNEL_LABELS[channel]}
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={SHARE_CAPTION_LOCAL_CHARACTERS}
                  rows={6}
                  disabled={busy || !canWrite}
                  aria-describedby="sc-main-caption-count"
                  aria-invalid={!primaryUsage.withinLimit}
                  required
                />
              </label>
              <p
                id="sc-main-caption-count"
                className={`sc-count${primaryUsage.withinLimit ? "" : " sc-count-over"}`}
              >
                {primaryUsage.count} / {primaryUsage.limit} {primaryUsage.unit}{" "}
                · main caption
              </p>
              <p className="sc-hint">
                {primaryUsage.behaviour}
                {primaryUsage.platformLimit > primaryUsage.limit
                  ? ` The destination accepts ${primaryUsage.platformLimit} ${primaryUsage.unit}; this main caption keeps the ${primaryUsage.limit}-${primaryUsage.unit.replace(/s$/, "")} Composer limit.`
                  : ""}
              </p>
              <fieldset className="sc-variants">
                <legend>Channel drafts</legend>
                <p className="sc-hint">
                  One exact caption per additional destination. The main caption
                  above is the {SHARE_CHANNEL_LABELS[channel]} destination; each
                  draft below is saved separately and appears in the approval
                  package.
                </p>
                {variants.map((variant, index) => {
                  const usage = captionUsage(variant.channel, variant.caption);
                  const available = SHARE_CHANNELS.filter(
                    (entry) =>
                      entry.id !== channel &&
                      !variants.some(
                        (other, otherIndex) =>
                          otherIndex !== index && other.channel === entry.id,
                      ),
                  );
                  return (
                    <div className="sc-variant" key={index}>
                      <div className="sc-variant-head">
                        <label className="sc-field">
                          Channel
                          <select
                            value={variant.channel}
                            disabled={busy || !canWrite}
                            onChange={(event) => {
                              const nextChannel = event.target
                                .value as ShareChannel;
                              setVariants((current) =>
                                current.map((entry, entryIndex) =>
                                  entryIndex === index
                                    ? { ...entry, channel: nextChannel }
                                    : entry,
                                ),
                              );
                            }}
                          >
                            {available.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="sc-variant-remove"
                          disabled={busy || !canWrite}
                          onClick={() =>
                            setVariants((current) =>
                              current.filter(
                                (_, entryIndex) => entryIndex !== index,
                              ),
                            )
                          }
                        >
                          Remove draft
                        </button>
                      </div>
                      <label className="sc-field">
                        Exact destination (optional)
                        <input
                          value={variant.destination}
                          onChange={(event) =>
                            setVariants((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      destination: event.target.value,
                                    }
                                  : entry,
                              ),
                            )
                          }
                          maxLength={SHARE_DESTINATION_MAX}
                          placeholder="e.g. Acme company Page"
                          disabled={busy || !canWrite}
                        />
                      </label>
                      <label className="sc-field">
                        Caption for {SHARE_CHANNEL_LABELS[variant.channel]}
                        <textarea
                          value={variant.caption}
                          onChange={(event) =>
                            setVariants((current) =>
                              current.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, caption: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          rows={4}
                          disabled={busy || !canWrite}
                          aria-describedby={`sc-variant-count-${index}`}
                          aria-invalid={!usage.withinLimit}
                          required
                        />
                      </label>
                      <p
                        id={`sc-variant-count-${index}`}
                        className={`sc-count${usage.withinLimit ? "" : " sc-count-over"}`}
                      >
                        {usage.count} / {usage.limit} {usage.unit}
                      </p>
                      <p className="sc-hint">{usage.behaviour}</p>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="sc-add-variant"
                  onClick={addVariant}
                  disabled={
                    busy ||
                    !canWrite ||
                    variants.length >= SHARE_VARIANT_MAX ||
                    !SHARE_CHANNELS.some(
                      (entry) =>
                        entry.id !== channel &&
                        !variants.some(
                          (variant) => variant.channel === entry.id,
                        ),
                    )
                  }
                >
                  Add channel draft
                </button>
                <p className="sc-hint">
                  Additional drafts are saved one at a time after the main
                  caption. The page reports a partial save instead of claiming
                  all of them were written.
                </p>
              </fieldset>
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
                Date and time (Australia/Melbourne, leave empty for a draft)
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
                    <p className="sc-hint sc-destination-line">
                      Exact destination: {item.destination || "not recorded"}.
                      {item.variants.length
                        ? " Additional drafts: " +
                          item.variants
                            .map(
                              (variant) =>
                                SHARE_CHANNEL_LABELS[variant.channel],
                            )
                            .join(", ") +
                          "."
                        : ""}
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
                        aria-expanded={packageFor === item.id}
                        aria-controls={`sc-package-${item.id}`}
                        disabled={busy}
                        onClick={() => void openPackage(item)}
                      >
                        {packageFor === item.id
                          ? "Hide approval package"
                          : "Prepare approval package"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !item.sourceCurrent}
                        onClick={() => void copyItem(item)}
                      >
                        Copy main caption + link
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
                    {packageFor === item.id && packageValue && (
                      <ApprovalPackageView
                        id={`sc-package-${item.id}`}
                        value={packageValue}
                        busy={busy}
                        onCopy={() => void copyPackage(item)}
                        onDownload={(format) =>
                          void downloadPackage(item, format)
                        }
                      />
                    )}
                    {hasBlueskyDraft(item) && (
                      <BlueskyPanel
                        item={item}
                        source={
                          sources.find(
                            (entry) =>
                              entry.id === item.stack &&
                              entry.publication === item.publication,
                          ) ?? null
                        }
                        approval={
                          snapshot.approvals.find(
                            (entry) => entry.itemId === item.id,
                          ) ?? null
                        }
                        identity={blueskyIdentity}
                        handle={blueskyHandle}
                        onHandleChange={(value) => {
                          setBlueskyHandle(value);
                          setBlueskyIdentity(null);
                        }}
                        onCheck={() => void checkBlueskyIdentity()}
                        checking={blueskyChecking}
                        now={blueskyNow}
                        onRecheck={() => setBlueskyNow(new Date())}
                        onApprove={() => void approveBluesky(item)}
                        onCancel={() => {
                          const approval = snapshot.approvals.find(
                            (entry) => entry.itemId === item.id,
                          );
                          if (approval) void cancelBluesky(item, approval);
                        }}
                        onCheckSend={() => {
                          const account =
                            blueskyAccountFromIdentity(blueskyIdentity);
                          void createBlueskyContent(
                            item,
                            sources.find(
                              (entry) =>
                                entry.id === item.stack &&
                                entry.publication === item.publication,
                            ) ?? null,
                            new Date(),
                          ).then((content) => {
                            const status = blueskyApprovalStatus({
                              content,
                              account,
                              approval:
                                snapshot.approvals.find(
                                  (entry) => entry.itemId === item.id,
                                ) ?? null,
                              now: new Date(),
                            });
                            checkBlueskySend(status);
                          });
                        }}
                        busy={busy}
                        canWrite={canWrite}
                      />
                    )}
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
