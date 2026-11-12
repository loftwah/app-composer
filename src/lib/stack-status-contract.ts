import { z } from "zod";

const version = z
  .string()
  .regex(/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/)
  .max(80);
const timestamp = z.iso.datetime();
const status = z.enum(["ok", "drift", "unknown", "unresolved"]);
const classification = z.enum([
  "current",
  "compatible-patch",
  "feature-opportunity",
  "breaking-major",
  "security-urgent",
  "unsupported",
  "unknown",
]);
const advisory = z
  .object({
    id: z.union([z.number().int(), z.string().max(80)]).nullable(),
    severity: z.string().min(1).max(40),
    title: z.string().max(300).nullable(),
    url: z.string().url().max(500).nullable(),
    vulnerableVersions: z.string().max(300).nullable(),
  })
  .strict();
const remotePackage = z
  .object({
    state: z.enum(["available", "unknown"]),
    latest: version.nullable(),
    checkedAt: timestamp.nullable(),
    classification,
    reason: z.string().max(600).nullable(),
    latestQualified: z.boolean().nullable(),
    advisory: advisory.nullable(),
  })
  .strict();
const packageRow = z
  .object({
    name: z.string().min(1).max(200),
    declared: z.string().min(1).max(200),
    installed: version.nullable(),
    deployed: version.nullable(),
    latestTested: version.nullable(),
    supported: z.string().min(1).max(300).nullable(),
    note: z.string().max(600).nullable(),
    status,
    remote: remotePackage,
  })
  .strict();
const runtimeStatus = z.enum([
  "ok",
  "drift",
  "unknown",
  "unresolved",
  "unobserved",
]);
const runtimeRow = z
  .object({
    name: z.enum(["node", "pnpm"]),
    declared: version.nullable(),
    default: version.nullable(),
    installed: version.nullable(),
    observed: z.boolean(),
    locked: version.nullable(),
    policy: z.string().min(1).max(300),
    tested: z.array(version).max(12),
    status: runtimeStatus,
    upstream: z
      .object({
        state: z.enum(["available", "unknown"]),
        latest: version.nullable(),
        checkedAt: timestamp.nullable(),
        classification: z.string().max(40),
        reason: z.string().max(600).nullable(),
      })
      .strict(),
  })
  .strict();
const blocker = z
  .object({
    kind: z.enum([
      "runtime",
      "policy",
      "unsupported",
      "security",
      "breaking",
      "remote",
    ]),
    name: z.string().min(1).max(200),
    detail: z.string().min(1).max(800),
    url: z.string().url().max(500).nullable().optional(),
  })
  .strict();

export const stackStatusSnapshot = z
  .object({
    contract: z.literal(1),
    generatedAt: timestamp,
    review: z.object({ date: z.iso.date().nullable() }).strict(),
    deployed: z
      .object({
        commit: z.string().regex(/^[a-f0-9]{40}$/),
        sourceCommittedAt: z.iso.datetime({ offset: true }),
        workerVersion: z.string().max(80).nullable(),
        note: z.string().min(1).max(300),
      })
      .strict(),
    remote: z
      .object({
        state: z.enum(["available", "unknown", "stale"]),
        checkedAt: timestamp.nullable(),
        registry: z.string().url().max(300).nullable(),
        reason: z.string().max(600).nullable(),
        ageDays: z.number().int().min(0).nullable(),
        maxAgeDays: z.number().int().min(1).max(365),
      })
      .strict(),
    runtime: z.array(runtimeRow).max(2),
    packages: z.array(packageRow).max(200),
    blockers: z.array(blocker).max(400),
    status: z.enum(["ok", "attention", "security", "unknown"]),
  })
  .strict();

export type StackStatusSnapshot = z.infer<typeof stackStatusSnapshot>;
export type StackPackageRow = z.infer<typeof packageRow>;
export type StackRemotePackage = z.infer<typeof remotePackage>;
