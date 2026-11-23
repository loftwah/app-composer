// One strict public HTTPS address, shared by the Top Nine profile link and the
// optional web page beside a manually named exhibit. It is only ever an
// ordinary outbound address: input, stored draft and untrusted result fragment
// all share this validator, and nothing here fetches, resolves or embeds it.

/** Hosts that are not a public page: loopback, private/reserved names and
 * IP literals. A bare hostname without a dot is never public either. */
const reservedHost = /(^|\.)(localhost|local|internal|home\.arpa|test|invalid|example)$/i;
const ipv4Host = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const ipv6Host = /^\[[0-9a-f:.]+\]$/i;
const unsafeCharacters = /[\u0000-\u0020\u007f\\]/;

/** Canonical public HTTPS address within the given compact limit, or null when
 * the value is empty, unsafe, malformed or too long. No fetch, DNS lookup or
 * provider access. */
export function publicHttpsUrl(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!/^https:\/\//i.test(raw) || raw.length > limit || unsafeCharacters.test(raw)) return null;
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
  if (url.href.length > limit) return null;
  return url.href;
}
