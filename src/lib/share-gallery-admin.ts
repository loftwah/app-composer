import type { D1Database } from "@cloudflare/workers-types";
import { PluginRouteError } from "emdash";
import { z } from "zod";
import {
  normalizeShareAssetId,
  publicShareArtwork,
  searchShareCatalogueAssets,
} from "./share-catalogue-asset.ts";
import { readArtworkCuration } from "./share-gallery.ts";

interface Context {
  user?: { role: number; disabled?: boolean };
  request: Request;
  input?: unknown;
}

const edit = z.strictObject({
  assetId: z.string().refine(normalizeShareAssetId),
  featured: z.boolean(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9][a-z0-9 -]{0,47}$/),
    )
    .max(12),
});

export async function manageShareArtwork(ctx: Context, db?: D1Database) {
  if (ctx.user?.role !== 50 || ctx.user.disabled)
    throw new PluginRouteError(
      "FORBIDDEN",
      "Only a Composer administrator can curate Share.",
      403,
    );
  if (!db)
    throw new PluginRouteError(
      "UNAVAILABLE",
      "Share curation storage is unavailable.",
      503,
    );

  try {
    if (ctx.request.method === "GET") {
      const search =
        new URL(ctx.request.url).searchParams.get("q")?.trim() ?? "";
      const curation = await readArtworkCuration(db);
      if (search) {
        const result = await searchShareCatalogueAssets(search);
        if (!result.ok)
          throw new PluginRouteError(
            result.code,
            result.message,
            result.code === "INVALID" ? 400 : 503,
          );
        return {
          items: result.items.map((item) => ({
            ...item,
            ...curation.find((entry) => entry.assetId === item.assetId),
          })),
        };
      }
      return {
        items: curation.map((item) => ({
          ...item,
          title: item.assetId,
          project: "",
        })),
      };
    }
    if (
      ctx.request.method !== "POST" ||
      ctx.request.headers.get("Origin") !== new URL(ctx.request.url).origin ||
      ctx.request.headers.get("X-EmDash-Request") !== "1"
    )
      throw new PluginRouteError(
        "FORBIDDEN",
        "Open the Composer admin directly to save.",
        403,
      );
    const parsed = edit.safeParse(ctx.input);
    if (!parsed.success)
      throw new PluginRouteError(
        "INVALID",
        "Use up to twelve tags of up to 48 characters with letters, numbers, spaces or hyphens.",
        400,
      );
    const { assetId, featured, tags } = parsed.data;
    const uniqueTags = [...new Set(tags)];
    const artwork = await publicShareArtwork(assetId);
    if (artwork.status === 503)
      throw new PluginRouteError(
        "UNAVAILABLE",
        "The public catalogue could not be reached. Try again.",
        503,
      );
    if (artwork.status === 404 && (featured || uniqueTags.length))
      throw new PluginRouteError(
        "MISSING",
        "This artwork is no longer public. Clear its tags and Featured setting to remove it.",
        404,
      );

    if (featured || uniqueTags.length) {
      await db
        .prepare(
          `INSERT INTO composer_share_artwork_curation (asset_id, featured, tags) VALUES (?, ?, ?)
        ON CONFLICT(asset_id) DO UPDATE SET featured=excluded.featured, tags=excluded.tags`,
        )
        .bind(assetId, Number(featured), JSON.stringify(uniqueTags))
        .run();
    } else {
      await db
        .prepare("DELETE FROM composer_share_artwork_curation WHERE asset_id=?")
        .bind(assetId)
        .run();
    }
    return { item: { assetId, featured, tags: uniqueTags } };
  } catch (error) {
    if (error instanceof PluginRouteError) throw error;
    throw new PluginRouteError(
      "UNAVAILABLE",
      "Share curation is unavailable. Try again.",
      503,
    );
  }
}
