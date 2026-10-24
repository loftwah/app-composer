import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { membership, resolveWorkspace, StackError } from "./stacks.mjs";
import { isCreatorRole } from "./creator-access.ts";
import { enquiryID, enquiryIntent } from "./enquiry-protocol.ts";
import { resourceConnection } from "./resource-client.ts";
import type { EnquiryRuntime } from "./private-enquiries.ts";
import { deliverResend } from "./resend-delivery.mjs";

const origin = "https://composer.loftwah.com";
const states = [
  "queued",
  "blocked",
  "sending",
  "accepted",
  "failed",
  "uncertain",
] as const;
export interface NotificationRuntime extends EnquiryRuntime {
  ENQUIRY_NOTIFICATIONS_ENABLED?: unknown;
  ENQUIRY_NOTIFICATION_RECIPIENT?: unknown;
  RESEND_API_KEY?: unknown;
  RESEND_FROM_ADDRESS?: unknown;
  RESEND_ALLOWED_RECIPIENTS?: unknown;
}
interface Scope {
  workspace: string;
  resource: string;
  account: string;
  environment: string;
  target: string;
}
interface Row {
  id: string;
  workspace_id: string;
  resource_id: string;
  event_id: string;
  account_id: string;
  environment: string;
  target: string;
  owner_id: string;
  state: (typeof states)[number];
  attempts: number;
  destination_digest: string | null;
  provider_id: string | null;
  reason: string;
  created_at: string;
  updated_at: string;
}
interface Preference {
  owner_id: string;
  enabled: number;
  revision: number;
  destination_digest: string | null;
}
const date = () => new Date().toISOString();
const digest = async (value: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const rowScope = (row: Row): Scope => ({
  workspace: row.workspace_id,
  resource: row.resource_id,
  account: row.account_id,
  environment: row.environment,
  target: row.target,
});
async function validResource(db: D1Database, scope: Scope) {
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
      "This notification belongs to another or unavailable app connection.",
    );
}
function connection(runtime: NotificationRuntime) {
  const recipient =
    typeof runtime.ENQUIRY_NOTIFICATION_RECIPIENT === "string"
      ? runtime.ENQUIRY_NOTIFICATION_RECIPIENT.trim().toLowerCase()
      : "";
  const allowed =
    typeof runtime.RESEND_ALLOWED_RECIPIENTS === "string"
      ? runtime.RESEND_ALLOWED_RECIPIENTS.split(",").map((value) =>
          value.trim().toLowerCase(),
        )
      : [];
  const ready =
    runtime.ENQUIRY_NOTIFICATIONS_ENABLED === "true" &&
    /^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/.test(recipient) &&
    allowed.includes(recipient) &&
    typeof runtime.RESEND_API_KEY === "string" &&
    Boolean(runtime.RESEND_API_KEY) &&
    typeof runtime.RESEND_FROM_ADDRESS === "string" &&
    /^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/.test(runtime.RESEND_FROM_ADDRESS);
  return { recipient, ready };
}

// Called only after an app-confirmed receipt, with server-selected scope. No body
// or visitor identity is copied. Duplicate receipts preserve one durable message.
export async function queueEnquiryNotification(
  db: D1Database,
  scope: Scope,
  event: string,
) {
  enquiryID.parse(scope.workspace);
  enquiryID.parse(scope.resource);
  enquiryIntent.parse(event);
  await validResource(db, scope);
  const preference = await db
    .prepare(
      "SELECT owner_id,enabled,revision,destination_digest FROM creator_enquiry_notification_preferences WHERE workspace_id=? AND resource_id=?",
    )
    .bind(scope.workspace, scope.resource)
    .first<Preference>();
  if (
    !preference?.enabled ||
    (await membership(db, scope.workspace, preference.owner_id)) !== "owner"
  )
    return;
  const now = date();
  await db
    .prepare(
      "INSERT INTO creator_enquiry_notification_outbox(id,version,workspace_id,resource_id,event_id,account_id,environment,target,owner_id,state,created_at,updated_at) SELECT ?,1,?,?,?,?,?,?,?,'queued',?,? FROM creator_enquiry_notification_preferences p JOIN creator_members m ON m.workspace_id=p.workspace_id AND m.user_id=p.owner_id JOIN creator_app_resources r ON r.id=p.resource_id AND r.workspace_id=p.workspace_id WHERE p.workspace_id=? AND p.resource_id=? AND p.revision=? AND p.owner_id=? AND p.enabled=1 AND m.role='owner' AND r.app='guestbook' AND r.account_id=? AND r.environment=? AND r.target=? AND r.state='ready' ON CONFLICT(workspace_id,resource_id,event_id,version) DO NOTHING",
    )
    .bind(
      crypto.randomUUID(),
      scope.workspace,
      scope.resource,
      event,
      scope.account,
      scope.environment,
      scope.target,
      preference.owner_id,
      now,
      now,
      scope.workspace,
      scope.resource,
      preference.revision,
      preference.owner_id,
      scope.account,
      scope.environment,
      scope.target,
    )
    .run();
}

// No scheduler or automatic provider retry. A trusted native owner action selects
// one row; tests inject transport. Interrupted/uncertain/accepted sends stay held.
export async function sendEnquiryNotification(
  db: D1Database,
  runtime: NotificationRuntime,
  workspace: string,
  resource: string,
  operation: string,
  send: typeof fetch = fetch,
) {
  const row = await db
    .prepare(
      "SELECT * FROM creator_enquiry_notification_outbox WHERE id=? AND workspace_id=? AND resource_id=?",
    )
    .bind(operation, workspace, resource)
    .first<Row>();
  if (!row)
    throw new StackError(
      "NOT_FOUND",
      "This workspace has no such notification.",
      404,
    );
  await validResource(db, rowScope(row));
  const current = resourceConnection(runtime, workspace);
  if (
    row.account_id !== current.account ||
    row.environment !== current.environment ||
    row.target !== current.target
  )
    throw new StackError(
      "UNAVAILABLE",
      "The notification app connection changed.",
    );
  const preference = await db
    .prepare(
      "SELECT owner_id,enabled,revision,destination_digest FROM creator_enquiry_notification_preferences WHERE workspace_id=? AND resource_id=?",
    )
    .bind(workspace, resource)
    .first<Preference>();
  if (
    !preference?.enabled ||
    preference.owner_id !== row.owner_id ||
    (await membership(db, workspace, row.owner_id)) !== "owner"
  )
    throw new StackError(
      "FORBIDDEN",
      "Notifications are paused or their owner access was revoked.",
      403,
    );
  if (["sending", "uncertain", "accepted"].includes(row.state)) return;
  if (row.attempts >= 3)
    throw new StackError(
      "CONFLICT",
      "Three attempts were used. Reconcile this notification before any further send.",
      409,
    );
  const mail = connection(runtime);
  if (!mail.ready) {
    await db
      .prepare(
        "UPDATE creator_enquiry_notification_outbox SET state='blocked',reason='The owner mail connection is not enabled or configured.',updated_at=? WHERE id=? AND state IN ('queued','blocked','failed')",
      )
      .bind(date(), row.id)
      .run();
    return;
  }
  const destination = await digest(mail.recipient);
  if (
    !preference.destination_digest ||
    preference.destination_digest !== destination
  )
    throw new StackError(
      "FORBIDDEN",
      "The configured destination is not the owner who enabled these notifications. Review the preference.",
      403,
    );
  if (row.destination_digest && row.destination_digest !== destination)
    throw new StackError(
      "CONFLICT",
      "The owner destination changed. Reconcile the original notification before sending.",
      409,
    );
  // Atomic claim: another request, reload or interrupted response cannot resend.
  const claimed = await db
    .prepare(
      "UPDATE creator_enquiry_notification_outbox SET state='sending',attempts=attempts+1,destination_digest=?,reason='',updated_at=? WHERE id=? AND state IN ('queued','blocked','failed') AND attempts=? RETURNING id",
    )
    .bind(destination, date(), row.id, row.attempts)
    .first();
  if (!claimed) return;
  try {
    // Recheck access and connection after the durable claim, before the effect.
    await validResource(db, rowScope(row));
    const freshPreference = await db
      .prepare(
        "SELECT owner_id,enabled,revision FROM creator_enquiry_notification_preferences WHERE workspace_id=? AND resource_id=?",
      )
      .bind(workspace, resource)
      .first<Preference>();
    if (
      (await membership(db, workspace, row.owner_id)) !== "owner" ||
      !freshPreference?.enabled ||
      freshPreference.owner_id !== row.owner_id ||
      freshPreference.revision !== preference.revision
    )
      throw Error("Permission or preference changed");
    const result = await deliverResend(
      {
        to: mail.recipient,
        subject: "A new private enquiry is in your Inbox",
        text:
          "A private enquiry is available in your selected visitor book. Open Composer administration to review it.\n\n" +
          origin +
          "/_emdash/admin/plugins/composer-stacks/enquiries?" +
          new URLSearchParams({ workspace, resource }) +
          "\n\nNo submitted brief or contact detail is included in this notification.",
      },
      runtime,
      send,
      { idempotencyKey: "composer-enquiry-v1/" + row.id },
    );
    await db
      .prepare(
        "UPDATE creator_enquiry_notification_outbox SET state=?,provider_id=?,reason=?,updated_at=? WHERE id=? AND state='sending'",
      )
      .bind(
        result.id ? "accepted" : "uncertain",
        result.id,
        result.id
          ? "Accepted by provider. Delivery and reading have not been verified."
          : "The provider accepted the request without a usable message identity. Reconcile before retry.",
        date(),
        row.id,
      )
      .run();
  } catch (error) {
    const status = (error as { providerStatus?: number }).providerStatus;
    const rejected =
      status !== undefined &&
      [400, 401, 403, 404, 405, 413, 415, 422, 429].includes(status);
    await db
      .prepare(
        "UPDATE creator_enquiry_notification_outbox SET state=?,reason=?,updated_at=? WHERE id=? AND state='sending'",
      )
      .bind(
        rejected ? "failed" : "uncertain",
        rejected
          ? "The provider rejected this notification (" +
              status +
              "). The enquiry remains in your Inbox."
          : "The send outcome is uncertain. The enquiry remains in your Inbox; reconcile before retry.",
        date(),
        row.id,
      )
      .run();
  }
}

const common = { workspace: enquiryID.optional(), resource: enquiryID };
const read = z
  .object({ action: z.literal("notificationStatus"), ...common })
  .strict();
const write = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("notificationPreference"),
      ...common,
      enabled: z.boolean(),
      expectedRevision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal("notificationSend"),
      ...common,
      operation: enquiryIntent,
    })
    .strict(),
]);
interface Context {
  user?: { id: string; role: number; email?: string; name?: string | null };
  request: Request;
  input: unknown;
}
export async function manageEnquiryNotifications(
  ctx: Context,
  runtime: NotificationRuntime,
) {
  try {
    if (!ctx.user || !isCreatorRole(ctx.user.role))
      throw new StackError(
        "FORBIDDEN",
        "A signed-in creator is required.",
        403,
      );
    if (!runtime.DB || runtime.PUBLIC_ORIGIN !== origin)
      throw new StackError(
        "UNAVAILABLE",
        "Notifications are disconnected in this environment.",
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
      throw new StackError(
        "FORBIDDEN",
        "Open notification actions from Composer administration.",
        403,
      );
    if (reading)
      for (const key of new URL(ctx.request.url).searchParams.keys())
        if (new URL(ctx.request.url).searchParams.getAll(key).length !== 1)
          throw new StackError(
            "INVALID",
            "Choose each notification filter once.",
          );
    const input = (reading ? read : write).parse(ctx.input);
    const db = runtime.DB,
      workspace = await resolveWorkspace(db, ctx.user, input.workspace ?? null);
    if (workspace.role === "viewer")
      throw new StackError(
        "FORBIDDEN",
        "Private notifications require owner or editor access.",
        403,
      );
    const app = resourceConnection(runtime, workspace.id),
      scope = {
        workspace: workspace.id,
        resource: input.resource,
        account: app.account,
        environment: app.environment,
        target: app.target,
      };
    await validResource(db, scope);
    if (input.action === "notificationPreference") {
      if (workspace.role !== "owner")
        throw new StackError(
          "FORBIDDEN",
          "Only the workspace owner can change notification preferences.",
          403,
        );
      const mail = connection(runtime);
      if (
        input.enabled &&
        mail.ready &&
        ctx.user.email?.toLowerCase() !== mail.recipient
      )
        throw new StackError(
          "FORBIDDEN",
          "The configured notification destination must be this authorised owner.",
          403,
        );
      if (
        input.enabled &&
        (!ctx.user.email ||
          !/^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/.test(ctx.user.email))
      )
        throw new StackError(
          "FORBIDDEN",
          "A verified owner email identity is required to enable notifications.",
          403,
        );
      const destinationDigest = input.enabled
        ? await digest(ctx.user.email!.trim().toLowerCase())
        : null;
      const now = date();
      const result =
        input.expectedRevision === 0
          ? await db
              .prepare(
                "INSERT INTO creator_enquiry_notification_preferences(workspace_id,resource_id,owner_id,enabled,destination_digest,revision,updated_at) SELECT ?,?,?,?,?,1,? WHERE EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role='owner') ON CONFLICT(workspace_id,resource_id) DO NOTHING RETURNING revision",
              )
              .bind(
                workspace.id,
                input.resource,
                ctx.user.id,
                input.enabled ? 1 : 0,
                destinationDigest,
                now,
                workspace.id,
                ctx.user.id,
              )
              .first()
          : await db
              .prepare(
                "UPDATE creator_enquiry_notification_preferences SET owner_id=?,enabled=?,destination_digest=?,revision=revision+1,updated_at=? WHERE workspace_id=? AND resource_id=? AND revision=? AND EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role='owner') RETURNING revision",
              )
              .bind(
                ctx.user.id,
                input.enabled ? 1 : 0,
                destinationDigest,
                now,
                workspace.id,
                input.resource,
                input.expectedRevision,
                workspace.id,
                ctx.user.id,
              )
              .first();
      if (!result)
        throw new StackError(
          "CONFLICT",
          "Notification preferences or owner access changed. Refresh before trying again.",
          409,
        );
    } else if (input.action === "notificationSend") {
      if (workspace.role !== "owner")
        throw new StackError(
          "FORBIDDEN",
          "Only the workspace owner can send its notification.",
          403,
        );
      await sendEnquiryNotification(
        db,
        runtime,
        workspace.id,
        input.resource,
        input.operation,
      );
    }
    const preference = await db
      .prepare(
        "SELECT owner_id,enabled,revision,destination_digest FROM creator_enquiry_notification_preferences WHERE workspace_id=? AND resource_id=?",
      )
      .bind(workspace.id, input.resource)
      .first<Preference>();
    const rows = await db
      .prepare(
        "SELECT id,state,attempts,reason,created_at,updated_at,provider_id FROM creator_enquiry_notification_outbox WHERE workspace_id=? AND resource_id=? ORDER BY created_at DESC,id LIMIT 30",
      )
      .bind(workspace.id, input.resource)
      .all();
    const mail = connection(runtime);
    await validResource(db, scope);
    const currentRole = await membership(db, workspace.id, ctx.user.id);
    if (currentRole !== "owner" && currentRole !== "editor")
      throw new StackError(
        "FORBIDDEN",
        "Private notification access changed. Refresh the selected workspace.",
        403,
      );
    return {
      ok: true as const,
      workspace: { ...workspace, role: currentRole },
      resource: input.resource,
      preference: {
        enabled: Boolean(preference?.enabled),
        revision: preference?.revision ?? 0,
      },
      connection: {
        ready: mail.ready,
        destination: mail.recipient || null,
        timezone: "UTC",
        delivery: "not-verified",
      },
      items: rows.results,
    };
  } catch (error) {
    return {
      ok: false as const,
      code: error instanceof StackError ? error.code : "INVALID",
      message:
        error instanceof StackError
          ? error.message
          : "The notification request could not be confirmed. Refresh its exact state before retry.",
    };
  }
}
