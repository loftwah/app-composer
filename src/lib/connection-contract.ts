import { z } from "zod";

export const connectionSnapshot = z
  .object({
    ok: z.literal(true),
    version: z.literal("composer.connections/1"),
    workspace: z.object({
      id: z.string().regex(/^[a-z0-9-]{6,64}$/),
      name: z.string().max(80),
      role: z.enum(["owner", "editor"]),
    }),
    installation: z
      .object({ account: z.string().max(80), environment: z.string().max(40) })
      .strict(),
    metadataReadAt: z.iso.datetime(),
    connections: z
      .array(
        z
          .object({
            id: z.enum(["guestbook-owner", "owner-mail"]),
            name: z.string().max(80),
            target: z.string().max(120),
            credentialReferences: z.array(z.string().max(80)).max(5),
            bindingAvailable: z.boolean(),
            credentialPresent: z.boolean(),
            declaredUse: z.array(z.string().max(120)).max(5),
            verifiedCapabilities: z
              .array(z.literal("read-owned-resource"))
              .max(1),
            status: z.enum([
              "not-configured",
              "metadata-only",
              "read-verified",
              "needs-attention",
              "unknown",
            ]),
            checkedAt: z.iso.datetime().nullable(),
            checkOutcome: z.enum([
              "not-checked",
              "passed",
              "denied",
              "mismatch",
              "unavailable",
              "rate-limited",
            ]),
            note: z.string().max(800),
            source: z
              .string()
              .regex(/^[a-f0-9]{40}$/)
              .nullable(),
            expiresAt: z.null(),
            dependencies: z
              .object({
                available: z.boolean(),
                atLimit: z.boolean(),
                items: z
                  .array(
                    z
                      .object({
                        label: z.string().max(160),
                        href: z
                          .string()
                          .regex(
                            /^\/_emdash\/admin\/plugins\/composer-stacks\/(stacks|enquiries)\?workspace=[a-z0-9-]+(?:&(resource|stack)=[a-z0-9-]+)?$/,
                          ),
                      })
                      .strict(),
                  )
                  .max(50),
              })
              .strict(),
          })
          .strict(),
      )
      .length(2),
  })
  .strict();
export type ConnectionSnapshot = z.infer<typeof connectionSnapshot>;
