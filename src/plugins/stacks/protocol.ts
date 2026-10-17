import { z } from "zod";
import { normaliseStack } from "../../lib/stacks.mjs";

const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const strings = z.record(z.string(), z.string());
const covers = z.record(z.string(), z.boolean());
const role = z.enum(["owner", "editor", "viewer"]);
const mode = z.enum(["own", "shared"]);
const canonicalDocument = z
  .object({
    version: z.literal(1),
    name: z.string(),
    description: z.string(),
    theme: z.enum(["daylight", "midnight"]),
    instances: z
      .array(
        z.object({
          id,
          app: z.string(),
          label: z.string(),
          caption: z.string(),
          visible: z.boolean(),
          binding: z.object({ mode, shareOf: id.nullable() }),
          config: strings,
        }),
      )
      .max(12),
  })
  .refine((value) => {
    try {
      normaliseStack(value);
      return true;
    } catch {
      return false;
    }
  }, "The saved stack does not match the app contract.");
// Earlier saved snapshots omit the optional instance binding/config fields.
// Upgrade only the editor's decoded copy; stored publication bytes stay exact.
const document = z.preprocess((value) => {
  try {
    return normaliseStack(value);
  } catch {
    return value;
  }
}, canonicalDocument);

const stack = z.object({
  id,
  slug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  revision,
  publishedRevision: revision.nullable(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
  draft: document,
  published: document.nullable(),
});
const entry = z.object({
  instanceId: id,
  app: z.string(),
  name: z.string(),
  configurable: z.boolean(),
  reason: z.string().optional(),
  settings: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.string(),
        overridden: z.boolean(),
      }),
    )
    .optional(),
});
const reply = z.object({
  ok: z.boolean(),
  code: z.string().max(80).optional(),
  message: z.string().max(1000).optional(),
  workspace: z.object({ id, name: z.string(), role }).optional(),
  stacks: z.array(stack).max(50).optional(),
  stack: stack.optional(),
  deleted: z
    .object({
      id,
      name: z.string(),
      slug: z.string().optional(),
      removedPublications: z.boolean().optional(),
    })
    .optional(),
  publications: z
    .array(
      z.object({
        revision,
        publishedAt: z.string(),
        document: document.nullable(),
      }),
    )
    .max(50)
    .optional(),
  instances: z
    .array(
      z.object({
        app: z.string(),
        name: z.string(),
        mode,
        shareOf: id.nullable(),
        declared: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            type: z.string(),
            default: z.string(),
            maxLength: z.number().nullable(),
            options: z.array(z.string()).nullable(),
          }),
        ),
        capabilities: z.array(z.string()),
        config: strings,
        source: strings.nullable(),
      }),
    )
    .max(12)
    .optional(),
  configuration: z
    .object({
      entries: z.array(entry).max(12),
      shared: z
        .array(
          z.object({
            instanceId: id,
            app: z.string(),
            name: z.string(),
            shareOf: id.nullable(),
          }),
        )
        .max(12),
    })
    .optional(),
  export: z
    .object({
      format: z.literal("app-composer.stack/v1"),
      stack: z.string(),
      revision,
      document,
      configuration: z
        .array(
          z.object({
            instance: id,
            app: z.string(),
            mode,
            shareOf: id.nullable(),
            settings: strings,
          }),
        )
        .max(12),
      covers,
    })
    .optional(),
  imported: z
    .object({
      name: z.string(),
      instances: z.number().int(),
      shared: z.number().int(),
      configured: z.number().int(),
      apps: z.array(z.string()),
      covers,
    })
    .optional(),
});

export function decodeStackReply(action: string, value: unknown) {
  const parsed = reply.safeParse(value);
  if (!parsed.success)
    throw Error(
      "The server response was incomplete. Your draft is still here; check the saved version before retrying.",
    );
  const data = parsed.data;
  if (!data.ok)
    throw Object.assign(
      Error(data.message || "The creator workspace is unavailable."),
      { code: data.code },
    );
  const valid =
    action === "list"
      ? data.workspace && data.stacks
      : [
            "create",
            "import",
            "open",
            "save",
            "publish",
            "unpublish",
            "archive",
            "restore",
            "republish",
            "restoreRevision",
            "duplicate",
          ].includes(action)
        ? data.stack
        : action === "delete"
          ? data.deleted
          : action === "export"
            ? data.export
            : action === "publications"
              ? data.publications
              : action === "configuration"
                ? data.configuration && data.instances
                : false;
  if (!valid)
    throw Error(
      "The server did not acknowledge this action. Your draft is still here; check the saved version before retrying.",
    );
  return data;
}
