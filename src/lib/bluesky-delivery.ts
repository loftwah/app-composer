// Durable Bluesky delivery contract for the share calendar (#604).
//
// The approval table records consent. This table records what Composer did
// with that consent, one row per item + approval revision. It is intentionally
// boring: public identity, the deterministic record key, the provider's AT
// URI/CID and a native permalink, plus a fixed error code/message. No token,
// app password, refresh credential or raw provider body is stored here.
//
// Claiming is a single conditional UPDATE from an unsent state to `sending`
// with the exact previous state and attempt in the predicate. D1 reports the
// number of changed rows, so exactly one caller wins. A transport failure
// during createRecord becomes `unknown`; reconciliation reads the provider by
// the deterministic rkey and resolves to `published` or `failed`. It never
// retries a timed-out send blindly.
import type { D1Database } from "@cloudflare/workers-types";
import type {
  BlueskyDeliveryRecord,
  BlueskyDeliveryState,
} from "./share-calendar.ts";
import {
  blueskyPostPermalink,
  type BlueskyReadResult,
} from "./bluesky-publisher.ts";
import { sha256Text } from "./share-approval.ts";

export const BLUESKY_DELIVERY_MAX_ATTEMPTS = 4;
export const BLUESKY_DELIVERY_STALE_MS = 10 * 60_000;

const itemIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const rkeyPattern = /^[a-zA-Z0-9._:~-]{1,512}$/;

interface DeliveryRow {
  idempotency_key: string;
  item_id: string;
  workspace_id: string;
  channel: string;
  approval_revision: number;
  account_handle: string;
  account_did: string;
  binding_hash: string;
  text_hash: string;
  rkey: string;
  state: string;
  attempt: number;
  provider_uri: string | null;
  provider_cid: string | null;
  permalink: string | null;
  error_code: string;
  error_message: string;
  claimed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const deliveryColumns =
  "idempotency_key,item_id,workspace_id,channel,approval_revision,account_handle,account_did,binding_hash,text_hash,rkey,state,attempt,provider_uri,provider_cid,permalink,error_code,error_message,claimed_at,published_at,created_at,updated_at";

export function blueskyDeliveryKey(
  itemId: string,
  approvalRevision: number,
): string {
  if (!itemIdPattern.test(itemId))
    throw Error("A Bluesky delivery needs a share item id.");
  if (!Number.isInteger(approvalRevision) || approvalRevision < 1)
    throw Error("A Bluesky delivery needs a positive approval revision.");
  return `bluesky:${itemId}:${approvalRevision}`;
}

export function blueskyDeliveryRecord(row: DeliveryRow): BlueskyDeliveryRecord {
  return {
    itemId: row.item_id,
    approvalRevision: row.approval_revision,
    state: row.state as BlueskyDeliveryState,
    attempt: row.attempt,
    accountHandle: row.account_handle,
    accountDid: row.account_did,
    rkey: row.rkey,
    providerUri: row.provider_uri,
    providerCid: row.provider_cid,
    permalink: row.permalink,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    claimedAt: row.claimed_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function readBlueskyDelivery(
  db: D1Database,
  workspaceId: string,
  itemId: string,
  approvalRevision: number,
): Promise<BlueskyDeliveryRecord | null> {
  const row = await db
    .prepare(
      `SELECT ${deliveryColumns} FROM creator_share_deliveries WHERE workspace_id=? AND item_id=? AND approval_revision=? LIMIT 1`,
    )
    .bind(workspaceId, itemId, approvalRevision)
    .first<DeliveryRow>();
  return row ? blueskyDeliveryRecord(row) : null;
}

export async function listBlueskyDeliveries(
  db: D1Database,
  workspaceId: string,
): Promise<BlueskyDeliveryRecord[]> {
  const rows = await db
    .prepare(
      `SELECT ${deliveryColumns} FROM creator_share_deliveries WHERE workspace_id=? ORDER BY item_id,approval_revision LIMIT 200`,
    )
    .bind(workspaceId)
    .all<DeliveryRow>();
  return (rows.results ?? []).map(blueskyDeliveryRecord);
}

export interface ClaimBlueskyDeliveryInput {
  itemId: string;
  workspaceId: string;
  approvalRevision: number;
  accountHandle: string;
  accountDid: string;
  bindingHash: string;
  textHash: string;
  rkey: string;
  now: Date;
  maxAttempts?: number;
  requireApproval?: boolean;
  scheduledOwner?: string;
}

export type ClaimBlueskyDeliveryResult =
  | { claimed: true; delivery: BlueskyDeliveryRecord }
  | {
      claimed: false;
      reason:
        | "published"
        | "sending"
        | "unknown"
        | "cancelled"
        | "exhausted"
        | "unavailable";
      delivery: BlueskyDeliveryRecord | null;
    };

function refusedClaim(
  row: DeliveryRow | null,
  reason: Extract<ClaimBlueskyDeliveryResult, { claimed: false }>["reason"],
): ClaimBlueskyDeliveryResult {
  return {
    claimed: false,
    reason,
    delivery: row ? blueskyDeliveryRecord(row) : null,
  };
}

function claimReason(
  state: string,
  attempt: number,
  maxAttempts: number,
): Extract<ClaimBlueskyDeliveryResult, { claimed: false }>["reason"] {
  if (state === "published") return "published";
  if (state === "sending") return "sending";
  if (state === "unknown") return "unknown";
  if (state === "cancelled") return "cancelled";
  if (state === "approved" || state === "failed" || state === "needs_auth")
    return attempt >= maxAttempts ? "exhausted" : "unavailable";
  return "unavailable";
}

// Insert-if-absent, then claim with an exact state/attempt predicate. The
// insert is what gives a first send an `approved` row to claim; an existing row
// is never reset to `approved`, so a published or unknown receipt cannot be
// turned back into a fresh send here.
export async function claimBlueskyDelivery(
  db: D1Database,
  input: ClaimBlueskyDeliveryInput,
): Promise<ClaimBlueskyDeliveryResult> {
  const key = blueskyDeliveryKey(input.itemId, input.approvalRevision);
  if (!rkeyPattern.test(input.rkey))
    throw Error("A Bluesky delivery needs a valid record key.");
  const now = input.now.toISOString();
  const maxAttempts = Math.min(
    10,
    Math.max(1, input.maxAttempts ?? BLUESKY_DELIVERY_MAX_ATTEMPTS),
  );
  await db
    .prepare(
      `INSERT INTO creator_share_deliveries
       (idempotency_key,item_id,workspace_id,channel,approval_revision,account_handle,account_did,binding_hash,text_hash,rkey,state,attempt,provider_uri,provider_cid,permalink,error_code,error_message,claimed_at,published_at,created_at,updated_at)
       VALUES (?,?,?,'bluesky',?,?,?,?,?,?,'approved',0,NULL,NULL,NULL,'','',NULL,NULL,?,?)
       ON CONFLICT(idempotency_key) DO NOTHING`,
    )
    .bind(
      key,
      input.itemId,
      input.workspaceId,
      input.approvalRevision,
      input.accountHandle,
      input.accountDid,
      input.bindingHash,
      input.textHash,
      input.rkey,
      now,
      now,
    )
    .run();
  const existing = await db
    .prepare(
      `SELECT ${deliveryColumns} FROM creator_share_deliveries WHERE idempotency_key=?`,
    )
    .bind(key)
    .first<DeliveryRow>();
  if (!existing) return refusedClaim(null, "unavailable");
  if (
    existing.state !== "approved" &&
    existing.state !== "failed" &&
    existing.state !== "needs_auth"
  )
    return refusedClaim(
      existing,
      claimReason(existing.state, existing.attempt, maxAttempts),
    );
  if (existing.attempt >= maxAttempts)
    return refusedClaim(existing, "exhausted");
  // Recheck consent atomically after the network-dependent source checks.
  // Automatic sends also require the authorising owner and a first attempt.
  const approvalFence = input.requireApproval || input.scheduledOwner
    ? `AND EXISTS (
       SELECT 1 FROM creator_share_approvals a
       JOIN creator_share_calendar_items i ON i.id=a.item_id AND i.workspace_id=a.workspace_id
       WHERE a.item_id=? AND a.workspace_id=? AND a.approval_revision=?
         AND a.state='approved' AND a.binding_hash=?
         AND a.draft_revision=i.revision AND a.scheduled_at=i.scheduled_at
         AND a.scheduled_at<=? AND a.expires_at>?
         ${input.scheduledOwner ? `AND i.state='scheduled' AND EXISTS (
           SELECT 1 FROM creator_members m
           WHERE m.workspace_id=a.workspace_id AND m.user_id=? AND m.role='owner'
         )` : ""}
     ) ${input.scheduledOwner ? "AND attempt=0" : ""}`
    : "";
  const result = await db
    .prepare(
      `UPDATE creator_share_deliveries
       SET state='sending',attempt=attempt+1,claimed_at=?,updated_at=?,error_code='',error_message=''
       WHERE idempotency_key=? AND state=? AND attempt=? AND provider_uri IS NULL
       ${approvalFence}`,
    )
    .bind(
      now,
      now,
      key,
      existing.state,
      existing.attempt,
      ...(approvalFence
        ? [
            input.itemId,
            input.workspaceId,
            input.approvalRevision,
            input.bindingHash,
            now,
            now,
            ...(input.scheduledOwner ? [input.scheduledOwner] : []),
          ]
        : []),
    )
    .run();
  if (result.meta?.changes !== 1) {
    const current = await db
      .prepare(
        `SELECT ${deliveryColumns} FROM creator_share_deliveries WHERE idempotency_key=?`,
      )
      .bind(key)
      .first<DeliveryRow>();
    return refusedClaim(
      current,
      current
        ? claimReason(current.state, current.attempt, maxAttempts)
        : "unavailable",
    );
  }
  const claimed = await db
    .prepare(
      `SELECT ${deliveryColumns} FROM creator_share_deliveries WHERE idempotency_key=?`,
    )
    .bind(key)
    .first<DeliveryRow>();
  return claimed
    ? { claimed: true, delivery: blueskyDeliveryRecord(claimed) }
    : refusedClaim(null, "unavailable");
}

async function finishDelivery(
  db: D1Database,
  key: string,
  from: string,
  values: {
    state: BlueskyDeliveryState;
    errorCode: string;
    errorMessage: string;
    providerUri?: string | null;
    providerCid?: string | null;
    permalink?: string | null;
    publishedAt?: string | null;
    now: Date;
  },
): Promise<BlueskyDeliveryRecord | null> {
  const now = values.now.toISOString();
  const result = await db
    .prepare(
      `UPDATE creator_share_deliveries
       SET state=?,error_code=?,error_message=?,
           provider_uri=COALESCE(?,provider_uri),
           provider_cid=COALESCE(?,provider_cid),
           permalink=COALESCE(?,permalink),
           published_at=COALESCE(?,published_at),
           updated_at=?
       WHERE idempotency_key=? AND state=?`,
    )
    .bind(
      values.state,
      values.errorCode.slice(0, 80),
      values.errorMessage.slice(0, 280),
      values.providerUri ?? null,
      values.providerCid ?? null,
      values.permalink ?? null,
      values.publishedAt ?? null,
      now,
      key,
      from,
    )
    .run();
  if (result.meta?.changes !== 1) return null;
  const row = await db
    .prepare(
      `SELECT ${deliveryColumns} FROM creator_share_deliveries WHERE idempotency_key=?`,
    )
    .bind(key)
    .first<DeliveryRow>();
  return row ? blueskyDeliveryRecord(row) : null;
}

export async function markBlueskyDeliveryPublished(
  db: D1Database,
  key: string,
  input: {
    uri: string;
    cid: string;
    permalink: string;
    now: Date;
  },
): Promise<BlueskyDeliveryRecord | null> {
  return finishDelivery(db, key, "sending", {
    state: "published",
    errorCode: "",
    errorMessage: "",
    providerUri: input.uri,
    providerCid: input.cid,
    permalink: input.permalink,
    publishedAt: input.now.toISOString(),
    now: input.now,
  });
}

export async function markBlueskyDeliveryFailed(
  db: D1Database,
  key: string,
  input: { code: string; message: string; now: Date },
): Promise<BlueskyDeliveryRecord | null> {
  return finishDelivery(db, key, "sending", {
    state: "failed",
    errorCode: input.code,
    errorMessage: input.message,
    now: input.now,
  });
}

export async function markBlueskyDeliveryNeedsAuth(
  db: D1Database,
  key: string,
  input: { message: string; now: Date },
): Promise<BlueskyDeliveryRecord | null> {
  return finishDelivery(db, key, "sending", {
    state: "needs_auth",
    errorCode: "needs_auth",
    errorMessage: input.message,
    now: input.now,
  });
}

export async function markBlueskyDeliveryUnknown(
  db: D1Database,
  key: string,
  input: { code: string; message: string; now: Date },
): Promise<BlueskyDeliveryRecord | null> {
  return finishDelivery(db, key, "sending", {
    state: "unknown",
    errorCode: input.code,
    errorMessage: input.message,
    now: input.now,
  });
}

// Cancellation only applies to a delivery that never reached the provider.
// `sending`, `unknown` and `published` are preserved: Composer cannot undo a
// request that may already be live.
export async function cancelBlueskyDelivery(
  db: D1Database,
  workspaceId: string,
  itemId: string,
  approvalRevision: number,
  now: Date,
): Promise<boolean> {
  const key = blueskyDeliveryKey(itemId, approvalRevision);
  const at = now.toISOString();
  const result = await db
    .prepare(
      `UPDATE creator_share_deliveries
       SET state='cancelled',error_code='cancelled',error_message=?,updated_at=?
       WHERE idempotency_key=? AND workspace_id=?
         AND state IN ('approved','failed','needs_auth')`,
    )
    .bind(
      "The owner cancelled this delivery before it reached the provider.",
      at,
      key,
      workspaceId,
    )
    .run();
  return result.meta?.changes === 1;
}

export interface ReconcileBlueskyDeliveryInput {
  workspaceId: string;
  itemId: string;
  approvalRevision: number;
  now: Date;
  staleAfterMs?: number;
}

export interface ReconcileBlueskyDeliveryResult {
  ok: boolean;
  changed: boolean;
  delivery: BlueskyDeliveryRecord | null;
  message: string;
}

// Resolve an ambiguous send by reading the deterministic record key. This is
// the only path that turns `unknown` into a terminal receipt.
export async function reconcileBlueskyDelivery(
  db: D1Database,
  input: ReconcileBlueskyDeliveryInput,
  read: (request: { repo: string; rkey: string }) => Promise<BlueskyReadResult>,
): Promise<ReconcileBlueskyDeliveryResult> {
  const key = blueskyDeliveryKey(input.itemId, input.approvalRevision);
  const row = await db
    .prepare(
      `SELECT ${deliveryColumns} FROM creator_share_deliveries WHERE idempotency_key=? AND workspace_id=? LIMIT 1`,
    )
    .bind(key, input.workspaceId)
    .first<DeliveryRow>();
  if (!row)
    return {
      ok: false,
      changed: false,
      delivery: null,
      message:
        "No Bluesky delivery receipt exists for that approval. Nothing was sent.",
    };
  if (row.state !== "unknown" && row.state !== "sending")
    return {
      ok: true,
      changed: false,
      delivery: blueskyDeliveryRecord(row),
      message:
        row.state === "published"
          ? "This delivery is already published."
          : "This delivery has no ambiguous receipt to reconcile.",
    };
  if (row.state === "sending") {
    const claimed = row.claimed_at ? Date.parse(row.claimed_at) : NaN;
    const staleAfter = Math.max(
      60_000,
      input.staleAfterMs ?? BLUESKY_DELIVERY_STALE_MS,
    );
    if (!Number.isFinite(claimed) || input.now.getTime() - claimed < staleAfter)
      return {
        ok: false,
        changed: false,
        delivery: blueskyDeliveryRecord(row),
        message:
          "This send is still in progress. Wait for its lease to expire before reconciling.",
      };
  }
  const readback = await read({ repo: row.account_did, rkey: row.rkey });
  if (!readback.ok)
    return {
      ok: false,
      changed: false,
      delivery: blueskyDeliveryRecord(row),
      message: `${readback.message} The receipt stays unknown; no retry was made.`,
    };
  const permalink = blueskyPostPermalink(row.account_handle, row.rkey);
  if (!readback.record.found) {
    const delivery = await finishDelivery(db, key, row.state, {
      state: "failed",
      errorCode: "record_not_found",
      errorMessage:
        "The provider has no record at this deterministic key. Nothing was published.",
      now: input.now,
    });
    return {
      ok: true,
      changed: Boolean(delivery),
      delivery:
        delivery ??
        (await readBlueskyDelivery(
          db,
          input.workspaceId,
          input.itemId,
          input.approvalRevision,
        )),
      message: delivery
        ? "Reconciled: the provider has no record at this key, so the delivery failed."
        : "Another worker resolved this receipt first.",
    };
  }
  const textHash = await sha256Text(readback.record.text);
  if (!readback.record.cid || !permalink) {
    return {
      ok: false,
      changed: false,
      delivery: blueskyDeliveryRecord(row),
      message:
        "A provider record exists at this key but its CID or permalink could not be verified. The receipt stays unknown; review the profile before any retry.",
    };
  }
  if (textHash !== row.text_hash) {
    const delivery = await finishDelivery(db, key, row.state, {
      state: "failed",
      errorCode: "content_mismatch",
      errorMessage:
        "A provider record exists at this key but its text does not match the approval. Review it on Bluesky; Composer will not retry.",
      providerUri: readback.record.uri,
      providerCid: readback.record.cid,
      permalink,
      now: input.now,
    });
    return {
      ok: true,
      changed: Boolean(delivery),
      delivery:
        delivery ??
        (await readBlueskyDelivery(
          db,
          input.workspaceId,
          input.itemId,
          input.approvalRevision,
        )),
      message: delivery
        ? "Reconciled: a record exists but does not match the approved text. Review it before any new approval."
        : "Another worker resolved this receipt first.",
    };
  }
  const delivery = await finishDelivery(db, key, row.state, {
    state: "published",
    errorCode: "",
    errorMessage: "",
    providerUri: readback.record.uri,
    providerCid: readback.record.cid,
    permalink,
    publishedAt: input.now.toISOString(),
    now: input.now,
  });
  return {
    ok: true,
    changed: Boolean(delivery),
    delivery:
      delivery ??
      (await readBlueskyDelivery(
        db,
        input.workspaceId,
        input.itemId,
        input.approvalRevision,
      )),
    message: delivery
      ? "Reconciled: the provider record matches the approval, so it is published."
      : "Another worker resolved this receipt first.",
  };
}
