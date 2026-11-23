// One optional exact public web page per manually named Top Nine exhibit. It
// is a plain outbound HTTPS address for a title someone typed themselves, not
// a provider source link: it never becomes a search result, an embed, a media
// preview, a fetched page or a provider claim. The strict public HTTPS
// validator shipped for creator profiles is reused as-is.

import { publicHttpsUrl } from "./public-https-url.ts";

/** A compact page address that keeps nine links inside one draft or result
 * fragment while leaving room for the exhibition text. */
export const pageUrlLimit = 300;

/** Canonical exact page address, or null when the value is empty, unsafe,
 * local, malformed or beyond the limit. No request is made. */
export function pageLink(value: unknown): string | null {
  return publicHttpsUrl(value, pageUrlLimit);
}

/** Page links for nine exhibits; every slot stays positional. */
export function normalisePageLinks(value: unknown): (string | null)[] {
  return Array.from({ length: 9 }, (_, index) =>
    Array.isArray(value) ? pageLink(value[index]) : null,
  );
}
