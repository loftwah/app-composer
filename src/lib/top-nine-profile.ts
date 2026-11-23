// One optional creator profile link beside a Top Nine byline. It is only ever
// an ordinary outbound HTTPS address: the interactive preview shows it as a
// link, and an explicitly saved draft or result link may carry it. It never
// enters the PNG, its image description, a provider request or an embed, so
// input, stored draft and untrusted result fragment all share this validator.

/** A compact profile address, long enough for a real handle and short enough
 * to keep a draft or result hash comfortably bounded. */
export const profileUrlLimit = 300;

/** Hosts that are not a public profile: loopback, private/reserved names and
 * IP literals. A bare hostname without a dot is never public either. */
const reservedHost = /(^|\.)(localhost|local|internal|home\.arpa|test|invalid|example)$/i;
const ipv4Host = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const ipv6Host = /^\[[0-9a-f:.]+\]$/i;
const unsafeCharacters = /[\u0000-\u0020\u007f\\]/;

/** Canonical HTTPS profile address, or null when the value is empty, unsafe,
 * malformed or beyond the limit. No fetch, DNS lookup or provider access. */
export function profileUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^https:\/\//i.test(raw) || raw.length > profileUrlLimit || unsafeCharacters.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname) return null;
  if (url.username || url.password) return null;
  const host = url.hostname.replace(/\.$/, "");
  if (!host.includes(".") || reservedHost.test(host) || ipv4Host.test(host) || ipv6Host.test(host)) return null;
  if (url.href.length > profileUrlLimit) return null;
  return url.href;
}
