import { z } from "zod";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

const workspace = z.object({
  id: z.string().max(64),
  name: z.string().max(60),
  role: z.enum(["owner", "editor", "viewer"]),
  revision: z.number().int().positive(),
});
export const grant = z.object({
  id: z.string().max(128),
  workspace: z.string().max(64),
  app: z.enum(["showcase", "guestbook"]),
  resource: z.string().max(128),
  action: z.enum([
    "create",
    "maintain",
    "publish",
    "export",
    "contribute",
    "moderate",
  ]),
  revision: z.number().int().positive(),
  status: z.enum(["active", "revoked"]).optional(),
  member: z.string().max(128).optional(),
  contributions: z.enum(["closed", "postcards", "members"]).optional(),
});
const invitation = z.object({
  id: z.string(),
  workspace: z.string(),
  email: z.string(),
  role: z.enum(["editor", "viewer"]),
  status: z.string(),
  revision: z.number(),
  expiresAt: z.string(),
  workspaceName: z.string().optional(),
  workspaceRevision: z.number().optional(),
});
export const session = z.object({
  ok: z.literal(true),
  actor: z.object({
    issuer: z.string(),
    subject: z.string(),
    name: z.string().nullable(),
  }),
  workspaces: z.array(workspace).max(32),
  incoming: z.array(invitation).max(50),
  grants: z.array(grant).max(512),
  operator: z.boolean(),
});
export type MemberSession = z.infer<typeof session>;
export type Grant = z.infer<typeof grant>;
export type Workspace = z.infer<typeof workspace>;

export async function memberCall(
  action: string,
  fields: Record<string, unknown> = {},
  reading = false,
): Promise<Record<string, unknown>> {
  const input = { action, ...fields };
  const path =
    "/_emdash/api/plugins/composer-members/" +
    (reading
      ? "read?" + new URLSearchParams(input as Record<string, string>)
      : "write");
  const response = await apiFetch(
    path,
    reading
      ? { cache: "no-store", redirect: "error" }
      : {
          method: "POST",
          redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
  ).catch(() => {
    throw Error(
      "Sign in with EmDash, then refresh your access. Your authentication system must admit you before workspace invitations can be accepted.",
    );
  });
  const value = await parseApiResponse<unknown>(
    response,
    "This action could not be confirmed. Your edits are retained; refresh access before retrying.",
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(
      "The server returned an unreadable result. Refresh access before retrying.",
    );
  const result = value as Record<string, unknown>;
  if (result.ok !== true)
    throw Object.assign(
      Error(
        typeof result.message === "string"
          ? result.message
          : "This action is unavailable.",
      ),
      { code: result.code },
    );
  return result;
}
export async function memberSession() {
  const result = session.safeParse(await memberCall("session", {}, true));
  if (!result.success)
    throw Error(
      "Your account access could not be read. Refresh before continuing; your edits are retained.",
    );
  return result.data;
}
export function sameAccount(a: MemberSession, b: MemberSession) {
  return (
    a.actor.issuer === b.actor.issuer && a.actor.subject === b.actor.subject
  );
}
export function actorConstraint(account: MemberSession) {
  return { issuer: account.actor.issuer, subject: account.actor.subject };
}
export function confirmedActor(
  reply: Record<string, unknown>,
  account: MemberSession,
) {
  const actor = reply.actor;
  return (
    !!actor &&
    typeof actor === "object" &&
    !Array.isArray(actor) &&
    (actor as Record<string, unknown>).issuer === account.actor.issuer &&
    (actor as Record<string, unknown>).subject === account.actor.subject
  );
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
