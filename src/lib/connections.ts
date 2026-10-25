import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { isCreatorRole } from "./creator-access.ts";
import {
  resolveWorkspace,
  membership,
  requireCapability,
  StackError,
} from "./stacks.mjs";
import { resourceConnection, type ResourceRuntime } from "./resource-client.ts";
import { appSettings } from "./app-settings.mjs";
import {
  connectionSnapshot,
  type ConnectionSnapshot,
} from "./connection-contract.ts";

const origin = "https://composer.loftwah.com";
const resourceTarget = origin + "/guestbook";
const inputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("list"),
      workspace: z
        .string()
        .regex(/^[a-z0-9-]{6,64}$/)
        .optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("check"),
      workspace: z.string().regex(/^[a-z0-9-]{6,64}$/),
      connection: z.literal("guestbook-owner"),
    })
    .strict(),
]);
type Connection = ConnectionSnapshot["connections"][number];
interface Runtime extends ResourceRuntime {
  DB?: D1Database;
  RESEND_API_KEY?: unknown;
  RESEND_FROM_ADDRESS?: unknown;
  RESEND_ALLOWED_RECIPIENTS?: unknown;
  ENQUIRY_NOTIFICATION_RECIPIENT?: unknown;
  ENQUIRY_NOTIFICATIONS_ENABLED?: unknown;
}
interface Context {
  user?: { id: string; role: number; name?: string | null };
  request: Request;
  input: unknown;
}
const present = (value: unknown) =>
  typeof value === "string" && Boolean(value.trim());
async function dependencies(
  db: D1Database,
  workspace: string,
  target: { account: string; environment: string },
  mail: boolean,
): Promise<Connection["dependencies"]> {
  try {
    const rows = mail
      ? await db
          .prepare(
            "SELECT p.resource_id AS id FROM creator_enquiry_notification_preferences p JOIN creator_app_resources r ON r.id=p.resource_id AND r.workspace_id=p.workspace_id WHERE p.workspace_id=? AND r.account_id=? AND r.environment=? AND r.target=? AND r.app='guestbook' ORDER BY p.resource_id LIMIT 50",
          )
          .bind(workspace, target.account, target.environment, resourceTarget)
          .all<{ id: string; name?: string }>()
      : await db
          .prepare(
            "SELECT DISTINCT s.id,s.name FROM creator_stacks s JOIN creator_stack_resource_bindings b ON b.stack_id=s.id JOIN creator_app_resources r ON r.id=b.resource_id AND r.workspace_id=s.workspace_id WHERE s.workspace_id=? AND r.app='guestbook' AND r.account_id=? AND r.environment=? AND r.target=? ORDER BY s.id LIMIT 50",
          )
          .bind(workspace, target.account, target.environment, resourceTarget)
          .all<{ id: string; name?: string }>();
    return {
      available: true,
      atLimit: rows.results.length === 50,
      items: rows.results.map((row) => ({
        label: mail
          ? `Owner notification preference · ${row.id}`
          : (row.name ?? "Saved stack").slice(0, 120),
        href: `/_emdash/admin/plugins/composer-stacks/${mail ? "enquiries" : "stacks"}?${new URLSearchParams({ workspace, ...(mail ? { resource: row.id } : { stack: row.id }) })}`,
      })),
    };
  } catch {
    return { available: false, atLimit: false, items: [] };
  }
}

export async function manageConnections(ctx: Context, runtime: Runtime) {
  try {
    if (!ctx.user || !isCreatorRole(ctx.user.role))
      throw new StackError(
        "FORBIDDEN",
        "A signed-in Composer creator is required.",
        403,
      );
    if (!runtime.DB || runtime.PUBLIC_ORIGIN !== origin)
      throw new StackError(
        "UNAVAILABLE",
        "Connections are disconnected in this environment.",
      );
    if (
      ctx.request.method !== "GET" ||
      (ctx.request.headers.has("Origin") &&
        ctx.request.headers.get("Origin") !== origin)
    )
      throw new StackError(
        "FORBIDDEN",
        "Open this read-only view from Composer administration.",
        403,
      );
    const url = new URL(ctx.request.url);
    for (const key of url.searchParams.keys())
      if (url.searchParams.getAll(key).length !== 1)
        throw new StackError("INVALID", "Choose each connection filter once.");
    const input = inputSchema.parse(ctx.input),
      db = runtime.DB,
      user = ctx.user;
    const workspace = await resolveWorkspace(db, user, input.workspace ?? null);
    requireCapability(workspace.role, "save"); // Private connection metadata is owner/editor only.
    const target = z
      .object({
        account: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
        environment: z.string().regex(/^[a-z0-9-]{1,40}$/),
      })
      .parse({
        account: runtime.RESOURCE_ACCOUNT_ID,
        environment: runtime.RESOURCE_ENVIRONMENT,
      });
    const [appDependencies, mailDependencies] = await Promise.all([
      dependencies(db, workspace.id, target, false),
      dependencies(db, workspace.id, target, true),
    ]);
    const guestbook: Connection = {
      id: "guestbook-owner",
      name: "Owned visitor books",
      target: resourceTarget,
      credentialReferences: ["GUESTBOOK_OWNER_TOKEN"],
      bindingAvailable: Boolean(
        runtime.GUESTBOOK && typeof runtime.GUESTBOOK.fetch === "function",
      ),
      credentialPresent: present(runtime.GUESTBOOK_OWNER_TOKEN),
      declaredUse: [
        "Scoped Guestbook resource reads and writes through the maintained adapter",
        "Creator stacks, app configuration and private enquiries",
      ],
      verifiedCapabilities: [],
      status: "metadata-only",
      checkedAt: null,
      checkOutcome: "not-checked",
      source: null,
      expiresAt: null,
      note: "Reference availability is metadata, not a verified credential or grant. Check an owned resource to prove only the supported read capability.",
      dependencies: appDependencies,
    };
    if (!guestbook.bindingAvailable || !guestbook.credentialPresent)
      guestbook.status = "not-configured";
    if (input.action === "check") {
      guestbook.checkedAt = new Date().toISOString();
      const resource = await db
        .prepare(
          "SELECT id FROM creator_app_resources WHERE workspace_id=? AND app='guestbook' AND account_id=? AND environment=? AND target=? AND state='ready' ORDER BY id LIMIT 1",
        )
        .bind(workspace.id, target.account, target.environment, resourceTarget)
        .first<{ id: string }>();
      if (
        !guestbook.bindingAvailable ||
        !guestbook.credentialPresent ||
        !resource
      ) {
        guestbook.status =
          !guestbook.bindingAvailable || !guestbook.credentialPresent
            ? "not-configured"
            : "unknown";
        guestbook.checkOutcome = "unavailable";
        guestbook.note = !resource
          ? "No ready visitor book in this exact workspace/account/environment can be read. Prepare one through Creator stacks first; no service request was made."
          : "The required server binding or credential reference is absent. No service request was made.";
      } else {
        requireCapability(await membership(db, workspace.id, user.id), "save");
        const statuses: number[] = [];
        let interrupted = false;
        try {
          const service = runtime.GUESTBOOK!;
          const observedRuntime: Runtime = {
            ...runtime,
            GUESTBOOK: {
              async fetch(request: Request) {
                // status() awaits public source verification before dispatching
                // its authenticated read. Recheck the live local grant and exact
                // resource after that wait, before forwarding any credential.
                if (request.headers.has("Authorization")) {
                  if (
                    request.method !== "GET" ||
                    request.url !==
                      resourceTarget + "/api/resources/" + resource.id
                  )
                    throw Error("Unexpected connection read");
                  const currentResource = await db
                    .prepare(
                      "SELECT id FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook' AND account_id=? AND environment=? AND target=? AND state='ready'",
                    )
                    .bind(
                      resource.id,
                      workspace.id,
                      target.account,
                      target.environment,
                      resourceTarget,
                    )
                    .first();
                  if (!currentResource)
                    throw Error("Resource changed before read");
                  requireCapability(
                    await membership(db, workspace.id, user.id),
                    "save",
                  );
                }
                try {
                  const response = await service.fetch(request);
                  statuses.push(response.status);
                  return response;
                } catch {
                  interrupted = true;
                  throw Error("App read interrupted");
                }
              },
            },
          };
          await resourceConnection(observedRuntime, workspace.id).status(
            resource.id,
          );
          const current = await db
            .prepare(
              "SELECT id FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook' AND account_id=? AND environment=? AND target=? AND state='ready'",
            )
            .bind(
              resource.id,
              workspace.id,
              target.account,
              target.environment,
              resourceTarget,
            )
            .first();
          if (!current) throw Error("Resource changed");
          guestbook.status = "read-verified";
          guestbook.checkOutcome = "passed";
          guestbook.verifiedCapabilities = ["read-owned-resource"];
          guestbook.source = appSettings.guestbook.source.commit;
          guestbook.note =
            "The maintained adapter verified the exact app source, account/environment and authenticated read of one owned resource. Writes, other resources, provider grants and credential expiry were not verified.";
        } catch {
          guestbook.checkOutcome = statuses.some(
            (code) => code === 401 || code === 403,
          )
            ? "denied"
            : statuses.includes(429)
              ? "rate-limited"
              : interrupted ||
                  statuses.length === 0 ||
                  statuses.some((code) => code >= 500)
                ? "unavailable"
                : "mismatch";
          guestbook.status =
            guestbook.checkOutcome === "denied" ||
            guestbook.checkOutcome === "mismatch"
              ? "needs-attention"
              : "unknown";
          guestbook.note =
            guestbook.checkOutcome === "denied"
              ? "The app denied a required read. Credential validity remains unverified; review its scope. No write was attempted."
              : guestbook.checkOutcome === "rate-limited"
                ? "The app rate-limited the read. Its credential is not verified; wait before another deliberate check."
                : guestbook.checkOutcome === "unavailable"
                  ? "The app read was unavailable or interrupted. Credential validity remains unknown; no automatic retry was made."
                  : "The app source, account, environment or resource response did not match the maintained contract. Review the connection before using it.";
        }
      }
    }
    const mail: Connection = {
      id: "owner-mail",
      name: "Owner email transport",
      target: "https://api.resend.com/emails",
      credentialReferences: [
        "RESEND_API_KEY",
        "RESEND_FROM_ADDRESS",
        "RESEND_ALLOWED_RECIPIENTS",
        "ENQUIRY_NOTIFICATION_RECIPIENT",
      ],
      bindingAvailable: true,
      credentialPresent: present(runtime.RESEND_API_KEY),
      declaredUse: [
        "Fixed Resend transport with the existing invited-recipient policy",
        "Explicit owner enquiry notifications where configured",
      ],
      verifiedCapabilities: [],
      status: present(runtime.RESEND_API_KEY)
        ? "metadata-only"
        : "not-configured",
      checkedAt: null,
      checkOutcome: "not-checked",
      source: null,
      expiresAt: null,
      note: "Only key-reference presence is shown. Sender/recipient policy, provider account, granted permissions, acceptance and delivery are not checked. This page never sends a test message. Use the scoped Inbox to inspect its actual configuration and outcomes.",
      dependencies: mailDependencies,
    };
    const role = await membership(db, workspace.id, user.id);
    requireCapability(role, "save");
    return connectionSnapshot.parse({
      ok: true,
      version: "composer.connections/1",
      workspace: { ...workspace, role },
      installation: target,
      metadataReadAt: new Date().toISOString(),
      encryptionCheckAvailable:
        user.role === 50 &&
        role === "owner" &&
        target.environment === "production",
      connections: [guestbook, mail],
    });
  } catch (cause) {
    return {
      ok: false as const,
      code: cause instanceof StackError ? cause.code : "UNAVAILABLE",
      message:
        cause instanceof StackError
          ? cause.message
          : "Connection metadata could not be confirmed for this selected workspace and environment.",
    };
  }
}
