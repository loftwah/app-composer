import { listBlueskyObservations } from "./bluesky-observations.ts";
// Owner-only route logic for the Share calendar (#604).
// The host authenticates the caller and checks the EmDash permission before
// dispatch. This second boundary rechecks the creator role, the exact origin,
// workspace membership and the save/read capability. A workspace or stack id
// from the request is only a selector and never widens authority.
import type { D1Database } from "@cloudflare/workers-types";
import { isCreatorRole } from "./creator-access.ts";
import {
  resolveWorkspace,
  requireCapability,
  publicStack,
  StackError,
} from "./stacks.mjs";
import { stackShareDetails } from "./stack-sharing.ts";
import {
  captionProblem,
  catalogueSelectionSchema,
  upcomingQueueSlots,
  shareCalendarCommand,
  shareCalendarReadInput,
  shareCalendarSnapshot,
  scheduledBlueskyJobSchema,
  type ScheduledBlueskyJob,
  shareCalendarVariantSchema,
  shareQueuePresetsReplySchema,
  sqliteInstant,
  variantSort,
  SHARE_QUEUE_PRESET_MAX,
  SHARE_CAPTION_LOCAL_CHARACTERS,
  SHARE_VARIANT_MAX,
  SHARE_X_CHANNEL,
  type BlueskyApprovalRecord,
  type ShareCalendarItem,
  type ShareCalendarSnapshot,
  type ShareCalendarSource,
  type ShareCalendarVariant,
  type ShareQueuePresetsReply,
} from "./share-calendar.ts";
import {
  BLUESKY_CREDENTIAL_STATEMENT,
  BLUESKY_HANDLE_SETTING,
  configuredBlueskyHandle,
  normalizeBlueskyHandle,
  resolveBlueskyIdentity,
} from "./bluesky-account.ts";
import {
  blueskyAccountFromIdentity,
  blueskyUsage,
  portfolioBlueskyText,
  bindingForContent,
  createBlueskyApproval,
  createBlueskyContent,
  BLUESKY_SEND_UNAVAILABLE_STATEMENT,
} from "./share-approval.ts";
import {
  BLUESKY_APP_PASSWORD_SETTING,
  blueskyPostRkey,
  createBlueskyPost,
  createBlueskySession,
  fetchBlueskyImage,
  normalizeBlueskyAppPassword,
  normalizeBlueskyService,
  readBlueskyPost,
  refreshBlueskySession,
  uploadBlueskyImage,
  type BlueskyPublishFailure,
} from "./bluesky-publisher.ts";
import {
  blueskyDeliveryKey,
  cancelBlueskyDelivery,
  claimBlueskyDelivery,
  listBlueskyDeliveries,
  markBlueskyDeliveryFailed,
  markBlueskyDeliveryNeedsAuth,
  markBlueskyDeliveryPublished,
  markBlueskyDeliveryUnknown,
  readBlueskyDelivery,
  reconcileBlueskyDelivery,
} from "./bluesky-delivery.ts";

import {
  cataloguePreviewHash,
  resolveShareCatalogueAsset,
  sameCatalogueAsset,
  searchShareCatalogueAssets,
  sha256Bytes,
} from "./share-catalogue-asset.ts";

export interface ShareCalendarRuntime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  SHARE_BLUESKY_HANDLE?: unknown;
  SHARE_BLUESKY_PDS?: unknown;
  fetch?: typeof globalThis.fetch;
  // Test-only clock and timeout seams. Production leaves both unset.
  now?: Date;
  blueskyTimeoutMs?: number;
}

interface User {
  id: string;
  role: number;
}
interface PluginSettings {
  getVersioned<T>(key: string): Promise<{ value: T; revision: string } | null>;
}
interface ShareCalendarCron {
  schedule(
    name: string,
    options: { schedule: string; data: Record<string, unknown> },
  ): Promise<void>;
  list(): Promise<Array<{ name: string }>>;
}
interface Context {
  user?: User;
  request: Request;
  input: unknown;
  settings?: PluginSettings;
  cron?: ShareCalendarCron;
}
interface Workspace {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
}
interface SourceRow {
  id: string;
  slug: string;
  name: string;
  published_revision: number;
}
interface ItemRow {
  id: string;
  stack_id: string | null;
  stack_name: string | null;
  stack_slug: string | null;
  stack_revision: number | null;
  asset_kind: "stack" | "portfolio";
  bluesky_asset: string | null;
  channel: string;
  destination: string;
  caption: string;
  variants: string;
  x_export_caption: string | null;
  link: string;
  scheduled_at: string | null;
  state: string;
  shared_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

interface ApprovalRow {
  item_id: string;
  channel: string;
  state: string;
  account_handle: string;
  account_did: string;
  draft_revision: number;
  approval_revision: number;
  text_hash: string;
  media_hash: string;
  media_revision: string;
  link: string;
  scheduled_at: string;
  binding_hash: string;
  approved_at: string;
  expires_at: string;
  cancelled_at: string | null;
  revoked_at: string | null;
  revocation_reason: string;
}

const origin = "https://composer.loftwah.com";
const unavailable = () => ({
  ok: false as const,
  code: "UNAVAILABLE",
  message: "The share calendar is disconnected in this environment.",
});
const fail = (code: string, message: string) => ({
  ok: false as const,
  code,
  message,
});

function database(value: unknown): value is D1Database {
  return Boolean(value && typeof value === "object" && "prepare" in value);
}

function requestDate(runtime: ShareCalendarRuntime): Date {
  const value = runtime.now;
  return value instanceof Date && Number.isFinite(value.getTime())
    ? new Date(value.getTime())
    : new Date();
}

function pdsOrigin(runtime: ShareCalendarRuntime): string | null {
  return normalizeBlueskyService(runtime.SHARE_BLUESKY_PDS) ?? null;
}

// Read the encrypted app password for this one server-side operation. It is
// never returned to the page, written to a delivery row, logged or included in
// an error. A missing or unreadable secret is simply "not configured".
async function readBlueskyAppPassword(
  ctx: Pick<Context, "settings">,
): Promise<string | null> {
  try {
    const stored = await ctx.settings?.getVersioned<string>(
      BLUESKY_APP_PASSWORD_SETTING,
    );
    return normalizeBlueskyAppPassword(stored?.value);
  } catch {
    return null;
  }
}

// The owner can save the public handle from Share connections. A stored value
// wins over the runtime fallback so administration needs no deployment; an
// unreadable setting keeps the existing fallback rather than blocking the
// calendar, and an invalid stored value stays unconfigured.
async function readConfiguredBlueskyHandle(
  ctx: Pick<Context, "settings">,
  runtime: ShareCalendarRuntime,
): Promise<string | null> {
  try {
    const stored = await ctx.settings?.getVersioned<string>(
      BLUESKY_HANDLE_SETTING,
    );
    const value = stored?.value;
    if (typeof value === "string" && value.trim())
      return configuredBlueskyHandle(runtime, value);
  } catch {
    /* Fall through to the runtime value. */
  }
  return configuredBlueskyHandle(runtime);
}

function connectionSummary(
  configuredHandle: string | null,
  passwordConfigured: boolean,
) {
  return {
    state: passwordConfigured
      ? ("configured" as const)
      : ("not_configured" as const),
    handle: configuredHandle,
    note: passwordConfigured
      ? "An encrypted Bluesky app password is configured. Its validity is checked only when the owner sends an approved post."
      : "No Bluesky publishing connection is configured. Copy the approval package and post it yourself; nothing will be sent.",
  };
}

function publishFailureCode(failure: BlueskyPublishFailure): string {
  if (failure.needsAuth) return "NEEDS_OWNER";
  if (failure.transport || failure.retryable) return "UNAVAILABLE";
  if (failure.code === "record_conflict") return "CONFLICT";
  return "BLOCKED";
}

interface QueuePresetRow {
  category: string;
  weekday: number;
  time: string;
}

// Scoped to one workspace and one exact configured handle, and always bounded
// to the same cap the reply exposes. No dispatch, date or provenance field is
// read or returned: the only public fields are category, weekday and time.
async function listQueuePresets(
  db: D1Database,
  workspaceId: string,
  accountHandle: string,
): Promise<QueuePresetRow[]> {
  const rows = await db
    .prepare(
      `SELECT category,weekday,time FROM creator_share_queue_presets
       WHERE workspace_id=? AND account_handle=?
       ORDER BY category LIMIT ?`,
    )
    .bind(workspaceId, accountHandle, SHARE_QUEUE_PRESET_MAX)
    .all<QueuePresetRow>();
  return (rows.results ?? []).map((row) => ({
    category: row.category,
    weekday: row.weekday,
    time: row.time,
  }));
}

function queueReply(
  workspace: Workspace,
  accountHandle: string,
  presets: QueuePresetRow[],
): ShareQueuePresetsReply {
  return shareQueuePresetsReplySchema.parse({
    ok: true,
    action: "queuePresets",
    workspace: workspace.id,
    account: accountHandle,
    presets,
  });
}

// The expected account and the workspace owner are checked against the current
// scope on every action. A stale or foreign account never writes a preset.
function queueAccountFailure(
  account: string,
  configuredHandle: string | null,
): ReturnType<typeof fail> | null {
  if (!configuredHandle)
    return fail(
      "INVALID",
      "Set the Bluesky account in Share connections first.",
    );
  if (normalizeBlueskyHandle(account) !== configuredHandle)
    return fail(
      "CONFLICT",
      "The Bluesky account changed. Refresh before managing the queue.",
    );
  return null;
}

const queueOwnerFailure = (workspace: Workspace) =>
  workspace.role !== "owner"
    ? fail("FORBIDDEN", "Only the workspace owner can manage the Bluesky queue.")
    : null;

async function listSources(
  db: D1Database,
  workspaceId: string,
): Promise<ShareCalendarSource[]> {
  const rows = await db
    .prepare(
      "SELECT id,slug,name,published_revision FROM creator_stacks WHERE workspace_id=? AND status='published' AND published_revision IS NOT NULL AND published_json IS NOT NULL ORDER BY updated_at DESC,id LIMIT 50",
    )
    .bind(workspaceId)
    .all<SourceRow>();
  const sources: ShareCalendarSource[] = [];
  for (const row of rows.results ?? []) {
    // Re-read the exact current publication rather than trusting the stack
    // columns. A changed revision or an unpublished stack never yields a stale
    // share card here.
    const stack = await publicStack(db, row.slug);
    if (
      !stack ||
      stack.id !== row.id ||
      stack.revision !== row.published_revision
    )
      continue;
    const share = await stackShareDetails(stack);
    sources.push({
      id: stack.id,
      slug: stack.slug,
      name: stack.name,
      description: share.description,
      publication: stack.revision,
      publishedAt: sqliteInstant(stack.publishedAt),
      url: share.url,
      imagePath: share.imagePath,
      imageAlt: share.imageAlt,
      apps: share.apps,
    });
  }
  return sources;
}

function variantsFor(row: ItemRow): ShareCalendarVariant[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.variants || "[]");
  } catch {
    throw new StackError(
      "UNAVAILABLE",
      "A saved channel draft could not be read. Refresh before retrying.",
      500,
    );
  }
  return shareCalendarVariantSchema.array().max(SHARE_VARIANT_MAX).parse(parsed);
}

function itemRow(row: ItemRow): ShareCalendarItem {
  const catalogue =
    row.asset_kind === "portfolio"
      ? catalogueSelectionSchema.parse(JSON.parse(row.bluesky_asset ?? "null"))
      : undefined;
  return {
    id: row.id,
    stack: row.stack_id,
    stackName: catalogue?.title ?? row.stack_name ?? "",
    ...(catalogue ? { catalogue } : {}),
    stackSlug: row.stack_slug,
    publication: row.stack_revision,
    sourceCurrent: false,
    channel: row.channel as ShareCalendarItem["channel"],
    destination: row.destination ?? "",
    caption: row.caption,
    variants: row.x_export_caption === null
      ? variantsFor(row)
      : [{ channel: SHARE_X_CHANNEL, destination: "", caption: row.x_export_caption }],
    link: row.link,
    scheduledAt: row.scheduled_at ? sqliteInstant(row.scheduled_at) : null,
    state: row.state as ShareCalendarItem["state"],
    sharedAt: row.shared_at ? sqliteInstant(row.shared_at) : null,
    revision: row.revision,
    createdAt: sqliteInstant(row.created_at),
    updatedAt: sqliteInstant(row.updated_at),
  };
}

function approvalRecord(row: ApprovalRow): BlueskyApprovalRecord {
  return {
    itemId: row.item_id,
    channel: "bluesky",
    state: row.state as BlueskyApprovalRecord["state"],
    accountHandle: row.account_handle,
    accountDid: row.account_did,
    draftRevision: row.draft_revision,
    approvalRevision: row.approval_revision,
    textHash: row.text_hash,
    mediaHash: row.media_hash,
    mediaRevision: row.media_revision,
    link: row.link,
    scheduledAt: sqliteInstant(row.scheduled_at),
    bindingHash: row.binding_hash,
    approvedAt: sqliteInstant(row.approved_at),
    expiresAt: sqliteInstant(row.expires_at),
    cancelledAt: row.cancelled_at ? sqliteInstant(row.cancelled_at) : null,
    revokedAt: row.revoked_at ? sqliteInstant(row.revoked_at) : null,
    revocationReason: row.revocation_reason,
  };
}

async function snapshot(
  db: D1Database,
  workspace: Workspace,
  changed: string | null = null,
  configuredHandle: string | null = null,
  connection = connectionSummary(configuredHandle, false),
  now = new Date(),
  cron?: ShareCalendarCron,
): Promise<ShareCalendarSnapshot> {
  const sources = await listSources(db, workspace.id);
  const rows = await db
    .prepare(
      `SELECT i.id,i.stack_id,i.stack_revision,i.asset_kind,i.bluesky_asset,i.channel,i.destination,i.caption,i.variants,i.x_export_caption,i.link,i.scheduled_at,i.state,i.shared_at,i.revision,i.created_at,i.updated_at,s.name AS stack_name,s.slug AS stack_slug
       FROM creator_share_calendar_items i
       LEFT JOIN creator_stacks s ON s.id=i.stack_id
       WHERE i.workspace_id=?
       ORDER BY CASE WHEN i.scheduled_at IS NULL THEN 1 ELSE 0 END,i.scheduled_at,i.updated_at DESC,i.id
       LIMIT 200`,
    )
    .bind(workspace.id)
    .all<ItemRow>();
  const approvalRows = await db
    .prepare(
      `SELECT item_id,channel,state,account_handle,account_did,draft_revision,approval_revision,text_hash,media_hash,media_revision,link,scheduled_at,binding_hash,approved_at,expires_at,cancelled_at,revoked_at,revocation_reason
       FROM creator_share_approvals
       WHERE workspace_id=?
       ORDER BY item_id`,
    )
    .bind(workspace.id)
    .all<ApprovalRow>();
  const deliveries = await listBlueskyDeliveries(db, workspace.id);
  const blueskyObservations = deliveries.some(({ state }) => state === "published")
    ? await listBlueskyObservations(db, workspace.id).catch(() => null)
    : undefined;
  const revisions = new Map(
    (rows.results ?? []).map((row) => [row.id, row.revision]),
  );
  let taskNames = new Set<string>();
  let schedulerAvailable = false;
  if (cron && approvalRows.results?.some((row) => row.state === "approved")) {
    try {
      taskNames = new Set((await cron.list()).map(({ name }) => name));
      schedulerAvailable = true;
    } catch {
      // The calendar and exact approval remain readable during a scheduler fault.
    }
  }
  const current = new Map(
    sources.map((source) => [source.id, source.publication]),
  );
  return shareCalendarSnapshot.parse({
    ok: true,
    workspace,
    sources,
    items: (rows.results ?? []).map((row) => ({
      ...itemRow(row),
      sourceCurrent:
        row.asset_kind === "portfolio" ||
        (row.stack_id !== null &&
          current.get(row.stack_id) === row.stack_revision),
    })),
    approvals: (approvalRows.results ?? []).map((row) => {
      const approval = approvalRecord(row);
      return {
        ...approval,
        automatic:
          approval.state === "approved" &&
          revisions.get(approval.itemId) === approval.draftRevision &&
          taskNames.has(scheduledBlueskyName(approval)),
      };
    }),
    deliveries,
    ...(blueskyObservations === undefined ? {} : { blueskyObservations }),
    bluesky: { configuredHandle, connection, schedulerAvailable },
    now: now.toISOString(),
    changed,
  });
}

async function currentSource(
  db: D1Database,
  workspaceId: string,
  stack: string | null,
): Promise<ShareCalendarSource> {
  const row = await db
    .prepare(
      "SELECT id,slug FROM creator_stacks WHERE id=? AND workspace_id=? AND status='published' AND published_revision IS NOT NULL AND published_json IS NOT NULL",
    )
    .bind(stack, workspaceId)
    .first<{ id: string; slug: string }>();
  if (!row)
    throw new StackError(
      "NOT_FOUND",
      "Choose a published stack with a current share card.",
      404,
    );
  const current = await publicStack(db, row.slug);
  if (!current || current.id !== row.id)
    throw new StackError(
      "NOT_FOUND",
      "Choose a published stack with a current share card.",
      404,
    );
  const share = await stackShareDetails(current);
  return {
    id: current.id,
    slug: current.slug,
    name: current.name,
    description: share.description,
    publication: current.revision,
    publishedAt: sqliteInstant(current.publishedAt),
    url: share.url,
    imagePath: share.imagePath,
    imageAlt: share.imageAlt,
    apps: share.apps,
  };
}

async function selectedItem(
  db: D1Database,
  workspaceId: string,
  id: string,
): Promise<ItemRow> {
  const row = await db
    .prepare(
      `SELECT i.id,i.stack_id,i.stack_revision,i.asset_kind,i.bluesky_asset,i.channel,i.destination,i.caption,i.variants,i.x_export_caption,i.link,i.scheduled_at,i.state,i.shared_at,i.revision,i.created_at,i.updated_at,s.name AS stack_name,s.slug AS stack_slug
       FROM creator_share_calendar_items i
       LEFT JOIN creator_stacks s ON s.id=i.stack_id
       WHERE i.id=? AND i.workspace_id=? LIMIT 1`,
    )
    .bind(id, workspaceId)
    .first<ItemRow>();
  if (!row)
    throw new StackError("NOT_FOUND", "That share item no longer exists.", 404);
  return row;
}

const conflict = () =>
  new StackError(
    "CONFLICT",
    "Another window changed this share item. Refresh before saving again.",
    409,
  );

const approvalColumns =
  "item_id,channel,state,account_handle,account_did,draft_revision,approval_revision,text_hash,media_hash,media_revision,link,scheduled_at,binding_hash,approved_at,expires_at,cancelled_at,revoked_at,revocation_reason";

async function selectedApproval(
  db: D1Database,
  workspaceId: string,
  itemId: string,
): Promise<ApprovalRow | null> {
  return db
    .prepare(
      `SELECT ${approvalColumns} FROM creator_share_approvals WHERE item_id=? AND workspace_id=? LIMIT 1`,
    )
    .bind(itemId, workspaceId)
    .first<ApprovalRow>();
}

function requireRevision(expected: number, actual: number) {
  if (expected !== actual) throw conflict();
}

function stateFor(scheduledAt: string | null) {
  return scheduledAt ? ("scheduled" as const) : ("draft" as const);
}

// Writes check the exact stack directly rather than relying on the bounded
// source list, so a workspace with many published stacks cannot make an older
// item look stale merely because its source fell outside the list.
async function sourceStillCurrent(
  db: D1Database,
  workspaceId: string,
  row: ItemRow,
): Promise<boolean> {
  if (!row.stack_id) return false;
  const stack = await db
    .prepare(
      "SELECT id,slug,status,published_revision,published_json FROM creator_stacks WHERE id=? AND workspace_id=?",
    )
    .bind(row.stack_id, workspaceId)
    .first<{
      id: string;
      slug: string;
      status: string;
      published_revision: number | null;
      published_json: string | null;
    }>();
  if (
    !stack ||
    stack.status !== "published" ||
    stack.published_revision !== row.stack_revision ||
    !stack.published_json
  )
    return false;
  const current = await publicStack(db, stack.slug);
  return Boolean(
    current &&
    current.id === stack.id &&
    current.revision === row.stack_revision,
  );
}

async function resolveCatalogue(
  assetId: string,
  runtime: ShareCalendarRuntime,
  expectedArtworkRevision?: string,
) {
  const resolved = await resolveShareCatalogueAsset(assetId, {
    fetch: runtime.fetch,
    timeoutMs: runtime.blueskyTimeoutMs,
    expectedArtworkRevision,
  });
  if (!resolved.ok) throw new StackError("SOURCE_STALE", resolved.message, 409);
  return resolved;
}

async function sourceForBluesky(
  db: D1Database,
  workspaceId: string,
  row: ItemRow,
  item: ShareCalendarItem,
  runtime: ShareCalendarRuntime,
) {
  if (item.catalogue) {
    const { asset: current } = await resolveCatalogue(item.catalogue.assetId, runtime);
    if (!sameCatalogueAsset(item.catalogue, current))
      throw new StackError(
        "SOURCE_STALE",
        "This artwork or its source details changed. Choose the current rendition for a new draft.",
        409,
      );
    return null;
  }
  if (!(await sourceStillCurrent(db, workspaceId, row)))
    throw new StackError(
      "SOURCE_STALE",
      "This stack's published revision changed. Refresh the source before approving or sending.",
      409,
    );
  const source = await currentSource(db, workspaceId, row.stack_id);
  if (source.publication !== row.stack_revision)
    throw new StackError(
      "SOURCE_STALE",
      "This stack's published revision changed. Refresh the source before approving or sending.",
      409,
    );
  return source;
}

function scheduledBlueskyName(approval: {
  itemId: string;
  approvalRevision: number;
  bindingHash: string;
}) {
  return `share-bs-${approval.itemId}-${approval.approvalRevision}-${approval.bindingHash}`;
}

async function sendApprovedBluesky({
  db,
  workspaceId,
  row,
  approval,
  runtime,
  nowDate,
  appPassword,
  configuredHandle,
  scheduledOwner,
}: {
  db: D1Database;
  workspaceId: string;
  row: ItemRow;
  approval: BlueskyApprovalRecord;
  runtime: ShareCalendarRuntime;
  nowDate: Date;
  appPassword: string | null;
  configuredHandle: string | null;
  scheduledOwner?: string;
}) {
  const expiresAt = Date.parse(approval.expiresAt);
  const intendedAt = Date.parse(approval.scheduledAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowDate.getTime())
    return fail(
      "BLOCKED",
      "This approval expired or has no valid expiry. Re-approve the exact revision before sending. Nothing was sent.",
    );
  if (!Number.isFinite(intendedAt) || intendedAt > nowDate.getTime())
    return fail(
      "BLOCKED",
      "The intended time has not arrived or is invalid. Nothing was sent.",
    );
  if (!appPassword || (scheduledOwner && !configuredHandle))
    return fail(
      "NEEDS_OWNER",
      `${BLUESKY_SEND_UNAVAILABLE_STATEMENT} No post was sent.`,
    );
  const connectionHandle = configuredHandle ?? approval.accountHandle;
  if (normalizeBlueskyHandle(connectionHandle) !== approval.accountHandle)
    return fail(
      "NEEDS_OWNER",
      "The configured public Bluesky handle does not match the approved handle. Nothing was sent.",
    );
  const item = { ...itemRow(row), sourceCurrent: true };
  const source = await sourceForBluesky(db, workspaceId, row, item, runtime);
  const content = await createBlueskyContent(item, source, nowDate);
  // A send happens at or after the intended time, so `time_passed` is the
  // expected state here. Every other content problem still blocks.
  const blocking = content.problems.filter(
    (problem) => problem.code !== "time_passed",
  );
  if (blocking.length)
    return fail(
      "BLOCKED",
      `${blocking.map((problem) => problem.message).join(" ")} Nothing was sent.`,
    );
  const media = content.media[0];
  if (!media)
    return fail(
      "BLOCKED",
      "The approved share card is no longer available. Nothing was sent.",
    );
  const exact =
    content.scheduledAt === approval.scheduledAt &&
    content.textHash === approval.textHash &&
    content.mediaHash === approval.mediaHash &&
    content.link === approval.link &&
    content.revision === approval.draftRevision;
  if (!exact)
    return fail(
      "CONFLICT",
      "The saved draft no longer matches the exact approval. Re-approve before sending. Nothing was sent.",
    );
  const { bindingHash } = await bindingForContent(content, {
    did: approval.accountDid,
    handle: approval.accountHandle,
  });
  if (bindingHash !== approval.bindingHash)
    return fail(
      "CONFLICT",
      "The approval binding no longer matches this item. Re-approve before sending. Nothing was sent.",
    );
  const rkey = await blueskyPostRkey(row.id, approval.approvalRevision);
  const deliveryKey = blueskyDeliveryKey(row.id, approval.approvalRevision);
  const claim = await claimBlueskyDelivery(db, {
    itemId: row.id,
    workspaceId: workspaceId,
    approvalRevision: approval.approvalRevision,
    accountHandle: approval.accountHandle,
    accountDid: approval.accountDid,
    bindingHash: approval.bindingHash,
    textHash: content.textHash,
    rkey,
    now: requestDate(runtime),
    requireApproval: true,
    scheduledOwner,
  });
  if (!claim.claimed) {
    if (claim.reason === "published") return null;
    if (claim.reason === "sending")
      return fail(
        "CONFLICT",
        "Another worker is already sending this exact approval. Nothing was retried.",
      );
    if (claim.reason === "unknown")
      return fail(
        "CONFLICT",
        "The previous attempt has an unknown outcome. Reconcile it before sending again. Nothing was sent.",
      );
    if (claim.reason === "cancelled")
      return fail(
        "CONFLICT",
        "This delivery was cancelled. Re-approve before sending. Nothing was sent.",
      );
    if (claim.reason === "exhausted")
      return fail(
        "BLOCKED",
        "This approval has reached its bounded send attempts. Re-approve before trying again. Nothing was sent.",
      );
    return fail(
      "UNAVAILABLE",
      "The delivery could not be claimed safely. Nothing was sent.",
    );
  }
  const service = pdsOrigin(runtime);
  if (!service) {
    await markBlueskyDeliveryFailed(db, deliveryKey, {
      code: "invalid_service",
      message:
        "The configured Bluesky service address is not a plain https origin. Nothing was sent.",
      now: nowDate,
    });
    return fail(
      "BLOCKED",
      "The configured Bluesky service address is not a plain https origin. Nothing was sent.",
    );
  }
  const doFetch = runtime.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    await markBlueskyDeliveryFailed(db, deliveryKey, {
      code: "unavailable",
      message:
        "Composer has no network transport for Bluesky. Nothing was sent.",
      now: nowDate,
    });
    return fail(
      "UNAVAILABLE",
      "Composer has no network transport for Bluesky. Nothing was sent.",
    );
  }
  const publisherOptions = {
    fetch: doFetch,
    service,
    timeoutMs: runtime.blueskyTimeoutMs,
  };
  try {
    const sessionResult = await createBlueskySession(
      { identifier: connectionHandle, password: appPassword },
      publisherOptions,
    );
    if (!sessionResult.ok) {
      if (sessionResult.needsAuth)
        await markBlueskyDeliveryNeedsAuth(db, deliveryKey, {
          message: sessionResult.message,
          now: nowDate,
        });
      else
        await markBlueskyDeliveryFailed(db, deliveryKey, {
          code: sessionResult.code,
          message: sessionResult.message,
          now: nowDate,
        });
      return fail(publishFailureCode(sessionResult), sessionResult.message);
    }
    const session = sessionResult.session;
    if (
      session.did !== approval.accountDid ||
      session.handle !== approval.accountHandle
    ) {
      await markBlueskyDeliveryFailed(db, deliveryKey, {
        code: "account_mismatch",
        message:
          "The Bluesky session belongs to a different account than the approval. Nothing was sent.",
        now: nowDate,
      });
      return fail(
        "BLOCKED",
        "The Bluesky session belongs to a different account than the approval. Nothing was sent.",
      );
    }
    const imageResult = await fetchBlueskyImage(media.url, publisherOptions);
    if (!imageResult.ok) {
      await markBlueskyDeliveryFailed(db, deliveryKey, {
        code: imageResult.code,
        message: imageResult.message,
        now: nowDate,
      });
      return fail(publishFailureCode(imageResult), imageResult.message);
    }
    if (
      item.catalogue &&
      (imageResult.image.mimeType !== item.catalogue.mimeType ||
        imageResult.image.bytes.byteLength !== item.catalogue.byteLength ||
        (await sha256Bytes(imageResult.image.bytes)) !==
          item.catalogue.bytesSha256)
    ) {
      const message =
        "The artwork bytes changed after approval. Nothing was sent.";
      await markBlueskyDeliveryFailed(db, deliveryKey, {
        code: "catalogue_media_changed",
        message,
        now: nowDate,
      });
      return fail("SOURCE_STALE", message);
    }
    const blobResult = await uploadBlueskyImage(
      {
        session,
        bytes: imageResult.image.bytes,
        mimeType: imageResult.image.mimeType,
      },
      publisherOptions,
    );
    if (!blobResult.ok) {
      if (blobResult.needsAuth)
        await markBlueskyDeliveryNeedsAuth(db, deliveryKey, {
          message: blobResult.message,
          now: nowDate,
        });
      else
        await markBlueskyDeliveryFailed(db, deliveryKey, {
          code: blobResult.code,
          message: blobResult.message,
          now: nowDate,
        });
      return fail(publishFailureCode(blobResult), blobResult.message);
    }
    const postInput = {
      session,
      rkey,
      text: content.text,
      createdAt: nowDate.toISOString(),
      link: content.link,
      embed: item.catalogue ? ("images" as const) : ("external" as const),
      image: { blob: blobResult.blob, alt: media.alt },
      external: {
        title: content.source.name,
        description: content.text,
      },
    };
    let postResult = await createBlueskyPost(postInput, publisherOptions);
    if (!postResult.ok && postResult.needsAuth) {
      const refreshed = await refreshBlueskySession(
        session.refreshJwt,
        publisherOptions,
      );
      if (
        refreshed.ok &&
        refreshed.session.did === approval.accountDid &&
        refreshed.session.handle === approval.accountHandle
      )
        postResult = await createBlueskyPost(
          { ...postInput, session: refreshed.session },
          publisherOptions,
        );
      else if (refreshed.ok) {
        await markBlueskyDeliveryFailed(db, deliveryKey, {
          code: "account_mismatch",
          message:
            "The refreshed Bluesky session belongs to a different account. Nothing was sent.",
          now: nowDate,
        });
        return fail(
          "BLOCKED",
          "The refreshed Bluesky session belongs to a different account. Nothing was sent.",
        );
      }
    }
    if (!postResult.ok) {
      if (postResult.needsAuth) {
        await markBlueskyDeliveryNeedsAuth(db, deliveryKey, {
          message: postResult.message,
          now: nowDate,
        });
        return fail("NEEDS_OWNER", postResult.message);
      }
      if (
        postResult.transport ||
        postResult.code === "record_conflict" ||
        postResult.code === "invalid_response"
      ) {
        // The request may have reached the provider. Never retry blindly;
        // the deterministic rkey makes reconciliation exact.
        await markBlueskyDeliveryUnknown(db, deliveryKey, {
          code: postResult.code,
          message: postResult.message,
          now: nowDate,
        });
        return fail(
          postResult.code === "record_conflict" ? "CONFLICT" : "UNAVAILABLE",
          `${postResult.message} The outcome is unknown; reconcile before retrying. Nothing was retried.`,
        );
      }
      await markBlueskyDeliveryFailed(db, deliveryKey, {
        code: postResult.code,
        message: postResult.message,
        now: nowDate,
      });
      return fail(publishFailureCode(postResult), postResult.message);
    }
    const published = await markBlueskyDeliveryPublished(db, deliveryKey, {
      uri: postResult.post.uri,
      cid: postResult.post.cid,
      permalink: postResult.post.permalink,
      now: nowDate,
    });
    if (!published)
      return fail(
        "UNAVAILABLE",
        "Bluesky accepted the post, but the local receipt changed before it could be recorded. Inspect the public profile and reconcile before any new approval.",
      );
    return null;
  } catch {
    // An unexpected stop after the claim is ambiguous: it may have
    // happened after createRecord. Record `unknown` and require a readback.
    await markBlueskyDeliveryUnknown(db, deliveryKey, {
      code: "unexpected",
      message:
        "The send stopped unexpectedly. The outcome is unknown; reconcile before retrying.",
      now: nowDate,
    });
    return fail(
      "UNAVAILABLE",
      "The send stopped unexpectedly. The outcome is unknown; reconcile before retrying. Nothing was retried.",
    );
  }
}

export async function runScheduledBluesky(
  event: { name: string; data?: Record<string, unknown>; scheduledAt: string },
  ctx: Pick<Context, "settings">,
  runtime: ShareCalendarRuntime,
): Promise<void> {
  if (
    !event.name.startsWith("share-bs-") ||
    runtime.PUBLIC_ORIGIN !== origin ||
    !database(runtime.DB)
  )
    return;
  const parsed = scheduledBlueskyJobSchema.safeParse(event.data);
  if (!parsed.success || event.name !== scheduledBlueskyName(parsed.data))
    return;
  const job = parsed.data;
  const db = runtime.DB;
  const member = await db
    .prepare(
      "SELECT role FROM creator_members WHERE workspace_id=? AND user_id=? AND role='owner'",
    )
    .bind(job.workspaceId, job.ownerId)
    .first();
  if (!member) return;
  const row = await selectedItem(db, job.workspaceId, job.itemId).catch(
    (error: unknown) => {
      if (error instanceof StackError && error.code === "NOT_FOUND")
        return null;
      throw error;
    },
  );
  const stored = await selectedApproval(db, job.workspaceId, job.itemId);
  if (
    !row ||
    !stored ||
    stored.state !== "approved" ||
    stored.approval_revision !== job.approvalRevision ||
    stored.binding_hash !== job.bindingHash ||
    stored.draft_revision !== row.revision ||
    stored.scheduled_at !== job.scheduledAt
  )
    return;
  const approval = approvalRecord(stored);
  const nowDate = requestDate(runtime);
  const failure = await sendApprovedBluesky({
    db,
    workspaceId: job.workspaceId,
    row,
    approval,
    runtime,
    nowDate,
    appPassword: await readBlueskyAppPassword(ctx),
    configuredHandle: await readConfiguredBlueskyHandle(ctx, runtime),
    scheduledOwner: job.ownerId,
  }).catch((error: unknown) => {
    if (error instanceof StackError && error.code === "SOURCE_STALE")
      return fail("SOURCE_STALE", "The approved source changed. Nothing was sent.");
    throw error;
  });
  if (!failure) return;
  // Preflight can refuse a due send before the provider is reached. Record
  // that outcome on the same exact approval, only if no worker has claimed it.
  // A cancelled, changed, expired or already attempted approval cannot claim.
  const recorded = await claimBlueskyDelivery(db, {
    itemId: job.itemId,
    workspaceId: job.workspaceId,
    approvalRevision: job.approvalRevision,
    accountHandle: approval.accountHandle,
    accountDid: approval.accountDid,
    bindingHash: approval.bindingHash,
    textHash: approval.textHash,
    rkey: await blueskyPostRkey(job.itemId, job.approvalRevision),
    now: requestDate(runtime),
    scheduledOwner: job.ownerId,
  });
  if (!recorded.claimed) return;
  const key = blueskyDeliveryKey(job.itemId, job.approvalRevision);
  if (failure.code === "NEEDS_OWNER")
    await markBlueskyDeliveryNeedsAuth(db, key, { message: failure.message, now: nowDate });
  else
    await markBlueskyDeliveryFailed(db, key, {
      code: "scheduled_preflight",
      message: failure.message,
      now: nowDate,
    });
}

export async function manageShareCalendar(
  ctx: Context,
  runtime: ShareCalendarRuntime,
) {
  if (!ctx.user || !isCreatorRole(ctx.user.role) || !ctx.user.id)
    return fail("FORBIDDEN", "A signed-in Composer creator is required.");
  if (runtime.PUBLIC_ORIGIN !== origin || !database(runtime.DB))
    return unavailable();
  const nowDate = requestDate(runtime);
  const reading = ctx.request.method === "GET";
  if (
    (ctx.request.headers.has("Origin") &&
      ctx.request.headers.get("Origin") !== origin) ||
    (!reading &&
      (ctx.request.method !== "POST" ||
        ctx.request.headers.get("Origin") !== origin ||
        ctx.request.headers.get("X-EmDash-Request") !== "1"))
  )
    return fail("FORBIDDEN", "Open this action from Composer administration.");
  // Read the stored public handle and the encrypted secret only after the
  // request boundary has passed. The secret is used for presence in the view
  // and for one explicit send; it is never returned, stored in a receipt or
  // included in an error.
  const configuredHandle = await readConfiguredBlueskyHandle(ctx, runtime);
  const appPassword = await readBlueskyAppPassword(ctx);
  const connection = connectionSummary(configuredHandle, Boolean(appPassword));
  const view = (
    db: D1Database,
    workspace: Workspace,
    changed: string | null = null,
  ) =>
    snapshot(
      db,
      workspace,
      changed,
      configuredHandle,
      connection,
      nowDate,
      ctx.cron,
    );
  try {
    if (reading) {
      const url = new URL(ctx.request.url);
      for (const key of url.searchParams.keys())
        if (url.searchParams.getAll(key).length !== 1)
          throw new StackError("INVALID", "Choose each calendar filter once.");
    }
    const parsedRead = reading
      ? shareCalendarReadInput.safeParse(ctx.input)
      : null;
    if (parsedRead && !parsedRead.success)
      return fail(
        "INVALID",
        "Choose only the declared share fields, a real time and an http or https link.",
      );
    if (parsedRead?.success) {
      const db = runtime.DB;
      const workspace = await resolveWorkspace(
        db,
        ctx.user,
        parsedRead.data.workspace ?? null,
      );
      requireCapability(workspace.role, "read");
      if (parsedRead.data.action === "cataloguePreview") {
        if (workspace.role !== "owner")
          return fail(
            "FORBIDDEN",
            "The workspace owner can confirm reuse of Woodhouse artwork.",
          );
        const { asset, sourceDescription } = await resolveCatalogue(
          parsedRead.data.assetId,
          runtime,
          parsedRead.data.artworkRevision,
        );
        const suggestedCaption = parsedRead.data.artworkRevision
          ? [sourceDescription, asset.title].find(text => text &&
            text.length <= SHARE_CAPTION_LOCAL_CHARACTERS &&
            blueskyUsage(portfolioBlueskyText(text, asset)).withinLimit)
          : undefined;
        return {
          ok: true as const,
          asset,
          assetHash: await cataloguePreviewHash(asset),
          ...(suggestedCaption ? { suggestedCaption } : {}),
        };
      }
      if (parsedRead.data.action === "catalogueSearch") {
        if (workspace.role !== "owner")
          return fail(
            "FORBIDDEN",
            "The workspace owner can search Woodhouse Share artwork.",
          );
        const found = await searchShareCatalogueAssets(parsedRead.data.q, {
          fetch: runtime.fetch,
          timeoutMs: runtime.blueskyTimeoutMs,
        });
        if (!found.ok) return fail(found.code, found.message);
        return {
          ok: true as const,
          action: "catalogueSearch",
          items: found.items,
        };
      }
      if (parsedRead.data.action === "blueskyIdentity") {
        const requested = parsedRead.data.handle?.trim();
        const result = await resolveBlueskyIdentity(
          requested ? requested : configuredHandle,
          { fetch: runtime.fetch, now: nowDate },
        );
        return { ok: true as const, action: "blueskyIdentity", result };
      }
      if (parsedRead.data.action === "queuePresets") {
        const ownerFailure = queueOwnerFailure(workspace);
        if (ownerFailure) return ownerFailure;
        if (!configuredHandle)
          return fail(
            "INVALID",
            "Set the Bluesky account in Share connections first.",
          );
        const presets = await listQueuePresets(
          db,
          workspace.id,
          configuredHandle,
        );
        return queueReply(workspace, configuredHandle, presets);
      }
      if (parsedRead.data.action === "queueNextPreview") {
        if (workspace.role !== "owner")
          return fail(
            "FORBIDDEN",
            "Only the workspace owner can preview the Bluesky queue.",
          );
        if (!configuredHandle)
          return fail(
            "INVALID",
            "Set the Bluesky account in Share connections first.",
          );

        const { weekday, time } = parsedRead.data;
        const slots = upcomingQueueSlots(weekday, time, nowDate);
        // A scheduled instant with seconds still occupies the displayed minute.
        // Each candidate adds one workspace/date index range, bounded to eight.
        const bounds = slots.flatMap((slot) => [
          slot,
          new Date(Date.parse(slot) + 60_000).toISOString(),
        ]);
        const candidates = slots.map(() => "(?, ?)").join(", ");
        const result = await db
          .prepare(
            `WITH candidate_slots(start, finish) AS (VALUES ${candidates})
           SELECT candidate.start AS occupied FROM candidate_slots candidate
           WHERE EXISTS (
             SELECT 1 FROM creator_share_calendar_items item
             WHERE item.workspace_id=? AND item.channel='bluesky' AND item.state='scheduled'
               AND item.scheduled_at>=candidate.start AND item.scheduled_at<candidate.finish
           )`,
          )
          .bind(...bounds, workspace.id)
          .all<{ occupied: string }>();
        const occupied = new Set(
          (result.results ?? []).map((row) => row.occupied),
        );
        return {
          ok: true as const,
          action: "queueNextPreview" as const,
          nextInstant: slots.find((slot) => !occupied.has(slot)) ?? null,
        };
      }
      return view(db, workspace);
    }
    const parsed = shareCalendarCommand.safeParse(ctx.input);
    if (!parsed.success)
      return fail(
        "INVALID",
        "Choose only the declared share fields, a real time and an http or https link.",
      );
    const db = runtime.DB;
    const workspace = await resolveWorkspace(
      db,
      ctx.user,
      parsed.data.workspace ?? null,
    );
    requireCapability(workspace.role, "save");

    const command = parsed.data;
    const now = nowDate.toISOString();
    if (
      command.action === "queuePresetSave" ||
      command.action === "queuePresetDelete"
    ) {
      const ownerFailure = queueOwnerFailure(workspace);
      if (ownerFailure) return ownerFailure;
      const accountFailure = queueAccountFailure(
        command.account,
        configuredHandle,
      );
      if (accountFailure) return accountFailure;
      // The expected account matched the current configured handle, which is
      // already normalized by the same mechanism Queue Next uses.
      const account = configuredHandle as string;
      if (command.action === "queuePresetSave") {
        // One bounded, atomic statement: add a new category only while this
        // workspace/account has room, or update an existing category even at
        // the cap. A zero-change result means a new category was refused.
        const saved = await db
          .prepare(
            `INSERT INTO creator_share_queue_presets
               (workspace_id,account_handle,category,weekday,time,created_at,updated_at)
             SELECT ?,?,?,?,?,?,?
             WHERE (
               SELECT COUNT(*) FROM creator_share_queue_presets
               WHERE workspace_id=? AND account_handle=?
             ) < ?
             OR EXISTS (
               SELECT 1 FROM creator_share_queue_presets
               WHERE workspace_id=? AND account_handle=? AND category=?
             )
             ON CONFLICT(workspace_id,account_handle,category) DO UPDATE SET
               weekday=excluded.weekday,time=excluded.time,updated_at=excluded.updated_at`,
          )
          .bind(
            workspace.id,
            account,
            command.category,
            command.weekday,
            command.time,
            now,
            now,
            workspace.id,
            account,
            SHARE_QUEUE_PRESET_MAX,
            workspace.id,
            account,
            command.category,
          )
          .run();
        if (saved.meta?.changes !== 1)
          return fail(
            "INVALID",
            `You already have ${SHARE_QUEUE_PRESET_MAX} queue presets. Remove one before adding another.`,
          );
      } else {
        // Idempotent scoped deletion: a missing category leaves the list as it
        // is rather than revealing whether another scope stored that label.
        await db
          .prepare(
            `DELETE FROM creator_share_queue_presets
             WHERE workspace_id=? AND account_handle=? AND category=?`,
          )
          .bind(workspace.id, account, command.category)
          .run();
      }
      const presets = await listQueuePresets(db, workspace.id, account);
      return queueReply(workspace, account, presets);
    }
    if (command.action === "catalogueCreate") {
      if (workspace.role !== "owner")
        return fail(
          "FORBIDDEN",
          "The workspace owner can confirm reuse of Woodhouse artwork.",
        );
      const { asset } = await resolveCatalogue(command.assetId, runtime);
      if ((await cataloguePreviewHash(asset)) !== command.assetHash)
        return fail(
          "SOURCE_STALE",
          "The artwork changed. Review the current preview before saving.",
        );
      if (
        !blueskyUsage(portfolioBlueskyText(command.caption, asset)).withinLimit
      )
        return fail(
          "INVALID",
          "The caption, credit and project link together exceed Bluesky’s limit.",
        );
      const descriptor = catalogueSelectionSchema.parse({
        ...asset,
        rightsConfirmedBy: ctx.user.id,
        rightsConfirmedAt: now,
      });
      const scheduledAt = command.scheduledAt ?? null;
      const id = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO creator_share_calendar_items
         (id,workspace_id,asset_kind,bluesky_asset,channel,caption,link,scheduled_at,state,
          created_by,updated_by,created_at,updated_at)
         VALUES (?,?,'portfolio',?,'bluesky',?,?,?,?,?,?,?,?)`,
        )
        .bind(
          id,
          workspace.id,
          JSON.stringify(descriptor),
          command.caption,
          asset.projectUrl,
          scheduledAt,
          stateFor(scheduledAt),
          ctx.user.id,
          ctx.user.id,
          now,
          now,
        )
        .run();
      return view(db, workspace, id);
    }
    if (command.action === "create") {
      const source = await currentSource(db, workspace.id, command.stack);
      const problem = captionProblem(command.channel, command.caption, true);
      if (problem) return fail("INVALID", problem);
      const scheduledAt = command.scheduledAt ?? null;
      const id = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO creator_share_calendar_items
           (id,workspace_id,stack_id,stack_revision,channel,destination,caption,variants,link,scheduled_at,state,shared_at,created_by,updated_by,revision,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,'[]',?,?,?,NULL,?,?,1,?,?)`,
        )
        .bind(
          id,
          workspace.id,
          source.id,
          source.publication,
          command.channel,
          command.destination ?? "",
          command.caption,
          command.link,
          scheduledAt,
          stateFor(scheduledAt),
          ctx.user.id,
          ctx.user.id,
          now,
          now,
        )
        .run();
      return view(db, workspace, id);
    }

    const row = await selectedItem(db, workspace.id, command.item);
    // Cancellation binds the approval revision, not the item revision: it must
    // remain safe even after the text was edited.
    if (
      command.action !== "blueskyCancel" &&
      command.action !== "blueskyReconcile"
    )
      requireRevision(command.expectedRevision, row.revision);
    if (command.action === "blueskyApprove") {
      const item = { ...itemRow(row), sourceCurrent: true };
      const source = await sourceForBluesky(
        db,
        workspace.id,
        row,
        item,
        runtime,
      );
      const nowDate = new Date(now);
      const identity = await resolveBlueskyIdentity(command.handle, {
        fetch: runtime.fetch,
        now: nowDate,
      });
      if (identity.status !== "resolved")
        return fail(
          identity.status === "needs_account" ||
            identity.status === "invalid_handle"
            ? "NEEDS_OWNER"
            : "BLOCKED",
          `${identity.message} ${BLUESKY_CREDENTIAL_STATEMENT}`,
        );
      const account = blueskyAccountFromIdentity(identity);
      if (!account)
        return fail(
          "BLOCKED",
          "The public identity did not resolve to an exact account. Nothing was approved.",
        );
      const content = await createBlueskyContent(item, source, nowDate);
      if (content.problems.length)
        return fail(
          "BLOCKED",
          content.problems.map((problem) => problem.message).join(" "),
        );
      const previousRow = await selectedApproval(db, workspace.id, row.id);
      const previous = previousRow ? approvalRecord(previousRow) : null;
      let approval;
      try {
        approval = await createBlueskyApproval(content, account, {
          now: nowDate,
          previous,
        });
      } catch (error) {
        return fail(
          "BLOCKED",
          error instanceof Error
            ? error.message
            : "This Bluesky approval could not be bound. Nothing was approved.",
        );
      }
      await db
        .prepare(
          `INSERT INTO creator_share_approvals
           (item_id,workspace_id,channel,state,account_handle,account_did,draft_revision,approval_revision,text_hash,media_hash,media_revision,link,scheduled_at,binding_hash,approved_at,expires_at,cancelled_at,revoked_at,revocation_reason,created_by,updated_by,created_at,updated_at)
           VALUES (?,?,'bluesky','approved',?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,'',?,?,?,?)
           ON CONFLICT(item_id) DO UPDATE SET
             state='approved',account_handle=excluded.account_handle,account_did=excluded.account_did,
             draft_revision=excluded.draft_revision,approval_revision=excluded.approval_revision,
             text_hash=excluded.text_hash,media_hash=excluded.media_hash,media_revision=excluded.media_revision,
             link=excluded.link,scheduled_at=excluded.scheduled_at,binding_hash=excluded.binding_hash,
             approved_at=excluded.approved_at,expires_at=excluded.expires_at,
             cancelled_at=NULL,revoked_at=NULL,revocation_reason='',
             updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
        )
        .bind(
          approval.itemId,
          workspace.id,
          approval.accountHandle,
          approval.accountDid,
          approval.draftRevision,
          approval.approvalRevision,
          approval.textHash,
          approval.mediaHash,
          approval.mediaRevision,
          approval.link,
          approval.scheduledAt,
          approval.bindingHash,
          approval.approvedAt,
          approval.expiresAt,
          ctx.user.id,
          ctx.user.id,
          now,
          now,
        )
        .run();
      return view(db, workspace, row.id);
    }
    if (command.action === "blueskyCancel") {
      const current = await selectedApproval(db, workspace.id, row.id);
      if (!current)
        return fail(
          "NOT_FOUND",
          "That Bluesky approval no longer exists. Refresh before retrying.",
        );
      if (current.approval_revision !== command.expectedApprovalRevision)
        throw conflict();
      if (current.state !== "approved")
        return fail(
          "CONFLICT",
          "That Bluesky approval is already cancelled or revoked. Refresh before retrying.",
        );
      const currentDelivery = await readBlueskyDelivery(
        db,
        workspace.id,
        row.id,
        current.approval_revision,
      );
      if (currentDelivery?.state === "published")
        return fail(
          "CONFLICT",
          "This approval was already published. Cancelling consent cannot remove the post; review the saved permalink instead.",
        );
      if (
        currentDelivery?.state === "sending" ||
        currentDelivery?.state === "unknown"
      )
        return fail(
          "CONFLICT",
          "A send is in progress or has an unknown outcome. Reconcile the receipt before cancelling this approval.",
        );
      const result = await db
        .prepare(
          `UPDATE creator_share_approvals
           SET state='cancelled',cancelled_at=?,approval_revision=approval_revision+1,revocation_reason=?,updated_by=?,updated_at=?
           WHERE item_id=? AND workspace_id=? AND approval_revision=? AND state='approved'
             AND NOT EXISTS (
               SELECT 1 FROM creator_share_deliveries d
               WHERE d.item_id=creator_share_approvals.item_id
                 AND d.workspace_id=creator_share_approvals.workspace_id
                 AND d.approval_revision=creator_share_approvals.approval_revision
                 AND d.state IN ('sending','unknown','published')
             )`,
        )
        .bind(
          now,
          command.reason ?? "",
          ctx.user.id,
          now,
          row.id,
          workspace.id,
          command.expectedApprovalRevision,
        )
        .run();
      if (result.meta?.changes !== 1) throw conflict();
      // A delivery that never reached the provider is cancelled with the
      // approval. `sending`, `unknown` and `published` rows are preserved:
      // cancelling consent cannot undo a request that may already be live.
      await cancelBlueskyDelivery(
        db,
        workspace.id,
        row.id,
        command.expectedApprovalRevision,
        nowDate,
      );
      return view(db, workspace, row.id);
    }
    if (
      command.action === "blueskySend" ||
      command.action === "blueskySchedule"
    ) {
      const approvalRow = await selectedApproval(db, workspace.id, row.id);
      if (!approvalRow)
        return fail(
          "NOT_FOUND",
          "That Bluesky approval no longer exists. Refresh before sending.",
        );
      if (approvalRow.approval_revision !== command.expectedApprovalRevision)
        throw conflict();
      if (approvalRow.state !== "approved")
        return fail(
          "CONFLICT",
          "That Bluesky approval is not current. Re-approve the exact revision before sending.",
        );
      const approval = approvalRecord(approvalRow);
      if (command.action === "blueskySchedule") {
        if (workspace.role !== "owner")
          return fail(
            "FORBIDDEN",
            "Only the workspace owner can schedule automatic publishing.",
          );
        if (
          !ctx.cron ||
          !appPassword ||
          configuredHandle !== approval.accountHandle
        )
          return fail(
            "NEEDS_OWNER",
            "Connect the approved Bluesky account before scheduling.",
          );
        if (
          row.state !== "scheduled" ||
          approval.draftRevision !== row.revision ||
          approval.scheduledAt !== row.scheduled_at
        )
          throw conflict();
        if (
          Date.parse(approval.scheduledAt) <= nowDate.getTime() ||
          Date.parse(approval.expiresAt) <= Date.parse(approval.scheduledAt)
        )
          return fail(
            "BLOCKED",
            "Choose and approve a future time before scheduling.",
          );
        const delivery = await readBlueskyDelivery(
          db,
          workspace.id,
          row.id,
          approval.approvalRevision,
        );
        if (delivery)
          return fail(
            "CONFLICT",
            "This approval already has a delivery receipt.",
          );
        await ctx.cron.schedule(scheduledBlueskyName(approval), {
          schedule: approval.scheduledAt,
          data: {
            itemId: row.id,
            workspaceId: workspace.id,
            ownerId: ctx.user.id,
            approvalRevision: approval.approvalRevision,
            bindingHash: approval.bindingHash,
            scheduledAt: approval.scheduledAt,
          } satisfies ScheduledBlueskyJob,
        });
        return view(db, workspace, row.id);
      }
      const failure = await sendApprovedBluesky({
        db,
        workspaceId: workspace.id,
        row,
        approval,
        runtime,
        nowDate,
        appPassword,
        configuredHandle,
      });
      return failure ?? view(db, workspace, row.id);
    }
    if (command.action === "blueskyReconcile") {
      const approvalRow = await selectedApproval(db, workspace.id, row.id);
      if (!approvalRow)
        return fail(
          "NOT_FOUND",
          "That Bluesky approval no longer exists. Nothing was reconciled.",
        );
      if (approvalRow.approval_revision !== command.expectedApprovalRevision)
        throw conflict();
      const delivery = await readBlueskyDelivery(
        db,
        workspace.id,
        row.id,
        command.expectedApprovalRevision,
      );
      if (!delivery)
        return fail(
          "NOT_FOUND",
          "No Bluesky delivery receipt exists for that approval. Nothing was sent.",
        );
      const service = pdsOrigin(runtime);
      if (!service)
        return fail(
          "BLOCKED",
          "The configured Bluesky service address is not a plain https origin. Nothing was reconciled.",
        );
      const result = await reconcileBlueskyDelivery(
        db,
        {
          workspaceId: workspace.id,
          itemId: row.id,
          approvalRevision: command.expectedApprovalRevision,
          now: nowDate,
        },
        ({ repo, rkey }) =>
          readBlueskyPost(
            { repo, rkey },
            {
              fetch: runtime.fetch,
              service,
              timeoutMs: runtime.blueskyTimeoutMs,
            },
          ),
      );
      if (!result.ok) return fail("UNAVAILABLE", result.message);
      return view(db, workspace, row.id);
    }
    if (command.action === "xVariant") {
      if (workspace.role !== "owner")
        return fail("FORBIDDEN", "Only the workspace owner can save an X artwork draft.");
      if (!itemRow(row).catalogue)
        return fail("INVALID", "X drafts are only available for Woodhouse Share artwork.");
      // Keep the Bluesky revision and approval readable by the previous Worker.
      // The X caption has its own compare-and-swap inside the current item revision.
      const result = await db
        .prepare(
          `UPDATE creator_share_calendar_items SET x_export_caption=?
           WHERE id=? AND workspace_id=? AND asset_kind='portfolio'
             AND revision=? AND x_export_caption IS ?`,
        )
        .bind(command.caption, row.id, workspace.id, command.expectedRevision, command.expectedCaption)
        .run();
      if (result.meta?.changes !== 1) throw conflict();
      return view(db, workspace, row.id);
    }
    if (
      row.asset_kind === "portfolio" &&
      (command.action === "variant" ||
        command.action === "refresh" ||
        command.action === "shared")
    )
      return fail(
        "INVALID",
        "Use the Bluesky controls to manage this artwork draft.",
      );
    if (command.action === "save") {
      const catalogue = itemRow(row).catalogue;
      if (catalogue) {
        if (
          command.channel !== "bluesky" ||
          command.link !== catalogue.projectUrl
        )
          return fail(
            "INVALID",
            "This artwork keeps its Bluesky destination and canonical project link.",
          );
        if (
          !blueskyUsage(portfolioBlueskyText(command.caption, catalogue))
            .withinLimit
        )
          return fail(
            "INVALID",
            "The caption, credit and project link together exceed Bluesky’s limit.",
          );
      } else if (!(await sourceStillCurrent(db, workspace.id, row))) {
        throw new StackError(
          "SOURCE_STALE",
          "This stack's published revision changed. Refresh the source before editing or sharing this item.",
          409,
        );
      }
      const problem = captionProblem(command.channel, command.caption, true);
      if (problem) return fail("INVALID", problem);
      if (
        variantsFor(row).some((variant) => variant.channel === command.channel)
      )
        return fail(
          "INVALID",
          "A channel draft already exists for the new main destination. Remove that draft before moving the main caption there.",
        );
      const scheduledAt = command.scheduledAt ?? null;
      const result = await db
        .prepare(
          `UPDATE creator_share_calendar_items
           SET channel=?,destination=?,caption=?,link=?,scheduled_at=?,state=?,shared_at=NULL,updated_by=?,revision=revision+1,updated_at=?
           WHERE id=? AND workspace_id=? AND revision=?`,
        )
        .bind(
          command.channel,
          command.destination ?? row.destination ?? "",
          command.caption,
          command.link,
          scheduledAt,
          stateFor(scheduledAt),
          ctx.user.id,
          now,
          row.id,
          workspace.id,
          command.expectedRevision,
        )
        .run();
      if (result.meta?.changes !== 1) throw conflict();
      return view(db, workspace, row.id);
    }
    if (command.action === "variant") {
      if (!(await sourceStillCurrent(db, workspace.id, row)))
        throw new StackError(
          "SOURCE_STALE",
          "This stack's published revision changed. Refresh the source before editing this item.",
          409,
        );
      if (command.channel === row.channel)
        return fail(
          "INVALID",
          "The main caption already covers this channel. Edit the main caption, or choose another channel for the draft.",
        );
      const existing = variantsFor(row);
      const previous = existing.find(
        (variant) => variant.channel === command.channel,
      );
      if (command.caption === null) {
        if (!previous)
          return fail(
            "NOT_FOUND",
            "That channel draft no longer exists. Refresh before retrying.",
          );
      } else {
        const problem = captionProblem(command.channel, command.caption);
        if (problem) return fail("INVALID", problem);
        if (!previous && existing.length >= SHARE_VARIANT_MAX)
          return fail(
            "INVALID",
            "This item already has a draft for every other channel.",
          );
      }
      const next = existing
        .filter((variant) => variant.channel !== command.channel)
        .concat(
          command.caption === null
            ? []
            : [
                {
                  channel: command.channel,
                  destination:
                    command.destination ?? previous?.destination ?? "",
                  caption: command.caption,
                },
              ],
        )
        .sort(variantSort);
      const encoded = JSON.stringify(next);
      if (encoded.length > 65536)
        return fail(
          "INVALID",
          "The saved channel drafts are too large. Remove a draft before adding another.",
        );
      const result = await db
        .prepare(
          `UPDATE creator_share_calendar_items
           SET variants=?,state=?,shared_at=NULL,updated_by=?,revision=revision+1,updated_at=?
           WHERE id=? AND workspace_id=? AND revision=?`,
        )
        .bind(
          encoded,
          stateFor(row.scheduled_at),
          ctx.user.id,
          now,
          row.id,
          workspace.id,
          command.expectedRevision,
        )
        .run();
      if (result.meta?.changes !== 1) throw conflict();
      return view(db, workspace, row.id);
    }
    if (command.action === "shared") {
      if (!(await sourceStillCurrent(db, workspace.id, row)))
        throw new StackError(
          "SOURCE_STALE",
          "This stack's published revision changed. Refresh the source before recording a share.",
          409,
        );
      const result = await db
        .prepare(
          `UPDATE creator_share_calendar_items
           SET state='shared',shared_at=?,updated_by=?,revision=revision+1,updated_at=?
           WHERE id=? AND workspace_id=? AND revision=?`,
        )
        .bind(
          now,
          ctx.user.id,
          now,
          row.id,
          workspace.id,
          command.expectedRevision,
        )
        .run();
      if (result.meta?.changes !== 1) throw conflict();
      return view(db, workspace, row.id);
    }
    if (command.action === "reopen") {
      const next = stateFor(row.scheduled_at);
      const result = await db
        .prepare(
          `UPDATE creator_share_calendar_items
           SET state=?,shared_at=NULL,updated_by=?,revision=revision+1,updated_at=?
           WHERE id=? AND workspace_id=? AND revision=?`,
        )
        .bind(
          next,
          ctx.user.id,
          now,
          row.id,
          workspace.id,
          command.expectedRevision,
        )
        .run();
      if (result.meta?.changes !== 1) throw conflict();
      return view(db, workspace, row.id);
    }
    if (command.action === "refresh") {
      const source = await currentSource(db, workspace.id, row.stack_id);
      const next = stateFor(row.scheduled_at);
      const result = await db
        .prepare(
          `UPDATE creator_share_calendar_items
           SET stack_revision=?,state=?,shared_at=NULL,updated_by=?,revision=revision+1,updated_at=?
           WHERE id=? AND workspace_id=? AND revision=?`,
        )
        .bind(
          source.publication,
          next,
          ctx.user.id,
          now,
          row.id,
          workspace.id,
          command.expectedRevision,
        )
        .run();
      if (result.meta?.changes !== 1) throw conflict();
      return view(db, workspace, row.id);
    }
    if (command.action === "delete") {
      const result = await db
        .prepare(
          "DELETE FROM creator_share_calendar_items WHERE id=? AND workspace_id=? AND revision=?",
        )
        .bind(row.id, workspace.id, command.expectedRevision)
        .run();
      if (result.meta?.changes !== 1) throw conflict();
      return view(db, workspace);
    }
    return fail("INVALID", "Choose a supported share calendar action.");
  } catch (error) {
    if (error instanceof StackError) return fail(error.code, error.message);
    return fail(
      "UNAVAILABLE",
      "The share calendar could not be confirmed. Refresh before retrying.",
    );
  }
}
