// Exact Bluesky draft and approval contract for the share calendar (#604).
// The approval binds the public destination DID, the saved item revision, the
// exact text, the media descriptor, the canonical link and the intended UTC
// instant. Editing any bound field, changing the account, an expired approval
// or a revoked connection invalidates consent and requires a new approval
// revision. Nothing in this module sends, schedules with a provider or stores a
// credential.
import {
  isCanonicalInstant,
  isSafeShareLink,
  scheduleLabels,
  type BlueskyApprovalRecord,
  type ShareCalendarItem,
  type ShareCalendarSnapshot,
  type ShareCalendarSource,
  catalogueIdentity,
  type CatalogueAssetDescriptor,
} from "./share-calendar.ts";
import {
  BLUESKY_PUBLISHING_STATEMENT,
  normalizeBlueskyHandle,
  type BlueskyIdentityResult,
} from "./bluesky-account.ts";

export type { BlueskyApprovalRecord } from "./share-calendar.ts";

export const BLUESKY_TEXT_GRAPHEMES = 300;
export const BLUESKY_TEXT_BYTES = 3000;
export const BLUESKY_MEDIA_MAX = 4;
export const BLUESKY_APPROVAL_TTL_HOURS = 24;
export const BLUESKY_APPROVAL_GRACE_HOURS = 2;
export const BLUESKY_APPROVAL_SCHEMA = "composer.bluesky-approval/v1";
export const BLUESKY_APPROVAL_BINDING_VERSION =
  "composer.bluesky-approval-binding/v1";
export const BLUESKY_PACKAGE_SCHEMA = "composer.bluesky-approval-package/v1";
export const BLUESKY_TIME_ZONE = "Australia/Melbourne";

export const BLUESKY_SEND_UNAVAILABLE_STATEMENT =
  "No Bluesky publishing connection is configured in Composer. Copy the approval package and post it yourself. Nothing was sent.";

export type BlueskyApprovalState =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "cancelled"
  | "blocked"
  | "unknown";

export const BLUESKY_APPROVAL_STATES: ReadonlyArray<{
  id: BlueskyApprovalState;
  label: string;
  note: string;
}> = [
  {
    id: "draft",
    label: "Draft",
    note: "Nothing is approved. Composer has not sent anything.",
  },
  {
    id: "awaiting_approval",
    label: "Awaiting approval",
    note: "The exact draft needs a fresh approval before any handoff.",
  },
  {
    id: "approved",
    label: "Approved (not sent)",
    note: "The exact revision is approved. Approval is not a post and does not send.",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    note: "The owner cancelled this approval. Nothing was sent.",
  },
  {
    id: "blocked",
    label: "Blocked",
    note: "Composer cannot approve or send this draft. Fix the stated reason.",
  },
  {
    id: "unknown",
    label: "Unknown",
    note: "A receipt could not be reconciled. Composer cannot claim a post and will not retry automatically.",
  },
];

export const BLUESKY_APPROVAL_LABELS: Record<BlueskyApprovalState, string> =
  Object.fromEntries(
    BLUESKY_APPROVAL_STATES.map((state) => [state.id, state.label]),
  ) as Record<BlueskyApprovalState, string>;

export const BLUESKY_APPROVAL_REASON_LABELS: Record<
  BlueskyApprovalReason,
  string
> = {
  no_draft: "No Bluesky draft is saved",
  no_account: "No public account is configured",
  identity_not_rechecked: "The public identity has not been rechecked",
  account_did_changed: "The destination DID changed",
  account_handle_changed: "The destination handle changed",
  draft_revision_changed: "The saved draft revision changed",
  text_changed: "The exact text changed",
  media_changed: "The media attachment changed",
  link_changed: "The canonical link changed",
  time_changed: "The intended time changed",
  approval_expired: "The approval expired",
  approval_cancelled: "The owner cancelled this approval",
  approval_revoked: "This approval was revoked",
  connection_revoked: "The publishing connection was revoked",
  time_passed: "The intended time has passed",
  unknown_receipt: "A previous receipt is unknown",
  draft_missing: "Add a Bluesky caption",
  text_empty: "The Bluesky text is empty",
  text_too_long: "The text exceeds 300 graphemes",
  text_too_many_bytes: "The text exceeds 3000 UTF-8 bytes",
  source_stale: "The published source is no longer current",
  media_unavailable: "The public share card is unavailable",
  media_alt_missing: "The media alt text is missing",
  link_missing: "The canonical link is missing",
  link_unsafe: "The canonical link is not a safe http(s) address",
  time_missing: "The intended time is missing",
  time_invalid: "The saved time is invalid",
};

export type BlueskyDraftProblemCode =
  | "draft_missing"
  | "text_empty"
  | "text_too_long"
  | "text_too_many_bytes"
  | "source_stale"
  | "media_unavailable"
  | "media_alt_missing"
  | "link_missing"
  | "link_unsafe"
  | "time_missing"
  | "time_passed"
  | "time_invalid";

export interface BlueskyDraftProblem {
  code: BlueskyDraftProblemCode;
  message: string;
}

export interface BlueskyUsage {
  count: number;
  limit: number;
  unit: "graphemes";
  bytes: number;
  byteLimit: number;
  withinLimit: boolean;
}

export interface BlueskyMediaAttachment {
  kind: "image";
  url: string;
  alt: string;
  // The published share-card identity, not a mutable account avatar.
  revision: string;
  // SHA-256 of the attachment descriptor (kind, URL, alt, revision), not the
  // encoded image bytes. The revision already binds the published source.
  hash: string;
}

export interface BlueskyContentSource {
  stackId: string | null;
  name: string;
  slug: string | null;
  publication: number | null;
  url: string | null;
  imagePath: string | null;
  imageAlt: string | null;
  current: boolean;
  rightsNote: string;
}

export interface BlueskySchedule {
  scheduledAt: string | null;
  timeZone: typeof BLUESKY_TIME_ZONE;
  local: string | null;
  utc: string | null;
  label: string;
  revalidatedAt: string;
  future: boolean;
}

export interface BlueskyAccountSummary {
  handle: string;
  did: string;
  displayName: string | null;
  avatar: string | null;
  profileUrl: string;
  resolvedAt: string;
  publicIdentity: "resolved";
  publishing: "not_authorised";
}

// The content half of a draft. It deliberately has no clock beyond the explicit
// revalidation instant and no account, so the exact hashes can be recomputed
// for every saved revision before comparing an approval.
export interface BlueskyContent {
  schema: typeof BLUESKY_APPROVAL_SCHEMA;
  itemId: string;
  revision: number;
  text: string;
  textHash: string;
  usage: BlueskyUsage;
  media: BlueskyMediaAttachment[];
  mediaHash: string;
  link: string;
  scheduledAt: string | null;
  schedule: BlueskySchedule;
  source: BlueskyContentSource;
  problems: BlueskyDraftProblem[];
}

export interface BlueskyDraft extends BlueskyContent {
  account: BlueskyAccountSummary;
}

export interface BlueskyApprovalBinding {
  version: typeof BLUESKY_APPROVAL_BINDING_VERSION;
  itemId: string;
  accountDid: string;
  accountHandle: string;
  draftRevision: number;
  textHash: string;
  mediaHash: string;
  mediaRevision: string;
  link: string;
  scheduledAt: string;
}

export type BlueskyPublishingConnection =
  | { state: "absent"; reason: string }
  | { state: "revoked"; reason: string; revokedAt: string }
  | {
      // The native encrypted secret is present. This is configuration status,
      // not proof that the credential works; the send path verifies a session.
      state: "configured";
      handle: string;
      did: string | null;
    }
  | {
      state: "authorised";
      did: string;
      scope: string;
      authorisedAt: string;
    };

export interface BlueskyReceipt {
  state: "unknown";
  recordedAt: string;
  reason: string;
}

export interface BlueskySendOutcome {
  ok: boolean;
  available: boolean;
  code: "ready" | "needs_owner" | "not_approved" | "account_mismatch";
  message: string;
}

export type BlueskyApprovalReason =
  | "no_draft"
  | "no_account"
  | "identity_not_rechecked"
  | "account_did_changed"
  | "account_handle_changed"
  | "draft_revision_changed"
  | "text_changed"
  | "media_changed"
  | "link_changed"
  | "time_changed"
  | "approval_expired"
  | "approval_cancelled"
  | "approval_revoked"
  | "connection_revoked"
  | "time_passed"
  | "unknown_receipt"
  | BlueskyDraftProblemCode;

export interface BlueskyApprovalStatus {
  state: BlueskyApprovalState;
  label: string;
  note: string;
  reasons: BlueskyApprovalReason[];
  approvalRevision: number | null;
  approvedAt: string | null;
  expiresAt: string | null;
  bindingHash: string | null;
  notSent: true;
  canApprove: boolean;
  canCancel: boolean;
  send: BlueskySendOutcome;
}

export function hasBlueskyDraft(
  item: Pick<ShareCalendarItem, "channel" | "variants">,
): boolean {
  return (
    item.channel === "bluesky" ||
    item.variants.some((variant) => variant.channel === "bluesky")
  );
}

export function portfolioBlueskyText(
  caption: string,
  asset: { credit: string; projectUrl: string },
): string {
  return `${caption.trim()}\n\nArtwork by ${asset.credit}\n${asset.projectUrl}`;
}

export function blueskyTextForItem(
  item: Pick<
    ShareCalendarItem,
    "channel" | "caption" | "variants" | "catalogue"
  >,
): string {
  if (item.catalogue) return portfolioBlueskyText(item.caption, item.catalogue);
  if (item.channel === "bluesky") return item.caption.trim();
  return (
    item.variants
      .find((variant) => variant.channel === "bluesky")
      ?.caption.trim() ?? ""
  );
}

export function graphemeCount(value: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [
      ...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value),
    ].length;
  }
  return Array.from(value).length;
}

export function blueskyUsage(value: string): BlueskyUsage {
  const count = graphemeCount(value);
  const bytes = new TextEncoder().encode(value).length;
  return {
    count,
    limit: BLUESKY_TEXT_GRAPHEMES,
    unit: "graphemes",
    bytes,
    byteLimit: BLUESKY_TEXT_BYTES,
    withinLimit: count <= BLUESKY_TEXT_GRAPHEMES && bytes <= BLUESKY_TEXT_BYTES,
  };
}

export async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function mediaRevisionFor(
  content: Pick<BlueskyContent, "media">,
): string {
  return content.media.map((entry) => entry.revision).join("|") || "none";
}

export function blueskyAccountFromIdentity(
  identity: BlueskyIdentityResult | null | undefined,
): BlueskyAccountSummary | null {
  if (
    !identity ||
    identity.status !== "resolved" ||
    !identity.handle ||
    !identity.did ||
    !identity.profileUrl ||
    !identity.resolvedAt
  )
    return null;
  return {
    handle: identity.handle,
    did: identity.did,
    displayName: identity.displayName,
    avatar: identity.avatar,
    profileUrl: identity.profileUrl,
    resolvedAt: identity.resolvedAt,
    publicIdentity: "resolved",
    publishing: "not_authorised",
  };
}

function rightsNote(
  source: ShareCalendarSource | null,
  current: boolean,
): string {
  if (!source || !current)
    return "No current public source is bound. Resolve the published stack revision before approval. No visitor, enquiry or workspace-private record is included.";
  return `Public share card and published copy from “${source.name}”, published revision ${source.publication}, at ${source.url}. The alt text comes from that publication. No visitor, enquiry or workspace-private record is included. Confirm the owner holds the rights to this copy and image before publishing.`;
}

function mediaFor(
  source: ShareCalendarSource | null,
  current: boolean,
): Array<Omit<BlueskyMediaAttachment, "hash">> {
  if (!source || !current || !source.url || !source.imagePath) return [];
  let imageUrl = "";
  try {
    imageUrl = new URL(source.imagePath, source.url).href;
  } catch {
    return [];
  }
  if (!/^https:\/\//.test(imageUrl)) return [];
  return [
    {
      kind: "image",
      url: imageUrl,
      alt: source.imageAlt.trim(),
      revision: source.imagePath,
    },
  ];
}

function catalogueConsentHash(catalogue: CatalogueAssetDescriptor) {
  return sha256Text(
    JSON.stringify([
      ...catalogueIdentity(catalogue),
      catalogue.rightsConfirmedBy,
      catalogue.rightsConfirmedAt,
    ]),
  );
}

function canonicalMedia(
  media: Array<Omit<BlueskyMediaAttachment, "hash">>,
): string {
  return JSON.stringify(
    media.map((entry) => [entry.kind, entry.url, entry.alt, entry.revision]),
  );
}

export async function createBlueskyContent(
  item: ShareCalendarItem,
  source: ShareCalendarSource | null,
  now: Date,
): Promise<BlueskyContent> {
  const problems: BlueskyDraftProblem[] = [];
  const text = blueskyTextForItem(item);
  const catalogue = item.catalogue;
  const usage = blueskyUsage(text);
  if (!hasBlueskyDraft(item))
    problems.push({
      code: "draft_missing",
      message: "Add a Bluesky caption before approving this destination.",
    });
  if (!text)
    problems.push({
      code: "text_empty",
      message: "Write the exact Bluesky text before approving.",
    });
  if (usage.count > BLUESKY_TEXT_GRAPHEMES)
    problems.push({
      code: "text_too_long",
      message: `Bluesky allows ${BLUESKY_TEXT_GRAPHEMES} graphemes; this text has ${usage.count}.`,
    });
  if (usage.bytes > BLUESKY_TEXT_BYTES)
    problems.push({
      code: "text_too_many_bytes",
      message: `Bluesky's post text is capped at ${BLUESKY_TEXT_BYTES} UTF-8 bytes; this text has ${usage.bytes}.`,
    });
  const current = Boolean(
    item.sourceCurrent &&
    (catalogue ||
      (source &&
        source.id === item.stack &&
        source.publication === item.publication)),
  );
  if (!current)
    problems.push({
      code: "source_stale",
      message:
        "The published source is no longer current. Refresh the share item before approving.",
    });
  const media =
    catalogue && current
      ? [
          {
            kind: "image" as const,
            url: catalogue.renditionUrl,
            alt: catalogue.alt,
            revision: `woodhouse:${catalogue.assetId}@${catalogue.assetRevision}`,
          },
        ]
      : mediaFor(source, current);
  if (!media.length)
    problems.push({
      code: "media_unavailable",
      message:
        "The public share card is not available from the current publication. Refresh before approving.",
    });
  for (const entry of media)
    if (!entry.alt)
      problems.push({
        code: "media_alt_missing",
        message: "The share card has no alt text. Add one before approving.",
      });
  const link = item.link.trim();
  if (!link)
    problems.push({
      code: "link_missing",
      message: "Add the canonical link before approving a Bluesky post.",
    });
  else if (!isSafeShareLink(link))
    problems.push({
      code: "link_unsafe",
      message: "The canonical link must be a plain http or https address.",
    });
  const scheduledAt = item.scheduledAt;
  if (!scheduledAt)
    problems.push({
      code: "time_missing",
      message: "Choose the intended Australia/Melbourne time before approving.",
    });
  else if (!isCanonicalInstant(scheduledAt))
    problems.push({
      code: "time_invalid",
      message: "The saved time is not a real UTC instant. Edit and save it.",
    });
  else if (Date.parse(scheduledAt) <= now.getTime())
    problems.push({
      code: "time_passed",
      message:
        "The intended time has passed. Revalidate and choose a future time before approving.",
    });
  const labels = scheduledAt ? scheduleLabels(scheduledAt) : null;
  const mediaWithHashes = await Promise.all(
    media.map(async (entry) => ({
      ...entry,
      hash: catalogue
        ? await catalogueConsentHash(catalogue)
        : await sha256Text(
            JSON.stringify([entry.kind, entry.url, entry.alt, entry.revision]),
          ),
    })),
  );
  const mediaHash = catalogue
    ? await sha256Text(
        JSON.stringify(mediaWithHashes.map((entry) => entry.hash)),
      )
    : await sha256Text(canonicalMedia(media));
  const textHash = await sha256Text(text);
  const sourceRecord: BlueskyContentSource = {
    stackId: item.stack,
    name: item.stackName,
    slug: item.stackSlug,
    publication: item.publication,
    url: current ? (catalogue?.projectUrl ?? source?.url ?? null) : null,
    imagePath: current
      ? (catalogue?.renditionUrl ?? source?.imagePath ?? null)
      : null,
    imageAlt: current ? (catalogue?.alt ?? source?.imageAlt ?? null) : null,
    current,
    rightsNote: catalogue
      ? `Woodhouse Share artwork. The owner confirmed rights for this exact rendition. Credit ${catalogue.credit}. Source ${catalogue.sourceUrl}.`
      : rightsNote(source, current),
  };
  const schedule: BlueskySchedule = {
    scheduledAt,
    timeZone: BLUESKY_TIME_ZONE,
    local: labels?.melbourne ?? null,
    utc: labels?.utc ?? null,
    label: labels ? `${labels.melbourne} · ${labels.utc}` : "No intended time",
    revalidatedAt: now.toISOString(),
    future: Boolean(scheduledAt && Date.parse(scheduledAt) > now.getTime()),
  };
  return {
    schema: BLUESKY_APPROVAL_SCHEMA,
    itemId: item.id,
    revision: item.revision,
    text,
    textHash,
    usage,
    media: mediaWithHashes,
    mediaHash,
    link,
    scheduledAt,
    schedule,
    source: sourceRecord,
    problems,
  };
}

export function blueskyDraft(
  content: BlueskyContent,
  account: BlueskyAccountSummary,
): BlueskyDraft {
  return { ...content, account };
}

export async function bindingForContent(
  content: BlueskyContent,
  account: Pick<BlueskyAccountSummary, "did" | "handle">,
): Promise<{ binding: BlueskyApprovalBinding; bindingHash: string }> {
  if (!content.scheduledAt)
    throw Error("A Bluesky approval needs an intended time.");
  const binding: BlueskyApprovalBinding = {
    version: BLUESKY_APPROVAL_BINDING_VERSION,
    itemId: content.itemId,
    accountDid: account.did,
    accountHandle: account.handle,
    draftRevision: content.revision,
    textHash: content.textHash,
    mediaHash: content.mediaHash,
    mediaRevision: mediaRevisionFor(content),
    link: content.link,
    scheduledAt: content.scheduledAt,
  };
  // Field order is fixed by the literal above. JSON encoding keeps the hash
  // stable and avoids separator collisions.
  const bindingHash = await sha256Text(JSON.stringify(binding));
  return { binding, bindingHash };
}

export interface CreateBlueskyApprovalOptions {
  now: Date;
  previous?: BlueskyApprovalRecord | null;
}

export async function createBlueskyApproval(
  content: BlueskyContent,
  account: BlueskyAccountSummary,
  options: CreateBlueskyApprovalOptions,
): Promise<BlueskyApprovalRecord> {
  if (content.problems.length)
    throw Error(content.problems.map((problem) => problem.message).join(" "));
  if (!content.scheduledAt)
    throw Error("A Bluesky approval needs an intended time.");
  const scheduled = Date.parse(content.scheduledAt);
  const now = options.now.getTime();
  if (!Number.isFinite(scheduled) || scheduled <= now)
    throw Error(
      "The intended time has passed. Revalidate and choose a future time before approving.",
    );
  const expiresAt = new Date(
    Math.min(
      scheduled + BLUESKY_APPROVAL_GRACE_HOURS * 60 * 60 * 1000,
      now + BLUESKY_APPROVAL_TTL_HOURS * 60 * 60 * 1000,
    ),
  ).toISOString();
  if (Date.parse(expiresAt) <= now)
    throw Error("This approval would already be expired.");
  const { bindingHash } = await bindingForContent(content, account);
  const previous =
    options.previous && options.previous.itemId === content.itemId
      ? options.previous
      : null;
  return {
    itemId: content.itemId,
    channel: "bluesky",
    state: "approved",
    accountHandle: account.handle,
    accountDid: account.did,
    draftRevision: content.revision,
    approvalRevision: (previous?.approvalRevision ?? 0) + 1,
    textHash: content.textHash,
    mediaHash: content.mediaHash,
    mediaRevision: mediaRevisionFor(content),
    link: content.link,
    scheduledAt: content.scheduledAt,
    bindingHash,
    approvedAt: options.now.toISOString(),
    expiresAt,
    cancelledAt: null,
    revokedAt: null,
    revocationReason: "",
  };
}

const blockerCodes = new Set<BlueskyApprovalReason>([
  "connection_revoked",
  "identity_not_rechecked",
  "time_passed",
  "draft_missing",
  "text_empty",
  "text_too_long",
  "text_too_many_bytes",
  "source_stale",
  "media_unavailable",
  "media_alt_missing",
  "link_missing",
  "link_unsafe",
  "time_missing",
  "time_invalid",
  "approval_revoked",
]);

export function blueskySendOutcome(input: {
  state: BlueskyApprovalState;
  account: BlueskyAccountSummary | null;
  connection: BlueskyPublishingConnection;
}): BlueskySendOutcome {
  if (input.state === "unknown")
    return {
      ok: false,
      available: false,
      code: "needs_owner",
      message:
        "The previous receipt is unknown. Reconcile it with the destination before any retry. Nothing was sent.",
    };
  if (input.connection.state === "revoked")
    return {
      ok: false,
      available: false,
      code: "needs_owner",
      message:
        "The Bluesky connection was revoked. The owner must reconnect a real authorised account. Nothing was sent.",
    };
  if (
    input.connection.state !== "authorised" &&
    input.connection.state !== "configured"
  )
    return {
      ok: false,
      available: false,
      code: "needs_owner",
      message: `${BLUESKY_SEND_UNAVAILABLE_STATEMENT} Owner action: configure the encrypted Bluesky app password in Composer plugin settings.`,
    };
  if (input.state !== "approved")
    return {
      ok: false,
      available: false,
      code: "not_approved",
      message: "The exact revision is not approved. Nothing was sent.",
    };
  if (!input.account)
    return {
      ok: false,
      available: false,
      code: "account_mismatch",
      message:
        "The configured account does not match the approved public DID. Nothing was sent.",
    };
  if (
    (input.connection.state === "authorised" &&
      input.account.did !== input.connection.did) ||
    (input.connection.state === "configured" &&
      ((input.connection.did && input.account.did !== input.connection.did) ||
        normalizeBlueskyHandle(input.connection.handle) !==
          input.account.handle))
  )
    return {
      ok: false,
      available: false,
      code: "account_mismatch",
      message:
        "The configured account does not match the approved public DID. Nothing was sent.",
    };
  return {
    ok: true,
    available: true,
    code: "ready",
    message:
      "Ready to send this exact approved revision from the configured connection. Nothing is sent until the owner confirms the bound handle, text, media and intended time.",
  };
}

function statusOf(
  state: BlueskyApprovalState,
  reasons: BlueskyApprovalReason[],
  approval: BlueskyApprovalRecord | null,
  canApprove: boolean,
  account: BlueskyAccountSummary | null,
  connection: BlueskyPublishingConnection,
): BlueskyApprovalStatus {
  return {
    state,
    label: BLUESKY_APPROVAL_LABELS[state],
    note:
      BLUESKY_APPROVAL_STATES.find((entry) => entry.id === state)?.note ?? "",
    reasons,
    approvalRevision: approval?.approvalRevision ?? null,
    approvedAt: approval?.approvedAt ?? null,
    expiresAt: approval?.expiresAt ?? null,
    bindingHash: approval?.bindingHash ?? null,
    notSent: true,
    canApprove,
    canCancel: approval?.state === "approved" && state !== "cancelled",
    send: blueskySendOutcome({ state, account, connection }),
  };
}

export interface BlueskyApprovalStatusInput {
  content: BlueskyContent | null;
  account: BlueskyAccountSummary | null;
  approval: BlueskyApprovalRecord | null;
  connection?: BlueskyPublishingConnection;
  receipt?: BlueskyReceipt | null;
  now: Date;
}

export function blueskyApprovalStatus(
  input: BlueskyApprovalStatusInput,
): BlueskyApprovalStatus {
  const connection: BlueskyPublishingConnection = input.connection ?? {
    state: "absent",
    reason: "No authorised Bluesky publishing connection exists.",
  };
  const approval = input.approval;
  const content = input.content;
  if (input.receipt?.state === "unknown")
    return statusOf(
      "unknown",
      ["unknown_receipt"],
      approval,
      false,
      input.account,
      connection,
    );
  if (approval?.state === "cancelled")
    return statusOf(
      "cancelled",
      ["approval_cancelled"],
      approval,
      Boolean(
        content &&
        content.problems.length === 0 &&
        input.account &&
        content.schedule.future &&
        connection.state !== "revoked",
      ),
      input.account,
      connection,
    );
  if (!content)
    return statusOf(
      "draft",
      ["no_draft"],
      approval,
      false,
      input.account,
      connection,
    );
  const reasons: BlueskyApprovalReason[] = [];
  const problems = content.problems.map((problem) => problem.code);
  const canApproveBase =
    content.problems.length === 0 &&
    Boolean(input.account) &&
    content.schedule.future &&
    connection.state !== "revoked";
  if (approval?.state === "revoked")
    return statusOf(
      "blocked",
      ["approval_revoked"],
      approval,
      canApproveBase,
      input.account,
      connection,
    );
  if (approval) {
    if (connection.state === "revoked") reasons.push("connection_revoked");
    if (!input.account) reasons.push("identity_not_rechecked");
    else {
      if (approval.accountDid !== input.account.did)
        reasons.push("account_did_changed");
      if (approval.accountHandle !== input.account.handle)
        reasons.push("account_handle_changed");
    }
    if (approval.draftRevision !== content.revision)
      reasons.push("draft_revision_changed");
    if (approval.textHash !== content.textHash) reasons.push("text_changed");
    if (
      approval.mediaHash !== content.mediaHash ||
      approval.mediaRevision !== mediaRevisionFor(content)
    )
      reasons.push("media_changed");
    if (approval.link !== content.link) reasons.push("link_changed");
    if (approval.scheduledAt !== content.scheduledAt)
      reasons.push("time_changed");
    if (input.now.getTime() >= Date.parse(approval.expiresAt))
      reasons.push("approval_expired");
    if (content.scheduledAt && !content.schedule.future)
      reasons.push("time_passed");
    for (const code of problems)
      if (!reasons.includes(code)) reasons.push(code);
    // An exact approval is valid until it expires. Once its intended time has
    // passed, `time_passed` is the expected send window and must not turn the
    // approval into "blocked"; expiry still ends the window and the route
    // rechecks both bounds. Every other reason keeps its existing meaning.
    const withinApprovalWindow = Boolean(
      approval.state === "approved" &&
      input.now.getTime() < Date.parse(approval.expiresAt),
    );
    const effectiveReasons = withinApprovalWindow
      ? reasons.filter((reason) => reason !== "time_passed")
      : reasons;
    const blocked = effectiveReasons.some((reason) => blockerCodes.has(reason));
    const state: BlueskyApprovalState = blocked
      ? "blocked"
      : effectiveReasons.length
        ? "awaiting_approval"
        : "approved";
    return statusOf(
      state,
      reasons,
      approval,
      canApproveBase && state !== "approved",
      input.account,
      connection,
    );
  }
  if (problems.length) {
    for (const code of problems) reasons.push(code);
    return statusOf("blocked", reasons, null, false, input.account, connection);
  }
  return statusOf(
    content.scheduledAt ? "awaiting_approval" : "draft",
    [],
    null,
    canApproveBase,
    input.account,
    connection,
  );
}

export interface SharePackageBluesky {
  schema: typeof BLUESKY_PACKAGE_SCHEMA;
  item: { id: string; revision: number };
  account: {
    status:
      | "resolved"
      | "not_checked"
      | "needs_account"
      | "invalid_handle"
      | "not_found"
      | "mismatch"
      | "unavailable";
    handle: string | null;
    did: string | null;
    displayName: string | null;
    avatar: string | null;
    profileUrl: string | null;
    publicIdentity: "resolved" | "unresolved";
    publishing: "not_authorised";
    checkedAt: string | null;
    bound: { handle: string; did: string } | null;
    statement: string;
  };
  text: string;
  textHash: string;
  count: number;
  limit: number;
  unit: "graphemes";
  bytes: number;
  byteLimit: number;
  withinLimit: boolean;
  media: BlueskyMediaAttachment[];
  mediaHash: string;
  link: string | null;
  schedule: BlueskySchedule;
  source: BlueskyContentSource;
  approval: {
    state: BlueskyApprovalState;
    label: string;
    note: string;
    reasons: BlueskyApprovalReason[];
    approvalRevision: number | null;
    approvedAt: string | null;
    expiresAt: string | null;
    bindingHash: string | null;
    notSent: true;
  };
  send: BlueskySendOutcome;
}

export function buildBlueskyPackage(
  content: BlueskyContent,
  identity: BlueskyIdentityResult | null | undefined,
  approval: BlueskyApprovalRecord | null,
  status: BlueskyApprovalStatus,
): SharePackageBluesky {
  const account = blueskyAccountFromIdentity(identity);
  const bound = approval
    ? { handle: approval.accountHandle, did: approval.accountDid }
    : null;
  const statusForAccount =
    account?.publicIdentity === "resolved"
      ? "resolved"
      : identity
        ? identity.status
        : "not_checked";
  const statement = account
    ? `${identity?.message ?? ""} ${BLUESKY_PUBLISHING_STATEMENT}`.trim()
    : bound
      ? `The saved approval binds @${bound.handle} (${bound.did}). Recheck the public profile before any handoff; a saved approval is not a live identity check. ${BLUESKY_PUBLISHING_STATEMENT}`
      : "No public Bluesky account has been resolved. Enter the owner's public handle and resolve it before approval. Composer stores no app password.";
  return {
    schema: BLUESKY_PACKAGE_SCHEMA,
    item: { id: content.itemId, revision: content.revision },
    account: {
      status: statusForAccount,
      handle: account?.handle ?? bound?.handle ?? null,
      did: account?.did ?? bound?.did ?? null,
      displayName: account?.displayName ?? null,
      avatar: account?.avatar ?? null,
      profileUrl: account?.profileUrl ?? null,
      publicIdentity: account ? "resolved" : "unresolved",
      publishing: "not_authorised",
      checkedAt: account?.resolvedAt ?? null,
      bound,
      statement,
    },
    text: content.text,
    textHash: content.textHash,
    count: content.usage.count,
    limit: content.usage.limit,
    unit: content.usage.unit,
    bytes: content.usage.bytes,
    byteLimit: content.usage.byteLimit,
    withinLimit: content.usage.withinLimit,
    media: content.media,
    mediaHash: content.mediaHash,
    link: content.link || null,
    schedule: content.schedule,
    source: content.source,
    approval: {
      state: status.state,
      label: status.label,
      note: status.note,
      reasons: status.reasons,
      approvalRevision: status.approvalRevision,
      approvedAt: status.approvedAt,
      expiresAt: status.expiresAt,
      bindingHash: status.bindingHash,
      notSent: true,
    },
    send: status.send,
  };
}

export interface BlueskyPackageOptions {
  identity?: BlueskyIdentityResult | null;
  approval?: BlueskyApprovalRecord | null;
  connection?: BlueskyPublishingConnection;
  receipt?: BlueskyReceipt | null;
  now: Date;
}

export async function blueskyPackageForItem(
  snapshot: ShareCalendarSnapshot,
  item: ShareCalendarItem,
  options: BlueskyPackageOptions,
): Promise<SharePackageBluesky | null> {
  if (!hasBlueskyDraft(item)) return null;
  const source =
    snapshot.sources.find(
      (entry) =>
        entry.id === item.stack && entry.publication === item.publication,
    ) ?? null;
  const content = await createBlueskyContent(item, source, options.now);
  const account = blueskyAccountFromIdentity(options.identity);
  const approval =
    options.approval ??
    snapshot.approvals.find((entry) => entry.itemId === item.id) ??
    null;
  const status = blueskyApprovalStatus({
    content,
    account,
    approval,
    connection: options.connection,
    receipt: options.receipt,
    now: options.now,
  });
  return buildBlueskyPackage(content, options.identity, approval, status);
}
