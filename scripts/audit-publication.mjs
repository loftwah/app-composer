import { publicationPrivateValues } from "./check-publication.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  archiveMembers,
  privateValues,
  textFindings,
  riskyPath,
} from "./lib/publication-secrets.mjs";

const risky = [
  "/.env",
  "/.env.production",
  "/.env.local",
  "/.dev.vars",
  "/.git/config",
  "/.git/HEAD",
  "/id_rsa",
  "/.npmrc",
  "/service-account.json",
];
export async function auditPublication(
  origin,
  { fetcher = fetch, values = publicationPrivateValues(), downloads = [] } = {},
) {
  const records = [],
    findings = [];
  const base = new URL(origin);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw Error("Select an HTTPS origin");
  async function get(path) {
    try {
      const response = await fetcher(new URL(path, base), {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
        headers: { "User-Agent": "Publication prevention verification" },
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 64 * 1024 * 1024) throw Error("oversized response");
      return { response, bytes };
    } catch {
      findings.push({ path, label: "unreachable or unreadable response" });
      return null;
    }
  }
  function inspect(path, bytes) {
    for (const label of textFindings(bytes, values))
      findings.push({ path, label });
  }
  for (const path of risky) {
    const result = await get(path);
    if (!result) continue;
    const { response, bytes } = result;
    inspect(path, bytes);
    const secret = textFindings(bytes, values).length > 0;
    let outcome = secret
      ? "exposed"
      : [403, 404, 410].includes(response.status)
        ? "absent"
        : /^text\/html\b/i.test(response.headers.get("content-type") ?? "")
          ? "HTML fallback; local artifact proof still required"
          : "unexpected response";
    records.push({ path, status: response.status, outcome });
    if (outcome === "unexpected response")
      findings.push({ path, label: outcome });
  }
  const shell = await get("/");
  const assets = new Set(downloads);
  if (shell) {
    inspect("/", shell.bytes);
    if (!shell.response.ok)
      findings.push({ path: "/", label: "public shell unavailable" });
    for (const match of shell.bytes
      .toString("utf8")
      .matchAll(/(?:src|href)=["']([^"']+\.(?:m?js|css)(?:\?[^"']*)?)["']/g)) {
      const url = new URL(match[1], base);
      if (url.origin === base.origin && !url.pathname.startsWith("/cdn-cgi/"))
        assets.add(url.pathname + url.search);
      else if (url.origin === base.origin)
        records.push({
          path: url.pathname,
          status: null,
          outcome:
            "Cloudflare-generated asset excluded from app artifact sample",
        });
    }
  }
  if (assets.size > 100)
    findings.push({
      path: "/",
      label: "asset sample exceeds inspection bound",
    });
  for (const path of [...assets].slice(0, 100)) {
    if (new URL(path, base).origin !== base.origin)
      throw Error("Asset must belong to selected origin");
    const result = await get(path);
    if (!result) continue;
    if (!result.response.ok) {
      findings.push({ path, label: "public asset unavailable" });
      continue;
    }
    inspect(path, result.bytes);
    try {
      const members = archiveMembers(path, result.bytes);
      for (const [member, data] of members ?? []) {
        inspect(path + "!" + member, data);
        if (riskyPath(member))
          findings.push({
            path: path + "!" + member,
            label: "published " + riskyPath(member),
          });
      }
      records.push({
        path,
        status: result.response.status,
        outcome: members
          ? `${members.length} archive members inspected`
          : "sampled public asset",
      });
    } catch {
      findings.push({ path, label: "archive could not be inspected" });
    }
    const map = /[#@]\s*sourceMappingURL=([^\s*]+)/.exec(
      result.bytes.toString("utf8"),
    );
    if (map && !map[1].startsWith("data:")) {
      const url = new URL(map[1], new URL(path, base));
      if (url.origin !== base.origin) {
        findings.push({
          path,
          label: "external source map requires separate review",
        });
        continue;
      }
      const source = await get(url.pathname + url.search);
      if (source?.response.ok) {
        inspect(url.pathname, source.bytes);
        records.push({
          path: url.pathname,
          status: source.response.status,
          outcome: "referenced source map inspected",
        });
      }
    }
  }
  return { ok: findings.length === 0, origin: base.origin, records, findings };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [origin, ...downloads] = process.argv.slice(2);
  const result = await auditPublication(origin, { downloads });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
