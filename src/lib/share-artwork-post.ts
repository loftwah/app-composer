import type { CatalogueArtwork } from "./share-catalogue-asset.ts";

export function artworkPostText(
  artwork: Pick<CatalogueArtwork, "title" | "description" | "credit" | "sourceUrl">,
  canonical: string,
): string {
  return [
    artwork.title,
    artwork.description,
    artwork.credit,
    artwork.sourceUrl,
    canonical,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}
