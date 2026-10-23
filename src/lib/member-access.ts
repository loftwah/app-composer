import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { StackError, membership } from "./stacks.mjs";
import {
  listWorkspaceAccess,
  readWorkspaceAccess,
  changeWorkspaceAccess,
} from "./workspace-access.ts";

export const memberIssuer = "https://composer.loftwah.com";
const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const account = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const capability = z.enum([
  "create",
  "maintain",
  "publish",
  "export",
  "contribute",
  "moderate",
]);
const app = z.enum(["showcase", "guestbook"]);
const grantSelector = {
  workspace: id,
  expectedRevision: revision,
  member: account,
  app,
  resource: id,
  capability,
};
const operation = z.enum([
  "create",
  "read",
  "config",
  "cards",
  "presentation",
  "tags",
  "achievements",
  "invitation",
  "share-card",
  "profile-settings",
  "export",
  "publish",
  "hide",
]);
const reads = z.discriminatedUnion("action", [
  z.object({ action: z.literal("session") }).strict(),
  z.object({ action: z.literal("people"), workspace: id }).strict(),
]);
const writes = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), ...grantSelector }).strict(),
  z
    .object({
      action: z.literal("revoke"),
      ...grantSelector,
      expectedGrantRevision: revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("profile"),
      workspace: id,
      operation,
      resource: id.optional(),
      expectedRevision: revision.optional(),
      command: z.unknown().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("guestbook"),
      workspace: id,
      resource: id,
      capability: z.enum(["contribute", "moderate"]),
      input: z.unknown(),
    })
    .strict(),
]);
export interface MemberUser {
  id: string;
  email: string;
  name: string | null;
  role: number;
}
export interface MemberContext {
  user?: MemberUser;
  request: Request;
  input: unknown;
}
interface Service {
  fetch(request: Request): Promise<Response>;
}
export interface MemberRuntime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  SHOWCASE?: Service;
  COMPOSER_PROFILE_BRIDGE_TOKEN?: unknown;
  GUESTBOOK_MEMBERS?: Service;
  GUESTBOOK_MEMBER_TOKEN?: unknown;
  RESOURCE_ACCOUNT_ID?: unknown;
  RESOURCE_ENVIRONMENT?: unknown;
}
export interface Grant {
  id: string;
  workspace_id: string;
  user_id: string;
  app: "showcase" | "guestbook";
  resource_id: string;
  action: z.infer<typeof capability>;
  revision: number;
  status: string;
  created_by: string;
}
const grantView = (g: Grant) => ({
  id: g.id,
  workspace: g.workspace_id,
  member: g.user_id,
  app: g.app,
  resource: g.resource_id,
  action: g.action,
  revision: g.revision,
  status: g.status,
});
const forbidden = () =>
  new StackError(
    "FORBIDDEN",
    "This account does not have the current permission for this app action.",
    403,
  );
const conflict = () =>
  new StackError(
    "CONFLICT",
    "Access changed. Refresh People before trying again.",
    409,
  );
function actor(user: MemberUser | undefined): MemberUser {
  if (
    !user ||
    !account.safeParse(user.id).success ||
    ![10, 20, 30, 40, 50].includes(user.role)
  )
    throw forbidden();
  return user;
}
async function grants(db: D1Database, user: string, workspace?: string) {
  return (
    await db
      .prepare(
        `SELECT g.* FROM creator_app_grants g JOIN creator_members m ON m.workspace_id=g.workspace_id AND m.user_id=g.user_id WHERE g.issuer=? AND g.user_id=? AND g.status='active' ${workspace ? "AND g.workspace_id=?" : ""} ORDER BY g.workspace_id,g.app,g.resource_id,g.action LIMIT 256`,
      )
      .bind(memberIssuer, user, ...(workspace ? [workspace] : []))
      .all<Grant>()
  ).results;
}
export async function requireAppGrant(
  db: D1Database,
  user: MemberUser,
  workspace: string,
  appName: string,
  resource: string,
  action: string,
) {
  actor(user);
  const grant = await db
    .prepare(
      `SELECT g.* FROM creator_app_grants g JOIN creator_members m ON m.workspace_id=g.workspace_id AND m.user_id=g.user_id WHERE g.issuer=? AND g.workspace_id=? AND g.user_id=? AND g.app=? AND g.resource_id=? AND g.action=? AND g.status='active'`,
    )
    .bind(memberIssuer, workspace, user.id, appName, resource, action)
    .first<Grant>();
  if (!grant) throw forbidden();
  return grant;
}
async function auditDispatch(db: D1Database, user: MemberUser, grant: Grant) {
  // This is the dispatch linearization point: the audit insert and current-grant
  // check are one SQL statement. Already dispatched app work may finish after a
  // revoke; no subsequent dispatch or entitlement binding can use that grant.
  const event = crypto.randomUUID();
  const result = await db
    .prepare(
      `INSERT INTO creator_app_access_audit(id,issuer,workspace_id,actor_id,member_id,app,resource_id,action,event,grant_revision) SELECT ?,?,?,?,?,?,?,?,'dispatch',? WHERE EXISTS(SELECT 1 FROM creator_app_grants g JOIN creator_members m ON m.workspace_id=g.workspace_id AND m.user_id=g.user_id WHERE g.id=? AND g.issuer=? AND g.user_id=? AND g.status='active' AND g.revision=?) RETURNING id`,
    )
    .bind(
      event,
      memberIssuer,
      grant.workspace_id,
      user.id,
      user.id,
      grant.app,
      grant.resource_id,
      grant.action,
      grant.revision,
      grant.id,
      memberIssuer,
      user.id,
      grant.revision,
    )
    .first();
  if (!result) throw forbidden();
}
async function changeGrant(
  db: D1Database,
  user: MemberUser,
  input: z.infer<typeof writes>,
) {
  if (input.action !== "grant" && input.action !== "revoke") throw forbidden();
  if ((await membership(db, input.workspace, user.id)) !== "owner")
    throw forbidden();
  const valid =
    input.app === "guestbook"
      ? ["contribute", "moderate"].includes(input.capability)
      : ["create", "maintain", "publish", "export"].includes(input.capability);
  if (
    !valid ||
    (input.app === "showcase" &&
      input.resource !== "new-profile" &&
      input.capability === "create")
  )
    throw new StackError("INVALID", "Choose a supported app permission.");
  if (input.app === "guestbook") {
    const resource = await db
      .prepare(
        "SELECT id FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook' AND state='ready'",
      )
      .bind(input.resource, input.workspace)
      .first();
    if (!resource) throw forbidden();
  }
  const nonce = crypto.randomUUID(),
    grantId = crypto.randomUUID();
  const current = await db
    .prepare(
      "SELECT * FROM creator_app_grants WHERE issuer=? AND workspace_id=? AND user_id=? AND app=? AND resource_id=? AND action=?",
    )
    .bind(
      memberIssuer,
      input.workspace,
      input.member,
      input.app,
      input.resource,
      input.capability,
    )
    .first<Grant>();
  if (
    input.action === "revoke" &&
    (!current ||
      current.status !== "active" ||
      current.revision !== input.expectedGrantRevision)
  )
    throw conflict();
  const condition =
    "EXISTS(SELECT 1 FROM creator_workspaces WHERE id=? AND access_mutation=?)";
  const common = [input.workspace, nonce];
  const selector = [
    memberIssuer,
    input.workspace,
    input.member,
    input.app,
    input.resource,
    input.capability,
  ];
  const result = await db.batch([
    db
      .prepare(
        `UPDATE creator_workspaces SET access_revision=access_revision+1,access_mutation=? WHERE id=? AND access_revision=? AND EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role='owner') AND EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=?) ${input.action === "revoke" ? "AND EXISTS(SELECT 1 FROM creator_app_grants WHERE id=? AND revision=? AND status='active')" : ""} RETURNING id`,
      )
      .bind(
        nonce,
        input.workspace,
        input.expectedRevision,
        input.workspace,
        user.id,
        input.workspace,
        input.member,
        ...(input.action === "revoke"
          ? [current!.id, input.expectedGrantRevision]
          : []),
      ),
    input.action === "grant"
      ? db
          .prepare(
            `INSERT INTO creator_app_grants(id,issuer,workspace_id,user_id,app,resource_id,action,created_by) SELECT ?,?,?,?,?,?,?,? WHERE ${condition} ON CONFLICT(issuer,workspace_id,user_id,app,resource_id,action) DO UPDATE SET status='active',revision=revision+1,created_by=excluded.created_by,updated_at=CURRENT_TIMESTAMP`,
          )
          .bind(grantId, ...selector, user.id, ...common)
      : db
          .prepare(
            `UPDATE creator_app_grants SET status='revoked',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE issuer=? AND workspace_id=? AND user_id=? AND app=? AND resource_id=? AND action=? AND ${condition}`,
          )
          .bind(...selector, ...common),
    db
      .prepare(
        `INSERT INTO creator_app_access_audit(id,issuer,workspace_id,actor_id,member_id,app,resource_id,action,event,grant_revision) SELECT ?,issuer,workspace_id,?,user_id,app,resource_id,action,?,revision FROM creator_app_grants WHERE issuer=? AND workspace_id=? AND user_id=? AND app=? AND resource_id=? AND action=? AND ${condition}`,
      )
      .bind(crypto.randomUUID(), user.id, input.action, ...selector, ...common),
  ]);
  if (!result[0]?.results?.[0]) throw conflict();
  return { action: input.action, workspace: input.workspace };
}
async function boundedReply(response: Response) {
  const reader = response.body?.getReader();
  if (!reader)
    throw new StackError("UNAVAILABLE", "The app response was empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 500000) {
      await reader.cancel();
      throw new StackError(
        "UNAVAILABLE",
        "The app response exceeded the supported size.",
      );
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const raw: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new StackError("UNAVAILABLE", "The app response was not recognised.");
  if (!response.ok)
    throw new StackError(
      response.status === 409
        ? "CONFLICT"
        : response.status === 403
          ? "FORBIDDEN"
          : "UNAVAILABLE",
      response.status === 409
        ? "This profile changed. Keep your edits and reload its saved version."
        : "The app refused this operation. Refresh its current state.",
      response.status,
    );
  return raw as Record<string, unknown>;
}
async function bindProfile(
  db: D1Database,
  user: MemberUser,
  workspace: string,
  resource: string,
  expected: number,
  entitlements: Grant[],
) {
  if (!id.safeParse(resource).success || resource === "new-profile")
    throw new StackError(
      "UNAVAILABLE",
      "The app returned an invalid profile identity.",
    );
  const nonce = crypto.randomUUID();
  const condition =
    "EXISTS(SELECT 1 FROM creator_workspaces WHERE id=? AND access_mutation=?)";
  const checks = entitlements
    .map(
      () =>
        "EXISTS(SELECT 1 FROM creator_app_grants WHERE id=? AND revision=? AND status='active')",
    )
    .join(" AND ");
  const result = await db.batch([
    db
      .prepare(
        `UPDATE creator_workspaces SET access_revision=access_revision+1,access_mutation=? WHERE id=? AND access_revision=? AND EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=?) AND ${checks} RETURNING id`,
      )
      .bind(
        nonce,
        workspace,
        expected,
        workspace,
        user.id,
        ...entitlements.flatMap((g) => [g.id, g.revision]),
      ),
    ...entitlements
      .filter((g) => g.action !== "create")
      .flatMap((g) => [
        db
          .prepare(
            `INSERT INTO creator_app_grants(id,issuer,workspace_id,user_id,app,resource_id,action,created_by) SELECT ?,?,?,?,'showcase',?,?,? WHERE ${condition} ON CONFLICT(issuer,workspace_id,user_id,app,resource_id,action) DO NOTHING`,
          )
          .bind(
            crypto.randomUUID(),
            memberIssuer,
            workspace,
            user.id,
            resource,
            g.action,
            g.created_by ?? user.id,
            workspace,
            nonce,
          ),
        db
          .prepare(
            `INSERT INTO creator_app_access_audit(id,issuer,workspace_id,actor_id,member_id,app,resource_id,action,event,grant_revision) SELECT ?,issuer,workspace_id,?,user_id,app,resource_id,action,'bind',revision FROM creator_app_grants WHERE issuer=? AND workspace_id=? AND user_id=? AND app='showcase' AND resource_id=? AND action=? AND status='active' AND ${condition}`,
          )
          .bind(
            crypto.randomUUID(),
            user.id,
            memberIssuer,
            workspace,
            user.id,
            resource,
            g.action,
            workspace,
            nonce,
          ),
      ]),
    db
      .prepare(
        `UPDATE creator_app_grants SET status='revoked',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE issuer=? AND workspace_id=? AND user_id=? AND app='showcase' AND resource_id='new-profile' AND ${condition}`,
      )
      .bind(memberIssuer, workspace, user.id, workspace, nonce),
  ]);
  if (!result[0]?.results?.[0])
    throw new StackError(
      "FORBIDDEN",
      "Access changed while the app was working. Its draft is preserved; ask the owner to review access.",
      403,
    );
}
export async function dispatchMemberApp(
  db: D1Database,
  user: MemberUser,
  input: z.infer<typeof writes>,
  runtime: MemberRuntime,
  pins: Record<string, string>,
) {
  if (input.action === "profile") {
    if (
      !runtime.SHOWCASE ||
      typeof runtime.COMPOSER_PROFILE_BRIDGE_TOKEN !== "string" ||
      !runtime.COMPOSER_PROFILE_BRIDGE_TOKEN ||
      !/^[a-f0-9]{40}$/.test(pins.showcase ?? "")
    )
      throw new StackError(
        "UNAVAILABLE",
        "Profile editing is not connected in this environment.",
      );
    const requested = input.resource ?? "new-profile";
    const action =
      input.operation === "create"
        ? "create"
        : input.operation === "export" ||
            (input.operation === "profile-settings" &&
              typeof input.command === "object" &&
              input.command !== null &&
              (("operation" in input.command &&
                input.command.operation === "export") ||
                ("action" in input.command &&
                  ["export", "download"].includes(
                    String(input.command.action),
                  ))))
          ? "export"
          : ["publish", "hide", "share-card"].includes(input.operation)
            ? "publish"
            : "maintain";
    let grant: Grant;
    try {
      grant = await requireAppGrant(
        db,
        user,
        input.workspace,
        "showcase",
        requested,
        action,
      );
    } catch (cause) {
      if (requested === "new-profile" && input.operation === "read")
        grant = await requireAppGrant(
          db,
          user,
          input.workspace,
          "showcase",
          requested,
          "create",
        );
      else throw cause;
    }
    const first = requested === "new-profile";
    if (first && !["create", "read"].includes(input.operation))
      throw forbidden();
    const entitlements = first
      ? (await grants(db, user.id, input.workspace)).filter(
          (g) => g.app === "showcase" && g.resource_id === "new-profile",
        )
      : [];
    const workspace = first
      ? await db
          .prepare("SELECT access_revision FROM creator_workspaces WHERE id=?")
          .bind(input.workspace)
          .first<{ access_revision: number }>()
      : null;
    const request = new Request(
      memberIssuer + "/showcase/api/member-profiles",
      {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: "Bearer " + runtime.COMPOSER_PROFILE_BRIDGE_TOKEN,
          "Content-Type": "application/json",
          "X-Composer-Source": pins.showcase!,
          "X-Composer-Target": memberIssuer + "/showcase",
        },
        body: JSON.stringify({
          version: 1,
          actor: { issuer: memberIssuer, subject: user.id },
          operation: input.operation,
          ...(input.resource ? { resource: input.resource } : {}),
          ...(input.expectedRevision
            ? { expectedRevision: input.expectedRevision }
            : {}),
          ...(input.command !== undefined ? { command: input.command } : {}),
        }),
      },
    );
    await auditDispatch(db, user, grant);
    const result = await boundedReply(await runtime.SHOWCASE.fetch(request));
    if (input.resource && result.resource !== input.resource)
      throw new StackError(
        "UNAVAILABLE",
        "The app confirmed a different profile. Keep your edits and reload.",
      );
    if (result.ok !== true)
      throw new StackError(
        "UNAVAILABLE",
        "The profile operation was not confirmed. Reload before retrying.",
      );
    if (first && result.profile !== null) {
      if (typeof result.resource !== "string" || !workspace)
        throw new StackError(
          "UNAVAILABLE",
          "The app did not confirm its profile identity.",
        );
      await bindProfile(
        db,
        user,
        input.workspace,
        result.resource,
        workspace.access_revision,
        entitlements,
      );
    }
    // A response arriving after revocation/account switch carries its original
    // actor for the client generation check, never a replacement account.
    return { result, actor: { issuer: memberIssuer, subject: user.id } };
  }
  if (input.action !== "guestbook") throw forbidden();
  const token = runtime.GUESTBOOK_MEMBER_TOKEN,
    target = memberIssuer + "/guestbook";
  if (
    !runtime.GUESTBOOK_MEMBERS ||
    typeof token !== "string" ||
    !token ||
    typeof runtime.RESOURCE_ACCOUNT_ID !== "string" ||
    typeof runtime.RESOURCE_ENVIRONMENT !== "string" ||
    !/^[a-f0-9]{40}$/.test(pins.guestbook ?? "")
  )
    throw new StackError(
      "UNAVAILABLE",
      "The selected Guestbook is not connected in this environment.",
    );
  const selected = await db
    .prepare(
      "SELECT id FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook' AND state='ready' AND account_id=? AND environment=? AND target=?",
    )
    .bind(
      input.resource,
      input.workspace,
      runtime.RESOURCE_ACCOUNT_ID,
      runtime.RESOURCE_ENVIRONMENT,
      target,
    )
    .first();
  if (!selected) throw forbidden();
  const request = new Request(target + "/__composer/member", {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "X-Composer-Workspace": input.workspace,
      "X-Composer-Account": runtime.RESOURCE_ACCOUNT_ID,
      "X-Composer-Environment": runtime.RESOURCE_ENVIRONMENT,
      "X-Composer-Source": pins.guestbook!,
      "X-Composer-Target": target,
    },
    body: JSON.stringify({
      schema: "composer.member-operation/1",
      actor: { issuer: memberIssuer, accountId: user.id },
      workspace: input.workspace,
      resource: input.resource,
      action: input.capability,
      input: input.input,
    }),
  });
  const grant = await requireAppGrant(
    db,
    user,
    input.workspace,
    "guestbook",
    input.resource,
    input.capability,
  );
  await auditDispatch(db, user, grant);
  const result = await boundedReply(
    await runtime.GUESTBOOK_MEMBERS.fetch(request),
  );
  const receipt = (
    input.capability === "contribute"
      ? z.object({
          id: z.string().min(1).max(128),
          resource: z.literal(input.resource),
          status: z.literal("pending"),
          message: z.string().max(500),
        })
      : z.object({
          contract: z.literal(1),
          resource: z.object({
            id: z.literal(input.resource),
            version: z.number().int().nonnegative(),
          }),
        })
  ).safeParse(result);
  if (!receipt.success)
    throw new StackError(
      "UNAVAILABLE",
      "The app did not confirm the selected Guestbook resource.",
    );
  return { result, actor: { issuer: memberIssuer, subject: user.id } };
}
export async function manageMembers(
  ctx: MemberContext,
  runtime: MemberRuntime,
  pins: Record<string, string>,
) {
  try {
    const user = actor(ctx.user),
      db = runtime.DB;
    if (runtime.PUBLIC_ORIGIN !== memberIssuer || !db)
      throw new StackError(
        "UNAVAILABLE",
        "Member access is disconnected in this environment.",
      );
    const origin = ctx.request.headers.get("Origin");
    if (
      (origin && origin !== memberIssuer) ||
      ctx.request.headers.get("X-EmDash-Request") !== "1" ||
      (ctx.request.method !== "GET" && origin !== memberIssuer)
    )
      throw forbidden();
    const session = async () => ({
      actor: { issuer: memberIssuer, subject: user.id, name: user.name },
      operator: user.role === 50,
      ...(await listWorkspaceAccess(db, user, Date.now(), true)),
      grants: (await grants(db, user.id)).map(grantView),
    });
    if (ctx.request.method === "GET") {
      const parsed = reads.safeParse(ctx.input);
      if (!parsed.success)
        throw new StackError("INVALID", "Choose a supported member view.");
      if (parsed.data.action === "session")
        return { ok: true, ...(await session()) };
      const workspace = parsed.data.workspace;
      if ((await membership(db, workspace, user.id)) !== "owner")
        throw forbidden();
      const access = await readWorkspaceAccess(
        db,
        user,
        workspace,
        Date.now(),
        true,
      );
      const all = (
        await db
          .prepare(
            "SELECT * FROM creator_app_grants WHERE issuer=? AND workspace_id=? ORDER BY user_id,app,resource_id,action LIMIT 256",
          )
          .bind(memberIssuer, workspace)
          .all<Grant>()
      ).results;
      const audit = (
        await db
          .prepare(
            "SELECT actor_id AS actor,member_id AS member,app,resource_id AS resource,action,event,grant_revision AS revision,created_at AS createdAt FROM creator_app_access_audit WHERE issuer=? AND workspace_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100",
          )
          .bind(memberIssuer, workspace)
          .all()
      ).results;
      const resources = (
        await db
          .prepare(
            "SELECT id, CASE WHEN json_valid(configuration_json) THEN coalesce(json_extract(configuration_json,'$.title'),json_extract(configuration_json,'$.config.title')) END AS name FROM creator_app_resources WHERE workspace_id=? AND app='guestbook' AND state='ready' ORDER BY created_at,id LIMIT 128",
          )
          .bind(workspace)
          .all<{ id: string; name: unknown }>()
      ).results.map((resource) => ({
        id: resource.id,
        name:
          typeof resource.name === "string" && resource.name.trim()
            ? resource.name.slice(0, 80)
            : "Visitor book",
      }));
      if ((await membership(db, workspace, user.id)) !== "owner")
        throw forbidden();
      return {
        ok: true,
        ...access,
        grants: all.map(grantView),
        resources,
        audit,
      };
    }
    if (ctx.request.method !== "POST")
      throw new StackError("INVALID", "Choose a supported member action.");
    const membershipCommand = z
      .looseObject({
        action: z.enum([
          "invite",
          "accept",
          "revokeInvitation",
          "removeMember",
          "changeRole",
        ]),
      })
      .safeParse(ctx.input);
    if (membershipCommand.success) {
      const changed = await changeWorkspaceAccess(
        db,
        user,
        ctx.input,
        Date.now(),
        true,
      );
      return { ok: true, changed, ...(await session()) };
    }
    const parsed = writes.safeParse(ctx.input);
    if (!parsed.success)
      throw new StackError(
        "INVALID",
        "Choose a supported app action and current revision.",
      );
    if (parsed.data.action === "grant" || parsed.data.action === "revoke") {
      const changed = await changeGrant(db, user, parsed.data);
      return { ok: true, changed, ...(await session()) };
    }
    return {
      ok: true,
      ...(await dispatchMemberApp(db, user, parsed.data, runtime, pins)),
      ...(await session()),
    };
  } catch (cause) {
    return cause instanceof StackError
      ? { ok: false, code: cause.code, message: cause.message }
      : {
          ok: false,
          code: "UNAVAILABLE",
          message:
            "The outcome could not be confirmed. Keep your edits and refresh current state before retrying.",
        };
  }
}
