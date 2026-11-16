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
  shareCalendarCommand,
  shareCalendarReadInput,
  shareCalendarSnapshot,
  shareCalendarVariantSchema,
  sqliteInstant,
  variantSort,
  SHARE_VARIANT_MAX,
  type BlueskyApprovalRecord,
  type ShareCalendarItem,
  type ShareCalendarSnapshot,
  type ShareCalendarSource,
  type ShareCalendarVariant,
} from "./share-calendar.ts";
import {
  BLUESKY_CREDENTIAL_STATEMENT,
  configuredBlueskyHandle,
  resolveBlueskyIdentity,
} from "./bluesky-account.ts";
import {
  blueskyAccountFromIdentity,
  createBlueskyApproval,
  createBlueskyContent,
} from "./share-approval.ts";

export interface ShareCalendarRuntime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  SHARE_BLUESKY_HANDLE?: unknown;
  fetch?: typeof globalThis.fetch;
}

interface User {
  id: string;
  role: number;
}
interface Context {
  user?: User;
  request: Request;
  input: unknown;
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
  stack_id: string;
  stack_name: string;
  stack_slug: string;
  stack_revision: number;
  channel: string;
  destination: string;
  caption: string;
  variants: string;
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
  return shareCalendarVariantSchema
    .array()
    .max(SHARE_VARIANT_MAX)
    .parse(parsed) as ShareCalendarVariant[];
}

function itemRow(row: ItemRow): ShareCalendarItem {
  return {
    id: row.id,
    stack: row.stack_id,
    stackName: row.stack_name,
    stackSlug: row.stack_slug,
    publication: row.stack_revision,
    sourceCurrent: false,
    channel: row.channel as ShareCalendarItem["channel"],
    destination: row.destination ?? "",
    caption: row.caption,
    variants: variantsFor(row),
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
): Promise<ShareCalendarSnapshot> {
  const sources = await listSources(db, workspace.id);
  const rows = await db
    .prepare(
      `SELECT i.id,i.stack_id,i.stack_revision,i.channel,i.destination,i.caption,i.variants,i.link,i.scheduled_at,i.state,i.shared_at,i.revision,i.created_at,i.updated_at,s.name AS stack_name,s.slug AS stack_slug
       FROM creator_share_calendar_items i
       JOIN creator_stacks s ON s.id=i.stack_id
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
  const current = new Map(
    sources.map((source) => [source.id, source.publication]),
  );
  return shareCalendarSnapshot.parse({
    ok: true,
    workspace,
    sources,
    items: (rows.results ?? []).map((row) => ({
      ...itemRow(row),
      sourceCurrent: current.get(row.stack_id) === row.stack_revision,
    })),
    approvals: (approvalRows.results ?? []).map(approvalRecord),
    bluesky: { configuredHandle },
    now: new Date().toISOString(),
    changed,
  });
}

async function currentSource(
  db: D1Database,
  workspaceId: string,
  stack: string,
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
      `SELECT i.id,i.stack_id,i.stack_revision,i.channel,i.destination,i.caption,i.variants,i.link,i.scheduled_at,i.state,i.shared_at,i.revision,i.created_at,i.updated_at,s.name AS stack_name,s.slug AS stack_slug
       FROM creator_share_calendar_items i
       JOIN creator_stacks s ON s.id=i.stack_id
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

export async function manageShareCalendar(
  ctx: Context,
  runtime: ShareCalendarRuntime,
) {
  if (!ctx.user || !isCreatorRole(ctx.user.role) || !ctx.user.id)
    return fail("FORBIDDEN", "A signed-in Composer creator is required.");
  if (runtime.PUBLIC_ORIGIN !== origin || !database(runtime.DB))
    return unavailable();
  const configuredHandle = configuredBlueskyHandle(runtime);
  const view = (
    db: D1Database,
    workspace: Workspace,
    changed: string | null = null,
  ) => snapshot(db, workspace, changed, configuredHandle);
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
      if (parsedRead.data.action === "blueskyIdentity") {
        const requested = parsedRead.data.handle?.trim();
        const result = await resolveBlueskyIdentity(
          requested ? requested : configuredHandle,
          { fetch: runtime.fetch, now: new Date() },
        );
        return { ok: true as const, action: "blueskyIdentity", result };
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
    const now = new Date().toISOString();
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
    if (command.action !== "blueskyCancel")
      requireRevision(command.expectedRevision, row.revision);
    if (command.action === "blueskyApprove") {
      if (!(await sourceStillCurrent(db, workspace.id, row)))
        throw new StackError(
          "SOURCE_STALE",
          "This stack's published revision changed. Refresh the source before approving a Bluesky draft.",
          409,
        );
      const source = await currentSource(db, workspace.id, row.stack_id);
      if (source.publication !== row.stack_revision)
        throw new StackError(
          "SOURCE_STALE",
          "This stack's published revision changed. Refresh the source before approving a Bluesky draft.",
          409,
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
      const item = { ...itemRow(row), sourceCurrent: true };
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
      const result = await db
        .prepare(
          `UPDATE creator_share_approvals
           SET state='cancelled',cancelled_at=?,approval_revision=approval_revision+1,revocation_reason=?,updated_by=?,updated_at=?
           WHERE item_id=? AND workspace_id=? AND approval_revision=? AND state='approved'`,
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
      return view(db, workspace, row.id);
    }
    if (command.action === "save") {
      if (!(await sourceStillCurrent(db, workspace.id, row)))
        throw new StackError(
          "SOURCE_STALE",
          "This stack's published revision changed. Refresh the source before editing or sharing this item.",
          409,
        );
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
