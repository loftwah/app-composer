// The transport boundary for the read-only Cloudflare check. The server
// validates its own summary before replying; the owner page validates the
// reply before display; a local compare file is treated as bounded data.
import { z } from "zod";

const text = (max: number) => z.string().min(1).max(max);
const maybe = (max: number) => z.string().max(max);
const count = z.number().int().nonnegative().max(10_000);
const tag = z.object({ key: text(80), value: maybe(120) }).strict();

export const providerComparison = z
  .object({
    kind: z.enum(["worker", "d1", "r2", "kv", "service"]),
    name: text(120),
    environment: z.enum(["production", "preview", "unverified"]),
    expectedSource: text(160),
    expectedId: maybe(80).nullable(),
    observedId: maybe(80).nullable(),
    state: z.enum([
      "match",
      "drift",
      "missing",
      "unverified",
      "inaccessible",
      "stale",
      "untracked",
    ]),
    detail: text(500),
    changes: z
      .array(
        z
          .object({
            field: text(60),
            expected: maybe(160),
            observed: maybe(160),
          })
          .strict(),
      )
      .max(8),
    tags: z
      .object({
        state: z.enum(["match", "partial", "mismatch", "unverified"]),
        expected: z.array(tag).max(8),
        observed: z.array(tag).max(8).nullable(),
        missing: z.array(text(80)).max(8),
        unexpected: z.array(text(80)).max(8),
      })
      .strict(),
    cost: z.object({ state: z.literal("unknown"), note: text(200) }).strict(),
    stale: z.boolean(),
  })
  .strict();
export type ProviderComparisonView = z.infer<typeof providerComparison>;

export const providerFinding = z
  .object({
    code: z.enum([
      "provider-unconfigured",
      "provider-inaccessible",
      "provider-partial",
      "expected-missing",
      "expected-drift",
      "expected-unverified",
      "untracked-resources",
      "provider-tags-absent",
      "stale-observation",
      "identity-unrecorded",
      "identity-unverified",
      "d1-list-counts-untrusted",
      "domain-service-split",
      "preview-revision-differs",
    ]),
    severity: z.enum(["attention", "unknown", "info"]),
    title: text(120),
    detail: text(700),
    action: z
      .object({ label: text(60), href: maybe(400) })
      .strict()
      .nullable(),
  })
  .strict();
export type ProviderFindingView = z.infer<typeof providerFinding>;

export const providerEndpoint = z
  .object({
    path: text(320),
    method: z.literal("GET"),
    state: z.enum([
      "verified",
      "inaccessible",
      "missing",
      "unverified",
      "stale",
    ]),
    status: z.number().int().min(100).max(599).nullable(),
    message: maybe(240).nullable(),
  })
  .strict();
export type ProviderEndpointView = z.infer<typeof providerEndpoint>;

export const providerIdentity = z
  .object({
    app: text(40),
    worker: text(80),
    repo: text(200),
    environment: z.enum(["production", "preview", "unverified"]),
    domain: maybe(120).nullable(),
    status: z.enum(["verified", "unknown", "drift"]),
    statusNote: text(300),
    evidence: z
      .array(
        z
          .object({
            kind: z.enum([
              "committed-manifest",
              "custom-domain",
              "deployment-annotation",
              "release-receipt",
            ]),
            source: text(200),
            value: maybe(160).nullable(),
          })
          .strict(),
      )
      .max(6),
    observed: z
      .object({
        deploymentId: maybe(80).nullable(),
        versionId: maybe(80).nullable(),
        message: maybe(200).nullable(),
        domains: z.array(text(120)).max(8),
        observedAt: z.iso.datetime(),
      })
      .strict()
      .nullable(),
    nextAction: text(200),
  })
  .strict();
export type ProviderIdentityView = z.infer<typeof providerIdentity>;

export const providerCheck = z
  .object({
    ok: z.literal(true),
    version: z.literal("composer.provider-check/2"),
    readOnly: z.literal(true),
    source: z.enum(["live", "local-cli"]),
    state: z.enum(["verified", "partial", "inaccessible", "unconfigured"]),
    checkedAt: z.iso.datetime(),
    expectedRevision: maybe(40).nullable(),
    observedAt: z.iso.datetime().nullable(),
    observation: z
      .object({ utc: text(40), melbourne: text(60) })
      .strict()
      .nullable(),
    account: maybe(80),
    counts: z
      .object({
        expected: count,
        declaredObserved: count,
        observed: count,
        match: count,
        drift: count,
        missing: count,
        unverified: count,
        inaccessible: count,
        undeclared: count,
        undeclaredWorkers: count,
        undeclaredEarlier: count,
        undeclaredOther: count,
        undeclaredStorage: count,
        unrelated: count,
        identityVerified: count,
        identityUnknown: count,
        identityDrift: count,
        attention: count,
      })
      .strict(),
    comparisons: z.array(providerComparison).max(32),
    identities: z.array(providerIdentity).max(8),
    findings: z.array(providerFinding).max(8),
    endpoints: z.array(providerEndpoint).max(48),
    limitations: z.array(text(240)).max(8),
    cost: z.object({ state: z.literal("unknown"), note: text(200) }).strict(),
    note: text(700),
  })
  .strict();
export type ProviderCheck = z.infer<typeof providerCheck>;

export const PROVIDER_CHECK_CONTENT_TYPE = "application/json";
export const PROVIDER_CHECK_MAX_BYTES = 512 * 1024;
