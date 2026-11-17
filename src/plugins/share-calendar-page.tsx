import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  buildShareCalendarIcs,
  calendarExportItems,
  calendarFilename,
  captionProblem,
  captionUsage,
  cataloguePreviewReplySchema,
  isSafeShareLink,
  itemApprovalAndDelivery,
  MELBOURNE_WEEKDAYS,
  QUEUE_NEXT_HORIZON_WEEKS,
  melbourneLocalInput,
  melbourneLocalInstant,
  primaryCaptionProblem,
  queueNextPreviewReplySchema,
  scheduleLabels,
  shareCalendarSnapshot,
  shareListFilterForItem,
  SHARE_CAPTION_LOCAL_CHARACTERS,
  SHARE_CHANNELS,
  SHARE_CHANNEL_LABELS,
  SHARE_CHANNEL_LIMITS,
  SHARE_DESTINATION_MAX,
  SHARE_STATES,
  SHARE_STATE_LABELS,
  SHARE_VARIANT_MAX,
  type CatalogueResolvedAsset,
  type QueueNextPreview,
  type ShareCalendarItem,
  type ShareCalendarSnapshot,
  type ShareCalendarSource,
  type ShareCalendarVariant,
  type ShareChannel,
  type ShareListFilter,
} from "../lib/share-calendar";
import {
  catalogueSearchReplySchema,
  SHARE_CATALOGUE_ID_MAX,
  SHARE_CATALOGUE_ID_PATTERN,
  SHARE_CATALOGUE_ORIGIN,
  SHARE_CATALOGUE_QUERY_MAX,
  type CatalogueSearchItem,
} from "../lib/share-catalogue-asset";
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
  portfolioBlueskyText,
  type BlueskyApprovalRecord,
  type BlueskyPublishingConnection,
  type SharePackageBluesky,
} from "../lib/share-approval";
import {
  BLUESKY_DELIVERY_LABELS,
  type BlueskyDeliveryRecord,
} from "../lib/share-calendar";
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

// Read-only Queue Next preview (#663). The page sends only a Melbourne weekday
// and HH:mm; the server reads authoritative scheduled Bluesky times and returns
// the next free slot. No schedule, approval or credential is changed.
async function queueNextCall(
  weekday: number,
  time: string,
  workspace?: string,
): Promise<QueueNextPreview> {
  const params = new URLSearchParams({
    action: "queueNextPreview",
    weekday: String(weekday),
    time,
  });
  if (workspace) params.set("workspace", workspace);
  const response = await apiFetch(
    base + "shareCalendarRead?" + params.toString(),
    { cache: "no-store" },
  );
  const raw = await parseApiResponse<unknown>(
    response,
    "The queue preview could not be confirmed. Refresh before retrying.",
  );
  const parsed = queueNextPreviewReplySchema.safeParse(raw);
  if (!parsed.success)
    throw Error(
      errorMessage(
        raw,
        "The queue preview response could not be validated. Refresh before retrying.",
      ),
    );
  return parsed.data;
}

type CataloguePreview = {
  asset: CatalogueResolvedAsset;
  assetHash: string;
};

// The browser supplies only a strict asset ID. The server builds the fixed
// Woodhouse Share URL and returns the exact rendition digest it resolved.
async function cataloguePreviewCall(
  assetId: string,
  workspace?: string,
): Promise<CataloguePreview> {
  const params = new URLSearchParams({ action: "cataloguePreview", assetId });
  if (workspace) params.set("workspace", workspace);
  const response = await apiFetch(
    base + "shareCalendarRead?" + params.toString(),
    { cache: "no-store" },
  );
  const raw = await parseApiResponse<unknown>(
    response,
    "The Woodhouse Share artwork could not be read. No artwork was selected.",
  );
  const parsed = cataloguePreviewReplySchema.safeParse(raw);
  if (!parsed.success)
    throw Error(
      errorMessage(
        raw,
        "The artwork preview could not be validated. No artwork was selected.",
      ),
    );
  return parsed.data;
}

// The picker sends only a bounded search term. Choosing a result runs the same
// cataloguePreviewCall above, so the exact rendition, alt and credit are still
// confirmed by the existing preview before anything can be saved.
async function catalogueSearchCall(
  q: string,
  workspace?: string,
): Promise<CatalogueSearchItem[]> {
  const params = new URLSearchParams({ action: "catalogueSearch", q });
  if (workspace) params.set("workspace", workspace);
  const response = await apiFetch(
    base + "shareCalendarRead?" + params.toString(),
    { cache: "no-store" },
  );
  const raw = await parseApiResponse<unknown>(
    response,
    "The Woodhouse Share catalogue could not be searched. No artwork was selected.",
  );
  const parsed = catalogueSearchReplySchema.safeParse(raw);
  if (!parsed.success)
    throw Error(
      errorMessage(
        raw,
        "The catalogue search response could not be validated. No artwork was selected.",
      ),
    );
  return parsed.data.items;
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
            {value.provenance.preparedAt}. Item revision{" "}
            {value.provenance.itemRevision}
            {value.provenance.sourceRevision !== null &&
              `. Stack revision ${value.provenance.sourceRevision}`}
            .
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
            Public identity {value.bluesky.account.publicIdentity} · public
            identity only · approval {value.bluesky.approval.label} · not sent
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
  connection,
  delivery,
  onHandleChange,
  onCheck,
  checking,
  now,
  onRecheck,
  onApprove,
  onCancel,
  onSend,
  onReconcile,
  onCopyPackage,
  sending,
  busy,
  canWrite,
}: {
  item: ShareCalendarItem;
  source: ShareCalendarSource | null;
  approval: BlueskyApprovalRecord | null;
  identity: BlueskyIdentityResult | null;
  handle: string;
  connection: BlueskyPublishingConnection;
  delivery: BlueskyDeliveryRecord | null;
  onHandleChange: (value: string) => void;
  onCheck: () => void;
  checking: boolean;
  now: Date;
  onRecheck: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onSend: () => void;
  onReconcile: () => void;
  onCopyPackage: () => void;
  sending: boolean;
  busy: boolean;
  canWrite: boolean;
}) {
  const [content, setContent] =
    useState<Awaited<ReturnType<typeof createBlueskyContent>>>();
  const [contentError, setContentError] = useState("");
  const [sendConfirmed, setSendConfirmed] = useState(false);
  useEffect(() => {
    setSendConfirmed(false);
  }, [approval?.approvalRevision, delivery?.state]);
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
        ? blueskyApprovalStatus({ content, account, approval, connection, now })
        : null,
    [content, account, approval, connection, now],
  );
  const preview = blueskyUsage(blueskyTextForItem(item));
  const media = content?.media[0];
  const intended = approval ? scheduleLabels(approval.scheduledAt) : null;
  const sendWindowOpen = Boolean(
    approval &&
    Date.parse(approval.scheduledAt) <= now.getTime() &&
    Date.parse(approval.expiresAt) > now.getTime(),
  );
  const deliveryBlocksSend =
    delivery?.state === "published" ||
    delivery?.state === "sending" ||
    delivery?.state === "unknown" ||
    delivery?.state === "cancelled";
  const canSend =
    canWrite &&
    !busy &&
    !sending &&
    sendConfirmed &&
    connection.state === "configured" &&
    status?.state === "approved" &&
    status?.send.ok === true &&
    sendWindowOpen &&
    !deliveryBlocksSend;
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
            fallback. This panel resolves a public profile, binds an exact
            approval and can send only that exact approval through the
            configured connection.
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
        <div className="sc-bluesky-connection">
          <h4>Publishing connection</h4>
          <p className="sc-hint">
            {connection.state === "configured"
              ? `Configured${
                  connection.handle ? ` for @${connection.handle}` : ""
                }. The app password is stored encrypted by Composer and its validity is checked only when you send.`
              : connection.state === "revoked"
                ? "This connection was revoked. Copy the approval package and post it yourself."
                : `${BLUESKY_SEND_UNAVAILABLE_STATEMENT} Configure an encrypted app password in Composer plugin settings to enable sending.`}
          </p>
          {connection.state !== "configured" && (
            <button type="button" onClick={onCopyPackage} disabled={busy}>
              Copy approval package
            </button>
          )}
        </div>
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
              </div>
              {approval && (
                <div className="sc-bluesky-send-panel">
                  <h4>Send approved post</h4>
                  <dl className="sc-bluesky-bound">
                    <div>
                      <dt>Bound handle</dt>
                      <dd>@{approval.accountHandle}</dd>
                    </div>
                    <div>
                      <dt>Exact text</dt>
                      <dd>{content?.text || "not available"}</dd>
                    </div>
                    <div>
                      <dt>Media</dt>
                      <dd>
                        {media
                          ? `${item.catalogue ? "Woodhouse artwork" : "Public share card"} · ${media.alt}`
                          : "No approved share card"}
                      </dd>
                    </div>
                    <div>
                      <dt>Intended time</dt>
                      <dd>
                        {intended
                          ? `${intended.melbourne} · ${intended.utc}`
                          : "not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt>Approval</dt>
                      <dd>
                        revision {approval.approvalRevision} · expires{" "}
                        {displayDate(approval.expiresAt)}
                      </dd>
                    </div>
                  </dl>
                  <p className="sc-hint">
                    Delivery:{" "}
                    {delivery
                      ? `${BLUESKY_DELIVERY_LABELS[delivery.state]} · attempt ${delivery.attempt}`
                      : "not sent. No provider call has been made."}
                  </p>
                  {delivery?.state === "published" && delivery.permalink ? (
                    <p className="sc-bluesky-published">
                      <a
                        href={delivery.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open the published post
                      </a>
                      {delivery.publishedAt
                        ? ` · ${displayDate(delivery.publishedAt)}`
                        : ""}
                      {delivery.providerUri ? (
                        <>
                          {" "}
                          · AT URI <code>{delivery.providerUri}</code>
                        </>
                      ) : null}
                      {delivery.providerCid ? (
                        <>
                          {" "}
                          · CID <code>{delivery.providerCid}</code>
                        </>
                      ) : null}
                    </p>
                  ) : delivery?.state === "unknown" ||
                    delivery?.state === "sending" ? (
                    <>
                      <p role="status" className="sc-bluesky-failure">
                        {delivery.state === "sending"
                          ? "This send is still in progress. Reconcile after its lease expires; Composer will not retry it."
                          : delivery.errorMessage ||
                            "The provider outcome is unknown. Composer will not retry automatically."}
                      </p>
                      <div className="sc-actions">
                        <button
                          type="button"
                          onClick={onReconcile}
                          disabled={busy || sending}
                        >
                          {sending ? "Reconciling…" : "Reconcile receipt"}
                        </button>
                        <button
                          type="button"
                          onClick={onCopyPackage}
                          disabled={busy}
                        >
                          Copy approval package
                        </button>
                      </div>
                      <p className="sc-hint">
                        Reconciliation reads the deterministic record key. It
                        never posts again.
                      </p>
                    </>
                  ) : delivery?.state === "needs_auth" ? (
                    <>
                      <p role="status" className="sc-bluesky-failure">
                        {delivery.errorMessage}
                      </p>
                      <p className="sc-hint">
                        Update the encrypted app password in Composer plugin
                        settings. The deterministic record key prevents a
                        duplicate, so this exact approval can be retried.
                      </p>
                      <label className="sc-bluesky-confirm">
                        <input
                          type="checkbox"
                          checked={sendConfirmed}
                          disabled={busy || sending || !canWrite}
                          onChange={(event) =>
                            setSendConfirmed(event.target.checked)
                          }
                        />
                        I updated the connection and reviewed the bound handle,
                        exact text, media and intended time.
                      </label>
                      <div className="sc-actions">
                        <button
                          type="button"
                          className="sc-primary"
                          onClick={onSend}
                          disabled={!canSend}
                        >
                          {sending ? "Sending…" : "Send approved post"}
                        </button>
                        <button
                          type="button"
                          onClick={onCopyPackage}
                          disabled={busy}
                        >
                          Copy approval package
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {delivery?.state === "failed" &&
                        delivery.errorMessage && (
                          <p role="status" className="sc-bluesky-failure">
                            {delivery.errorMessage}
                          </p>
                        )}
                      <label className="sc-bluesky-confirm">
                        <input
                          type="checkbox"
                          checked={sendConfirmed}
                          disabled={busy || sending || !canWrite}
                          onChange={(event) =>
                            setSendConfirmed(event.target.checked)
                          }
                        />
                        I reviewed the bound handle, exact text, media and
                        intended time.
                      </label>
                      {!sendWindowOpen && (
                        <p className="sc-hint">
                          Sending opens at the intended time and closes when the
                          approval expires. Re-approve if the window has closed.
                        </p>
                      )}
                      <div className="sc-actions">
                        <button
                          type="button"
                          className="sc-primary"
                          onClick={onSend}
                          disabled={!canSend}
                        >
                          {sending ? "Sending…" : "Send approved post"}
                        </button>
                        {connection.state !== "configured" && (
                          <button
                            type="button"
                            onClick={onCopyPackage}
                            disabled={busy}
                          >
                            Copy approval package
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  <p className="sc-hint">
                    Composer writes a claim before the provider call and a
                    terminal receipt after it. A timeout becomes Unknown and is
                    reconciled by the record key, never retried blindly.
                  </p>
                </div>
              )}
              <p className="sc-hint">
                Receipt:{" "}
                {delivery
                  ? `${BLUESKY_DELIVERY_LABELS[delivery.state]} · updated ${displayDate(delivery.updatedAt)}`
                  : "none recorded. Approval alone never sends."}
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
  const [sourceKind, setSourceKind] = useState<"stack" | "catalogue">("stack");
  const [assetId, setAssetId] = useState("");
  const [cataloguePreview, setCataloguePreview] = useState<CataloguePreview>();
  const [catalogueChecking, setCatalogueChecking] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetResults, setAssetResults] = useState<CatalogueSearchItem[]>();
  const [assetSearching, setAssetSearching] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
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
  const [blueskySending, setBlueskySending] = useState(false);
  const [blueskyNow, setBlueskyNow] = useState(() => new Date());
  const [listFilter, setListFilter] = useState<ShareListFilter>("all");
  // Owner-only, read-only Queue Next preview state. It never writes and is
  // cleared when the weekday or time changes so a stale slot is not shown.
  const [queueWeekday, setQueueWeekday] = useState(1);
  const [queueTime, setQueueTime] = useState("09:00");
  const [queueResult, setQueueResult] = useState<{
    account: string;
    weekday: number;
    time: string;
    preview: QueueNextPreview;
  }>();
  const [queueChecking, setQueueChecking] = useState(false);
  // The same approval/delivery resolution as the item card drives both the
  // counts and the visible list. This filter is read-only and keeps item order.
  const classified = (snapshot?.items ?? []).map((item) => ({
    item,
    filter: snapshot ? shareListFilterForItem(snapshot, item) : null,
  }));
  const visibleItems = classified
    .filter(({ filter }) => listFilter === "all" || filter === listFilter)
    .map(({ item }) => item);
  const listCounts = {
    all: classified.length,
    published: classified.filter(({ filter }) => filter === "published").length,
    attention: classified.filter(({ filter }) => filter === "attention").length,
  };
  const alive = useRef(true);
  const pending = useRef(false);
  const selection = useRef<string | undefined>(undefined);
  const invalidScope = useRef(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // The send window opens at the intended time and closes when the approval
  // expires. A page left open across that boundary used to keep the original
  // instant, so the send button stayed disabled until a reload. Advance the
  // clock while the tab is visible; the explicit Revalidate control stays.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      setBlueskyNow((current) => {
        const next = new Date();
        return next.getTime() - current.getTime() >= 15_000 ? next : current;
      });
    };
    const timer = window.setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);

  const sources = snapshot?.sources ?? [];
  const source = sources.find((entry) => entry.id === sourceId);
  const canWrite = Boolean(snapshot && snapshot.workspace.role !== "viewer");
  const isOwner = snapshot?.workspace.role === "owner";
  const catalogueMode = sourceKind === "catalogue";
  const previewAsset =
    editing?.catalogue ??
    (cataloguePreview?.asset.assetId === assetId.trim()
      ? cataloguePreview.asset
      : undefined);
  const blueskyAccount = (
    snapshot?.bluesky.connection.handle ??
    snapshot?.bluesky.configuredHandle ??
    blueskyHandle
  ).trim();
  const queueAccount = snapshot?.bluesky.configuredHandle?.trim();
  const queuePreview =
    queueResult &&
    queueResult.account === queueAccount &&
    queueResult.weekday === queueWeekday &&
    queueResult.time === queueTime
      ? queueResult.preview
      : undefined;
  const queueLabels = scheduleLabels(queuePreview?.nextInstant ?? null);
  const canApplyQueuePreview =
    !editing &&
    (catalogueMode || channel === "bluesky") &&
    canWrite &&
    !busy &&
    !scheduledLocal &&
    Boolean(queuePreview?.nextInstant);
  const scheduled = useMemo(
    () => calendarExportItems(snapshot?.items ?? []),
    [snapshot],
  );

  function fillFromSource(id: string, current?: ShareCalendarItem) {
    setSourceId(id);
    setSourceKind("stack");
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

  function changeSourceKind(kind: "stack" | "catalogue") {
    if (editing || kind === sourceKind) return;
    setSourceKind(kind);
    setCataloguePreview(undefined);
    setRightsConfirmed(false);
    setVariants([]);
    if (kind === "catalogue") {
      if (caption === source?.description) setCaption("");
      setChannel("bluesky");
      setDestination("");
      setLink("");
      return;
    }
    setChannel("instagram");
    setDestination("");
    const next = sources.find((entry) => entry.id === sourceId) ?? sources[0];
    if (next) {
      setSourceId(next.id);
      setLink(next.url);
      if (!caption.trim()) setCaption(next.description);
    }
  }

  async function previewCatalogue(idValue: string = assetId) {
    const id = idValue.trim();
    if (!SHARE_CATALOGUE_ID_PATTERN.test(id)) {
      setError(
        "Use a single lowercase Woodhouse Share asset ID made of letters, digits and hyphens.",
      );
      return;
    }
    if (catalogueChecking) return;
    setCatalogueChecking(true);
    setError("");
    setNotice("");
    try {
      const reply = await cataloguePreviewCall(id, selection.current);
      if (!alive.current) return;
      setCataloguePreview(reply);
      setRightsConfirmed(false);
      setNotice(
        `Read ${reply.asset.title} from Woodhouse Share. Review the exact rendition, alt and credit before saving.`,
      );
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The Woodhouse Share artwork could not be read. No artwork was selected.",
        );
    } finally {
      if (alive.current) setCatalogueChecking(false);
    }
  }

  async function searchCatalogue() {
    const q = assetQuery.trim();
    if (!q || assetSearching || catalogueChecking || !canWrite || !isOwner)
      return;
    const workspace = selection.current;
    setAssetSearching(true);
    setAssetResults(undefined);
    setError("");
    setNotice("");
    try {
      const items = await catalogueSearchCall(q, workspace);
      if (alive.current && selection.current === workspace) {
        setAssetResults(items);
      }
    } catch (cause) {
      if (alive.current && selection.current === workspace) {
        setError(
          errorMessage(
            cause,
            "Woodhouse Share could not be searched. Try again or enter an asset ID.",
          ),
        );
      }
    } finally {
      if (alive.current) setAssetSearching(false);
    }
  }

  function chooseCatalogueResult(item: CatalogueSearchItem) {
    if (catalogueChecking) return;
    setAssetId(item.assetId);
    setCataloguePreview(undefined);
    setRightsConfirmed(false);
    void previewCatalogue(item.assetId);
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
        setSourceKind("stack");
        setSourceId(result.sources[0].id);
        setCaption(result.sources[0].description);
        setLink(result.sources[0].url);
      } else if (!editing && !sourceId && result.workspace.role === "owner") {
        setSourceKind("catalogue");
        setChannel("bluesky");
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

  async function previewQueueNext() {
    if (queueChecking || !queueAccount || !isOwner) return;
    const time = queueTime.trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError("Choose a 24-hour time in HH:mm format.");
      return;
    }
    const workspace = selection.current;
    setQueueChecking(true);
    setError("");
    setNotice("");
    setQueueResult(undefined);
    try {
      const result = await queueNextCall(queueWeekday, time, workspace);
      if (alive.current && selection.current === workspace)
        setQueueResult({
          account: queueAccount,
          weekday: queueWeekday,
          time,
          preview: result,
        });
    } catch (cause) {
      if (alive.current && selection.current === workspace)
        setError(
          cause instanceof Error
            ? cause.message
            : "The queue preview could not be confirmed. Refresh before retrying.",
        );
    } finally {
      if (alive.current) setQueueChecking(false);
    }
  }

  function applyQueuePreview() {
    const instant = queuePreview?.nextInstant;
    if (!instant || !canApplyQueuePreview || pending.current) return;
    if (Date.parse(instant) <= Date.now()) {
      setQueueResult(undefined);
      setNotice("That time has passed. Preview the next slot again.");
      return;
    }
    const local = melbourneLocalInput(instant);
    if (!local) return;
    // Form-local only: no request, no reservation, no change to approval or
    // send paths. The user can then edit the field before saving.
    setScheduledLocal(local);
    dateInputRef.current?.focus();
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
      // The approval route already resolved this public identity on the
      // server. Fill the panel's own check so an exact approval is not shown
      // as "identity not rechecked" immediately after it was bound.
      if (blueskyIdentity?.status !== "resolved") {
        try {
          const identity = await identityCall(
            approval.accountHandle,
            selection.current,
          );
          if (alive.current) setBlueskyIdentity(identity);
        } catch {
          /* The approval stands; the owner can resolve the public profile. */
        }
      }
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

  function connectionFor(
    approval: BlueskyApprovalRecord | null,
  ): BlueskyPublishingConnection {
    if (snapshot?.bluesky.connection.state === "configured")
      return {
        state: "configured",
        handle:
          snapshot.bluesky.connection.handle ?? approval?.accountHandle ?? "",
        did: approval?.accountDid ?? null,
      };
    return {
      state: "absent",
      reason: "No Bluesky publishing connection is configured.",
    };
  }

  async function sendBluesky(
    item: ShareCalendarItem,
    approval: BlueskyApprovalRecord,
  ) {
    if (blueskySending) return;
    setBlueskySending(true);
    setError("");
    setNotice("");
    try {
      const saved = await perform("blueskySend", {
        item: item.id,
        expectedRevision: item.revision,
        expectedApprovalRevision: approval.approvalRevision,
      });
      const delivery = saved.deliveries.find(
        (entry) =>
          entry.itemId === item.id &&
          entry.approvalRevision === approval.approvalRevision,
      );
      setNotice(
        delivery?.state === "published" && delivery.permalink
          ? `Published ${delivery.permalink}. The provider receipt is saved; no other revision was sent.`
          : `Send recorded as ${delivery ? BLUESKY_DELIVERY_LABELS[delivery.state] : "unknown"}. Review the receipt before any retry.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The send could not be confirmed. Reconcile the receipt before retrying.",
      );
      // Reload the authoritative receipt after a failed/ambiguous send so the
      // page cannot keep showing a pre-send state.
      try {
        const refreshed = await calendarCall("list", selection.current);
        if (alive.current) setSnapshot(refreshed);
      } catch {
        /* The original error stays visible; the receipt remains unknown. */
      }
    } finally {
      if (alive.current) setBlueskySending(false);
    }
  }

  async function reconcileBluesky(
    item: ShareCalendarItem,
    approval: BlueskyApprovalRecord,
  ) {
    if (blueskySending) return;
    setBlueskySending(true);
    setError("");
    setNotice("");
    try {
      const saved = await perform("blueskyReconcile", {
        item: item.id,
        expectedApprovalRevision: approval.approvalRevision,
      });
      const delivery = saved.deliveries.find(
        (entry) =>
          entry.itemId === item.id &&
          entry.approvalRevision === approval.approvalRevision,
      );
      setNotice(
        delivery?.state === "published" && delivery.permalink
          ? `Reconciled as published: ${delivery.permalink}.`
          : `Reconciled as ${delivery ? BLUESKY_DELIVERY_LABELS[delivery.state] : "unknown"}. No post was retried.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The receipt could not be reconciled. It stays unknown; no retry was made.",
      );
    } finally {
      if (alive.current) setBlueskySending(false);
    }
  }

  async function packageBluesky(
    item: ShareCalendarItem,
  ): Promise<SharePackageBluesky | null> {
    if (!snapshot || !hasBlueskyDraft(item)) return null;
    const approval =
      snapshot.approvals.find((entry) => entry.itemId === item.id) ?? null;
    return blueskyPackageForItem(snapshot, item, {
      identity: blueskyIdentity,
      approval,
      connection: connectionFor(approval),
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
    if (catalogueMode) {
      if (!isOwner) {
        setError(
          "Only a workspace owner can prepare a Woodhouse Share artwork draft.",
        );
        return;
      }
      if (!previewAsset || (!editing && !cataloguePreview)) {
        setError("Preview the exact Woodhouse Share artwork before saving.");
        return;
      }
      if (!editing && !rightsConfirmed) {
        setError(
          "Confirm the artwork rights and credit before saving this Bluesky draft.",
        );
        return;
      }
      const text = caption.trim();
      if (!text) {
        setError("Write a caption before saving this share.");
        return;
      }
      const body = portfolioBlueskyText(text, previewAsset);
      const usage = blueskyUsage(body);
      if (!usage.withinLimit) {
        setError(
          `This exact post is ${usage.count} / ${usage.limit} graphemes and ${usage.bytes} / ${usage.byteLimit} UTF-8 bytes. Shorten the caption; the artwork credit and project link are always included.`,
        );
        return;
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
      if (editing?.catalogue) {
        const saved = await mutate(
          "save",
          {
            item: editing.id,
            expectedRevision: editing.revision,
            channel: "bluesky",
            caption: text,
            link: editing.catalogue.projectUrl,
            scheduledAt,
          },
          "Artwork draft updated. Approve the new revision before sending.",
        );
        if (saved) {
          setEditing(undefined);
          setAssetId("");
          setCaption("");
          setScheduledLocal("");
        }
        return;
      }
      if (!cataloguePreview) return;
      const payload = {
        action: "catalogueCreate",
        workspace: selection.current,
        assetId: previewAsset.assetId,
        assetHash: cataloguePreview.assetHash,
        rightsConfirmed: true as const,
        caption: text,
        scheduledAt,
      };
      if (requestByteLength(payload) > 7900) {
        setError(
          `This save is ${requestByteLength(payload)} bytes. Composer can send at most 7,900 bytes in one request; shorten the caption.`,
        );
        return;
      }
      const detail = scheduledAt ? scheduleLabels(scheduledAt) : null;
      const saved = await mutate(
        "catalogueCreate",
        {
          assetId: previewAsset.assetId,
          assetHash: cataloguePreview.assetHash,
          rightsConfirmed: true,
          caption: text,
          scheduledAt,
        },
        detail
          ? `Scheduled ${previewAsset.title} for ${detail.melbourne} · ${detail.utc}. Composer will not post it automatically.`
          : `Saved ${previewAsset.title} as a Bluesky draft. Nothing is on the calendar and nothing was posted.`,
      );
      if (saved) {
        setAssetId("");
        setCataloguePreview(undefined);
        setRightsConfirmed(false);
        setCaption("");
        setScheduledLocal("");
      }
      return;
    }
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
      ? `${verb} for ${detail.melbourne} · ${detail.utc}. Composer will not post it automatically.`
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
  const catalogueBody =
    catalogueMode && previewAsset
      ? portfolioBlueskyText(caption, previewAsset)
      : "";
  const catalogueUsage = previewAsset ? blueskyUsage(catalogueBody) : null;
  const catalogueCaptionOnly = blueskyUsage(caption.trim());

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
        Prepare a caption and a date for a published stack, or for a workspace
        owner, one exact Woodhouse Share artwork. The calendar records local
        preparation and handoff. Bluesky is the only channel with an optional
        send path, and it runs only after an explicit confirmation of one exact
        approval; nothing posts automatically.
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
      {snapshot && !sources.length && !loading && !isOwner && (
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
      {snapshot && (sources.length > 0 || isOwner) && (
        <div className="sc-layout">
          <div className="sc-prepare" id="sc-prepare">
            <h2>{editing ? "Edit share" : "Prepare a share"}</h2>
            <p className="sc-hint">
              {editing
                ? "Editing content clears a previous local-share receipt; save and record it again when you hand it off."
                : "A published stack fills the caption and link from its current publication. A Woodhouse Share asset uses its exact rendition, alt, credit and project link."}
            </p>
            <form onSubmit={submit} className="sc-form">
              <div
                className="sc-source-switch"
                role="group"
                aria-label="Draft source"
              >
                <button
                  type="button"
                  aria-pressed={!catalogueMode}
                  disabled={Boolean(editing) || busy || !canWrite}
                  onClick={() => changeSourceKind("stack")}
                >
                  Published stack
                </button>
                <button
                  type="button"
                  aria-pressed={catalogueMode}
                  disabled={Boolean(editing) || busy || !canWrite || !isOwner}
                  onClick={() => changeSourceKind("catalogue")}
                >
                  Woodhouse Share artwork
                </button>
              </div>
              {catalogueMode ? (
                <div className="sc-catalogue">
                  <div className="sc-catalogue-search">
                    <label className="sc-field">
                      Search Woodhouse Share
                      <input
                        value={assetQuery}
                        onChange={(event) => {
                          setAssetQuery(event.target.value);
                          setAssetResults(undefined);
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault();
                            void searchCatalogue();
                          }
                        }}
                        maxLength={SHARE_CATALOGUE_QUERY_MAX}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="Artwork or project name"
                        readOnly={assetSearching}
                        disabled={
                          Boolean(editing) || busy || !canWrite || !isOwner
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void searchCatalogue()}
                      aria-disabled={assetSearching || catalogueChecking}
                      disabled={
                        Boolean(editing) ||
                        busy ||
                        !canWrite ||
                        !isOwner ||
                        !assetQuery.trim()
                      }
                    >
                      {assetSearching ? "Searching…" : "Search catalogue"}
                    </button>
                    <p className="sc-hint" role="status">
                      {assetSearching
                        ? "Searching Woodhouse Share…"
                        : assetResults?.length
                          ? `${assetResults.length} results. Choose artwork to preview.`
                          : assetResults
                            ? "No matching artwork. Try a different search."
                            : ""}
                    </p>
                    {!!assetResults?.length && (
                      <ul
                        className="sc-catalogue-results"
                        aria-label="Woodhouse Share search results"
                      >
                        {assetResults.map((item) => (
                          <li key={item.assetId}>
                            <button
                              type="button"
                              aria-pressed={assetId.trim() === item.assetId}
                              aria-disabled={catalogueChecking}
                              disabled={
                                Boolean(editing) ||
                                busy ||
                                !canWrite ||
                                !isOwner
                              }
                              onClick={() => chooseCatalogueResult(item)}
                            >
                              <strong>{item.title}</strong>
                              <span className="sc-hint">{item.project}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <label className="sc-field">
                    Woodhouse Share asset ID
                    <input
                      value={assetId}
                      onChange={(event) => {
                        setAssetId(event.target.value);
                        setCataloguePreview(undefined);
                        setRightsConfirmed(false);
                      }}
                      maxLength={SHARE_CATALOGUE_ID_MAX}
                      pattern="[a-z0-9][a-z0-9-]*"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="portfolio-asset-id"
                      disabled={
                        Boolean(editing) || busy || !canWrite || !isOwner
                      }
                      required
                    />
                  </label>
                  <div className="sc-actions">
                    <button
                      type="button"
                      onClick={() => void previewCatalogue()}
                      disabled={
                        Boolean(editing) ||
                        busy ||
                        catalogueChecking ||
                        !canWrite ||
                        !isOwner ||
                        !SHARE_CATALOGUE_ID_PATTERN.test(assetId.trim())
                      }
                    >
                      {catalogueChecking
                        ? "Reading artwork…"
                        : "Preview artwork"}
                    </button>
                    <a
                      className="sc-text-link"
                      href={SHARE_CATALOGUE_ORIGIN + "/share/"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Browse Woodhouse Share
                    </a>
                  </div>

                  {!isOwner && (
                    <p className="sc-hint">
                      Only a workspace owner can prepare a Woodhouse Share
                      artwork draft.
                    </p>
                  )}
                  {previewAsset && (
                    <div className="sc-catalogue-preview">
                      <img
                        src={previewAsset.renditionUrl}
                        alt={previewAsset.alt}
                        loading="lazy"
                      />
                      <div>
                        <p>
                          <strong>{previewAsset.title}</strong>
                        </p>
                        <p className="sc-hint">Alt: {previewAsset.alt}</p>
                        <p className="sc-hint">Credit: {previewAsset.credit}</p>
                        <p className="sc-hint">
                          <a
                            className="sc-text-link"
                            href={previewAsset.projectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Project page
                          </a>{" "}
                          ·{" "}
                          <a
                            className="sc-text-link"
                            href={previewAsset.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Original source
                          </a>
                        </p>
                        <p className="sc-hint">
                          Rendition {previewAsset.assetRevision} ·{" "}
                          {previewAsset.mimeType} · {previewAsset.byteLength}{" "}
                          bytes · SHA-256{" "}
                          <code>{previewAsset.bytesSha256.slice(0, 16)}…</code>
                        </p>
                      </div>
                      {!editing && (
                        <label className="sc-rights">
                          <input
                            type="checkbox"
                            checked={rightsConfirmed}
                            disabled={busy || !canWrite || !isOwner}
                            onChange={(event) =>
                              setRightsConfirmed(event.target.checked)
                            }
                          />
                          {`I have the right to reuse this exact rendition in this post, and I will keep the credit “${previewAsset.credit}”.`}
                        </label>
                      )}
                    </div>
                  )}
                  {cataloguePreview && !previewAsset && (
                    <p className="sc-stale">
                      The asset ID changed. Preview the exact artwork again
                      before saving.
                    </p>
                  )}
                </div>
              ) : (
                <>
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
                          <strong>
                            Published revision {source.publication}
                          </strong>
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
                    Name the account, Page or profile a reviewer should use.
                    Leave it empty and the package says “not recorded” rather
                    than guessing.
                  </p>
                </>
              )}
              {catalogueMode && (
                <>
                  <label className="sc-field">
                    Bluesky account
                    <input
                      value={
                        blueskyAccount ? "@" + blueskyAccount : "Not configured"
                      }
                      readOnly
                      disabled
                    />
                  </label>
                  <p className="sc-hint">
                    Approve the exact post and send it through the configured
                    account.
                  </p>
                </>
              )}
              <label className="sc-field">
                {catalogueMode
                  ? "Caption for Bluesky"
                  : `Main caption for ${SHARE_CHANNEL_LABELS[channel]}`}
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={SHARE_CAPTION_LOCAL_CHARACTERS}
                  rows={6}
                  disabled={busy || !canWrite}
                  aria-describedby="sc-main-caption-count"
                  aria-invalid={
                    catalogueMode
                      ? Boolean(catalogueUsage && !catalogueUsage.withinLimit)
                      : !primaryUsage.withinLimit
                  }
                  required
                />
              </label>
              {catalogueMode ? (
                <>
                  {catalogueUsage && (
                    <p className="sc-caption-preview">{catalogueBody}</p>
                  )}
                  <p
                    id="sc-main-caption-count"
                    className={`sc-count${
                      catalogueUsage && !catalogueUsage.withinLimit
                        ? " sc-count-over"
                        : ""
                    }`}
                  >
                    {catalogueUsage
                      ? `${catalogueUsage.count} / ${catalogueUsage.limit} graphemes · ${catalogueUsage.bytes} / ${catalogueUsage.byteLimit} UTF-8 bytes · exact Bluesky post`
                      : `${catalogueCaptionOnly.count} / ${catalogueCaptionOnly.limit} graphemes · ${catalogueCaptionOnly.bytes} / ${catalogueCaptionOnly.byteLimit} bytes · caption only`}
                  </p>
                  <p className="sc-hint">
                    The server trims the caption and normalises line breaks,
                    then posts it with “Artwork by{" "}
                    {previewAsset?.credit ?? "the recorded credit"}” and the
                    artwork project link. Preview the artwork to count the exact
                    post, including that credit.
                  </p>
                </>
              ) : (
                <>
                  <p
                    id="sc-main-caption-count"
                    className={`sc-count${primaryUsage.withinLimit ? "" : " sc-count-over"}`}
                  >
                    {primaryUsage.count} / {primaryUsage.limit}{" "}
                    {primaryUsage.unit} · main caption
                  </p>
                  <p className="sc-hint">
                    {primaryUsage.behaviour}
                    {primaryUsage.platformLimit > primaryUsage.limit
                      ? ` The destination accepts ${primaryUsage.platformLimit} ${primaryUsage.unit}; this main caption keeps the ${primaryUsage.limit}-${primaryUsage.unit.replace(/s$/, "")} Composer limit.`
                      : ""}
                  </p>
                </>
              )}
              <fieldset
                className="sc-variants"
                hidden={catalogueMode}
                disabled={catalogueMode}
              >
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
              {!catalogueMode && (
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
              )}
              <label className="sc-field">
                Date and time (Australia/Melbourne, leave empty for a draft)
                <input
                  ref={dateInputRef}
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
                  disabled={
                    busy ||
                    !canWrite ||
                    (catalogueMode
                      ? !isOwner ||
                        !previewAsset ||
                        (!editing && !rightsConfirmed)
                      : !sourceId)
                  }
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
                      if (next) {
                        setSourceKind("stack");
                        fillFromSource(next.id);
                      } else {
                        setAssetId("");
                        setCaption("");
                        setScheduledLocal("");
                      }
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
              <div
                className="sc-list-filter"
                role="group"
                aria-label="Filter calendar items"
              >
                {(
                  [
                    ["all", "All"],
                    ["published", "Published"],
                    ["attention", "Needs attention"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={listFilter === value}
                    onClick={() => setListFilter(value)}
                  >
                    {label} ({listCounts[value]})
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={downloadCalendar}
                disabled={busy || !scheduled.length}
              >
                Download .ics
              </button>
            </div>
            {isOwner && queueAccount && (
              <section className="sc-queue" aria-labelledby="sc-queue-title">
                <h3 id="sc-queue-title">Queue Next preview</h3>
                <p className="sc-hint">
                  Find a time for @{queueAccount}. The preview skips scheduled
                  Bluesky items in this workspace and leaves the calendar
                  unchanged.
                </p>
                <div className="sc-queue-fields">
                  <label className="sc-field">
                    Melbourne weekday
                    <select
                      value={queueWeekday}
                      disabled={queueChecking}
                      onChange={(event) => {
                        setQueueWeekday(Number(event.target.value));
                        setQueueResult(undefined);
                      }}
                    >
                      {MELBOURNE_WEEKDAYS.map((day) => (
                        <option key={day.id} value={day.id}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="sc-field">
                    Melbourne time
                    <input
                      type="time"
                      value={queueTime}
                      readOnly={queueChecking}
                      onChange={(event) => {
                        setQueueTime(event.target.value);
                        setQueueResult(undefined);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    aria-disabled={queueChecking}
                    disabled={!queueTime || busy}
                    onClick={() => void previewQueueNext()}
                  >
                    {queueChecking ? "Previewing…" : "Preview next slot"}
                  </button>
                </div>
                <div role="status">
                  {queueLabels && (
                    <p className="sc-queue-slot">
                      {queueLabels.melbourne} (Melbourne) · {queueLabels.utc}
                    </p>
                  )}
                  {queuePreview && !queueLabels && (
                    <p>
                      No matching free slot in the next{" "}
                      {QUEUE_NEXT_HORIZON_WEEKS} weeks.
                    </p>
                  )}
                </div>
                {canApplyQueuePreview && (
                  <button type="button" onClick={applyQueuePreview}>
                    Use this time in the new Bluesky draft
                  </button>
                )}
              </section>
            )}
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
            {Boolean(snapshot.items.length) && !visibleItems.length && (
              <div className="sc-empty sc-empty-list">
                <h3>No items in this view</h3>
                <p>
                  {listFilter === "published"
                    ? "No published posts in this workspace yet."
                    : "No failed or unconfirmed deliveries or stale sources in this view."}
                </p>
              </div>
            )}
            <ol className="sc-items">
              {visibleItems.map((item) => {
                const labels = item.scheduledAt
                  ? scheduleLabels(item.scheduledAt)
                  : null;
                const { approval, delivery } = itemApprovalAndDelivery(
                  snapshot,
                  item,
                );
                const portfolio = item.catalogue;
                const stackId = item.stack;
                const stackSource = stackId
                  ? sources.find((entry) => entry.id === stackId)
                  : undefined;
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
                      <strong>{item.stackName}</strong>
                      {portfolio
                        ? ` · Woodhouse Share artwork · ${portfolio.assetId}@${portfolio.assetRevision}`
                        : item.publication !== null
                          ? ` · published revision ${item.publication}`
                          : ""}
                      {!item.sourceCurrent &&
                        (portfolio
                          ? " · artwork changed or unavailable"
                          : " · source changed or no longer public")}
                    </p>
                    <p className="sc-hint sc-destination-line">
                      {portfolio
                        ? approval
                          ? `Bound account @${approval.accountHandle}.`
                          : blueskyAccount
                            ? `Configured for @${blueskyAccount}.`
                            : "Connect a Bluesky account before sending."
                        : `Exact destination: ${item.destination || "not recorded"}.`}
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
                    {portfolio && (
                      <div className="sc-item-art">
                        <img
                          src={portfolio.renditionUrl}
                          alt={portfolio.alt}
                          loading="lazy"
                        />
                        <p className="sc-hint">
                          Alt: {portfolio.alt} · credit: {portfolio.credit} ·{" "}
                          <a
                            className="sc-text-link"
                            href={portfolio.projectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            project page
                          </a>
                        </p>
                      </div>
                    )}
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
                          This time has passed. For Bluesky, the delivery
                          receipt above is authoritative. For other channels,
                          Composer cannot tell whether you shared it; record a
                          local share only after you do.
                        </p>
                      )}
                    {item.sharedAt && (
                      <p className="sc-hint">
                        Local share recorded {displayDate(item.sharedAt)}
                      </p>
                    )}
                    {!item.sourceCurrent && (
                      <p className="sc-stale">
                        {portfolio
                          ? "This artwork is no longer current in Woodhouse Share. Its saved descriptor is kept for history; prepare a new draft from the current asset before sharing."
                          : "This item points at a publication that has changed or is no longer public. Refresh it from the current publication before copying, downloading or exporting."}
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
                      {!portfolio && (
                        <button
                          type="button"
                          disabled={busy || !item.sourceCurrent}
                          onClick={() => void copyItem(item)}
                        >
                          Copy main caption + link
                        </button>
                      )}
                      {!portfolio &&
                        item.sourceCurrent &&
                        stackSource?.imagePath && (
                          <a
                            className="sc-download"
                            href={stackSource.imagePath}
                            download={`${item.stackSlug ?? "share"}-r${item.publication ?? 1}-share-card.png`}
                            aria-disabled={!canWrite || busy}
                            onClick={(event) => {
                              if (!canWrite || busy) {
                                event.preventDefault();
                                return;
                              }
                              void shared(
                                item,
                                "Share image download started.",
                              );
                            }}
                          >
                            Download share image
                          </a>
                        )}
                      {!portfolio && !item.sourceCurrent && canWrite && (
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
                      {!portfolio && item.state === "shared" && canWrite && (
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
                      {canWrite &&
                        item.sourceCurrent &&
                        (portfolio ? isOwner : stackId) && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setEditing(item);
                              if (portfolio) {
                                setSourceKind("catalogue");
                                setAssetId(portfolio.assetId);
                                setCataloguePreview(undefined);
                                setRightsConfirmed(false);
                                setCaption(item.caption);
                                setScheduledLocal(
                                  melbourneLocalInput(item.scheduledAt),
                                );
                              } else if (stackId) {
                                setSourceKind("stack");
                                fillFromSource(stackId, item);
                              }
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
                                "Delete this calendar item and its local approval history?",
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
                          (stackId &&
                            sources.find(
                              (entry) =>
                                entry.id === stackId &&
                                entry.publication === item.publication,
                            )) ||
                          null
                        }
                        approval={approval}
                        identity={blueskyIdentity}
                        handle={blueskyHandle}
                        connection={connectionFor(approval)}
                        delivery={delivery}
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
                          if (approval) void cancelBluesky(item, approval);
                        }}
                        onSend={() => {
                          if (approval) void sendBluesky(item, approval);
                        }}
                        onReconcile={() => {
                          if (approval) void reconcileBluesky(item, approval);
                        }}
                        onCopyPackage={() => void copyPackage(item)}
                        sending={blueskySending}
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
