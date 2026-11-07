import { z } from "zod";

// Bounded reader for the receipt the local delivery journey writes. It is the
// same `app-composer.delivery-receipt/1` contract a runner produces; the admin
// surface stores only these fields, never command output, tokens or logs.
export const deliveryReceiptSchema = "app-composer.delivery-receipt/1";
export const deliveryRunnerKinds = [
  "local",
  "jenkins",
  "gitlab",
  "buildkite",
  "azure-pipelines",
  "circleci",
  "codebuild",
  "other",
] as const;
export const deliveryModes = ["local", "candidate", "release", "verify"] as const;
export const deliveryStates = ["passed", "failed", "refused"] as const;
export const maximumReceiptBytes = 24 * 1024;
export const maximumStoredRuns = 20;

const commit = z.string().regex(/^[a-f0-9]{40}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const text = (limit: number) => z.string().min(1).max(limit);
const optionalText = (limit: number) => z.string().max(limit).nullable();

const binding = z
  .object({
    binding: text(80),
    id: text(120),
  })
  .strict();

const preview = z
  .object({
    worker: text(120),
    environment: z.literal("preview"),
    origin: z.url().max(300).nullable(),
    d1: z.array(binding).min(1).max(10),
    r2: z.array(binding).min(1).max(10),
    kv: z.array(binding).min(1).max(10),
    services: z.number().int().min(0).max(100),
    routes: z.number().int().min(0).max(100),
    crons: z.number().int().min(0).max(100),
    isolated: z.literal(true),
  })
  .strict();

const target = z
  .object({
    worker: text(120),
    account: text(80),
    environment: text(40),
    origin: z.url().max(300),
    compatibilityDate: optionalText(20),
    composition: z
      .object({
        id: z.string().regex(/^[a-f0-9]{64}$/),
        apps: z
          .array(
            z
              .object({
                id: text(80),
                commit: optionalText(40),
                dataVersion: z.number().int().min(0).max(1000).nullable(),
              })
              .strict(),
          )
          .max(20),
      })
      .strict(),
    preview: preview.nullable(),
  })
  .strict();

const step = z
  .object({
    id: text(40),
    label: text(120),
    command: text(200),
    state: z.enum(["passed", "failed"]),
    durationMs: z.number().int().min(0).max(86_400_000),
    error: z.string().max(240).optional(),
    code: z.string().max(60).optional(),
  })
  .strict();

export const artefactIdentity = z
  .object({
    path: text(40),
    files: z.number().int().min(1).max(100_000),
    bytes: z.number().int().min(1).max(2_000_000_000),
    digest,
  })
  .strict();

const candidate = z
  .object({
    built: z.literal(true),
    uploaded: z.literal(false),
    versionUrlUsed: z.literal(false),
    worker: text(120),
    origin: z.url().max(300).nullable(),
    configPath: text(120),
    digest,
    artefact: artefactIdentity.nullable(),
    isolation: preview.nullable(),
    warning: z.string().max(400),
  })
  .strict();

export const deliveryReceipt = z
  .object({
    schema: z.literal(deliveryReceiptSchema),
    mode: z.enum(deliveryModes),
    state: z.enum(deliveryStates),
    generatedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime(),
    runner: z
      .object({
        kind: z.enum(deliveryRunnerKinds),
        local: z.boolean(),
        runId: optionalText(300),
        runUrl: optionalText(500),
        source: z.enum(["flag", "environment", "default"]),
      })
      .strict(),
    source: z
      .object({
        available: z.boolean(),
        repository: optionalText(120),
        branch: optionalText(120),
        commit: commit.nullable(),
        originCommit: commit.nullable(),
        dirty: z.boolean().nullable(),
        pushed: z.boolean(),
        releaseEligible: z.boolean(),
      })
      .strict()
      .nullable(),
    target: target.nullable(),
    steps: z.array(step).max(12),
    artefact: artefactIdentity.nullable(),
    candidate: candidate.nullable(),
    release: z
      .object({
        attempted: z.boolean(),
        performed: z.boolean(),
        command: optionalText(60),
        commit: commit.nullable(),
        checks: optionalText(200),
        failed: z.boolean().optional(),
      })
      .strict(),
    verification: z
      .object({
        performed: z.boolean(),
        independent: z.boolean(),
        verifier: text(80),
        origin: z.url().max(300).nullable(),
      })
      .strict(),
    approval: z
      .object({
        mode: z.literal("explicit-flag"),
        flag: text(20),
        sourceCommit: commit.nullable(),
        candidateDigest: digest.nullable(),
      })
      .strict(),
    review: z
      .object({
        required: z.boolean(),
        action: optionalText(300),
      })
      .strict(),
    nextAction: optionalText(400),
    limits: z.array(z.string().min(1).max(300)).max(10),
    error: z
      .object({
        code: text(60),
        message: text(240),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const issue = (path: Array<string | number>, message: string) =>
      ctx.addIssue({ code: "custom", message, path });
    if (value.mode === "candidate" && !value.candidate)
      issue(["candidate"], "A candidate receipt must include the built candidate.");
    if (value.mode === "local" && value.candidate)
      issue(["candidate"], "Local checks cannot report a candidate.");
    if (value.mode === "release" || value.mode === "verify") {
      if (!value.source || value.source.commit === null)
        issue(["source"], "This mode needs an exact source commit.");
    }
    if (value.mode === "release") {
      if (!value.release.attempted)
        issue(["release"], "A release receipt must record the attempt.");
      if (value.release.commit !== value.source?.commit)
        issue(["release", "commit"], "The release commit must match the source commit.");
      if (value.state === "passed" && !value.release.performed)
        issue(["release"], "A passed release must have performed the guarded release.");
      if (
        value.state === "passed" &&
        !(value.verification.performed && value.verification.independent)
      )
        issue(["verification"], "A passed release needs an independent live read.");
    }
    if (
      value.mode === "verify" &&
      value.state === "passed" &&
      !value.verification.performed
    )
      issue(["verification"], "A passed verify run must record the live read.");
  });

export type DeliveryReceipt = z.infer<typeof deliveryReceipt>;

export const deliveryRun = z
  .object({
    id: text(64),
    runner: z.enum(deliveryRunnerKinds),
    mode: z.enum(deliveryModes),
    state: z.enum(deliveryStates),
    runId: optionalText(300),
    runUrl: optionalText(500),
    repository: optionalText(120),
    branch: optionalText(120),
    commit: commit.nullable(),
    worker: optionalText(120),
    account: optionalText(80),
    environment: optionalText(40),
    origin: optionalText(300),
    artefactDigest: optionalText(80),
    artefactFiles: z.number().int().min(0).max(100_000).nullable(),
    candidateDigest: optionalText(80),
    releasePerformed: z.boolean(),
    verificationPerformed: z.boolean(),
    generatedAt: z.iso.datetime(),
    recordedAt: z.iso.datetime(),
    recordedBy: text(120),
    receipt: deliveryReceipt,
  })
  .strict();

export const deliveryRunList = z
  .object({
    ok: z.literal(true),
    site: z.literal("https://composer.loftwah.com"),
    environment: z.literal("production"),
    checkedAt: z.iso.datetime(),
    runs: z.array(deliveryRun).max(maximumStoredRuns),
    retention: z
      .object({
        stored: z.number().int().min(0).max(maximumStoredRuns),
        maximum: z.literal(maximumStoredRuns),
      })
      .strict(),
    limits: z.array(z.string().min(1).max(300)).max(6),
  })
  .strict();

export type DeliveryRun = z.infer<typeof deliveryRun>;
export type DeliveryRunList = z.infer<typeof deliveryRunList>;

export const deliveryLabels: Record<
  (typeof deliveryModes)[number],
  string
> = {
  local: "Local checks",
  candidate: "Preview candidate",
  release: "Production release",
  verify: "Independent verify",
};

export const runnerLabels: Record<
  (typeof deliveryRunnerKinds)[number],
  string
> = {
  local: "This machine or my agent",
  jenkins: "Jenkins",
  gitlab: "GitLab CI",
  buildkite: "Buildkite",
  "azure-pipelines": "Azure Pipelines",
  circleci: "CircleCI",
  codebuild: "AWS CodeBuild",
  other: "Another runner",
};
