import { z } from "zod";
export const teamHubWorkspace = z.string().regex(/^[a-z0-9-]{6,64}$/);
export const teamHubUser = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const teamHubId = z.string().uuid();
export const teamHubRevision = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER - 1);
export const teamHubAttachment = z
  .object({
    name: z
      .string()
      .min(5)
      .max(80)
      .regex(/^[A-Za-z0-9_. -]+\.txt$/),
    text: z.string().max(16000),
  })
  .strict();
export const teamHubRequest = z
  .object({
    title: z.string().trim().min(2).max(100),
    body: z.string().trim().min(2).max(3000),
    assignee: teamHubUser.nullable(),
    status: z.enum(["open", "in-progress", "done"]),
    attachment: teamHubAttachment.nullable(),
  })
  .strict();
export type TeamHubRequest = z.infer<typeof teamHubRequest>;
export const teamHubCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("scope") }).strict(),
  z
    .object({
      action: z.enum(["read", "connection"]),
      workspace: teamHubWorkspace,
    })
    .strict(),
  z
    .object({
      action: z.literal("enable"),
      workspace: teamHubWorkspace,
      expectedRevision: z.literal(0),
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      workspace: teamHubWorkspace,
      expectedRevision: teamHubRevision,
      id: teamHubId,
      expectedRequestRevision: teamHubRevision,
      request: teamHubRequest,
    })
    .strict(),
  z
    .object({
      action: z.literal("grant"),
      workspace: teamHubWorkspace,
      expectedRevision: teamHubRevision,
      member: teamHubUser,
      capability: z.enum(["use", "manage"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("revoke"),
      workspace: teamHubWorkspace,
      expectedRevision: teamHubRevision,
      grant: teamHubId,
      expectedGrantRevision: teamHubRevision,
    })
    .strict(),
  z
    .object({
      action: z.enum(["history", "attachment"]),
      workspace: teamHubWorkspace,
      id: teamHubId,
    })
    .strict(),
]);
export const teamHubSnapshot = z.object({
  ok: z.literal(true),
  version: z.literal("composer.team-hub/1"),
  target: z.object({
    workspace: teamHubWorkspace,
    account: z.string().max(80),
    environment: z.enum(["production", "preview"]),
  }),
  actor: z.object({
    id: teamHubUser,
    name: z.string().nullable(),
    role: z.enum(["owner", "editor", "viewer"]),
    manage: z.boolean(),
  }),
  enabled: z.boolean(),
  revision: teamHubRevision,
  requests: z
    .array(
      z.object({
        id: teamHubId,
        revision: teamHubRevision,
        title: z.string().max(100),
        body: z.string().max(3000),
        assignee: teamHubUser.nullable(),
        status: z.enum(["open", "in-progress", "done"]),
        attachment: z
          .object({
            name: z.string().max(80),
            bytes: z.number().int().max(16000),
          })
          .nullable(),
        updatedAt: z.string().max(40),
      }),
    )
    .max(40),
  people: z
    .array(
      z.object({
        id: teamHubUser,
        name: z.string().nullable(),
        role: z.enum(["owner", "editor", "viewer"]),
        disabled: z.number().int(),
        grantId: teamHubId.nullable(),
        action: z.string().nullable(),
        status: z.string().nullable(),
        revision: teamHubRevision.nullable(),
      }),
    )
    .max(128),
  activity: z
    .array(
      z.object({
        event: z.string(),
        actor_id: teamHubUser,
        request_id: teamHubId.nullable(),
        member_id: teamHubUser.nullable(),
        created_at: z.string().max(40),
        hub_revision: teamHubRevision,
      }),
    )
    .max(30),
  authentication: z.object({
    profile: z.literal("native-local"),
    production: z.literal("unqualified"),
    passwordlessMfa: z.string().max(200),
  }),
});
export type TeamHubSnapshot = z.infer<typeof teamHubSnapshot>;
