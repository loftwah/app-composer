import { z } from "zod";
const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
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
        environment: z.string().min(1).max(40),
      })
      .strict(),
    checkedAt: z.iso.datetime(),
    sources: z
      .array(
        z
          .object({
            id: z.enum(["platform", "workflows", "notifications"]),
            label: z.string().max(80),
            status: z.enum(["checked", "unavailable", "restricted"]),
            count: z.number().int().nonnegative().nullable(),
            atLimit: z.boolean(),
            note: z.string().max(500),
          })
          .strict(),
      )
      .length(3),
    items: z
      .array(
        z
          .object({
            id: z.string().max(180),
            source: z.enum(["platform", "workflows", "notifications"]),
            title: z.string().max(120),
            summary: z.string().max(500),
            action: z.string().max(80),
            href: z
              .string()
              .regex(
                /^\/_emdash\/admin\/plugins\/composer-stacks\/(platform|workflows|enquiries)\?workspace=[a-z0-9-]+(?:&resource=[a-z0-9-]+)?(?:&item=[a-z0-9-]+)?#(?:platform-request|workflow-run|notification)-[a-z0-9-]+$/,
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
