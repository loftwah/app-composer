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
  isXVariant,
  itemApprovalAndDelivery,
  MELBOURNE_WEEKDAYS,
  QUEUE_NEXT_HORIZON_WEEKS,
  melbourneLocalInput,
  melbourneLocalInstant,
  primaryCaptionProblem,
  queueNextPreviewReplySchema,
  scheduleLabels,
  shareCalendarSnapshot,
  shareListItemFilters,
  shareQueuePresetsReplySchema,
  SHARE_CAPTION_LOCAL_CHARACTERS,
  SHARE_QUEUE_CATEGORY_MAX,
  SHARE_QUEUE_PRESET_MAX,
  SHARE_CHANNELS,
  SHARE_CHANNEL_LABELS,
  SHARE_CHANNEL_LIMITS,
  SHARE_DESTINATION_MAX,
  SHARE_X_CHANNEL,
  SHARE_STATES,
  SHARE_STATE_LABELS,
  SHARE_VARIANT_MAX,
  type CatalogueAssetDescriptor,
  type CatalogueResolvedAsset,
  type QueueNextPreview,
  type ShareCalendarItem,
  type ShareCalendarSnapshot,
  type ShareCalendarIcsItem,
  type ShareCalendarSource,
  type ShareCalendarVariant,
  type ShareChannel,
  type ShareListFilter,
  type ShareQueuePresetsReply,
} from "../lib/share-calendar";
import { shareCalendarAgenda } from "../lib/share-calendar-agenda";
import {
  catalogueSearchReplySchema,
  sameCatalogueAsset,
  SHARE_CATALOGUE_ID_MAX,
  SHARE_CATALOGUE_ID_PATTERN,
  SHARE_CATALOGUE_ORIGIN,
  SHARE_CATALOGUE_QUERY_MAX,
  type CatalogueSearchItem,
} from "../lib/share-catalogue-asset";
import {
  approvalPackageForItem,
  publishedReceiptLabel,
  sharePackageFilename,
  sharePackageJson,
  sharePackageMarkdown,
  sharePackagePlainText,
  sharePackagePublishedReceipt,
  type ShareApprovalPackage,
} from "../lib/share-package";
import {
  shareXHandoffFilename,
  shareXHandoffMarkdown,
} from "../lib/share-x-handoff";
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
  hasPublishedBlueskyRevision,
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

type QueuePreset = ShareQueuePresetsReply["presets"][number];
type QueuePresetCommand =
  | ({ action: "queuePresetSave" } & QueuePreset)
  | { action: "queuePresetDelete"; category: string };

async function queuePresetsCall(
  workspace: string,
  account: string,
  signal: AbortSignal,
  command?: QueuePresetCommand,
): Promise<QueuePreset[]> {
  const params = new URLSearchParams({ action: "queuePresets", workspace });
  const response = await apiFetch(
    base + (command ? "shareCalendarWrite" : "shareCalendarRead?" + params),
    command
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...command, workspace, account }),
          signal,
        }
      : { cache: "no-store", signal },
  );
  const fallback = "Queue presets could not be confirmed. Try again.";
  const raw = await parseApiResponse<unknown>(response, fallback);
  const result = shareQueuePresetsReplySchema.safeParse(raw);
  if (!result.success) throw Error(errorMessage(raw, fallback));
  if (result.data.workspace !== workspace || result.data.account !== account)
    throw Error("The queue account or workspace changed. Refresh to continue.");
  return result.data.presets;
}

function QueuePresets({
  workspace,
  account,
  weekday,
  time,
  disabled,
  onUse,
}: {
  workspace: string;
  account: string;
  weekday: number;
  time: string;
  disabled: boolean;
  onUse: (preset: QueuePreset) => void;
}) {
  const [presets, setPresets] = useState<QueuePreset[]>();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [read, setRead] = useState(0);
  const scope = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const category = name.trim();
  const existing = presets?.some((preset) => preset.category === category);
  const canSave =
    Boolean(
      presets &&
      category &&
      (existing || presets.length < SHARE_QUEUE_PRESET_MAX),
    ) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);

  useEffect(() => {
    const controller = new AbortController();
    scope.current = controller;
    setError("");
    void queuePresetsCall(workspace, account, controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setPresets(list);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Queue presets could not be loaded.",
          );
      });
    return () => controller.abort();
  }, [workspace, account, read]);

  async function write(command: QueuePresetCommand) {
    const signal = scope.current?.signal;
    if (!signal || signal.aborted || pending.current || disabled) return;
    pending.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const list = await queuePresetsCall(workspace, account, signal, command);
      if (signal.aborted) return;
      setPresets(list);
      if (command.action === "queuePresetDelete") setName("");
      setMessage(
        command.action === "queuePresetSave"
          ? "Preset saved."
          : "Preset removed.",
      );
    } catch (cause) {
      if (!signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "The preset change could not be confirmed.",
        );
    } finally {
      pending.current = false;
      if (!signal.aborted) setSaving(false);
    }
  }

  return (
    <details>
      <summary>Queue presets</summary>
      <p className="sc-hint">
        Save a Melbourne weekday and time to reuse for @{account}.
      </p>
      <div className="sc-queue-fields">
        <label className="sc-field">
          Saved preset
          <select
            value={existing ? category : ""}
            disabled={disabled || saving || !presets?.length}
            onChange={(event) => {
              const preset = presets?.find(
                (entry) => entry.category === event.target.value,
              );
              setName(preset?.category ?? "");
              if (preset) onUse(preset);
            }}
          >
            <option value="">
              {presets?.length
                ? "Choose a preset"
                : presets
                  ? "No saved presets"
                  : error
                    ? "Presets unavailable"
                    : "Loading presets…"}
            </option>
            {presets?.map((preset) => (
              <option key={preset.category} value={preset.category}>
                {preset.category} ·{" "}
                {
                  MELBOURNE_WEEKDAYS.find((day) => day.id === preset.weekday)
                    ?.label
                }{" "}
                {preset.time}
              </option>
            ))}
          </select>
        </label>
        <label className="sc-field">
          Preset name
          <input
            value={name}
            maxLength={SHARE_QUEUE_CATEGORY_MAX}
            disabled={disabled || saving || !presets}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={disabled || saving || !canSave}
          onClick={() =>
            void write({ action: "queuePresetSave", category, weekday, time })
          }
        >
          {existing ? "Update preset" : "Save preset"}
        </button>
      </div>
      {existing && (
        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => void write({ action: "queuePresetDelete", category })}
        >
          Remove preset
        </button>
      )}
      {presets?.length === SHARE_QUEUE_PRESET_MAX && !existing && (
        <p className="sc-hint">Remove a preset before saving a new one.</p>
      )}
      <div role="status">{saving ? "Saving preset…" : message}</div>
      {error && (
        <div role="alert">
          <p>{error}</p>
          {!presets && (
            <button type="button" onClick={() => setRead((value) => value + 1)}>
              Try again
            </button>
          )}
        </div>
      )}
    </details>
  );
}

type CataloguePreview = {
  asset: CatalogueResolvedAsset;
  assetHash: string;
  // Optional source text returned with a linked exact preview (#477/#663).
  // It is read defensively and never fills the form on its own.
  suggestedCaption?: string;
};

// The browser supplies only a strict asset ID. The server builds the fixed
// Woodhouse Share URL and returns the exact rendition digest it resolved.
async function cataloguePreviewCall(
  assetId: string,
  workspace?: string,
  artworkRevision?: string,
): Promise<CataloguePreview> {
  const params = new URLSearchParams({ action: "cataloguePreview", assetId });
  if (workspace) params.set("workspace", workspace);
  if (artworkRevision) params.set("artworkRevision", artworkRevision);
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

async function copyText(value: string, stillCurrent = () => true) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    if (!stillCurrent()) return false;
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

function ArtworkXExport({
  asset,
  caption,
  savedCaption,
  workspace,
  onSave,
  busy,
}: {
  asset: CatalogueAssetDescriptor;
  caption: string;
  savedCaption?: string;
  workspace: string;
  onSave: (value: string) => Promise<void>;
  busy: boolean;
}) {
  const [text, setText] = useState(savedCaption ?? caption);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function recheck() {
    setChecking(true);
    setMessage("");
    try {
      const { asset: current } = await cataloguePreviewCall(
        asset.assetId,
        workspace,
      );
      if (!active.current) return false;
      if (!sameCatalogueAsset(asset, current)) {
        setReady(false);
        setMessage(
          "The artwork changed. Choose the current rendition before exporting.",
        );
        return false;
      }
      setReady(true);
      return true;
    } catch {
      if (active.current) {
        setReady(false);
        setMessage("Could not check the artwork. Try again before exporting.");
      }
      return false;
    } finally {
      if (active.current) setChecking(false);
    }
  }

  async function copy(value: string, label: string) {
    if (!ready || !active.current) return;
    const copied = await copyText(value, () => active.current);
    if (active.current)
      setMessage(
        copied ? label + " copied." : "Select and copy the text yourself.",
      );
  }

  async function save() {
    const value = text.trim();
    if (!ready || !value || saving || busy || !active.current) return;
    setSaving(true);
    setMessage("");
    try {
      await onSave(value);
      if (active.current) setMessage("X draft saved for manual export.");
    } catch (cause) {
      if (active.current)
        setMessage(
          cause instanceof Error
            ? cause.message
            : "The X draft could not be saved. Refresh before retrying.",
        );
    } finally {
      if (active.current) setSaving(false);
    }
  }

  const draft = text.trim() ? portfolioBlueskyText(text, asset) : "";

  function downloadHandoff() {
    if (!ready || !draft || !active.current) return;
    try {
      const markdown = shareXHandoffMarkdown({
        caption: text.trim(),
        exportText: draft,
        asset,
      });
      const url = URL.createObjectURL(
        new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = shareXHandoffFilename(asset);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage("X handoff prepared for download.");
    } catch {
      setMessage("The handoff could not be prepared. Copy the draft instead.");
    }
  }

  return (
    <section className="sc-package" aria-label="X artwork export">
      <h3>X artwork export</h3>
      <p className="sc-hint">
        Prepare text and image details for manual posting.
      </p>
      {!ready && (
        <button
          type="button"
          disabled={checking}
          onClick={() => void recheck()}
        >
          {checking ? "Checking artwork…" : "Prepare X draft"}
        </button>
      )}
      {ready && (
        <>
          <label className="sc-field">
            X draft caption
            <textarea
              value={text}
              maxLength={SHARE_CAPTION_LOCAL_CHARACTERS}
              rows={3}
              disabled={checking}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          {draft && <p className="sc-package-caption">{draft}</p>}
          <p className="sc-hint">{asset.alt}</p>
          <p className="sc-hint">
            <a
              href={asset.renditionUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open artwork
            </a>
            {" · "}
            <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer">
              Artwork source
            </a>
          </p>
          <div className="sc-actions">
            <button
              type="button"
              disabled={checking || !draft}
              onClick={() => void copy(draft, "X draft")}
            >
              Copy X draft
            </button>
            <button
              type="button"
              disabled={checking}
              onClick={() => void copy(asset.alt, "Image alt text")}
            >
              Copy image alt text
            </button>
            <button
              type="button"
              disabled={checking || !draft}
              onClick={downloadHandoff}
            >
              Download X handoff
            </button>
            <button
              type="button"
              disabled={checking || saving || busy || !draft || text.trim() === savedCaption}
              onClick={() => void save()}
            >
              {saving ? "Saving X draft…" : "Save X draft"}
            </button>
          </div>
        </>
      )}
      <p className="sc-hint" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
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
            {value.source.name} ·{" "}
            {value.artwork
              ? `artwork revision ${value.artwork.assetRevision}`
              : `revision ${value.source.publication}`}{" "}
            ·{" "}
            {value.artwork?.status ??
              (value.source.current ? "current" : "no longer current")}
          </dd>
        </div>
        {value.artwork ? (
          <div>
            <dt>Artwork</dt>
            <dd>
              Credit {value.artwork.credit}
              <br />
              {value.artwork.byteLength} bytes · SHA-256{" "}
              <code>{value.artwork.bytesSha256}</code>
              <br />
              <span className="sc-hint">{value.artwork.statement}</span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Schedule</dt>
          <dd>{value.schedule.label}</dd>
        </div>
        <div>
          <dt>Link</dt>
          <dd>{value.link ?? "not recorded"}</dd>
        </div>
        <div>
          <dt>{value.artwork ? "Saved rendition" : "Share image"}</dt>
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
            ) : value.artwork ? (
              "Select the current artwork to share a new rendition."
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
            identity only · approval {value.bluesky.approval.label}
            {value.bluesky.published ? null : " · not sent"}
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
          {value.bluesky.published ? (
            <p className="sc-hint">
              Published on Bluesky (actual):{" "}
              {publishedReceiptLabel(value.bluesky.published)} ·{" "}
              <a
                href={value.bluesky.published.permalink}
                target="_blank"
                rel="noopener noreferrer"
              >
                View published Bluesky post
              </a>
            </p>
          ) : null}
          {value.bluesky.approval.reasons.length ? (
            <p className="sc-hint">
              Invalidation:{" "}
              {value.bluesky.approval.reasons
                .map((reason) => BLUESKY_APPROVAL_REASON_LABELS[reason])
                .join("; ")}
            </p>
          ) : null}
          {value.bluesky.published ? null : (
            <p className="sc-hint">{value.bluesky.send.message}</p>
          )}
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
  onSchedule,
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
  onSchedule?: () => void;
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
  const published = hasPublishedBlueskyRevision(item, approval, delivery);
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
    !approval?.automatic &&
    connection.state === "configured" &&
    status?.state === "approved" &&
    status?.send.ok === true &&
    sendWindowOpen &&
    !deliveryBlocksSend;
  const canSchedule = Boolean(
    onSchedule &&
    canWrite &&
    !busy &&
    !sending &&
    sendConfirmed &&
    approval &&
    !approval.automatic &&
    !delivery &&
    status?.state === "approved" &&
    status.send.ok &&
    Date.parse(approval.scheduledAt) > now.getTime() &&
    Date.parse(approval.expiresAt) > Date.parse(approval.scheduledAt),
  );
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
            {!published && content.problems.length > 0 && (
              <ul className="sc-bluesky-problems">
                {content.problems.map((problem) => (
                  <li key={problem.code}>{problem.message}</li>
                ))}
              </ul>
            )}
          </div>
          {status && (
            <div
              className={`sc-bluesky-approval sc-approval-${published ? "approved" : status.state}`}
            >
              <div className="sc-bluesky-approval-head">
                <h4>{published ? "Published" : status.label}</h4>
                {!published && <span className="sc-notch">Not sent</span>}
              </div>
              <p className="sc-hint">
                {published
                  ? "The approval window below is part of the published post’s record."
                  : status.note}
              </p>
              {!published && status.reasons.length > 0 && (
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
              {!published && (
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
              )}
              {approval && (
                <div className="sc-bluesky-send-panel">
                  <h4>
                    {published ? "Published delivery" : "Publish approved post"}
                  </h4>
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
                      {approval.automatic ? (
                        <p role="status" className="sc-hint">
                          Scheduled to publish automatically. Cancel approval to
                          stop it. Refresh the calendar after the intended time
                          to see the receipt.
                        </p>
                      ) : (
                        !sendWindowOpen && (
                          <p className="sc-hint">
                            Sending opens at the intended time and closes when
                            the approval expires. Re-approve if the window has
                            closed.
                          </p>
                        )
                      )}
                      <div className="sc-actions">
                        {onSchedule &&
                          !approval.automatic &&
                          !delivery &&
                          Date.parse(approval.scheduledAt) > now.getTime() && (
                            <button
                              type="button"
                              className="sc-primary"
                              onClick={onSchedule}
                              disabled={!canSchedule}
                            >
                              Publish automatically at this time
                            </button>
                          )}
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

const emptyShareList: Record<ShareListFilter, string> = {
  all: "No items in this view.",
  drafts: "No drafts in this workspace.",
  scheduled: "No scheduled items in this workspace.",
  published: "No published posts in this workspace yet.",
  attention:
    "No failed or unconfirmed deliveries or stale sources in this view.",
};

function readArtworkHandoff(search: string) {
  const params = new URLSearchParams(search);
  const assets = params.getAll("artwork");
  const revisions = params.getAll("revision");
  if (assets.length === 0 && revisions.length === 0) return { state: "absent" } as const;
  const assetId = assets[0] ?? "";
  const revision = revisions[0] ?? "";
  if (assets.length !== 1 || revisions.length !== 1 || assetId.trim() !== assetId ||
      !SHARE_CATALOGUE_ID_PATTERN.test(assetId) || revision.length !== 64 || !/^[a-f0-9]+$/.test(revision))
    return { state: "invalid" } as const;
  return { state: "linked", assetId, revision } as const;
}

function ShareCalendar({ search }: { search: string }) {
  const artworkHandoff = useMemo(() => readArtworkHandoff(search), [search]);
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
  // The full, actionable list is the default. Agenda is a read-only grouping of
  // the same filtered items by intended date; it adds no state of its own.
  const [calendarView, setCalendarView] = useState<"list" | "agenda">("list");
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
  // The same approval/delivery resolution as the item card drives the Published
  // and Needs attention counts. Drafts and Scheduled come from the local
  // item.state, so an error item also appears in the view matching its state.
  // This filter is read-only and keeps item order.
  const classified = snapshot
    ? snapshot.items.map((item) => ({
        item,
        filters: shareListItemFilters(snapshot, item),
      }))
    : [];
  const visibleItems = classified
    .filter(({ filters }) => filters.includes(listFilter))
    .map(({ item }) => item);
  const listCounts: Record<ShareListFilter, number> = {
    all: classified.length,
    drafts: classified.filter(({ filters }) => filters.includes("drafts"))
      .length,
    scheduled: classified.filter(({ filters }) => filters.includes("scheduled"))
      .length,
    published: classified.filter(({ filters }) => filters.includes("published"))
      .length,
    attention: classified.filter(({ filters }) => filters.includes("attention"))
      .length,
  };
  // The agenda is derived from the same filtered items; it owns no state and
  // only shows intended dates, never a new action or permission.
  const agendaDays =
    calendarView === "agenda" ? shareCalendarAgenda(visibleItems) : [];
  // "Open in list" only switches back to the full list and moves focus to the
  // same item. Nothing is saved, approved or sent, and no new permission is
  // introduced for the read-only agenda.
  const openInListId = useRef<string | null>(null);
  useEffect(() => {
    if (calendarView !== "list" || !openInListId.current) return;
    const id = openInListId.current;
    openInListId.current = null;
    const row = document.getElementById(`sc-item-${id}`);
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    row.focus({ preventScroll: true });
  }, [calendarView, snapshot]);
  const alive = useRef(true);
  const pending = useRef(false);
  const selection = useRef<string | undefined>(undefined);
  const invalidScope = useRef(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLTextAreaElement>(null);

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
    () => calendarExportItems(snapshot?.items ?? [], snapshot),
    [snapshot],
  );
  const scheduledById = useMemo(
    () => new Map(scheduled.map(event => [event.id, event])),
    [scheduled],
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
        current.variants
          .filter((variant) => !isXVariant(variant))
          .map((variant) => ({
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
      const expectedRevision = !editing && artworkHandoff.state === "linked" && artworkHandoff.assetId === id
        ? artworkHandoff.revision : undefined;
      const reply = await cataloguePreviewCall(id, selection.current, expectedRevision);
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
      if (!editing && !sourceId && artworkHandoff.state === "linked" && result.workspace.role === "owner") {
        setSourceKind("catalogue");
        setChannel("bluesky");
        setAssetId(artworkHandoff.assetId);
      } else if (!editing && !sourceId && result.sources[0]) {
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

  // Export-only X draft save. The exact authenticated workspace from the route
  // search and the exact item/revision on screen are sent to the isolated
  // xVariant write; it changes only that item's saved X caption. The row's X
  // export disclosure stays open so the owner can keep preparing the manual
  // export.
  async function saveXArtwork(
    id: string,
    expectedRevision: number,
    expectedCaption: string | null,
    value: string,
  ) {
    if (pending.current || invalidScope.current || !isOwner || !canWrite)
      throw Error("Only the workspace owner can save an X artwork draft.");
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await calendarCall("xVariant", selection.current, {
        item: id,
        expectedRevision,
        expectedCaption,
        caption: value,
      });
      if (!alive.current) return;
      setSnapshot(saved);
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The X draft could not be saved. Refresh before retrying.",
        );
      throw cause;
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

  async function scheduleBluesky(
    item: ShareCalendarItem,
    approval: BlueskyApprovalRecord,
  ) {
    const scheduled = await mutate(
      "blueskySchedule",
      {
        item: item.id,
        expectedRevision: item.revision,
        expectedApprovalRevision: approval.approvalRevision,
      },
      `Automatic Bluesky delivery requested for ${displayDate(approval.scheduledAt)}.`,
    );
    if (
      scheduled?.approvals.find((entry) => entry.itemId === item.id)?.automatic
    )
      setNotice(
        `Bluesky will publish this approval automatically at ${displayDate(approval.scheduledAt)}.`,
      );
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
          ? `Scheduled ${previewAsset.title} for ${detail.melbourne} · ${detail.utc}. Choose automatic Bluesky delivery after approval.`
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
      ? `${verb} for ${detail.melbourne} · ${detail.utc}. Choose automatic Bluesky delivery after approval.`
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
        if (isXVariant(persisted)) continue;
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

  function downloadCalendar(event?: ShareCalendarIcsItem) {
    if (!snapshot) return;
    const entries = event ? [event] : scheduled;
    if (!entries.length) {
      setNotice("Add a scheduled share before downloading the calendar.");
      return;
    }
    try {
      const ics = buildShareCalendarIcs(entries, {
        now: new Date(),
        calendarName: "Share calendar · " + snapshot.workspace.name,
      });
      const url = URL.createObjectURL(
        new Blob([ics], { type: "text/calendar;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = calendarFilename(
        event ? event.id.slice(0, 8) + " " + event.stackName : snapshot.workspace.name,
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice(
        event
          ? "Downloaded this event as an .ics calendar. The file uses UTC."
          : `Downloaded ${entries.length} scheduled share${entries.length === 1 ? "" : "s"} as an .ics calendar. The file uses UTC.`,
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
  // A linked exact preview may supply source text. It is offered only while the
  // Caption is empty and unsaved. Stale, manual and edited captions are left
  // exactly as they are; nothing is inserted without an explicit choice.
  const linkedSuggestedCaption =
    !editing &&
    artworkHandoff.state === "linked" &&
    assetId.trim() === artworkHandoff.assetId &&
    previewAsset?.assetId === artworkHandoff.assetId
      ? cataloguePreview?.suggestedCaption?.trim() || undefined
      : undefined;
  const canOfferArtworkText =
    catalogueMode &&
    Boolean(linkedSuggestedCaption) &&
    !caption.trim() &&
    !busy &&
    canWrite;

  function useArtworkText() {
    if (!canOfferArtworkText || !linkedSuggestedCaption) return;
    setCaption(linkedSuggestedCaption);
    setNotice("Artwork text added to the caption. Review it before saving.");
    captionInputRef.current?.focus();
  }

  return (
    <section className="composer-share-calendar">
      <div className="sc-heading">
        <h1>Share calendar</h1>
        {snapshot && (
          <p className="sc-scope">
            {snapshot.workspace.name} · {snapshot.workspace.role}
          </p>
        )}
      </div>
      <p className="sc-lede">
        {isOwner
          ? "Draft a post from a published stack or artwork."
          : "Draft a post from a published stack."}
      </p>
      <details className="sc-delivery-help">
        <summary>How delivery and dates work</summary>
        <p>
          Workspace owners can select an exact Woodhouse Share artwork. For
          Bluesky, approve the exact post, then schedule it or send it yourself.
          For manual handoff, the calendar records your preparation and exports.
        </p>
        <p>
          Times appear in Australia/Melbourne and UTC. The .ics export uses UTC
          so your calendar shows the same instant in your time zone.
        </p>
      </details>
      <p role="status" aria-live="polite" className="sc-notice">
        {notice}
      </p>
      {error && (
        <div role="alert" className="sc-error">
          <p>{error}</p>
        </div>
      )}
      {artworkHandoff.state === "invalid" && (
        <p className="sc-hint">Open Share and choose Prepare in Share calendar again to get a valid artwork link.</p>
      )}
      {snapshot && !loading && artworkHandoff.state === "linked" && !isOwner && (
        <p className="sc-hint">Choose a workspace you own to preview the linked artwork.</p>
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

                  {!editing && artworkHandoff.state === "linked" && assetId === artworkHandoff.assetId && (
                    <p className="sc-hint">
                      Artwork from Composer Share. Preview it here, or{" "}
                      <a className="sc-text-link" href={`/share/artwork/${artworkHandoff.assetId}`}>return to the artwork page</a>.
                    </p>
                  )}
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
                    Approve the exact post, then choose how to send it through
                    the configured account.
                  </p>
                </>
              )}
              <label className="sc-field">
                {catalogueMode
                  ? "Caption for Bluesky"
                  : `Main caption for ${SHARE_CHANNEL_LABELS[channel]}`}
                <textarea
                  ref={captionInputRef}
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
              {canOfferArtworkText && (
                <div className="sc-actions">
                  <button
                    type="button"
                    onClick={useArtworkText}
                    disabled={busy || !canWrite}
                  >
                    Use artwork text
                  </button>
                </div>
              )}
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
                  {scheduled.length} dates available to export ·{" "}
                  {
                    snapshot.items.filter((item) => item.state === "shared")
                      .length
                  }{" "}
                  shared locally. Published deliveries keep their intended dates here.
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
                    ["drafts", "Drafts"],
                    ["scheduled", "Scheduled"],
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
              <div
                className="sc-list-filter sc-view-toggle"
                role="group"
                aria-label="Calendar view"
              >
                <button
                  type="button"
                  aria-pressed={calendarView === "list"}
                  onClick={() => setCalendarView("list")}
                >
                  List
                </button>
                <button
                  type="button"
                  aria-pressed={calendarView === "agenda"}
                  onClick={() => setCalendarView("agenda")}
                >
                  Agenda
                </button>
              </div>
              <button
                type="button"
                onClick={() => downloadCalendar()}
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
                <QueuePresets
                  key={`${snapshot.workspace.id}:${queueAccount}`}
                  workspace={snapshot.workspace.id}
                  account={queueAccount}
                  weekday={queueWeekday}
                  time={queueTime}
                  disabled={queueChecking || busy}
                  onUse={(preset) => {
                    setQueueWeekday(preset.weekday);
                    setQueueTime(preset.time);
                    setQueueResult(undefined);
                  }}
                />
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
                <p>{emptyShareList[listFilter]}</p>
              </div>
            )}
            {calendarView === "agenda" &&
              Boolean(visibleItems.length) &&
              !agendaDays.length && (
                <div className="sc-empty sc-empty-list">
                  <h3>No intended dates in this view</h3>
                  <p>Open List to see undated items in this view.</p>
                </div>
              )}
            {calendarView === "agenda" ? (
              <div
                className="sc-agenda"
                aria-label="Agenda by intended Melbourne date"
              >
                {agendaDays.map((group) => (
                  <section
                    className="sc-agenda-group"
                    key={group.date}
                    aria-label={`Intended date ${group.date}`}
                  >
                    <h3 className="sc-agenda-date">
                      Intended date · {group.date}
                    </h3>
                    <ol className="sc-agenda-items">
                      {group.items.map((item) => {
                        const labels = item.scheduledAt
                          ? scheduleLabels(item.scheduledAt)
                          : null;
                        const { approval, delivery } = itemApprovalAndDelivery(
                          snapshot,
                          item,
                        );
                        const published = hasPublishedBlueskyRevision(
                          item,
                          approval,
                          delivery,
                        );
                        return (
                          <li key={item.id} className="sc-agenda-item">
                            <div className="sc-item-top">
                              <span
                                className={`sc-badge sc-badge-${published ? "published" : item.state}`}
                              >
                                {published
                                  ? "Published"
                                  : SHARE_STATE_LABELS[item.state]}
                              </span>
                              <span className="sc-channel">
                                {SHARE_CHANNEL_LABELS[item.channel]}
                              </span>
                              {labels && (
                                <span className="sc-when">
                                  Intended time · {labels.melbourne} ·{" "}
                                  {labels.utc}
                                </span>
                              )}
                            </div>
                            <p className="sc-source-line">
                              <strong>{item.stackName}</strong>
                            </p>
                            <p className={`sc-caption sc-caption-${item.state}`}>
                              {item.caption}
                            </p>
                            <button
                              type="button"
                              className="sc-agenda-open"
                              onClick={() => {
                                openInListId.current = item.id;
                                setCalendarView("list");
                              }}
                            >
                              Open in list
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            ) : null}
            {calendarView === "list" && <ol className="sc-items">
              {visibleItems.map((item) => {
                const exportEvent = scheduledById.get(item.id);
                const labels = item.scheduledAt
                  ? scheduleLabels(item.scheduledAt)
                  : null;
                const { approval, delivery } = itemApprovalAndDelivery(
                  snapshot,
                  item,
                );
                const published = hasPublishedBlueskyRevision(item, approval, delivery);
                const publishedReceipt = sharePackagePublishedReceipt(item, approval, delivery);
                const hasBluesky = hasBlueskyDraft(item);
                const portfolio = item.catalogue;
                const stackId = item.stack;
                const stackSource = stackId
                  ? sources.find((entry) => entry.id === stackId)
                  : undefined;
                return (
                  <li
                    key={item.id}
                    id={`sc-item-${item.id}`}
                    tabIndex={-1}
                    className={`sc-item sc-state-${item.state}`}
                  >
                    <div className="sc-item-top">
                      <span className={`sc-badge sc-badge-${published ? "published" : item.state}`}>
                        {published ? "Published" : SHARE_STATE_LABELS[item.state]}
                      </span>
                      <span className="sc-channel">
                        {SHARE_CHANNEL_LABELS[item.channel]}
                      </span>
                      {labels && (
                        <span className="sc-when">
                          {published && "Intended time · "}
                          {labels.melbourne} · {labels.utc}
                        </span>
                      )}
                      {publishedReceipt && (
                        <span className="sc-when">
                          Published on Bluesky ·{" "}
                          {publishedReceiptLabel(publishedReceipt)} ·{" "}
                          <a
                            className="sc-text-link"
                            href={publishedReceipt.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open Bluesky post
                          </a>
                        </span>
                      )}
                    </div>
                    <p className="sc-source-line">
                      <strong>{item.stackName}</strong>
                      {!portfolio && stackSource && (
                        <>
                          {" · "}
                          <a
                            className="sc-text-link"
                            href={`/_emdash/admin/plugins/composer-stacks/stacks?workspace=${encodeURIComponent(snapshot.workspace.id)}&stack=${encodeURIComponent(stackSource.id)}`}
                          >
                            Back to this stack
                          </a>
                        </>
                      )}
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
                      {item.variants.some((variant) => !isXVariant(variant))
                        ? " Additional drafts: " +
                          item.variants
                            .filter((variant) => !isXVariant(variant))
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
                    {!published &&
                      approval &&
                      delivery?.state === "published" &&
                      delivery.permalink && (
                        <p className="sc-hint">
                          Bluesky published revision {approval.draftRevision}.{" "}
                          <a
                            className="sc-text-link"
                            href={delivery.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open earlier Bluesky post
                          </a>
                        </p>
                      )}
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
                    {!published && <p className="sc-hint">{stateNote(item.state)}</p>}
                    {!published && item.state === "scheduled" &&
                      item.scheduledAt &&
                      item.scheduledAt < snapshot.now && (
                        <p className="sc-hint">
                          This time has passed.
                          {hasBluesky &&
                            " Check the Bluesky panel below for delivery status."}
                          {item.channel !== "bluesky" &&
                            " Record a local share only after you share the main caption."}
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
                      {exportEvent && (
                        <button type="button" onClick={() => downloadCalendar(exportEvent)}>
                          Download this event (.ics)
                        </button>
                      )}
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
                    {isOwner && portfolio && (
                      <details className="sc-x-export">
                        <summary>X artwork export</summary>
                        <ArtworkXExport
                          key={`${snapshot.workspace.id}:${item.id}:${item.revision}`}
                          asset={portfolio}
                          caption={item.caption}
                          savedCaption={item.variants.find(
                            (variant) => variant.channel === SHARE_X_CHANNEL,
                          )?.caption}
                          workspace={snapshot.workspace.id}
                          onSave={(value) =>
                            saveXArtwork(
                              item.id,
                              item.revision,
                              item.variants.find(isXVariant)?.caption ?? null,
                              value,
                            )
                          }
                          busy={busy}
                        />
                      </details>
                    )}
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
                    {hasBluesky && (
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
                        onSchedule={
                          isOwner && approval
                            ? () => void scheduleBluesky(item, approval)
                            : undefined
                        }
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
            </ol>}
            <div className="sc-export-note">
              <h3>Calendar export</h3>
              <p>
                The .ics file contains only scheduled items whose published
                source is still current. Drafts and locally shared items stay
                out. Events last thirty minutes and start at the recorded time.
                A confirmed Bluesky post keeps its date as a record of the
                published revision. Manual handoffs identify where you need to
                share yourself.
              </p>
              <button
                type="button"
                onClick={() => downloadCalendar()}
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
