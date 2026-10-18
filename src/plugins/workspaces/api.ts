import { z } from "zod";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";

const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const role = z.enum(["owner", "editor", "viewer"]);
const invitation = z.object({
  id,
  workspace: id,
  email: z.email().max(254),
  role: z.enum(["editor", "viewer"]),
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  revision,
  expiresAt: z.iso.datetime(),
  createdAt: z.string().max(40),
  acceptedAt: z.string().max(40).nullable(),
});
const workspace = z.object({ id, name: z.string().max(60), role, revision });
const reply = z.object({
  ok: z.boolean(),
  code: z.string().max(80).optional(),
  message: z.string().max(1000).optional(),
  workspaces: z.array(workspace).max(32).optional(),
  incoming: z
    .array(
      invitation.extend({
        workspaceName: z.string().max(60),
        workspaceRevision: revision,
      }),
    )
    .max(50)
    .optional(),
  access: z
    .object({
      workspace,
      members: z
        .array(
          z.object({
            id: z
              .string()
              .min(1)
              .max(128)
              .regex(/^[A-Za-z0-9_-]+$/),
            role,
            name: z.string().max(200).nullable(),
            email: z.string().max(254).nullable(),
            personal: z.boolean(),
          }),
        )
        .max(64),
      invitations: z.array(invitation).max(50),
    })
    .optional(),
  changed: z
    .object({
      action: z.enum([
        "create",
        "invite",
        "revokeInvitation",
        "accept",
        "changeRole",
        "removeMember",
      ]),
      workspace: id,
      invitation: id.optional(),
    })
    .optional(),
});
export type AccessSnapshot = NonNullable<z.infer<typeof reply>["access"]>;
export type Workspace = z.infer<typeof workspace>;
export type Incoming = z.infer<typeof invitation> & {
  workspaceName: string;
  workspaceRevision: number;
};

export function decodeWorkspaceReply(action: string, value: unknown) {
  const parsed = reply.safeParse(value);
  if (!parsed.success)
    throw Error(
      "Workspace access was not confirmed. Your entries remain here; refresh access before trying again.",
    );
  const data = parsed.data;
  if (!data.ok)
    throw Object.assign(
      Error(data.message || "Workspace access is unavailable."),
      { code: data.code },
    );
  if (
    !data.workspaces ||
    !data.incoming ||
    (action === "open"
      ? !data.access
      : action !== "list" && data.changed?.action !== action) ||
    (action === "invite" && !data.changed?.invitation)
  )
    throw Error(
      "The server did not acknowledge this workspace action. Refresh access before retrying.",
    );
  return data;
}

export async function workspaceCall(
  action: string,
  fields: Record<string, unknown> = {},
) {
  const read = action === "list" || action === "open";
  const input = { action, ...fields };
  const path =
    "/_emdash/api/plugins/composer-stacks/" +
    (read
      ? "accessRead?" + new URLSearchParams(input as Record<string, string>)
      : "accessWrite");
  const response = await apiFetch(
    path,
    read
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
  );
  const value = await parseApiResponse<unknown>(
    response,
    "Workspace access could not be confirmed. Refresh before retrying; your entries are still here.",
  );
  return decodeWorkspaceReply(action, value);
}
