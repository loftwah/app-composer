import { z } from "zod";

const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const source = z.string().regex(/^[a-f0-9]{40}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const settings = z
  .object({
    title: z.string().min(1).max(80),
    intro: z.string().max(240),
    theme: z.enum(["daylight", "midnight"]),
    layout: z.enum(["grid", "editorial"]),
    guestAccess: z.enum(["closed", "postcards"]),
  })
  .strict();
export const portableGuestbook = z
  .object({
    format: z.literal("guestbook.approved-portable/v1"),
    contract: z.literal(1),
    exportedAt: z.iso.datetime(),
    source: z
      .object({
        app: z.literal("guestbook"),
        build: source,
        resource: id,
        workspace: id,
        account: z.string().min(1).max(80),
        environment: z.string().min(1).max(40),
        target: z.url().max(256),
        version: revision,
      })
      .strict(),
    configuration: z
      .object({ revision, digest, source, values: settings })
      .strict(),
    items: z
      .array(
        z
          .object({
            id,
            revision,
            caption: z.string().max(160),
            author: z.string().max(60),
            synthetic: z.union([z.literal(0), z.literal(1)]),
            createdAt: z.string().max(40),
            media: z
              .object({
                type: z.literal("image/png"),
                sha256: digest,
                base64: z
                  .string()
                  .min(1)
                  .max(133336)
                  .regex(/^[A-Za-z0-9+/]+={0,2}$/),
              })
              .strict(),
          })
          .strict(),
      )
      .max(8),
    coverage: z
      .object({
        approvedOriginals: version,
        included: version.max(8),
        complete: z.boolean(),
        maximumItems: z.literal(8),
        privateContent: z.literal(false),
        credentials: z.literal(false),
        restoredCopies: z.literal(false),
      })
      .strict(),
    rights: z.literal(
      "No new licence is granted. Retain contributor consent and confirm your permission to copy.",
    ),
    limitation: z.literal(
      "Requires this live source authority. Restores are private, fresh copies; not offline or cross-account disaster recovery.",
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.coverage.included !== value.items.length ||
      value.coverage.approvedOriginals < value.items.length ||
      value.coverage.complete !==
        (value.coverage.approvedOriginals === value.items.length) ||
      new Set(value.items.map((item) => item.id)).size !== value.items.length
    )
      ctx.addIssue({
        code: "custom",
        message: "The approved export coverage disagrees.",
      });
  });
const configuration = z.object({ revision, digest, source });
const identity = z.object({
  account: z.string().min(1).max(80),
  environment: z.string().min(1).max(40),
  target: z.url().max(256),
  source,
});
const workspace = z.object({
  id,
  name: z.string().max(60),
  role: z.enum(["owner", "editor", "viewer"]),
});
const instance = z.object({
  id,
  label: z.string().max(60),
  app: z.string().max(80),
  resource: id.nullable(),
  state: z.enum(["unbound", "reserved", "ready", "unknown", "refused"]),
  shared: z.boolean(),
});
const stack = z.object({
  id,
  name: z.string().max(80),
  revision,
  status: z.enum(["draft", "published", "archived"]),
  instances: z.array(instance).max(12),
});
const check = z.object({
  stack: id,
  revision,
  instance: id,
  resource: id,
  checkedAt: z.iso.datetime(),
  outcome: z.enum(["matched", "stale", "unavailable", "pending"]),
  message: z.string().max(1000),
  expected: identity.extend({
    version,
    configuration: configuration.nullable(),
  }),
  actual: identity
    .extend({
      version,
      configuration: configuration.nullable(),
      visible: z.boolean(),
      paused: z.boolean(),
    })
    .nullable(),
  portabilitySupported: z.boolean(),
  coverage: z.object({
    source: z.enum(["matched", "unverified"]),
    resource: z.enum(["matched", "unverified", "different"]),
    workerDeployment: z.literal("unavailable"),
    media: z.literal("not-checked"),
    metrics: z.literal("unavailable"),
    costs: z.literal("unavailable"),
  }),
});
const reply = z.object({
  ok: z.boolean(),
  code: z.string().max(80).optional(),
  message: z.string().max(1000).optional(),
  workspace: workspace.optional(),
  stacks: z.array(stack).max(50).optional(),
  check: check.optional(),
  portable: portableGuestbook.optional(),
});
export type MaintenanceWorkspace = z.infer<typeof workspace>;
export type MaintenanceStack = z.infer<typeof stack>;
export type MaintenanceCheck = z.infer<typeof check>;
export type PortableGuestbook = z.infer<typeof portableGuestbook>;

export function decodeMaintenanceReply(action: string, raw: unknown) {
  const parsed = reply.safeParse(raw);
  if (!parsed.success)
    throw Error(
      "The maintenance response was not confirmed. Check again before relying on it.",
    );
  const value = parsed.data;
  if (!value.ok)
    throw Object.assign(Error(value.message || "Maintenance is unavailable."), {
      code: value.code,
    });
  if (
    !value.workspace ||
    (action === "list"
      ? !value.stacks
      : action === "check"
        ? !value.check
        : action !== "export" || !value.portable)
  )
    throw Error("The selected maintenance result was not confirmed.");
  return value;
}
