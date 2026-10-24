import { z } from "zod";
const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const scopeId = z.string().regex(/^[a-z0-9-]{1,40}$/);
export const overviewSources = [
  "platform",
  "workflows",
  "resources",
  "notifications",
] as const;
export const overviewSnapshot = z
  .object({
    ok: z.literal(true),
    version: z.literal("composer.overview/1"),
    workspace: z
      .object({
        id,
        name: z.string().max(120),
        role: z.enum(["owner", "editor", "viewer"]),
      })
      .passthrough(),
    target: z
      .object({
        account: z.string().min(1).max(80),
        environment: scopeId,
      })
      .strict(),
    // The selection the server actually read, so the UI never implies a
    // different app or environment than the records came from.
    selection: z.object({ app: scopeId.nullable() }).strict(),
    // Offer only scopes this workspace records for the configured account.
    available: z
      .object({
        workspaces: z
          .array(
            z
              .object({
                id,
                name: z.string().max(120),
                role: z.enum(["owner", "editor", "viewer"]),
              })
              .strict(),
          )
          .min(1)
          .max(32),
        environments: z.array(scopeId).min(1).max(8),
        apps: z
          .array(
            z
              .object({
                id: scopeId,
                resources: z.number().int().nonnegative(),
              })
              .strict(),
          )
          .max(20),
      })
      .strict(),
    checkedAt: z.iso.datetime(),
    rechecked: z
      .object({ source: z.enum(overviewSources), at: z.iso.datetime() })
      .strict()
      .optional(),
    sources: z
      .array(
        z
          .object({
            id: z.enum(overviewSources),
            label: z.string().max(80),
            status: z.enum(["checked", "unavailable", "restricted"]),
            count: z.number().int().nonnegative().nullable(),
            atLimit: z.boolean(),
            note: z.string().max(500),
          })
          .strict(),
      )
      .length(4),
    items: z
      .array(
        z
          .object({
            id: z.string().max(180),
            source: z.enum(overviewSources),
            // Which recorded app this problem belongs to, when it belongs to one.
            app: scopeId.nullable(),
            title: z.string().max(120),
            summary: z.string().max(500),
            action: z.string().max(80),
            href: z
              .string()
              .regex(
                /^\/_emdash\/admin\/plugins\/composer-stacks\/(platform|workflows|enquiries|resources)\?workspace=[a-z0-9-]+(?:&resource=[a-z0-9-]+)?#(?:platform-request|workflow-run|notification|ri-resource)-[a-z0-9-]+$/,
              ),
            count: z.number().int().positive().max(100),
            firstObserved: z.iso.datetime(),
            lastObserved: z.iso.datetime(),
          })
          .strict(),
      )
      .max(300),
  })
  .strict();
export type OverviewSnapshot = z.infer<typeof overviewSnapshot>;
