// MIT. Bounded publisher reconciliation after a native EmDash import.
// Produces reviewable field patches only; no network, SQL, publication or secrets.
import { z } from "zod";
const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const sourceMedia = z
  .object({
    id: z.number().int().positive(),
    url: z.string().url(),
    sha256: sha,
    alt: z.string(),
    caption: z.string(),
  })
  .passthrough();
const sourceEntry = z
  .object({
    id: z.number().int().positive(),
    slug: z.string().regex(/^[a-z0-9-]{1,200}$/),
    url: z.string().url(),
    featuredImage: z.number().int().nonnegative(),
  })
  .passthrough();
const input = z
  .object({
    source: z
      .object({
        media: z.array(sourceMedia).max(100),
        articles: z.array(sourceEntry).max(100),
        pages: z.array(sourceEntry).max(100),
      })
      .passthrough(),
    sourceOrigins: z.array(z.string().url()).min(1).max(8),
    media: z
      .array(
        z.object({
          id,
          sha256: sha,
          url: z.string(),
          alt: z.string().nullable(),
          caption: z.string().nullable(),
        }),
      )
      .max(200),
    entries: z
      .array(
        z.object({
          id,
          collection: z.enum(["posts", "pages"]),
          slug: z.string(),
          revision: z.string().min(1),
          data: z.record(z.string(), z.unknown()),
        }),
      )
      .max(200),
  })
  .strict();
function unique(items, name) {
  if (new Set(items).size !== items.length)
    throw Error("Ambiguous " + name + "; reconcile manually.");
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function planPublisherReconciliation(value) {
  const { source, sourceOrigins, media, entries } = input.parse(value);
  const origins = sourceOrigins.map((origin) => {
    const u = new URL(origin);
    if (
      u.origin !== origin ||
      u.username ||
      u.password ||
      !["http:", "https:"].includes(u.protocol)
    )
      throw Error("Choose exact reviewed source origins.");
    return origin;
  });
  unique(
    source.media.map((item) => item.id),
    "source attachment IDs",
  );
  unique(
    source.articles.map((item) => item.slug),
    "source post slugs",
  );
  unique(
    source.pages.map((item) => item.slug),
    "source page slugs",
  );
  unique(
    media.map((item) => item.id),
    "destination media IDs",
  );
  unique(
    entries.map((item) => item.collection + ":" + item.slug),
    "destination slugs",
  );
  const map = new Map(),
    owned = new Map(),
    metadata = [],
    unresolved = [];
  const add = (old, next) => {
    if (map.has(old) && map.get(old) !== next)
      throw Error("Ambiguous source URL; reconcile manually.");
    map.set(old, next);
  };
  const variants = (url) => {
    const u = new URL(url);
    if (
      !origins.includes(u.origin) ||
      u.username ||
      u.password ||
      u.hash ||
      u.search
    )
      throw Error("Source URL is outside reviewed origins.");
    return origins.map((origin) => origin + u.pathname);
  };
  for (const attachment of source.media) {
    const matches = media.filter((item) => item.sha256 === attachment.sha256);
    if (matches.length !== 1) {
      unresolved.push({
        kind: "media",
        sourceId: attachment.id,
        reason: matches.length ? "ambiguous-bytes" : "missing-bytes",
      });
      continue;
    }
    const item = matches[0];
    if (!/^\/_emdash\/api\/media\/file\/[A-Za-z0-9_.-]+$/.test(item.url))
      throw Error("Destination must be app-owned media.");
    for (const old of variants(attachment.url)) add(old, item.url);
    owned.set(attachment.id, item);
    // Preserve explicit destination descriptions. Filling a blank still needs owner review.
    const patch = {};
    for (const field of ["alt", "caption"])
      if (!item[field] && attachment[field]) patch[field] = attachment[field];
    if (Object.keys(patch).length)
      metadata.push({
        id: item.id,
        expected: { alt: item.alt, caption: item.caption },
        patch,
      });
  }
  for (const [collection, items] of [
    ["posts", source.articles],
    ["pages", source.pages],
  ])
    for (const item of items) {
      if (
        !new URL(item.url).search &&
        entries.some(
          (entry) =>
            entry.collection === collection && entry.slug === item.slug,
        )
      )
        for (const old of variants(item.url))
          add(old, new URL(item.url).pathname);
    }
  const rewrite = (node) => {
    if (Array.isArray(node)) return node.map(rewrite);
    if (!node || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node).map(([key, item]) => [
        key,
        ["href", "src"].includes(key) &&
        typeof item === "string" &&
        map.has(item)
          ? map.get(item)
          : rewrite(item),
      ]),
    );
  };
  const patches = [];
  for (const entry of entries) {
    const sourceItem = (
      entry.collection === "posts" ? source.articles : source.pages
    ).find((item) => item.slug === entry.slug);
    if (!sourceItem) continue;
    const data = {},
      content = rewrite(entry.data.content);
    if (!same(content, entry.data.content)) data.content = content;
    const expected = owned.get(sourceItem.featuredImage),
      current = entry.data.featured_image;
    if (
      expected &&
      current &&
      typeof current === "object" &&
      current.provider === "external" &&
      (current.id === "" || current.id === undefined) &&
      typeof current.src === "string" &&
      (map.get(current.src) === expected.url || current.src === expected.url)
    ) {
      const { src: retiredSource, ...retained } = current;
      data.featured_image = {
        ...retained,
        provider: "local",
        id: expected.id,
        alt:
          typeof current.alt === "string" && current.alt.trim()
            ? current.alt
            : expected.alt ||
              source.media.find((item) => item.id === sourceItem.featuredImage)
                .alt,
        meta: {
          ...(current.meta &&
          typeof current.meta === "object" &&
          !Array.isArray(current.meta)
            ? current.meta
            : {}),
          storageKey: expected.url.split("/").pop(),
        },
      };
    }
    if (Object.keys(data).length)
      patches.push({
        id: entry.id,
        collection: entry.collection,
        slug: entry.slug,
        _rev: entry.revision,
        data,
      });
  }
  return {
    schema: "composer.publisher-reconciliation/1",
    entryPatches: patches,
    mediaPatches: metadata,
    unresolved,
    publication:
      "Save each reviewed patch with its exact native _rev, verify the draft, then explicitly publish only previously public entries. Never publish private/draft/scheduled work as a repair.",
  };
}
