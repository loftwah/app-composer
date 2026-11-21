import type { CatalogueArtwork } from "./share-catalogue-asset.ts";

export function artworkPostText(
  artwork: Pick<CatalogueArtwork, "title" | "description" | "caption" | "credit" | "sourceUrl">,
  canonical: string,
): string {
  return [
    artwork.title,
    artwork.caption || artwork.description,
    artwork.credit,
    artwork.sourceUrl,
    canonical,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

export function artworkPostBrief(
  artwork: Pick<CatalogueArtwork, "assetId" | "title" | "description" | "caption" | "credit" | "sourceUrl" | "alt">,
  canonicalUrl: string,
  downloadUrl: string,
  revision: string,
) {
  return {
    schema: "app-composer/public-artwork-post",
    version: 1,
    status: "draft",
    caption: artworkPostText(artwork, canonicalUrl),
    artwork: {
      id: artwork.assetId,
      revision,
      title: artwork.title,
      canonicalUrl,
      downloadUrl,
      alt: artwork.alt,
      credit: artwork.credit,
      sourceUrl: artwork.sourceUrl ?? null,
      reuse: "unconfirmed",
    },
  } as const;
}
