import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const posts = defineCollection({
  loader: glob({
    base: "./src/content/posts",
    pattern: "*.md",
    generateId({ entry }) {
      const slug = entry.match(/^([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/)?.[1];
      if (!slug) throw new Error(`Use a unique lowercase, hyphenated Markdown file name for ${entry}.`);
      return slug;
    },
  }),
  schema: z.strictObject({
    title: z.string().min(1),
    description: z.string().min(1),
    date: z.iso.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
