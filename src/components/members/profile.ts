import { z } from "zod";
import { shareCardSnapshot } from "../../lib/miniapp-share-card.mjs";

export const card = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  url: z.string().nullable(),
  provider: z.string().nullable(),
  item_id: z.string().nullable(),
  position: z.number(),
  status: z.enum(["draft", "published", "hidden"]),
});
const tag = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  citationLabel: z.string(),
  citationURL: z.string(),
  relatedLabel: z.string(),
  relatedURL: z.string(),
  status: z.enum(["draft", "published", "hidden"]),
});
const achievement = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.string(),
  url: z.string(),
  icon: z.string(),
  status: z.string(),
});
const collection = {
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
};
export const profile = z.object({
  version: z.literal(1),
  resource: z.uuid(),
  revision: z.number().int().positive(),
  handle: z.string().nullable(),
  visibility: z.enum(["draft", "published", "hidden"]),
  publishedRevision: z.number().nullable(),
  publicURL: z.string().nullable(),
  hasUnpublishedChanges: z.boolean(),
  draft: z.object({
    config: z.record(z.string(), z.string()),
    cards: z.array(card).max(200),
    presentation: z.record(
      z.string(),
      z.object({
        pinned: z.boolean(),
        icon: z.string(),
        group: z.string().optional(),
      }),
    ),
    tags: z.object({ ...collection, items: z.array(tag).max(12) }),
    achievements: z.object({
      ...collection,
      items: z.array(achievement).max(12),
    }),
    invitation: z.unknown(),
  }),
  shareCard: z
    .object({ stale: z.boolean() })
    .passthrough()
    .transform((value) => ({
      ...shareCardSnapshot(value),
      stale: value.stale,
    })),
});
export type Profile = z.infer<typeof profile>;
export type Card = z.infer<typeof card>;
export function decodeProfile(value: unknown): Profile {
  const parsed = profile.safeParse(value);
  if (!parsed.success)
    throw Error(
      "The saved profile could not be read. Keep your edits and refresh before continuing.",
    );
  return parsed.data;
}
