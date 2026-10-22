import { z } from "zod";

export const collectionId = z.string().regex(/^[a-z0-9-]{6,64}$/);
export const collectionRevision = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const collectionSource = z
  .object({
    kind: z.literal("guestbook.resource"),
    version: z.literal(1),
    resource: collectionId,
    configuration: collectionRevision,
  })
  .strict();
export const collectionSelection = z
  .object({
    workspace: collectionId,
    stack: collectionId,
    instance: collectionId,
    expectedRevision: collectionRevision,
  })
  .strict();
export type CollectionSelection = z.infer<typeof collectionSelection>;
export type CollectionSource = z.infer<typeof collectionSource>;
export const collectionChoice = collectionSelection.extend({
  stackName: z.string().max(80),
  label: z.string().max(80),
  source: collectionSource,
  shared: z.boolean(),
});
export const collectionSourcesReply = z.object({
  ok: z.literal(true),
  supported: z.boolean(),
  message: z.string().max(500),
  workspace: collectionId.nullable(),
  workspaces: z
    .array(
      z.object({
        id: collectionId,
        name: z.string().max(80),
        role: z.enum(["owner", "editor"]),
      }),
    )
    .max(32),
  sources: z.array(collectionChoice).max(400),
});
export const collectionItemsReply = z.object({
  ok: z.literal(true),
  selection: collectionSelection,
  source: collectionSource,
  title: z.string().max(80),
  visible: z.boolean(),
  pending: z.boolean(),
  items: z
    .array(
      z.object({
        id: collectionId,
        caption: z.string().max(160),
        author: z.string().max(60),
      }),
    )
    .max(200),
});
export const collectionInvitationState = z
  .object({
    state: z.enum(["open", "paused", "closed", "full", "unavailable", "none"]),
    configuration: collectionRevision.optional(),
    contribute: z.string().url().max(2048).optional(),
    collection: z.string().url().max(2048).optional(),
  })
  .strict();
export const collectionInvitationReply = z.object({
  ok: z.literal(true),
  selection: collectionSelection,
  source: collectionSource,
  linked: collectionSource.nullable(),
  configured: z.boolean(),
  invitation: collectionInvitationState,
  outcome: z.enum(["applied", "unchanged", "refused", "unknown"]),
  message: z.string().max(500),
});
export type CollectionInvitationReply = z.infer<
  typeof collectionInvitationReply
>;
export const collectionReceipt = z
  .object({
    ok: z.literal(true),
    workspace: collectionId,
    source: collectionSource,
    item: collectionId,
    outcome: z.enum(["applied", "unchanged", "refused", "unknown"]),
    card: z
      .object({
        id: collectionId,
        status: z.enum(["draft", "published", "hidden"]),
      })
      .optional(),
    message: z.string().max(500),
  })
  .superRefine((value, context) => {
    if (["applied", "unchanged"].includes(value.outcome) && !value.card)
      context.addIssue({
        code: "custom",
        message: "A confirmed collection needs its exact saved card.",
      });
  });
export type CollectionReceipt = z.infer<typeof collectionReceipt>;
