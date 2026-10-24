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

export const providerCheck = z
  .object({
    ok: z.literal(true),
    version: z.literal("composer.provider-check/1"),
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
        observed: count,
        match: count,
        drift: count,
        missing: count,
        unverified: count,
        inaccessible: count,
        untracked: count,
        attention: count,
      })
      .strict(),
    comparisons: z.array(providerComparison).max(32),
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
