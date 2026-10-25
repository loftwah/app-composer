import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { isCreatorRole } from "./creator-access.ts";
import {
  membership,
  requireCapability,
  resolveWorkspace,
  StackError,
} from "./stacks.mjs";
import {
  enquiryExport,
  enquiryID,
  enquiryIntent,
  type EnquiryItem,
} from "./enquiry-protocol.ts";
import { resourceConnection } from "./resource-client.ts";
import {
  appFailure,
  checkResource,
  selectedResource,
} from "./private-enquiries.ts";
import {
  mailConnection,
  queueEnquiryNotification,
  sendEnquiryNotification,
  type NotificationRuntime,
} from "./enquiry-notifications.ts";
import {
  deliveryLabels,
  enquiryState,
  inboxJourney,
  inboxJourneyVersion,
  journeyCommand,
  type DeliveryState,
  type InboxJourney,
} from "./inbox-journey-contract.ts";

const origin = "https://composer.loftwah.com";
const maxAttempts = 3;
const runLimit = 500;

export interface JourneyScope {
  workspace: string;
  resource: string;
  account: string;
  environment: string;
  target: string;
}
interface RunRow {
  id: string;
  workspace_id: string;
  resource_id: string;
  event_id: string;
  account_id: string;
  environment: string;
  target: string;
  actor_kind: "system" | "member";
  actor_id: string;
  state: "queued" | "running" | "finished" | "failed";
  stage: "observed" | "source-checked" | "notice-prepared";
  attempts: number;
  reason: string;
  revision: number;
  outbox_id: string | null;
  item_id: string | null;
  created_at: string;
  updated_at: string;
}
interface PreferenceRow {
  owner_id: string;
  enabled: number;
  revision: number;
  destination_digest: string | null;
}
interface OutboxRow {
  id: string;
  state: "queued" | "blocked" | "sending" | "accepted" | "failed" | "uncertain";
  attempts: number;
  reason: string;
  provider_id: string | null;
  destination_digest: string | null;
  reconciled_at: string | null;
  reconciliations: number;
  item_id: string | null;
  created_at: string;
  updated_at: string;
}
interface User {
  id: string;
  role: number;
  name?: string | null;
  email?: string;
}
interface Context {
  user?: User;
  request: Request;
  input: unknown;
}
type Actor = { kind: "system" | "member"; id: string };
type Outcome = {
  state: "finished" | "failed";
  stage: "observed" | "source-checked" | "notice-prepared";
  reason: string;
  outboxId: string | null;
};

const date = () => new Date().toISOString();
const failedReason = (error: unknown) =>
  error instanceof StackError
    ? error.message
    : "Processing was interrupted before an outcome was recorded. Re-check this run; no provider request was made.";
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

async function validResource(db: D1Database, scope: JourneyScope) {
  const row = await db
    .prepare(
      "SELECT id FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook' AND account_id=? AND environment=? AND target=? AND state='ready'",
    )
    .bind(
      scope.resource,
      scope.workspace,
      scope.account,
      scope.environment,
      scope.target,
    )
    .first();
  if (!row)
    throw new StackError(
      "UNAVAILABLE",
      "This enquiry belongs to another or unavailable app connection.",
    );
}
const runFor = (
  db: D1Database,
  scope: JourneyScope,
  event: string,
): Promise<RunRow | null> =>
  db
    .prepare(
      "SELECT * FROM creator_enquiry_workflow_runs WHERE workspace_id=? AND resource_id=? AND event_id=? AND account_id=? AND environment=? AND target=?",
    )
    .bind(
      scope.workspace,
      scope.resource,
      event,
      scope.account,
      scope.environment,
      scope.target,
    )
    .first<RunRow>();
const preferenceFor = (db: D1Database, scope: JourneyScope) =>
  db
    .prepare(
      "SELECT owner_id,enabled,revision,destination_digest FROM creator_enquiry_notification_preferences WHERE workspace_id=? AND resource_id=?",
    )
    .bind(scope.workspace, scope.resource)
    .first<PreferenceRow>();
const outboxFor = (db: D1Database, scope: JourneyScope, event: string) =>
  db
    .prepare(
      "SELECT id,state,attempts,reason,provider_id,destination_digest,reconciled_at,reconciliations,item_id,created_at,updated_at FROM creator_enquiry_notification_outbox WHERE workspace_id=? AND resource_id=? AND event_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
    )
    .bind(scope.workspace, scope.resource, event)
    .first<OutboxRow>();
const runForItem = (db: D1Database, scope: JourneyScope, item: string) =>
  db
    .prepare(
      "SELECT * FROM creator_enquiry_workflow_runs WHERE workspace_id=? AND resource_id=? AND item_id=? AND account_id=? AND environment=? AND target=?",
    )
    .bind(
      scope.workspace,
      scope.resource,
      item,
      scope.account,
      scope.environment,
      scope.target,
    )
    .first<RunRow>();
const outboxForItem = (db: D1Database, scope: JourneyScope, item: string) =>
  db
    .prepare(
      "SELECT id,state,attempts,reason,provider_id,destination_digest,reconciled_at,reconciliations,item_id,created_at,updated_at FROM creator_enquiry_notification_outbox WHERE workspace_id=? AND resource_id=? AND item_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
    )
    .bind(scope.workspace, scope.resource, item)
    .first<OutboxRow>();

/** Match an app-confirmed receipt to the one retained brief with the same exact
 * scope and submission values. Zero or multiple matches stay unlinked; the
 * journey then offers no delivery action rather than guessing. */
export async function linkEnquiryEvent(
  db: D1Database,
  connection: ReturnType<typeof resourceConnection>,
  scope: JourneyScope,
  event: string,
  values: unknown,
  provenance: unknown,
): Promise<"linked" | "unlinked"> {
  enquiryIntent.parse(event);
  const remote = await connection.enquiry(scope.resource, "export");
  appFailure(remote);
  const exported = enquiryExport.parse(remote.body);
  if (
    exported.resource.id !== scope.resource ||
    exported.resource.workspace_id !== scope.workspace ||
    exported.resource.account_id !== scope.account ||
    exported.resource.environment !== scope.environment ||
    exported.resource.target !== scope.target ||
    exported.source !== connection.source
  )
    throw new StackError(
      "CONFLICT",
      "The app export does not match this exact visitor book.",
      409,
    );
  for (const item of exported.items)
    if (
      item.provenance.resource !== scope.resource ||
      item.provenance.configuration !== item.configuration_revision
    )
      throw new StackError(
        "UNAVAILABLE",
        "A retained brief has inconsistent provenance. No link was recorded.",
      );
  const expected = JSON.stringify(canonical(values));
  const expectedScope = JSON.stringify(canonical(provenance));
  const matches = exported.items.filter(
    (item) =>
      item.status === "pending" &&
      JSON.stringify(canonical(item.values)) === expected &&
      JSON.stringify(canonical(item.provenance)) === expectedScope,
  );
  if (matches.length !== 1) return "unlinked";
  await db.batch([
    db
      .prepare(
        "UPDATE creator_enquiry_workflow_runs SET item_id=? WHERE workspace_id=? AND resource_id=? AND event_id=? AND item_id IS NULL",
      )
      .bind(matches[0].id, scope.workspace, scope.resource, event),
    db
      .prepare(
        "UPDATE creator_enquiry_notification_outbox SET item_id=? WHERE workspace_id=? AND resource_id=? AND event_id=? AND item_id IS NULL",
      )
      .bind(matches[0].id, scope.workspace, scope.resource, event),
  ]);
  return "linked";
}

/** Durable, body-free event record written after an app-confirmed receipt.
 * Duplicate receipts preserve one row; missing storage never reverses the brief. */
export async function recordEnquiryEvent(
  db: D1Database,
  scope: JourneyScope,
  event: string,
) {
  enquiryID.parse(scope.workspace);
  enquiryID.parse(scope.resource);
  enquiryIntent.parse(event);
  await validResource(db, scope);
  const now = date();
  await db
    .prepare(
      "INSERT OR IGNORE INTO creator_enquiry_workflow_runs(id,workspace_id,resource_id,event_id,account_id,environment,target,actor_kind,actor_id,state,stage,attempts,reason,revision,created_at,updated_at) SELECT ?,?,?,?,?,?,?,'system','receipt','queued','observed',0,'',1,?,? WHERE (SELECT COUNT(*) FROM creator_enquiry_workflow_runs WHERE workspace_id=?)<?",
    )
    .bind(
      crypto.randomUUID(),
      scope.workspace,
      scope.resource,
      event,
      scope.account,
      scope.environment,
      scope.target,
      now,
      now,
      scope.workspace,
      runLimit,
    )
    .run();
}

/** One explicit processing attempt for an already-recorded enquiry event.
 * The only effect is the existing idempotent outbox preparation; no provider is
 * contacted. Attempts are bounded and the actor is recorded with the exact scope. */
export async function processEnquiryEvent(
  db: D1Database,
  scope: JourneyScope,
  event: string,
  actor: Actor,
): Promise<"finished" | "failed"> {
  enquiryIntent.parse(event);
  await validResource(db, scope);
  const row = await runFor(db, scope, event);
  if (!row)
    throw new StackError(
      "NOT_FOUND",
      "No workflow record exists for this enquiry. Reload the Inbox and prepare the event first.",
      404,
    );
  if (row.state === "finished") return "finished";
  if (row.state === "failed" && row.attempts >= maxAttempts)
    throw new StackError(
      "CONFLICT",
      "Three processing attempts were used. Review the recorded reason; no further processing is offered.",
      409,
    );
  const now = date();
  const claimed = await db
    .prepare(
      "UPDATE creator_enquiry_workflow_runs SET state='running',attempts=attempts+1,actor_kind=?,actor_id=?,revision=revision+1,updated_at=? WHERE id=? AND workspace_id=? AND resource_id=? AND event_id=? AND state=? AND attempts=? AND attempts<? AND (?<>'member' OR EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role IN ('owner','editor'))) RETURNING id",
    )
    .bind(
      actor.kind,
      actor.id,
      now,
      row.id,
      scope.workspace,
      scope.resource,
      event,
      row.state,
      row.attempts,
      maxAttempts,
      actor.kind,
      scope.workspace,
      actor.id,
    )
    .first();
  if (!claimed)
    throw new StackError(
      "CONFLICT",
      "This workflow run changed. Refresh the Inbox before another action.",
      409,
    );
  let outcome: Outcome;
  try {
    await validResource(db, scope);
    const preference = await preferenceFor(db, scope);
    if (!preference?.enabled) {
      outcome = {
        state: "finished",
        stage: "source-checked",
        reason:
          "Owner notifications are off for this visitor book. The brief stays in the Inbox; no notice was prepared.",
        outboxId: null,
      };
    } else if (
      (await membership(db, scope.workspace, preference.owner_id)) !== "owner"
    ) {
      outcome = {
        state: "failed",
        stage: "source-checked",
        reason:
          "The owner who enabled notifications no longer has owner access. Restore that access or review the visitor book’s notification setting.",
        outboxId: null,
      };
    } else {
      // Idempotent preparation: the same event cannot create a second outbox row.
      await queueEnquiryNotification(db, scope, event);
      const outbox = await outboxFor(db, scope, event);
      if (outbox && row.item_id && !outbox.item_id)
        await db
          .prepare(
            "UPDATE creator_enquiry_notification_outbox SET item_id=? WHERE id=? AND item_id IS NULL",
          )
          .bind(row.item_id, outbox.id)
          .run();
      outcome = outbox
        ? {
            state: "finished",
            stage: "notice-prepared",
            reason:
              outbox.state === "blocked"
                ? "The owner notice is prepared, but owner mail is not configured. Delivery cannot be attempted."
                : "The owner notice is prepared. Sending needs an explicit owner action.",
            outboxId: outbox.id,
          }
        : {
            state: "failed",
            stage: "source-checked",
            reason:
              "The owner notice was not prepared. The visitor book or its owner preference changed; refresh and try again.",
            outboxId: null,
          };
    }
  } catch (error) {
    outcome = {
      state: "failed",
      stage: "observed",
      reason: failedReason(error),
      outboxId: null,
    };
  }
  const completed = await db
    .prepare(
      "UPDATE creator_enquiry_workflow_runs SET state=?,stage=?,reason=?,outbox_id=?,updated_at=? WHERE id=? AND state='running' RETURNING id",
    )
    .bind(
      outcome.state,
      outcome.stage,
      outcome.reason,
      outcome.outboxId,
      date(),
      row.id,
    )
    .first();
  if (!completed)
    throw new StackError(
      "CONFLICT",
      "The workflow run changed while it was processing. Re-check it before another action.",
      409,
    );
  return outcome.state;
}

function deliveryView(
  outbox: OutboxRow | null,
  preference: PreferenceRow | null,
  mailReady: boolean,
  linked: boolean,
): { state: DeliveryState; reason: string } {
  if (!outbox)
    return {
      state: "unconfigured",
      reason: !linked
        ? "No exact owner-notice event is linked to this brief. No delivery action is offered."
        : !preference?.enabled
          ? "Owner notifications are off for this visitor book. No notice has been prepared."
          : !mailReady
            ? "The owner mail connection is not enabled or configured, so no notice can be prepared for sending."
            : "No owner notice has been prepared yet. Process the enquiry event first.",
    };
  if (outbox.state === "blocked" || (outbox.state === "queued" && !mailReady))
    return {
      state: "unconfigured",
      reason:
        outbox.state === "blocked"
          ? outbox.reason ||
            "The owner mail connection is not enabled or configured."
          : "The owner notice is prepared, but owner mail is not enabled or configured. No send is offered.",
    };
  const state: DeliveryState =
    outbox.state === "queued"
      ? "ready"
      : outbox.state === "sending"
        ? "attempted"
        : outbox.state === "accepted"
          ? "accepted"
          : outbox.state === "uncertain"
            ? "uncertain"
            : "failed";
  return {
    state,
    reason:
      outbox.reason ||
      (state === "ready"
        ? "The owner notice is prepared and waiting for an explicit owner send."
        : deliveryLabels[state] + "."),
  };
}

function nextAction(
  journey: Pick<InboxJourney, "workflow" | "delivery" | "enquiry">,
  role: "owner" | "editor" | "viewer",
): InboxJourney["next"] {
  const editing = role !== "viewer";
  const owner = role === "owner";
  const { workflow, delivery, enquiry } = journey;
  if (workflow.state === "failed" && workflow.attempts >= maxAttempts)
    return {
      kind: "none",
      label: "No supported action",
      detail:
        "Three processing attempts were used. Review the recorded reason; the brief stays in the Inbox and no provider was contacted.",
      actor: "none",
      enabled: false,
    };
  if (
    workflow.state === "queued" ||
    workflow.state === "running" ||
    (workflow.state === "failed" && workflow.attempts < maxAttempts)
  )
    return {
      kind: "process",
      label:
        workflow.state === "failed"
          ? "Retry processing"
          : workflow.state === "running"
            ? "Re-check processing"
            : "Process this enquiry",
      detail:
        workflow.state === "running"
          ? "Processing was interrupted before it recorded an outcome. Re-checking is safe: the notice preparation is idempotent and no provider is contacted."
          : workflow.state === "failed"
            ? "Retry the same event once its recorded cause is resolved. This reuses the same notice identity."
            : "Prepare the owner notice for this exact event. This is a local, idempotent step and contacts no provider.",
      actor: "owner-or-editor",
      enabled: editing,
    };
  if (workflow.state === "unlinked" && delivery.state === "unconfigured")
    return {
      kind: "none",
      label: "No supported action",
      detail:
        "No exact workflow link exists for this brief, so Composer cannot prove which owner notice belongs to it. The brief stays in the Inbox; no provider is contacted.",
      actor: "none",
      enabled: false,
    };
  if (delivery.state === "failed" && delivery.attempts >= maxAttempts)
    return {
      kind: "none",
      label: "No supported action",
      detail:
        "Three provider attempts were used. Review the recorded reason; the brief remains in the Inbox and no further send is offered.",
      actor: "none",
      enabled: false,
    };
  if (delivery.state === "failed" || delivery.state === "ready")
    return {
      kind: "send",
      label:
        delivery.state === "failed"
          ? "Try the owner notice again"
          : "Send the owner notice",
      detail:
        delivery.state === "failed"
          ? "The provider definitely refused the previous attempt. A retry reuses the same message identity and stops after three attempts."
          : "Send the prepared notice to the verified owner. The brief itself is not included in the message.",
      actor: "owner",
      enabled: owner,
    };
  if (delivery.state === "attempted" || delivery.state === "uncertain")
    return {
      kind: "reconcile",
      label: "Reconcile delivery",
      detail:
        "The provider may already have received this message. Reconcile the recorded state; Composer does not resend it and will not mark it accepted without a provider identity.",
      actor: "owner",
      enabled: owner,
    };
  if (enquiry.status === "new")
    return {
      kind: "review",
      label: "Mark this brief reviewed",
      detail:
        "Reading the brief is separate from notification. Reviewed is an owner or editor decision; it is not a reply, sale or contact.",
      actor: "owner-or-editor",
      enabled: editing,
    };
  return {
    kind: "none",
    label: "No supported action",
    detail:
      delivery.state === "accepted"
        ? "No supported action. The provider accepted this notice; delivery to a recipient server and reading have not been verified."
        : "No supported action. The brief is retained in the app-owned Inbox and its current state is recorded above.",
    actor: "none",
    enabled: false,
  };
}

function mapItem(item: EnquiryItem): InboxJourney["enquiry"] {
  return {
    id: item.id,
    status: enquiryState(item.status),
    revision: item.revision,
    createdAt: item.created_at,
    expiresAt: item.expires_at,
    title: item.values.title,
    goal: item.values.goal,
    startingPoint: item.values.starting_point,
    existingSite: item.values.existing_site ?? null,
    deliverables: item.values.deliverables,
    provenance: item.provenance,
  };
}

async function readJourney(
  db: D1Database,
  runtime: NotificationRuntime,
  workspace: { id: string; name: string; role: "owner" | "editor" | "viewer" },
  item: EnquiryItem,
  connection: ReturnType<typeof resourceConnection>,
  resourceVersion: number,
): Promise<InboxJourney> {
  const scope = {
    workspace: workspace.id,
    resource: item.provenance.resource,
    account: connection.account,
    environment: connection.environment,
    target: connection.target,
  };
  const [run, preference, outbox] = await Promise.all([
    runForItem(db, scope, item.id),
    preferenceFor(db, scope),
    outboxForItem(db, scope, item.id),
  ]);
  const mail = mailConnection(runtime);
  const recipientDigest = mail.recipient ? await digest(mail.recipient) : null;
  const destinationVerified = Boolean(
    preference?.destination_digest &&
    recipientDigest &&
    preference.destination_digest === recipientDigest,
  );
  const delivery = deliveryView(outbox, preference, mail.ready, Boolean(run));
  const workflow: InboxJourney["workflow"] = run
    ? {
        state: run.state,
        attempts: run.attempts,
        maxAttempts,
        reason: run.reason,
        revision: run.revision,
        actor: { kind: run.actor_kind, id: run.actor_id },
        outboxId: run.outbox_id,
        updatedAt: run.updated_at,
      }
    : {
        state: "unlinked",
        attempts: 0,
        maxAttempts,
        reason:
          "No exact owner-notice event is linked to this brief. Composer links a retained brief only when the app export contains exactly one pending item with the same scope and submission values. No delivery action is offered.",
        revision: 0,
        actor: null,
        outboxId: null,
        updatedAt: null,
      };
  const journey: Pick<InboxJourney, "workflow" | "delivery" | "enquiry"> = {
    workflow,
    delivery: {
      state: delivery.state,
      attempts: outbox?.attempts ?? 0,
      maxAttempts,
      reason: delivery.reason,
      providerReference: outbox?.provider_id ?? null,
      destination: {
        configured: mail.ready,
        verified: destinationVerified,
        fingerprint: preference?.destination_digest?.slice(0, 12) ?? null,
      },
      reconciledAt: outbox?.reconciled_at ?? null,
      reconciliations: outbox?.reconciliations ?? 0,
      updatedAt: outbox?.updated_at ?? null,
    },
    enquiry: mapItem(item),
  };
  return inboxJourney.parse({
    ok: true,
    version: inboxJourneyVersion,
    workspace,
    scope: {
      resource: item.provenance.resource,
      account: connection.account,
      environment: connection.environment,
      target: connection.target,
      source: connection.source,
    },
    resourceVersion,
    ...journey,
    notificationPreference: {
      enabled: Boolean(preference?.enabled),
      revision: preference?.revision ?? 0,
    },
    next: nextAction(journey, workspace.role),
    timezone: "UTC",
  });
}

const common = { workspace: enquiryID.optional(), resource: enquiryID };
const readInput = z
  .object({ action: z.literal("journey"), ...common, item: enquiryID })
  .strict();

/** One owner journey: the actual app-owned brief, its Composer workflow run and
 * the separate owner-notice delivery state. Actions are explicit and scoped. */
export async function manageInboxJourney(
  ctx: Context,
  runtime: NotificationRuntime,
  send: typeof fetch = fetch,
) {
  const fail = (code: string, message: string) => ({
    ok: false as const,
    code,
    message,
  });
  if (!ctx.user || !isCreatorRole(ctx.user.role) || !ctx.user.id)
    return fail("FORBIDDEN", "A signed-in Composer creator is required.");
  if (runtime.PUBLIC_ORIGIN !== origin || !runtime.DB)
    return fail(
      "UNAVAILABLE",
      "The inbox journey is disconnected in this environment.",
    );
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
    if (reading)
      for (const key of new URL(ctx.request.url).searchParams.keys())
        if (new URL(ctx.request.url).searchParams.getAll(key).length !== 1)
          throw new StackError("INVALID", "Choose each journey filter once.");
    const parsedInput = (reading ? readInput : journeyCommand).safeParse(
      ctx.input,
    );
    if (!parsedInput.success)
      return fail(
        "INVALID",
        "Choose only the declared enquiry journey fields.",
      );
    const input = parsedInput.data,
      db = runtime.DB,
      user = ctx.user;
    const workspace = await resolveWorkspace(db, user, input.workspace ?? null);
    requireCapability(workspace.role, "save");
    const needed = reading || input.action === "process" ? "save" : "owner";
    if (needed === "owner" && workspace.role !== "owner")
      return fail(
        "FORBIDDEN",
        "Only the workspace owner can send or reconcile owner notices.",
      );
    const connection = resourceConnection(runtime, workspace.id),
      resource = await selectedResource(
        db,
        workspace.id,
        input.resource,
        connection,
      );
    const guard = async (owner = false) => {
      const role = await membership(db, workspace.id, user.id);
      requireCapability(role, "save");
      if (owner && role !== "owner")
        throw new StackError(
          "FORBIDDEN",
          "Only the workspace owner can send or reconcile owner notices.",
          403,
        );
      await selectedResource(db, workspace.id, resource.id, connection);
    };
    const remote = await connection.enquiry(resource.id, "export");
    appFailure(remote);
    // Access and exact resource are rechecked after the remote wait.
    await guard(needed === "owner");
    const reply = enquiryExport.parse(remote.body);
    checkResource(reply.resource, resource, connection);
    if (reply.source !== connection.source)
      throw new StackError(
        "CONFLICT",
        "The visitor book source changed. Refresh before acting on this brief.",
        409,
      );
    for (const entry of reply.items)
      if (
        entry.provenance.resource !== resource.id ||
        entry.provenance.configuration !== entry.configuration_revision
      )
        throw new StackError(
          "UNAVAILABLE",
          "A retained brief has inconsistent provenance. Refresh the Inbox.",
        );
    const item = reply.items.find((entry) => entry.id === input.item);
    if (!item)
      throw new StackError(
        "NOT_FOUND",
        "This brief has expired, was removed, or belongs to another visitor book.",
        404,
      );
    const scope = {
      workspace: workspace.id,
      resource: resource.id,
      account: connection.account,
      environment: connection.environment,
      target: connection.target,
    };
    if (!reading && input.action === "process") {
      await guard();
      const linked = await runForItem(db, scope, item.id);
      if (!linked)
        throw new StackError(
          "CONFLICT",
          "No exact workflow event is linked to this brief. No processing or provider action is offered.",
          409,
        );
      await processEnquiryEvent(db, scope, linked.event_id, {
        kind: "member",
        id: user.id,
      });
    } else if (!reading) {
      const current = await outboxForItem(db, scope, item.id);
      if (!current)
        throw new StackError(
          "NOT_FOUND",
          "No owner notice is prepared for this brief yet. Process the enquiry event first.",
          404,
        );
      await guard(true);
      if (input.action === "send") {
        if (current.state === "accepted")
          throw new StackError(
            "CONFLICT",
            "The provider already accepted this notice. Sending it again could deliver a duplicate, so no resend is offered.",
            409,
          );
        if (current.state === "uncertain")
          throw new StackError(
            "CONFLICT",
            "The previous send outcome is uncertain. Reconcile it; Composer does not resend an uncertain notice.",
            409,
          );
        if (current.state === "sending")
          throw new StackError(
            "CONFLICT",
            "A send is already in progress. Wait for its outcome, then reconcile it.",
            409,
          );
        if (current.attempts >= maxAttempts)
          throw new StackError(
            "CONFLICT",
            "Three provider attempts were used. This notice cannot be sent again; the brief remains in the Inbox.",
            409,
          );
        await sendEnquiryNotification(
          db,
          runtime,
          workspace.id,
          resource.id,
          current.id,
          send,
        );
      } else if (input.action === "reconcile") {
        if (!["sending", "uncertain"].includes(current.state))
          throw new StackError(
            "CONFLICT",
            "Only an in-flight or uncertain notice can be reconciled. A definite failure has its own bounded retry.",
            409,
          );
        await db
          .prepare(
            "UPDATE creator_enquiry_notification_outbox SET reconciled_at=?,reconciliations=reconciliations+1,updated_at=? WHERE id=? AND workspace_id=? AND resource_id=? AND state IN ('sending','uncertain')",
          )
          .bind(date(), date(), current.id, workspace.id, resource.id)
          .run();
      }
    }
    await guard(needed === "owner");
    return readJourney(
      db,
      runtime,
      workspace,
      item,
      connection,
      reply.resource.version,
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return fail(
        "INVALID",
        "The connected app returned a brief or notice identity this build does not support. Nothing was changed; refresh the Inbox.",
      );
    return fail(
      error instanceof StackError ? error.code : "UNKNOWN",
      error instanceof StackError
        ? error.message
        : "The enquiry journey could not be confirmed. Refresh its exact state before retry.",
    );
  }
}
