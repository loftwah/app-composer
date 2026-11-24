// The finite, reviewed catalogue-art exception for Top Nine #1066. This is one
// exact Apple Music album, not permission to import artist or provider artwork.
// Apple identifies the release; the pinned, locally served CC0 file supplies the
// pixels. Titles, slugs, search terms and other catalogue rows never select it.

import type { CoverFit } from "./top-nine-cover.ts";
import { appleAlbumRef } from "./top-nine-music.ts";

export const approvedOpenGoldbergCover = {
  id: "open-goldberg-1126033418-678c1b99",
  appleAlbumId: "1162185845",
  src: "/top-nine/covers/open-goldberg-1126033418-678c1b99.jpg",
  sha256: "678c1b990236d8f08938ffb61ffae7d2068e7e1f6c94192c944f15f42dfbfe43",
  bytes: 286_973,
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Cover_of_the_Open_Goldberg_Variations.jpg",
  sourceRevision: "1126033418",
  licence: "CC0 1.0",
  licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  originalCredits: "Jeffrey McGuire (graphic design); Philippe Ramakers (photography)",
  attribution: "Open Goldberg Variations cover · Wikimedia Commons · CC0 1.0 · Jeffrey McGuire (graphic design); Philippe Ramakers (photography)",
} as const;

export interface ApprovedCover {
  id: string;
  src: string;
  bytes: number;
  attribution: string;
  sourceUrl: string;
  licenceUrl: string;
}

/** Match the reviewed release by Apple collection ID, independent of its
 * storefront or display title. The parser excludes songs and foreign URLs. */
export function approvedCoverForSource(value: unknown): ApprovedCover | null {
  return appleAlbumRef(value)?.id === approvedOpenGoldbergCover.appleAlbumId
    ? approvedOpenGoldbergCover
    : null;
}


export interface ApprovedCoverReference {
  id: string;
  fit: CoverFit;
}

/** A result can hang only a pinned cover for that exact exhibit's source.
 * Legacy results and malformed references produce no artwork requests. */
export function normaliseApprovedCovers(
  value: unknown,
  hrefs: readonly (string | null)[],
): (ApprovedCoverReference | null)[] {
  if (!Array.isArray(value) || value.length !== 9) return [];
  return hrefs.map((href, index) => {
    const cover = approvedCoverForSource(href);
    const ref = value[index] as Partial<ApprovedCoverReference> | null;
    if (!cover || !ref || ref.id !== cover.id || (ref.fit !== "cover" && ref.fit !== "contain")) return null;
    return { id: cover.id, fit: ref.fit };
  });
}
