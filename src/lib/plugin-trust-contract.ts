import { z } from "zod";

const text = z.string().min(1).max(300);
const did = z.string().regex(/^did:(plc|web):[a-zA-Z0-9.:%-]{1,160}$/);
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const cid = z.string().regex(/^b[a-z2-7]{20,120}$/);
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
const date = z.iso.datetime();
const label = z
  .object({
    ver: z.number().int(),
    src: did,
    uri: text,
    val: z.string().max(80),
    cts: date,
    cid: cid.optional(),
    neg: z.boolean().optional(),
  })
  .strict();
export const curatedPlugin = z
  .object({
    name: z.string().min(1).max(80),
    did,
    slug,
    handle: z
      .string()
      .regex(/^[a-z0-9.-]{1,120}$/)
      .nullable(),
    profileCid: cid,
    profileUri: text,
    releaseCid: cid,
    releaseUri: text,
    version,
    indexedAt: date,
    checksum: z.string().max(140).nullable(),
    requires: z.string().max(120).nullable(),
    historyComplete: z.boolean(),
    license: z.string().max(80).nullable(),
    repository: text.nullable(),
    securityContact: z.boolean(),
    requireProvenance: z.boolean(),
    labels: z.array(label).max(30),
    refreshFailed: z.boolean(),
    inspection: z
      .object({
        observedAt: date,
        did,
        slug,
        version,
        releaseCid: cid,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        capabilities: z
          .array(z.string().regex(/^[a-z][a-z0-9:-]{0,100}$/))
          .max(100),
        allowedHosts: z
          .array(z.string().regex(/^[a-zA-Z0-9.*:-]{1,200}$/))
          .max(100),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const pluginTrustSnapshot = z
  .object({
    schemaVersion: z.literal(1),
    policy: z.literal("2026-10-25.1"),
    observedAt: date,
    host: z
      .object({ emdash: version, cloudflare: version, astro: version })
      .strict(),
    packages: z.array(curatedPlugin).max(8),
  })
  .strict();
export type CuratedPlugin = z.infer<typeof curatedPlugin>;
export type TrustSnapshot = z.infer<typeof pluginTrustSnapshot>;
export type TrustState = "RED" | "AMBER" | "UNKNOWN" | "GREEN";
export type TrustReason = { state: TrustState; code: string; detail: string };

export function httpsLink(value: string | null): string | null {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// The curated v1 snapshot has simple numeric ranges. Unsupported syntax remains
// UNKNOWN; this is not a replacement for EmDash's install-time range evaluator.
export function compatibility(
  range: string | null,
  host: string,
): boolean | null {
  if (!range) return null;
  const numeric = (value: string) => value.split(".").map(Number);
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    return 0;
  };
  const parts = range.trim().split(/\s+/);
  if (
    !parts.length ||
    parts.some((part) => !/^(>=|<=|>|<|=)?\d+\.\d+\.\d+$/.test(part))
  )
    return null;
  return parts.every((part) => {
    const match = /^(>=|<=|>|<|=)?(\d+\.\d+\.\d+)$/.exec(part)!;
    const result = compare(numeric(host), numeric(match[2]));
    return match[1] === ">="
      ? result >= 0
      : match[1] === "<="
        ? result <= 0
        : match[1] === ">"
          ? result > 0
          : match[1] === "<"
            ? result < 0
            : result === 0;
  });
}

function checksumDigest(checksum: string | null): string | null {
  if (!checksum || !/^b[a-z2-7]+$/.test(checksum)) return null;
  let bits = "";
  for (const char of checksum.slice(1))
    bits += "abcdefghijklmnopqrstuvwxyz234567"
      .indexOf(char)
      .toString(2)
      .padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8)
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  // Registry package checksums use a SHA-256 multihash, multibase base32.
  if (bytes.length !== 34 || bytes[0] !== 0x12 || bytes[1] !== 0x20)
    return null;
  return bytes
    .slice(2)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function evaluatePlugin(
  plugin: CuratedPlugin,
  snapshot: TrustSnapshot,
  now = new Date(),
) {
  const reasons: TrustReason[] = [];
  const add = (state: TrustState, code: string, detail: string) =>
    reasons.push({ state, code, detail });
  const age = now.getTime() - Date.parse(snapshot.observedAt);
  const stale = age > 14 * 86400000 || age < -300000 || plugin.refreshFailed;
  if (stale)
    add(
      "UNKNOWN",
      "STALE_SNAPSHOT",
      "Evidence is older than 14 days, has a future date or its latest refresh failed. Re-observe this exact release before a decision.",
    );
  const profileUri = `at://${plugin.did}/com.emdashcms.experimental.package.profile/${plugin.slug}`;
  const releaseUri = `at://${plugin.did}/com.emdashcms.experimental.package.release/${plugin.slug}:${plugin.version}`;
  if (plugin.profileUri !== profileUri || plugin.releaseUri !== releaseUri)
    add(
      "RED",
      "IDENTITY_MISMATCH",
      "The package and release identifiers do not describe the same publisher, slug and version.",
    );
  const officialLabels = plugin.labels.filter(
    (value) => value.src === "did:web:labels.emdashcms.com",
  );
  const malformed = officialLabels.some(
    (value) =>
      value.uri !== releaseUri ||
      (value.cid !== undefined && value.cid !== plugin.releaseCid),
  );
  const active = new Map<string, boolean>();
  for (const value of officialLabels.toSorted(
    (a, b) => Date.parse(a.cts) - Date.parse(b.cts),
  ))
    active.set(value.val, value.neg !== true);
  if (
    malformed ||
    [...active].some(
      ([value, enabled]) => enabled && /yank|withdraw|takedown/.test(value),
    )
  )
    add(
      "RED",
      "RELEASE_WITHDRAWN",
      "Release labels indicate withdrawal or have inconsistent identity. EmDash must verify the authoritative record.",
    );
  if (!officialLabels.length)
    add(
      "UNKNOWN",
      "LABELS_ABSENT",
      "No official release-label observation is available.",
    );
  if (active.get("listing-review"))
    add(
      "AMBER",
      "LABEL_REVIEW",
      "The selected release carries an active registry review label.",
    );
  const digest = checksumDigest(plugin.checksum);
  if (!plugin.checksum)
    add(
      "RED",
      "ARTIFACT_MISSING",
      "The release has no package-artifact checksum to verify.",
    );
  else if (!digest)
    add(
      "UNKNOWN",
      "ARTIFACT_UNVERIFIED",
      "A supported SHA-256 artifact checksum is unavailable.",
    );
  const inspection = plugin.inspection;
  const inspectionMatches =
    inspection &&
    inspection.did === plugin.did &&
    inspection.slug === plugin.slug &&
    inspection.version === plugin.version &&
    inspection.releaseCid === plugin.releaseCid;
  if (inspection && !inspectionMatches)
    add(
      "UNKNOWN",
      "INSPECTION_IDENTITY_MISMATCH",
      "The inspection receipt belongs to a different release and cannot establish its permissions or bytes.",
    );
  if (!inspectionMatches)
    add(
      "UNKNOWN",
      "CAPABILITIES_UNINSPECTED",
      "Exact manifest permissions and network hosts have not been inspected for this release.",
    );
  if (inspectionMatches) {
    if (digest && digest !== inspection.sha256)
      add(
        "RED",
        "DIGEST_MISMATCH",
        "The inspected artifact digest differs from the release checksum.",
      );
    if (
      inspection.capabilities.includes("network:request:unrestricted") ||
      (inspection.capabilities.includes("network:request") &&
        !inspection.allowedHosts.length)
    )
      add(
        "RED",
        "EGRESS_UNRESTRICTED",
        "The inspected manifest permits unrestricted outbound requests. This local policy blocks installation pending an owner decision; it is not a malware finding.",
      );
    else if (inspection.capabilities.includes("network:request"))
      add(
        "AMBER",
        "EGRESS_REVIEW",
        "Declared outbound hosts need an owner review for this application.",
      );
    if (
      inspection.capabilities.some(
        (value) =>
          /:(write|publish|restore|send|moderate)$/.test(value) ||
          value === "users:read",
      )
    )
      add(
        "AMBER",
        "WRITE_SCOPE_REVIEW",
        "The manifest declares write, send, moderation or user-reading authority that needs review.",
      );
  }
  const compatible = compatibility(plugin.requires, snapshot.host.emdash);
  if (compatible === false)
    add(
      "RED",
      "COMPAT_INCOMPATIBLE",
      "The declared EmDash range excludes this evaluated host version.",
    );
  if (compatible === null)
    add(
      "UNKNOWN",
      "COMPAT_UNKNOWN",
      "The release has no supported compatibility declaration. EmDash must evaluate it before installation.",
    );
  if (!plugin.historyComplete)
    add(
      "AMBER",
      "HISTORY_INCOMPLETE",
      "The registry does not report complete release history; this does not establish abandonment.",
    );
  if (!plugin.requireProvenance)
    add(
      "AMBER",
      "PROVENANCE_OPTIONAL",
      "The publisher does not require build provenance. A matching digest alone does not verify who built the bytes.",
    );
  if (
    Date.parse(snapshot.observedAt) - Date.parse(plugin.indexedAt) <
    7 * 86400000
  )
    add(
      "AMBER",
      "RECENT_INDEX",
      "This record was indexed less than seven days before observation. Index time is not publish time.",
    );
  if (!plugin.securityContact)
    add(
      "AMBER",
      "CONTACT_MISSING",
      "No publisher security contact was observed.",
    );
  if (!httpsLink(plugin.repository))
    add(
      "AMBER",
      "SOURCE_UNAVAILABLE",
      "No usable HTTPS source repository was observed.",
    );
  if (!plugin.license)
    add("AMBER", "LICENSE_UNKNOWN", "No licence was observed.");
  add(
    "UNKNOWN",
    "ADVISORY_SOURCE_NONE",
    "No advisory source has been checked; this evaluation cannot certify the absence of known vulnerabilities.",
  );
  add(
    "UNKNOWN",
    "INSTALL_NOT_TESTED",
    "No native installation and lifecycle receipt exists for this exact release.",
  );
  add(
    "UNKNOWN",
    "UPDATE_BASELINE_NONE",
    "An installed manifest baseline is unavailable. Permission and public-route changes are unknown.",
  );
  const state: TrustState = stale
    ? "UNKNOWN"
    : reasons.some((value) => value.state === "RED")
      ? "RED"
      : reasons.some((value) => value.state === "AMBER")
        ? "AMBER"
        : "UNKNOWN";
  const dimension = (codes: string[]): TrustState => {
    const relevant = reasons.filter((reason) =>
      codes.some((code) => reason.code.startsWith(code)),
    );
    return relevant.some((reason) => reason.state === "RED")
      ? "RED"
      : relevant.some((reason) => reason.state === "AMBER")
        ? "AMBER"
        : "UNKNOWN";
  };
  return {
    state,
    security: dimension([
      "IDENTITY_",
      "RELEASE_",
      "ARTIFACT_",
      "DIGEST_",
      "EGRESS_",
      "WRITE_",
      "PROVENANCE_",
      "ADVISORY_",
      "CAPABILITIES_",
      "INSPECTION_",
    ]),
    maintenance: dimension([
      "COMPAT_",
      "HISTORY_",
      "RECENT_",
      "CONTACT_",
      "SOURCE_",
      "LICENSE_",
      "INSTALL_",
    ]),
    freshness: stale ? ("stale" as const) : ("dated" as const),
    reasons,
    compatible,
    digestMatches: Boolean(
      inspectionMatches && digest && digest === inspection.sha256,
    ),
    capabilities: inspectionMatches ? inspection.capabilities : null,
    allowedHosts: inspectionMatches ? inspection.allowedHosts : null,
  };
}
