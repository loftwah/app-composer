import type { D1Database } from "@cloudflare/workers-types";
import { StackError } from "./stacks.mjs";
import type { EnquiryItem } from "./enquiry-protocol.ts";
import {
  replyLimits,
  replySubject,
  replyView,
  type ManualExport,
  type ReplyCommand,
  type ReplyView,
} from "./enquiry-reply-contract.ts";

// A reply job stores Composer's own draft and receipt. It never copies the
// enquiry body, never stores the consented address and never contacts a
// provider: the only dispatch this slice ships is an explicit manual export.
export interface ReplyScope {
  workspace: string;
  resource: string;
  account: string;
  environment: string;
  target: string;
}
interface Actor {
  id: string;
}
interface JobRow {
  id: string;
  workspace_id: string;
  resource_id: string;
  item_id: string;
  item_revision: number;
  source_digest: string;
  account_id: string;
  environment: string;
  target: string;
  consent_version: number;
  consent_at: string;
  consent_expires_at: string;
  recipient_digest: string;
  state: "draft" | "approved" | "exported" | "invalidated" | "declined";
  generator: "owner" | "agent";
  generator_id: string;
  draft_body: string;
  draft_digest: string;
  draft_revision: number;
  approval_id: string | null;
  approval_digest: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_expires_at: string | null;
  exported_at: string | null;
  reason: string;
  actor_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
}
interface EventRow {
  kind: "draft" | "approved" | "exported" | "invalidated" | "declined";
  at: string;
  actor_id: string;
  draft_revision: number;
  digest: string;
  reason: string;
}
export type ReplyConsent =
  | {
      ok: true;
      version: 2;
      consentedAt: string;
      expiresAt: string;
      recipient: string;
      recipientDigest: string;
    }
  | { ok: false; expired: boolean; reason: string };

const approvalWindow = 24 * 60 * 60 * 1000;
const email = /^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/;
const date = () => new Date().toISOString();
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, entry]) => entry !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => [key, canonical(entry)]),
        )
      : value;
const digest = async (value: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

/** Stored timestamps are UTC. A value without a zone is read as UTC, matching
 * the enquiry export and the native Inbox display. */
function instant(value: string) {
  const text = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    ? value
    : value.replace(" ", "T") + "Z";
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** Plain text only: normalise standard line breaks and remove surrounding
 * whitespace. Unsupported control characters are refused by the contract. */
export function normaliseReplyBody(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/** The exact brief revision and text a draft was prepared from. */
async function sourceDigestFor(item: EnquiryItem) {
  return digest(
    JSON.stringify(
      canonical({
        id: item.id,
        revision: item.revision,
        configuration: item.configuration_revision,
        provenance: item.provenance,
        producer: item.producer_source,
        values: item.values,
        consent: item.consent_version,
        consentAt: item.consent_at,
      }),
    ),
  );
}

/** Reply consent comes only from the versioned consented form export. A v1
 * no-contact item has no reply object, so this returns null and no reply
 * action is ever offered. */
export async function replyConsentFor(
  item: EnquiryItem,
): Promise<ReplyConsent | null> {
  if (!item.reply) return null;
  const consent = item.reply;
  if (consent.version !== 2 || !email.test(consent.recipient))
    return {
      ok: false,
      expired: false,
      reason:
        "The app returned reply consent this build cannot verify. No reply is offered.",
    };
  const consented = instant(consent.consented_at),
    expires = instant(consent.expires_at);
  if (!Number.isFinite(consented) || !Number.isFinite(expires))
    return {
      ok: false,
      expired: false,
      reason:
        "The app returned reply consent with an unreadable timestamp. No reply is offered.",
    };
  if (expires <= Date.now())
    return {
      ok: false,
      expired: true,
      reason:
        "Reply consent expired on " +
        consent.expires_at +
        ". This brief still offers no reply.",
    };
  return {
    ok: true,
    version: 2,
    consentedAt: consent.consented_at,
    expiresAt: consent.expires_at,
    recipient: consent.recipient,
    recipientDigest: await digest(consent.recipient.trim().toLowerCase()),
  };
}

const jobFor = (
  db: D1Database,
  scope: ReplyScope,
  item: string,
): Promise<JobRow | null> =>
  db
    .prepare(
      "SELECT * FROM creator_enquiry_reply_jobs WHERE workspace_id=? AND resource_id=? AND item_id=? AND account_id=? AND environment=?",
    )
    .bind(
      scope.workspace,
      scope.resource,
      item,
      scope.account,
      scope.environment,
    )
    .first<JobRow>();

/** Best-effort job creation when an accepted receipt links to exactly one
 * consented v2 brief. A duplicate link or relink inserts nothing. This stores
 * no body and no recipient address; the first draft fills the revision. */
export async function ensureReplyJob(
  db: D1Database,
  scope: ReplyScope,
  item: EnquiryItem,
) {
  if (!item.reply || item.status === "rejected") return;
  const consent = await replyConsentFor(item);
  if (!consent?.ok) return;
  const source = await sourceDigestFor(item),
    now = date();
  await db
    .prepare(
      "INSERT INTO creator_enquiry_reply_jobs(id,workspace_id,resource_id,item_id,item_revision,source_digest,account_id,environment,target,consent_version,consent_at,consent_expires_at,recipient_digest,state,generator,generator_id,draft_body,draft_digest,draft_revision,reason,actor_id,revision,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,2,?,?,?,'draft','owner','','','',0,'','receipt',1,?,? WHERE EXISTS(SELECT 1 FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook' AND account_id=? AND environment=? AND target=? AND state='ready') ON CONFLICT(workspace_id,resource_id,item_id,account_id,environment) DO NOTHING",
    )
    .bind(
      crypto.randomUUID(),
      scope.workspace,
      scope.resource,
      item.id,
      item.revision,
      source,
      scope.account,
      scope.environment,
      scope.target,
      consent.consentedAt,
      consent.expiresAt,
      consent.recipientDigest,
      now,
      now,
      scope.resource,
      scope.workspace,
      scope.account,
      scope.environment,
      scope.target,
    )
    .run();
}

function checkJob(job: JobRow, scope: ReplyScope) {
  if (
    job.workspace_id !== scope.workspace ||
    job.resource_id !== scope.resource ||
    job.target !== scope.target
  )
    throw new StackError(
      "UNAVAILABLE",
      "This reply job belongs to another or changed app connection. Refresh the Inbox.",
    );
}

async function insertEvent(
  db: D1Database,
  job: JobRow,
  kind: EventRow["kind"],
  actor: string,
  reason: string,
  unique = false,
) {
  await db
    .prepare(
      (unique ? "INSERT OR IGNORE" : "INSERT") +
        " INTO creator_enquiry_reply_events(id,job_id,kind,draft_revision,digest,approval_id,actor_id,reason,at) VALUES(?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      crypto.randomUUID(),
      job.id,
      kind,
      job.draft_revision,
      job.draft_digest,
      job.approval_id,
      actor,
      reason,
      date(),
    )
    .run();
}

async function timeline(db: D1Database, job: JobRow) {
  const rows = await db
    .prepare(
      "SELECT kind,at,actor_id,draft_revision,digest,reason FROM creator_enquiry_reply_events WHERE job_id=? ORDER BY at DESC,id DESC LIMIT ?",
    )
    .bind(job.id, replyLimits.timeline)
    .all<EventRow>();
  return rows.results.reverse().map((row) => ({
    kind: row.kind,
    at: row.at,
    actorId: row.actor_id,
    draftRevision: row.draft_revision,
    digest: row.digest ? row.digest.slice(0, 12) : null,
    reason: row.reason,
  }));
}

async function approvalDigestFor(input: {
  approvalId: string;
  job: JobRow;
  item: EnquiryItem;
  itemRevision: number;
  sourceDigest: string;
  draftRevision: number;
  draftDigest: string;
  scope: ReplyScope;
  owner: string;
  recipientDigest: string;
  approvedAt: string;
  approvalExpiresAt: string;
}) {
  return digest(
    JSON.stringify(
      canonical({
        approval: input.approvalId,
        job: input.job.id,
        item: input.item.id,
        itemRevision: input.itemRevision,
        source: input.sourceDigest,
        draftRevision: input.draftRevision,
        draft: input.draftDigest,
        scope: input.scope,
        owner: input.owner,
        consentVersion: 2,
        consentAt: input.item.reply?.consented_at,
        consentExpiresAt: input.item.reply?.expires_at,
        recipient: input.recipientDigest,
        approvedAt: input.approvedAt,
        approvalExpiresAt: input.approvalExpiresAt,
      }),
    ),
  );
}

/** The owner-facing reply state. It is separate from the owner-notice workflow
 * and delivery states: an exported reply never becomes "sent". */
export async function replyJourney(
  db: D1Database,
  scope: ReplyScope,
  item: EnquiryItem,
  role: "owner" | "editor" | "viewer",
): Promise<ReplyView> {
  const consent = await replyConsentFor(item);
  const job = await jobFor(db, scope, item.id);
  const consentView = item.reply
    ? {
        version: 2 as const,
        consentedAt: item.reply.consented_at,
        expiresAt: item.reply.expires_at,
        expired: Boolean(consent && !consent.ok && consent.expired),
        recipientFingerprint: (
          await digest(item.reply.recipient.trim().toLowerCase())
        ).slice(0, 12),
      }
    : null;
  if (job) checkJob(job, scope);
  const events = job ? await timeline(db, job) : [];
  const currentSource = await sourceDigestFor(item);
  const bodyIntact =
    job && job.draft_revision > 0
      ? (await digest(job.draft_body)) === job.draft_digest
      : true;
  const owner = role === "owner";
  const editing = role !== "viewer";
  const base = job
    ? {
        source: {
          itemRevision: job.item_revision,
          digest: job.source_digest,
        },
        draft: job?.draft_revision
          ? {
              revision: job.draft_revision,
              body: job.draft_body,
              digest: job.draft_digest,
              generator: job.generator,
              generatorId: job.generator_id || null,
              updatedAt: job.updated_at,
            }
          : null,
        approval:
          job.approval_id &&
          job.approval_digest &&
          job.approved_by &&
          job.approved_at &&
          job.approval_expires_at
            ? {
                id: job.approval_id,
                digest: job.approval_digest,
                approvedAt: job.approved_at,
                approvedBy: job.approved_by,
                expiresAt: job.approval_expires_at,
              }
            : null,
        receipt:
          job.state === "exported" &&
          job.exported_at &&
          job.approval_id &&
          job.approval_digest
            ? {
                id: job.approval_id,
                exportedAt: job.exported_at,
                method: "manual-export" as const,
                sent: false as const,
                draftDigest: job.draft_digest,
                approvalDigest: job.approval_digest,
              }
            : null,
        timeline: events,
      }
    : {
        source: null,
        draft: null,
        approval: null,
        receipt: null,
        timeline: [],
      };

  const none = (reason: string, eligible = false) => ({
    eligible,
    state: "unavailable" as const,
    reason,
    consent: consentView,
    ...base,
    next: {
      kind: "none" as const,
      label: "No reply action",
      detail:
        "No reply action is offered for this brief. The retained enquiry and its review state are unchanged.",
      actor: "none" as const,
      enabled: false,
    },
  });

  if (!consent)
    return replyView.parse(
      none(
        "This form did not ask for consent to send a reply. The no-contact enquiry offers review and owner notice only; no reply action is available.",
      ),
    );
  if (!consent.ok && !(job?.state === "exported"))
    return replyView.parse(
      none(
        consent.reason +
          " No reply draft or approval can be used until a form with current reply consent is submitted.",
      ),
    );
  if (item.status === "rejected" && job?.state !== "exported")
    return replyView.parse(
      none(
        "The brief was rejected. No reply action is offered; the retained record and its workflow state are unchanged.",
      ),
    );
  if (!job || job.draft_revision === 0) {
    if (!consent.ok) return replyView.parse(none(consent.reason));
    return replyView.parse({
      eligible: true,
      state: "draft",
      reason: job
        ? "A reply job is ready for this exact brief. No draft is saved yet; write or paste a draft, then approve the exact text before any export."
        : "No reply draft is saved yet. Write or paste a draft, then approve the exact text before any export.",
      consent: consentView,
      source: job
        ? { itemRevision: job.item_revision, digest: job.source_digest }
        : null,
      draft: null,
      approval: null,
      receipt: null,
      timeline: job ? events : [],
      next: {
        kind: "draft",
        label: "Save a reply draft",
        detail:
          "The draft is bound to this exact brief revision and its consented recipient. Saving a draft sends nothing.",
        actor: "owner-or-editor",
        enabled: editing,
      },
    });
  }

  if (job.state === "exported") {
    if (!consent.ok)
      return replyView.parse({
        eligible: false,
        state: "exported",
        reason:
          "Exported for manual sending on " +
          job.exported_at +
          ". Composer did not send this reply. Reply consent has since expired, so no new reply is offered.",
        consent: consentView,
        ...base,
        next: {
          kind: "none",
          label: "No reply action",
          detail:
            "The receipt is retained. Composer did not send this reply and will not send it again.",
          actor: "none",
          enabled: false,
        },
      });
    return replyView.parse({
      eligible: true,
      state: "exported",
      reason:
        "Exported for manual sending on " +
        job.exported_at +
        ". Composer did not send this reply. The receipt below is the record of that handoff." +
        (job.recipient_digest !== consent.recipientDigest
          ? " The consented address has changed since export; this receipt belongs to the original approval."
          : "") +
        (job.source_digest !== currentSource
          ? " The brief changed since export; the receipt remains, but its manual subject is derived from the current brief."
          : ""),
      consent: consentView,
      ...base,
      next: {
        kind: "none",
        label: "No reply action",
        detail:
          "The receipt is retained. Composer did not send this reply and will not send it again.",
        actor: "none",
        enabled: false,
      },
    });
  }
  if (job.state === "declined")
    return replyView.parse({
      eligible: true,
      state: "declined",
      reason:
        job.reason ||
        "This reply was declined before export. No message was sent.",
      consent: consentView,
      ...base,
      next: {
        kind: "none",
        label: "No reply action",
        detail:
          "The declined reply stays in the record. Composer did not send it and will not send it automatically.",
        actor: "none",
        enabled: false,
      },
    });

  const stale = !consent.ok
    ? consent.reason
    : !bodyIntact
      ? "The saved reply text does not match its recorded digest. Save the draft again before approval."
      : job.item_revision !== item.revision ||
          job.source_digest !== currentSource
        ? "The brief changed after this draft was saved. Save an updated draft before approval."
        : job.recipient_digest !== consent.recipientDigest ||
            job.consent_at !== consent.consentedAt ||
            job.consent_expires_at !== consent.expiresAt
          ? "The consented reply address or consent record changed. Save the draft again before approval."
          : "";
  if (stale)
    return replyView.parse({
      eligible: Boolean(consent.ok),
      state: "invalidated",
      reason: stale,
      consent: consentView,
      ...base,
      receipt: null,
      next: {
        kind: "draft",
        label: "Save an updated draft",
        detail:
          "The saved draft stays visible, but it can no longer be approved against the current brief or consent. Saving a new draft records a new revision.",
        actor: "owner-or-editor",
        enabled: editing,
      },
    });
  if (job.state === "draft")
    return replyView.parse({
      eligible: true,
      state: "draft",
      reason:
        "A draft is saved. It has not been approved and no message was sent. The owner must approve the exact text.",
      consent: consentView,
      ...base,
      next: {
        kind: "approve",
        label: "Approve the exact reply",
        detail: owner
          ? "Approving binds this exact draft revision, the brief revision, the consented recipient and this sender scope. It sends nothing."
          : "Only the workspace owner can approve or export a reply. An editor can prepare the draft.",
        actor: "owner",
        enabled: owner,
      },
    });
  if (job.state === "invalidated")
    return replyView.parse({
      eligible: true,
      state: "draft",
      reason:
        job.reason ||
        "The previous approval is no longer valid. Review the current draft and approve it again.",
      consent: consentView,
      ...base,
      receipt: null,
      next: {
        kind: "approve",
        label: "Approve the current draft",
        detail: owner
          ? "The previous approval cannot be replayed. Approving the current text records a new approval and sends nothing."
          : "Only the workspace owner can approve or export a reply.",
        actor: "owner",
        enabled: owner,
      },
    });
  // Approved.
  const expired =
    Boolean(job.approval_expires_at) &&
    instant(job.approval_expires_at!) <= Date.now();
  if (expired)
    return replyView.parse({
      eligible: true,
      state: "invalidated",
      reason:
        "The approval expired before export. Approve the current draft again; nothing was sent.",
      consent: consentView,
      ...base,
      receipt: null,
      next: {
        kind: "approve",
        label: "Approve the current draft",
        detail: owner
          ? "The expired approval cannot be replayed. Review the exact text and approve it again."
          : "Only the workspace owner can approve or export a reply.",
        actor: "owner",
        enabled: owner,
      },
    });
  return replyView.parse({
    eligible: true,
    state: "approved",
    reason:
      "Approved on " +
      job.approved_at +
      ". No email was sent. Exporting records a manual handoff of this exact text.",
    consent: consentView,
    ...base,
    next: {
      kind: "export",
      label: "Export the approved reply",
      detail: owner
        ? "This records a manual export for the owner to send. Composer does not contact a provider and the receipt says it was not sent."
        : "Only the workspace owner can export an approved reply.",
      actor: "owner",
      enabled: owner,
    },
  });
}

async function currentConsent(item: EnquiryItem) {
  const consent = await replyConsentFor(item);
  if (!consent || !consent.ok)
    throw new StackError(
      "FORBIDDEN",
      consent?.reason ?? "This brief has no current consent to send a reply.",
      403,
    );
  return consent;
}

export async function saveReplyDraft(
  db: D1Database,
  scope: ReplyScope,
  item: EnquiryItem,
  input: Extract<ReplyCommand, { action: "replyDraft" }>,
  actor: Actor,
) {
  if (item.status === "rejected")
    throw new StackError(
      "CONFLICT",
      "The brief was rejected. No reply draft can be saved for it.",
      409,
    );
  const consent = await currentConsent(item);
  const body = normaliseReplyBody(input.body);
  if (!body || body.length > replyLimits.body)
    throw new StackError(
      "INVALID",
      "Write a reply within " + replyLimits.body + " characters.",
    );
  const bodyDigest = await digest(body),
    source = await sourceDigestFor(item),
    now = date();
  const existing = await jobFor(db, scope, item.id);
  if (existing) {
    checkJob(existing, scope);
    if (existing.state === "exported")
      throw new StackError(
        "CONFLICT",
        "This reply was already exported. A job never carries a second handoff; start again only from a new enquiry.",
        409,
      );
    if (existing.state === "declined")
      throw new StackError(
        "CONFLICT",
        "This reply was declined before export. No further draft is offered for the same job.",
        409,
      );
    if (existing.draft_revision !== input.expectedRevision)
      throw new StackError(
        "CONFLICT",
        "Another draft revision exists (" +
          existing.draft_revision +
          "). Refresh the Inbox before saving.",
        409,
      );
    if (
      existing.draft_body === body &&
      existing.draft_digest === bodyDigest &&
      existing.source_digest === source &&
      existing.item_revision === item.revision &&
      existing.recipient_digest === consent.recipientDigest &&
      existing.generator === input.generator &&
      existing.generator_id === (input.generatorId ?? "")
    )
      return existing;
    const updated = await db
      .prepare(
        "UPDATE creator_enquiry_reply_jobs SET item_revision=?,source_digest=?,consent_version=2,consent_at=?,consent_expires_at=?,recipient_digest=?,generator=?,generator_id=?,draft_body=?,draft_digest=?,draft_revision=draft_revision+1,state='draft',approval_id=NULL,approval_digest=NULL,approved_by=NULL,approved_at=NULL,approval_expires_at=NULL,exported_at=NULL,reason='',actor_id=?,revision=revision+1,updated_at=? WHERE id=? AND draft_revision=? AND state IN ('draft','approved','invalidated') RETURNING id",
      )
      .bind(
        item.revision,
        source,
        consent.consentedAt,
        consent.expiresAt,
        consent.recipientDigest,
        input.generator,
        input.generatorId ?? "",
        body,
        bodyDigest,
        actor.id,
        now,
        existing.id,
        existing.draft_revision,
      )
      .first();
    if (!updated)
      throw new StackError(
        "CONFLICT",
        "The reply job changed while the draft was saving. Refresh before another action.",
        409,
      );
    const job = (await jobFor(db, scope, item.id))!;
    await insertEvent(
      db,
      job,
      "draft",
      actor.id,
      "Draft revision " + job.draft_revision + " saved. Approval is required.",
    );
    return job;
  }
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO creator_enquiry_reply_jobs(id,workspace_id,resource_id,item_id,item_revision,source_digest,account_id,environment,target,consent_version,consent_at,consent_expires_at,recipient_digest,state,generator,generator_id,draft_body,draft_digest,draft_revision,reason,actor_id,revision,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,2,?,?,?,'draft',?,?,?,?,1,'',?,1,?,? WHERE EXISTS(SELECT 1 FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook' AND account_id=? AND environment=? AND target=? AND state='ready') ON CONFLICT(workspace_id,resource_id,item_id,account_id,environment) DO NOTHING",
    )
    .bind(
      id,
      scope.workspace,
      scope.resource,
      item.id,
      item.revision,
      source,
      scope.account,
      scope.environment,
      scope.target,
      consent.consentedAt,
      consent.expiresAt,
      consent.recipientDigest,
      input.generator,
      input.generatorId ?? "",
      body,
      bodyDigest,
      actor.id,
      now,
      now,
      scope.resource,
      scope.workspace,
      scope.account,
      scope.environment,
      scope.target,
    )
    .run();
  const job = await jobFor(db, scope, item.id);
  if (!job)
    throw new StackError(
      "UNAVAILABLE",
      "This visitor book is no longer available for a reply draft.",
    );
  checkJob(job, scope);
  if (job.id !== id) {
    if (
      job.draft_body === body &&
      job.draft_digest === bodyDigest &&
      job.source_digest === source &&
      job.item_revision === item.revision
    )
      return job;
    throw new StackError(
      "CONFLICT",
      "Another reply draft was saved at the same time. Refresh the Inbox before another action.",
      409,
    );
  }
  await insertEvent(
    db,
    job,
    "draft",
    actor.id,
    "Draft revision 1 saved. Approval is required.",
  );
  return job;
}

export async function approveReply(
  db: D1Database,
  scope: ReplyScope,
  item: EnquiryItem,
  input: Extract<ReplyCommand, { action: "replyApprove" }>,
  actor: Actor,
) {
  if (item.status === "rejected")
    throw new StackError(
      "CONFLICT",
      "The brief was rejected. A reply cannot be approved for it.",
      409,
    );
  const consent = await currentConsent(item);
  const job = await jobFor(db, scope, item.id);
  if (!job)
    throw new StackError(
      "NOT_FOUND",
      "No reply draft is saved for this brief. Save a draft before approval.",
      404,
    );
  checkJob(job, scope);
  if (job.state === "exported")
    throw new StackError(
      "CONFLICT",
      "This reply was already exported. Approving it again cannot create a second handoff.",
      409,
    );
  if (job.state === "declined")
    throw new StackError(
      "CONFLICT",
      "This reply was declined before export. No approval is offered.",
      409,
    );
  const source = await sourceDigestFor(item);
  if (job.item_revision !== item.revision || job.source_digest !== source)
    throw new StackError(
      "CONFLICT",
      "The brief changed after this draft was saved. Save an updated draft before approval.",
      409,
    );
  if (
    job.recipient_digest !== consent.recipientDigest ||
    job.consent_at !== consent.consentedAt ||
    job.consent_expires_at !== consent.expiresAt
  )
    throw new StackError(
      "CONFLICT",
      "The consented reply address or consent record changed. Save the draft again before approval.",
      409,
    );
  if (
    job.draft_revision !== input.expectedRevision ||
    job.draft_digest !== input.expectedDigest
  )
    throw new StackError(
      "CONFLICT",
      "The reply draft changed. Refresh and approve the exact current text.",
      409,
    );
  if ((await digest(job.draft_body)) !== job.draft_digest)
    throw new StackError(
      "CONFLICT",
      "The saved reply text does not match its recorded digest. Save the draft again before approval.",
      409,
    );
  // Repeating the same approval is safe: the existing approval is returned and
  // no second approval event is recorded.
  if (
    job.state === "approved" &&
    job.approval_id &&
    job.approval_expires_at &&
    instant(job.approval_expires_at) > Date.now()
  )
    return job;
  const approvalId = crypto.randomUUID(),
    approvedAt = date(),
    approvalExpiresAt = new Date(Date.now() + approvalWindow).toISOString(),
    approvalDigest = await approvalDigestFor({
      approvalId,
      job,
      item,
      itemRevision: item.revision,
      sourceDigest: source,
      draftRevision: job.draft_revision,
      draftDigest: job.draft_digest,
      scope,
      owner: actor.id,
      recipientDigest: consent.recipientDigest,
      approvedAt,
      approvalExpiresAt,
    });
  const updated = await db
    .prepare(
      "UPDATE creator_enquiry_reply_jobs SET state='approved',approval_id=?,approval_digest=?,approved_by=?,approved_at=?,approval_expires_at=?,reason='',actor_id=?,revision=revision+1,updated_at=? WHERE id=? AND state=? AND revision=? AND draft_revision=? AND draft_digest=? RETURNING id",
    )
    .bind(
      approvalId,
      approvalDigest,
      actor.id,
      approvedAt,
      approvalExpiresAt,
      actor.id,
      approvedAt,
      job.id,
      job.state,
      job.revision,
      job.draft_revision,
      job.draft_digest,
    )
    .first();
  if (!updated) {
    const current = await jobFor(db, scope, item.id);
    if (
      current?.state === "approved" &&
      current.draft_revision === job.draft_revision &&
      current.draft_digest === job.draft_digest
    )
      return current;
    throw new StackError(
      "CONFLICT",
      "The reply job changed while approval was saving. Refresh before another action.",
      409,
    );
  }
  const approved = (await jobFor(db, scope, item.id))!;
  await insertEvent(
    db,
    approved,
    "approved",
    actor.id,
    "Approved the exact draft revision. No message was sent.",
  );
  return approved;
}

async function invalidate(
  db: D1Database,
  job: JobRow,
  reason: string,
  actor: Actor,
) {
  const updated = await db
    .prepare(
      "UPDATE creator_enquiry_reply_jobs SET state='invalidated',reason=?,actor_id=?,revision=revision+1,updated_at=? WHERE id=? AND state='approved' AND approval_id=? RETURNING id",
    )
    .bind(reason, actor.id, date(), job.id, job.approval_id)
    .first();
  if (!updated) return false;
  await insertEvent(db, job, "invalidated", actor.id, reason);
  return true;
}

function exportPayload(
  job: JobRow,
  item: EnquiryItem,
  consent: ReplyConsent | null,
  idempotent: boolean,
): ManualExport {
  const recipient = consent?.ok ? consent.recipient : null,
    subject = replySubject(item.values.title);
  const receipt = [
    "Composer private enquiry reply receipt",
    "Method: manual export",
    "Sent by Composer: no",
    "",
    "Job: " + job.id,
    "Brief: " + job.item_id + " (revision " + job.item_revision + ")",
    "Visitor book: " +
      job.resource_id +
      " · workspace " +
      job.workspace_id +
      " · account " +
      job.account_id +
      " · environment " +
      job.environment,
    "Approval: " + job.approval_id,
    "Approval digest: " + job.approval_digest,
    "Approved by: " + job.approved_by + " at " + job.approved_at,
    "Approval expires: " + job.approval_expires_at,
    "Draft revision: " + job.draft_revision + " · SHA-256 " + job.draft_digest,
    "Exported at: " + job.exported_at,
    "Reply consent: version 2 · consented " +
      job.consent_at +
      " · expires " +
      job.consent_expires_at,
    "",
    "To: " + (recipient ?? "Consent no longer current; do not send"),
    "Subject: " + subject,
    "",
    "----- reply text -----",
    job.draft_body,
    "----- end reply text -----",
  ].join("\n");
  return {
    id: job.approval_id!,
    job: job.id,
    item: job.item_id,
    itemRevision: job.item_revision,
    recipient,
    subject,
    body: job.draft_body,
    receipt,
    method: "manual-export",
    sent: false,
    approvedAt: job.approved_at!,
    exportedAt: job.exported_at!,
    approvalDigest: job.approval_digest!,
    idempotent,
  };
}

/** The only dispatch in this slice. It records a manual handoff and never
 * contacts a provider. The approval, body digest, brief revision, consent and
 * recipient digest are rechecked before the one atomic state change. A replay
 * returns the same receipt. */
export async function exportReply(
  db: D1Database,
  scope: ReplyScope,
  item: EnquiryItem,
  input: Extract<ReplyCommand, { action: "replyExport" }>,
  actor: Actor,
): Promise<{ job: JobRow; exported: ManualExport }> {
  const job = await jobFor(db, scope, item.id);
  if (!job)
    throw new StackError(
      "NOT_FOUND",
      "No reply job exists for this brief. Save and approve a draft first.",
      404,
    );
  checkJob(job, scope);
  if (job.state === "exported") {
    if (
      job.approval_id !== input.expectedApproval ||
      job.draft_digest !== input.expectedDigest
    )
      throw new StackError(
        "CONFLICT",
        "This reply already has an export receipt for a different approval. Refresh the Inbox.",
        409,
      );
    await insertEvent(
      db,
      job,
      "exported",
      actor.id,
      "Manual export receipt replayed; no second handoff was recorded.",
      true,
    );
    const current = await replyConsentFor(item);
    return {
      job,
      exported: exportPayload(
        job,
        item,
        current?.ok && current.recipientDigest === job.recipient_digest
          ? current
          : null,
        true,
      ),
    };
  }
  const staleReason = async () => {
    const consent = await currentConsent(item).catch(() => null);
    if (!consent)
      return "Reply consent expired or changed before export. Nothing was sent; approve the current consent again.";
    const source = await sourceDigestFor(item);
    if (job.item_revision !== item.revision || job.source_digest !== source)
      return "The brief changed after approval. Nothing was sent; save and approve an updated draft.";
    if (
      job.recipient_digest !== consent.recipientDigest ||
      job.consent_at !== consent.consentedAt ||
      job.consent_expires_at !== consent.expiresAt
    )
      return "The consented reply address or consent record changed after approval. Nothing was sent; approve again.";
    if (
      !job.approval_expires_at ||
      instant(job.approval_expires_at) <= Date.now()
    )
      return "The approval expired before export. Nothing was sent; approve the current draft again.";
    return "";
  };
  if (job.state !== "approved") {
    if (job.state === "declined")
      throw new StackError(
        "CONFLICT",
        "This reply was declined. Nothing was exported.",
        409,
      );
    throw new StackError(
      "CONFLICT",
      "The exact reply must be approved before export. Nothing was sent.",
      409,
    );
  }
  if (
    job.approval_id !== input.expectedApproval ||
    job.draft_digest !== input.expectedDigest
  )
    throw new StackError(
      "CONFLICT",
      "The approval or reply text changed. Refresh before exporting; nothing was exported.",
      409,
    );
  const reason = await staleReason();
  if (reason) {
    await invalidate(db, job, reason, actor);
    throw new StackError("STALE_APPROVAL", reason, 409);
  }
  const bodyDigest = await digest(job.draft_body);
  if (bodyDigest !== job.draft_digest) {
    const message =
      "The approved reply text no longer matches its recorded digest. Nothing was exported; the approval is invalid.";
    await invalidate(db, job, message, actor);
    throw new StackError("STALE_APPROVAL", message, 409);
  }
  const consent = await replyConsentFor(item);
  if (!consent?.ok) {
    const message =
      "Reply consent expired or changed before export. Nothing was exported; the approval is invalid.";
    await invalidate(db, job, message, actor);
    throw new StackError("STALE_APPROVAL", message, 409);
  }
  const source = await sourceDigestFor(item),
    recomputed = await approvalDigestFor({
      approvalId: job.approval_id!,
      job,
      item,
      itemRevision: job.item_revision,
      sourceDigest: job.source_digest,
      draftRevision: job.draft_revision,
      draftDigest: job.draft_digest,
      scope,
      owner: job.approved_by!,
      recipientDigest: job.recipient_digest,
      approvedAt: job.approved_at!,
      approvalExpiresAt: job.approval_expires_at!,
    });
  if (
    recomputed !== job.approval_digest ||
    job.source_digest !== source ||
    job.recipient_digest !== consent.recipientDigest
  ) {
    const message =
      "The approval no longer matches the exact brief, draft, consent or recipient. Nothing was exported; approve again.";
    await invalidate(db, job, message, actor);
    throw new StackError("STALE_APPROVAL", message, 409);
  }
  const exportedAt = date();
  const claimed = await db
    .prepare(
      "UPDATE creator_enquiry_reply_jobs SET state='exported',exported_at=?,reason='',actor_id=?,revision=revision+1,updated_at=? WHERE id=? AND state='approved' AND revision=? AND draft_revision=? AND draft_digest=? AND approval_id=? AND approval_digest=? RETURNING id",
    )
    .bind(
      exportedAt,
      actor.id,
      exportedAt,
      job.id,
      job.revision,
      job.draft_revision,
      job.draft_digest,
      job.approval_id,
      job.approval_digest,
    )
    .first();
  if (!claimed) {
    const current = await jobFor(db, scope, item.id);
    if (
      current?.state === "exported" &&
      current.approval_id === input.expectedApproval
    ) {
      await insertEvent(
        db,
        current,
        "exported",
        actor.id,
        "Manual export receipt replayed; no second handoff was recorded.",
        true,
      );
      const fresh = await replyConsentFor(item);
      return {
        job: current,
        exported: exportPayload(
          current,
          item,
          fresh?.ok && fresh.recipientDigest === current.recipient_digest
            ? fresh
            : null,
          true,
        ),
      };
    }
    throw new StackError(
      "CONFLICT",
      "The reply job changed during export. Nothing was sent; refresh the exact state before retry.",
      409,
    );
  }
  const exported = (await jobFor(db, scope, item.id))!;
  await insertEvent(
    db,
    exported,
    "exported",
    actor.id,
    "Manual export recorded. Composer did not send this reply.",
    true,
  );
  return {
    job: exported,
    exported: exportPayload(exported, item, consent, false),
  };
}

export async function declineReply(
  db: D1Database,
  scope: ReplyScope,
  item: EnquiryItem,
  input: Extract<ReplyCommand, { action: "replyDecline" }>,
  actor: Actor,
) {
  const job = await jobFor(db, scope, item.id);
  if (!job)
    throw new StackError(
      "NOT_FOUND",
      "No reply draft exists for this brief.",
      404,
    );
  checkJob(job, scope);
  if (job.state === "exported")
    throw new StackError(
      "CONFLICT",
      "This reply was already exported. It cannot be declined now.",
      409,
    );
  if (job.state === "declined") return job;
  if (job.draft_revision !== input.expectedRevision)
    throw new StackError(
      "CONFLICT",
      "The reply draft changed. Refresh before declining it.",
      409,
    );
  const reason =
    (input.reason ?? "").trim().slice(0, replyLimits.reason) ||
    "The owner declined this reply. No message was sent.";
  const updated = await db
    .prepare(
      "UPDATE creator_enquiry_reply_jobs SET state='declined',reason=?,approval_id=NULL,approval_digest=NULL,approved_by=NULL,approved_at=NULL,approval_expires_at=NULL,actor_id=?,revision=revision+1,updated_at=? WHERE id=? AND draft_revision=? AND state IN ('draft','approved','invalidated') RETURNING id",
    )
    .bind(reason, actor.id, date(), job.id, job.draft_revision)
    .first();
  if (!updated)
    throw new StackError(
      "CONFLICT",
      "The reply job changed while declining. Refresh before another action.",
      409,
    );
  const declined = (await jobFor(db, scope, item.id))!;
  await insertEvent(db, declined, "declined", actor.id, reason);
  return declined;
}
