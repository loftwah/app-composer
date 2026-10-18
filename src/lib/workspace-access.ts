import type {
  D1Database,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import { z } from "zod";
import {
  StackError,
  workspaceForUser,
  membership,
  requireCapability,
} from "./stacks.mjs";

const origin = "https://composer.loftwah.com";
const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const memberId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const role = z.enum(["editor", "viewer"]);
const selected = { workspace: id, expectedRevision: revision };
const commands = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      name: z
        .string()
        .trim()
        .min(1)
        .max(60)
        .regex(/^[^\u0000-\u001f\u007f]+$/),
    })
    .strict(),
  z
    .object({ action: z.literal("invite"), ...selected, email: email, role })
    .strict(),
  z
    .object({
      action: z.literal("revokeInvitation"),
      ...selected,
      invitation: id,
      invitationRevision: revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("accept"),
      ...selected,
      invitation: id,
      invitationRevision: revision,
    })
    .strict(),
  z
    .object({
      action: z.literal("changeRole"),
      ...selected,
      member: memberId,
      expectedRole: role,
      role,
    })
    .strict(),
  z
    .object({
      action: z.literal("removeMember"),
      ...selected,
      member: memberId,
      expectedRole: role,
    })
    .strict(),
]);
interface User {
  id: string;
  email: string;
  name: string | null;
  role: number;
}
interface Context {
  user?: User;
  request: Request;
  input: unknown;
}
interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
}
interface WorkspaceRow {
  id: string;
  name: string;
  access_revision: number;
}
interface InvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role: "editor" | "viewer";
  status: "pending" | "accepted" | "revoked" | "expired";
  revision: number;
  expires_at: number;
  created_at: string;
  accepted_at: string | null;
}
const conflict = () =>
  new StackError(
    "CONFLICT",
    "Workspace access changed. Refresh its current members and invitations before trying again.",
    409,
  );
const requireAdministrator = (user: User) => {
  if (!user || user.role !== 50 || typeof user.id !== "string" || !user.id)
    throw new StackError(
      "FORBIDDEN",
      "An invited Composer administrator is required. Workspace membership does not grant CMS access.",
      403,
    );
};
const trustedEmail = (user: User) => {
  const parsed = email.safeParse(user.email);
  if (!parsed.success)
    throw new StackError(
      "FORBIDDEN",
      "A trusted administrator email is required for workspace invitations.",
      403,
    );
  return parsed.data;
};
const invitationView = (row: InvitationRow, now: number) => ({
  id: row.id,
  workspace: row.workspace_id,
  email: row.email,
  role: row.role,
  status:
    row.status === "pending" && row.expires_at <= now
      ? ("expired" as const)
      : row.status,
  revision: row.revision,
  expiresAt: new Date(row.expires_at).toISOString(),
  createdAt: row.created_at,
  acceptedAt: row.accepted_at,
});

export async function listWorkspaceAccess(
  db: D1Database,
  user: User,
  now = Date.now(),
) {
  requireAdministrator(user);
  await workspaceForUser(db, user);
  const spaces = await db
    .prepare(
      `SELECT w.id,w.name,w.access_revision AS revision,m.role
    FROM creator_members m JOIN creator_workspaces w ON w.id=m.workspace_id
    WHERE m.user_id=? ORDER BY CASE WHEN w.id=(SELECT workspace_id FROM creator_personal_workspaces WHERE user_id=?) THEN 0 ELSE 1 END,m.created_at,w.id LIMIT 32`,
    )
    .bind(user.id, user.id)
    .all();
  const recipient = email.safeParse(user.email);
  const invitations = recipient.success
    ? await db
        .prepare(
          `SELECT i.*,w.name AS workspace_name,w.access_revision
    FROM creator_workspace_invitations i JOIN creator_workspaces w ON w.id=i.workspace_id
    WHERE i.email=? AND i.status='pending' ORDER BY i.created_at DESC,i.id LIMIT 50`,
        )
        .bind(recipient.data)
        .all<
          InvitationRow & { workspace_name: string; access_revision: number }
        >()
    : { results: [] };
  return {
    workspaces: spaces.results,
    incoming: invitations.results.map((row) => ({
      ...invitationView(row, now),
      workspaceName: row.workspace_name,
      workspaceRevision: row.access_revision,
    })),
  };
}

export async function readWorkspaceAccess(
  db: D1Database,
  user: User,
  workspace: string,
  now = Date.now(),
) {
  requireAdministrator(user);
  const memberRole = await membership(db, workspace, user.id);
  requireCapability(memberRole, "read");
  const current = await db
    .prepare(
      "SELECT id,name,access_revision FROM creator_workspaces WHERE id=?",
    )
    .bind(workspace)
    .first<WorkspaceRow>();
  if (!current)
    throw new StackError("NOT_FOUND", "This workspace is unavailable.", 404);
  const owner = memberRole === "owner";
  const members = owner
    ? await db
        .prepare(
          `SELECT user_id AS id,role,display_name AS name,email,
    EXISTS(SELECT 1 FROM creator_personal_workspaces p WHERE p.workspace_id=m.workspace_id AND p.user_id=m.user_id) AS personal
    FROM creator_members m WHERE workspace_id=? ORDER BY created_at,user_id LIMIT 64`,
        )
        .bind(workspace)
        .all<{
          id: string;
          role: "owner" | "editor" | "viewer";
          name: string | null;
          email: string | null;
          personal: number;
        }>()
    : { results: [] };
  const invitations = owner
    ? await db
        .prepare(
          `SELECT * FROM creator_workspace_invitations WHERE workspace_id=?
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created_at DESC,id LIMIT 50`,
        )
        .bind(workspace)
        .all<InvitationRow>()
    : { results: [] };
  if ((await membership(db, workspace, user.id)) !== memberRole)
    throw new StackError(
      "FORBIDDEN",
      "Your workspace role changed. Refresh access before continuing.",
      403,
    );
  const stable = await db
    .prepare(
      "SELECT id FROM creator_workspaces WHERE id=? AND access_revision=?",
    )
    .bind(workspace, current.access_revision)
    .first();
  if (!stable) throw conflict();
  // No directory-wide user lookup: older member rows retain their identities,
  // and only the authenticated caller supplies their own current profile.
  return {
    workspace: {
      id: current.id,
      name: current.name,
      revision: current.access_revision,
      role: memberRole,
    },
    members: members.results.map((entry) => ({
      ...entry,
      name:
        entry.id === user.id ? (user.name?.slice(0, 200) ?? null) : entry.name,
      email: entry.id === user.id ? user.email : entry.email,
      personal: Boolean(entry.personal),
    })),
    invitations: invitations.results.map((row) => invitationView(row, now)),
  };
}

// The membership condition and operation-specific eligibility are inside the
// same D1 transaction as every write. A nonce prevents a losing CAS from using
// a different request's incremented workspace revision.
async function mutate(
  db: D1Database,
  workspace: string,
  expected: number,
  eligibility: string,
  eligibleValues: unknown[],
  build: (condition: string, values: string[]) => D1PreparedStatement[],
) {
  const nonce = crypto.randomUUID();
  const condition =
    "EXISTS(SELECT 1 FROM creator_workspaces WHERE id=? AND access_mutation=?)";
  const result = await db.batch([
    db
      .prepare(
        `UPDATE creator_workspaces SET access_revision=access_revision+1,access_mutation=?
      WHERE id=? AND access_revision=? AND (${eligibility}) RETURNING *`,
      )
      .bind(nonce, workspace, expected, ...eligibleValues),
    ...build(condition, [workspace, nonce]),
  ]);
  const row = result[0]?.results?.[0] as unknown as WorkspaceRow | undefined;
  if (!row) throw conflict();
  return row;
}
const ownerGuard =
  "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role='owner')";

export async function changeWorkspaceAccess(
  db: D1Database,
  user: User,
  input: unknown,
  now = Date.now(),
) {
  requireAdministrator(user);
  const parsed = commands.safeParse(input);
  if (!parsed.success)
    throw new StackError(
      "INVALID",
      "Choose a supported workspace action and its current access revision.",
    );
  const command = parsed.data;
  if (command.action === "create") {
    await workspaceForUser(db, user);
    const workspace = crypto.randomUUID();
    const result = await db.batch([
      db
        .prepare(
          `INSERT INTO creator_workspaces(id,name) SELECT ?,?
        WHERE (SELECT COUNT(*) FROM creator_members WHERE user_id=?)<32 RETURNING *`,
        )
        .bind(workspace, command.name, user.id),
      db
        .prepare(
          `INSERT INTO creator_members(workspace_id,user_id,role,display_name,email)
        SELECT ?,?,'owner',?,? WHERE EXISTS(SELECT 1 FROM creator_workspaces WHERE id=?)`,
        )
        .bind(
          workspace,
          user.id,
          user.name?.slice(0, 200) ?? null,
          user.email,
          workspace,
        ),
    ]);
    if (!result[0]?.results?.[0])
      throw new StackError(
        "CONFLICT",
        "This account already has the supported 32 workspaces.",
        409,
      );
    return { action: command.action, workspace };
  }
  if (command.action === "accept") {
    const recipient = trustedEmail(user);
    const eligible = `EXISTS(SELECT 1 FROM creator_workspace_invitations WHERE id=? AND workspace_id=? AND email=?
      AND revision=? AND status='pending' AND expires_at>?)
      AND NOT EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=?)
      AND (SELECT COUNT(*) FROM creator_members WHERE workspace_id=?)<64
      AND (SELECT COUNT(*) FROM creator_members WHERE user_id=?)<32`;
    await mutate(
      db,
      command.workspace,
      command.expectedRevision,
      eligible,
      [
        command.invitation,
        command.workspace,
        recipient,
        command.invitationRevision,
        now,
        command.workspace,
        user.id,
        command.workspace,
        user.id,
      ],
      (condition, values) => [
        db
          .prepare(
            `UPDATE creator_workspace_invitations SET status='accepted',revision=revision+1,accepted_by=?,accepted_at=CURRENT_TIMESTAMP
          WHERE id=? AND ${condition}`,
          )
          .bind(user.id, command.invitation, ...values),
        db
          .prepare(
            `INSERT INTO creator_members(workspace_id,user_id,role,display_name,email)
          SELECT workspace_id,?,role,?,? FROM creator_workspace_invitations
          WHERE id=? AND workspace_id=? AND accepted_by=? AND status='accepted' AND ${condition}`,
          )
          .bind(
            user.id,
            user.name?.slice(0, 200) ?? null,
            recipient,
            command.invitation,
            command.workspace,
            user.id,
            ...values,
          ),
      ],
    );
    return { action: command.action, workspace: command.workspace };
  }
  if ((await membership(db, command.workspace, user.id)) !== "owner")
    throw new StackError(
      "FORBIDDEN",
      "Only a workspace owner can manage its members and invitations.",
      403,
    );
  const ownerValues = [command.workspace, user.id];
  if (command.action === "invite") {
    if (command.email === trustedEmail(user))
      throw new StackError(
        "INVALID",
        "You already own this workspace. Invite another administrator.",
      );
    const invitation = crypto.randomUUID();
    const eligible = `${ownerGuard} AND NOT EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND lower(email)=?)
      AND NOT EXISTS(SELECT 1 FROM creator_workspace_invitations WHERE workspace_id=? AND email=? AND status='pending' AND expires_at>?)
      AND (SELECT COUNT(*) FROM creator_workspace_invitations WHERE workspace_id=? AND status='pending' AND expires_at>?)<32`;
    await mutate(
      db,
      command.workspace,
      command.expectedRevision,
      eligible,
      [
        ...ownerValues,
        command.workspace,
        command.email,
        command.workspace,
        command.email,
        now,
        command.workspace,
        now,
      ],
      (condition, values) => [
        db
          .prepare(
            `UPDATE creator_workspace_invitations SET status='expired',revision=revision+1
          WHERE workspace_id=? AND email=? AND status='pending' AND expires_at<=? AND ${condition}`,
          )
          .bind(command.workspace, command.email, now, ...values),
        db
          .prepare(
            `INSERT INTO creator_workspace_invitations(id,workspace_id,email,role,expires_at,created_by)
          SELECT ?,?,?,?,?,? WHERE ${condition}`,
          )
          .bind(
            invitation,
            command.workspace,
            command.email,
            command.role,
            now + 7 * 86400000,
            user.id,
            ...values,
          ),
      ],
    );
    return { action: command.action, workspace: command.workspace, invitation };
  }
  if (command.action === "revokeInvitation") {
    await mutate(
      db,
      command.workspace,
      command.expectedRevision,
      `${ownerGuard} AND EXISTS(SELECT 1 FROM creator_workspace_invitations WHERE id=? AND workspace_id=? AND revision=? AND status='pending')`,
      [
        ...ownerValues,
        command.invitation,
        command.workspace,
        command.invitationRevision,
      ],
      (condition, values) => [
        db
          .prepare(
            `UPDATE creator_workspace_invitations SET status='revoked',revision=revision+1 WHERE id=? AND ${condition}`,
          )
          .bind(command.invitation, ...values),
      ],
    );
    return { action: command.action, workspace: command.workspace };
  }
  // Owner changes, original personal ownership and workspace deletion are
  // deliberately outside this routine collaboration contract.
  const eligible = `${ownerGuard} AND EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role=? AND role!='owner')
    AND NOT EXISTS(SELECT 1 FROM creator_personal_workspaces WHERE workspace_id=? AND user_id=?)`;
  await mutate(
    db,
    command.workspace,
    command.expectedRevision,
    eligible,
    [
      ...ownerValues,
      command.workspace,
      command.member,
      command.expectedRole,
      command.workspace,
      command.member,
    ],
    (condition, values) => [
      command.action === "changeRole"
        ? db
            .prepare(
              `UPDATE creator_members SET role=? WHERE workspace_id=? AND user_id=? AND ${condition}`,
            )
            .bind(command.role, command.workspace, command.member, ...values)
        : db
            .prepare(
              `DELETE FROM creator_members WHERE workspace_id=? AND user_id=? AND ${condition}`,
            )
            .bind(command.workspace, command.member, ...values),
    ],
  );
  return { action: command.action, workspace: command.workspace };
}

export async function manageWorkspaceAccess(ctx: Context, runtime: Runtime) {
  const fail = (code: string, message: string) => ({
    ok: false as const,
    code,
    message,
  });
  if (!ctx.user || ctx.user.role !== 50)
    return fail(
      "FORBIDDEN",
      "An invited Composer administrator is required. Workspace membership does not grant CMS access.",
    );
  if (runtime.PUBLIC_ORIGIN !== origin || !runtime.DB)
    return fail(
      "UNAVAILABLE",
      "Workspace access is disconnected in this environment.",
    );
  const requestOrigin = ctx.request.headers.get("Origin");
  const reading = ctx.request.method === "GET";
  if (
    (requestOrigin && requestOrigin !== origin) ||
    (!reading &&
      (requestOrigin !== origin ||
        ctx.request.headers.get("X-EmDash-Request") !== "1"))
  )
    return fail("FORBIDDEN", "Open this action from Composer administration.");
  try {
    const now = Date.now();
    if (reading) {
      const parsed = z
        .object({ action: z.enum(["list", "open"]), workspace: id.optional() })
        .strict()
        .safeParse(ctx.input);
      if (!parsed.success)
        throw new StackError("INVALID", "Choose a supported workspace view.");
      if (parsed.data.action === "list")
        return {
          ok: true as const,
          ...(await listWorkspaceAccess(runtime.DB, ctx.user, now)),
        };
      if (!parsed.data.workspace)
        throw new StackError("INVALID", "Choose a workspace.");
      const access = await readWorkspaceAccess(
        runtime.DB,
        ctx.user,
        parsed.data.workspace,
        now,
      );
      return {
        ok: true as const,
        ...(await listWorkspaceAccess(runtime.DB, ctx.user, now)),
        access,
      };
    }
    if (ctx.request.method !== "POST")
      return fail("INVALID", "Choose a supported workspace action.");
    const changed = await changeWorkspaceAccess(
      runtime.DB,
      ctx.user,
      ctx.input,
      now,
    );
    return {
      ok: true as const,
      changed,
      ...(await listWorkspaceAccess(runtime.DB, ctx.user, now)),
    };
  } catch (cause) {
    return cause instanceof StackError
      ? fail(cause.code, cause.message)
      : fail(
          "UNAVAILABLE",
          "Workspace access could not be confirmed. Keep your entries and refresh the current members and invitations before retrying.",
        );
  }
}
