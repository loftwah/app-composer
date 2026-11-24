// Pinned cover sources for exact Top Nine catalogue identities. Each reviewed
// file is served locally and carries its own provenance and reuse terms.
import type { CoverFit } from "./top-nine-cover.ts";
import { appleAlbumRef } from "./top-nine-music.ts";
import { wikidataSource } from "./top-nine-wikidata.ts";

export const approvedOpenGoldbergCover = {
  id: "open-goldberg-1126033418-678c1b99",
  appleAlbumId: "1162185845",
  defaultFit: "cover",
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

export const approvedAnarchCover = {
  id: "anarch-1030685754-fd21c212",
  entity: "https://www.wikidata.org/wiki/Q114540914",
  defaultFit: "contain",
  src: "/top-nine/covers/anarch-1030685754-fd21c212.png",
  sha256: "fd21c212f1344cf3a791d9bb46101e68d20edbbcc0d7a4691ab080d86e38c57b",
  bytes: 82_305,
  sourceUrl: "https://commons.wikimedia.org/w/index.php?title=File:Anarch_screenshot.png&oldid=1030685754",
  licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  attribution: "Anarch screenshot · Miloslav Číž (Drummyfish) · CC0 1.0",
} as const;

export interface ApprovedCover {
  id: string;
  src: string;
  bytes: number;
  defaultFit: CoverFit;
  attribution: string;
  sourceUrl: string;
  licenceUrl: string;
}

/** Use the provider's validated stable ID, independent of title or edition
 * spelling. A place, band or similarly named game keeps its own identity. */
export function approvedCoverForSource(value: unknown): ApprovedCover | null {
  if (appleAlbumRef(value)?.id === approvedOpenGoldbergCover.appleAlbumId) return approvedOpenGoldbergCover;
  return wikidataSource(value) === approvedAnarchCover.entity ? approvedAnarchCover : null;
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
