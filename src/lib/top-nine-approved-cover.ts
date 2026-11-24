// The finite, reviewed catalogue-art exception for Top Nine #1066. This is one
// exact Apple Music album, not permission to import artist or provider artwork.
// Apple identifies the release; the pinned, locally served CC0 file supplies the
// pixels. Titles, slugs, search terms and other catalogue rows never select it.

import { appleAlbumRef } from "./top-nine-music.ts";

export const approvedOpenGoldbergCover = {
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
