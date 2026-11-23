// One optional creator profile link beside a Top Nine byline. It is only ever
// an ordinary outbound HTTPS address: the interactive preview shows it as a
// link, and an explicitly saved draft or result link may carry it. It never
// enters the PNG, its image description, a provider request or an embed, so
// input, stored draft and untrusted result fragment all share this validator.

import { publicHttpsUrl } from "./public-https-url.ts";

/** A compact profile address, long enough for a real handle and short enough
 * to keep a draft or result hash comfortably bounded. */
export const profileUrlLimit = 300;

/** Canonical HTTPS profile address, or null when the value is empty, unsafe,
 * malformed or beyond the limit. No fetch, DNS lookup or provider access. */
export function profileUrl(value: unknown): string | null {
  return publicHttpsUrl(value, profileUrlLimit);
}
