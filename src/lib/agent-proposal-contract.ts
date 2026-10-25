/** Versioned agent proposal contract.
 *
 * A proposal is a reviewable record, not an approval and not an execution
 * instruction. The canonical digest covers exactly the scope, source identity,
 * cited evidence, risk and proposed change. Timestamps, row ids and review
 * history are excluded so the same content always produces the same digest.
 */
import { z } from "zod";
import {
  rolePackIds,
  rolePacks,
  type RolePack,
  type RolePackId,
} from "./role-packs.ts";

export const agentBriefingVersion = "composer.agent-briefing/1";
export const agentProposalVersion = "composer.agent-proposal/1";
export const agentHandoffVersion = "composer.agent-handoff/1";
export const agentProposalSuite = "composer.agent-proposals/1";

const scopedId = z.string().regex(/^[a-z0-9-]{6,64}$/);
const actorId = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const displayName = z.string().trim().min(2).max(80);
const evidenceId = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,39}$/);
const isoTime = z.iso.datetime({ offset: false });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const shortText = z.string().trim().min(1).max(400);
const longText = z.string().trim().min(1).max(120_000);

export const agentRolePack = z.enum(rolePackIds);
export type AgentRolePack = z.infer<typeof agentRolePack>;

export const agentEnvironment = z
  .object({
    id: scopedId,
    kind: z.enum(["local", "preview", "production"]),
    account: z.string().trim().min(1).max(80),
  })
  .strict();
export type AgentEnvironment = z.infer<typeof agentEnvironment>;

export const agentGrantEnvironment = z
  .object({
    id: scopedId,
    kind: z.enum(["local", "preview"]),
    account: z.string().trim().min(1).max(80),
  })
  .strict();

export const agentActor = z.object({ id: actorId, name: displayName }).strict();
export type AgentActor = z.infer<typeof agentActor>;

export const agentHuman = z.object({ id: actorId, name: displayName }).strict();

export const agentGrantInput = z
  .object({
    workspace: scopedId,
    app: scopedId,
    environment: agentEnvironment,
    rolePack: agentRolePack,
    agent: agentActor,
    owner: agentHuman,
    fallback: agentHuman,
    issuedBy: displayName,
    expiresAt: isoTime,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.environment.kind === "production")
      ctx.addIssue({
        code: "custom",
        message:
          "Production proposals are not supported. Use an isolated local or Preview environment.",
      });
    if (value.owner.id === value.fallback.id)
      ctx.addIssue({
        code: "custom",
        message: "The owner and fallback must be different people.",
      });
    if (
      [value.owner.id, value.fallback.id].includes(value.agent.id) ||
      [value.owner.name, value.fallback.name]
        .map((name) => name.toLowerCase())
        .includes(value.agent.name.toLowerCase())
    )
      ctx.addIssue({
        code: "custom",
        message: "An agent cannot be its own accountable owner or fallback.",
      });
    if (
      [value.agent.id, value.agent.name]
        .map((name) => name.trim().toLowerCase())
        .includes(value.issuedBy.trim().toLowerCase())
    )
      ctx.addIssue({
        code: "custom",
        message: "An agent cannot issue its own proposal grant.",
      });
    if (
      ![value.owner.name, value.fallback.name]
        .map((name) => name.trim().toLowerCase())
        .includes(value.issuedBy.trim().toLowerCase())
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Only the accountable owner or fallback can issue this proposal grant.",
      });
  });
export type AgentGrantInput = z.infer<typeof agentGrantInput>;

export const agentGrantView = z
  .object({
    id: scopedId,
    workspace: scopedId,
    app: scopedId,
    environment: agentGrantEnvironment,
    rolePack: agentRolePack,
    mode: z.literal("proposal-only"),
    agent: agentActor,
    owner: agentHuman,
    fallback: agentHuman,
    issuedBy: displayName,
    issuedAt: isoTime,
    expiresAt: isoTime,
    revokedAt: isoTime.nullable(),
    revokedBy: displayName.nullable(),
    revision: z.number().int().positive(),
    state: z.enum(["active", "expired", "revoked"]),
  })
  .strict();
export type AgentGrantView = z.infer<typeof agentGrantView>;

export const agentEvidence = z
  .object({
    id: evidenceId,
    kind: z.string().trim().min(1).max(60),
    source: z.string().trim().min(1).max(300),
    environment: scopedId,
    observedAt: isoTime,
    summary: z.string().trim().min(1).max(500),
  })
  .strict();
export type AgentEvidence = z.infer<typeof agentEvidence>;

/** Per-pack evidence freshness, aligned with the existing role-pack runner. */
export const agentEvidenceHours: Record<RolePackId, number> = {
  "service-owner": 24,
  programmer: 72,
  architect: 168,
  devops: 48,
  security: 72,
  qa: 48,
};

export const agentChange = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("diff"),
      summary: shortText,
      patch: longText,
    })
    .strict(),
  z
    .object({
      kind: z.literal("actions"),
      summary: shortText,
      actions: z
        .array(
          z
            .object({
              op: z.enum([
                "edit",
                "create",
                "delete",
                "configure",
                "investigate",
                "verify",
              ]),
              target: z.string().trim().min(1).max(200),
              detail: z.string().trim().min(1).max(600),
            })
            .strict(),
        )
        .min(1)
        .max(20),
    })
    .strict(),
]);
export type AgentChange = z.infer<typeof agentChange>;

export const agentRisk = z.enum(["low", "medium", "high"]);
export type AgentRisk = z.infer<typeof agentRisk>;

export const agentSourceInput = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("local-path"),
      path: z.string().trim().min(1).max(300),
    })
    .strict(),
  z
    .object({
      kind: z.literal("repo"),
      repository: z.string().trim().min(2).max(200),
      commit: z.string().regex(/^[a-f0-9]{7,40}$/),
      checkout: z.string().trim().min(1).max(300).optional(),
    })
    .strict(),
]);
export type AgentSourceInput = z.infer<typeof agentSourceInput>;

export const agentStoredSource = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("local-path"),
      path: z.string().min(1).max(300),
      contentHash: sha256,
      files: z.number().int().min(1).max(50),
      bytes: z.number().int().min(1).max(2_000_000),
      checkedAt: isoTime,
    })
    .strict(),
  z
    .object({
      kind: z.literal("repo"),
      repository: z.string().min(2).max(200),
      commit: z.string().regex(/^[a-f0-9]{7,40}$/),
      checkout: z.string().min(1).max(300).nullable(),
      contentHash: sha256.nullable(),
      files: z.number().int().min(0).max(50),
      bytes: z.number().int().min(0).max(2_000_000),
      checkedAt: isoTime.nullable(),
    })
    .strict(),
]);
export type AgentStoredSource = z.infer<typeof agentStoredSource>;

export const agentProposalSubmit = z
  .object({
    action: z.literal("submit"),
    workspace: scopedId,
    app: scopedId,
    environment: agentEnvironment,
    rolePack: agentRolePack,
    grant: scopedId,
    briefing: scopedId,
    proposal: scopedId.optional(),
    agent: agentActor,
    source: agentSourceInput,
    evidence: z.array(evidenceId).min(1).max(20),
    risk: agentRisk,
    change: agentChange,
  })
  .strict();
export type AgentProposalSubmit = z.infer<typeof agentProposalSubmit>;

export const agentReviewDecision = z.enum([
  "accept",
  "request-changes",
  "reject",
]);
export type AgentReviewDecision = z.infer<typeof agentReviewDecision>;

export const agentReviewInput = z
  .object({
    action: z.literal("review"),
    workspace: scopedId,
    proposal: scopedId,
    environment: scopedId,
    decision: agentReviewDecision,
    actor: agentHuman,
    reason: z.string().trim().min(8).max(1000),
    expectedDigest: sha256,
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export type AgentReviewInput = z.infer<typeof agentReviewInput>;

export const agentHandoffInput = z
  .object({
    action: z.literal("handoff"),
    workspace: scopedId,
    proposal: scopedId,
    environment: scopedId,
    actor: agentHuman,
    expectedDigest: sha256,
    destination: z
      .enum(["existing-release-flow", "existing-delivery-flow"])
      .default("existing-release-flow"),
  })
  .strict();
export type AgentHandoffInput = z.infer<typeof agentHandoffInput>;

export const agentProposalReview = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    digest: sha256,
    decision: agentReviewDecision,
    actor: agentHuman,
    reason: z.string(),
    createdAt: isoTime,
  })
  .strict();
export type AgentProposalReview = z.infer<typeof agentProposalReview>;

export const agentHandoffArtifact = z
  .object({
    version: z.literal(agentHandoffVersion),
    id: z.uuid(),
    proposal: scopedId,
    proposalVersion: z.number().int().positive(),
    digest: sha256,
    workspace: scopedId,
    app: scopedId,
    environment: agentEnvironment,
    rolePack: agentRolePack,
    source: agentStoredSource,
    evidence: z.array(agentEvidence).min(1).max(20),
    risk: agentRisk,
    change: agentChange,
    acceptedBy: z.string(),
    acceptedAt: isoTime,
    destination: z.enum(["existing-release-flow", "existing-delivery-flow"]),
    execution: z.literal("not-performed"),
    state: z.literal("prepared"),
    requires: z.array(z.string()).min(1),
  })
  .strict();
export type AgentHandoffArtifact = z.infer<typeof agentHandoffArtifact>;

export const agentProposalState = z.enum([
  "submitted",
  "changes-requested",
  "rejected",
  "accepted",
]);
export type AgentProposalState = z.infer<typeof agentProposalState>;

export const agentProposalView = z
  .object({
    id: scopedId,
    version: z.number().int().positive(),
    state: agentProposalState,
    risk: agentRisk,
    workspace: scopedId,
    app: scopedId,
    environment: agentEnvironment,
    rolePack: agentRolePack,
    rolePackVersion: z.string(),
    proposer: agentActor,
    source: agentStoredSource,
    evidence: z.array(agentEvidence).min(1).max(20),
    change: agentChange,
    digest: sha256,
    briefing: z
      .object({ id: scopedId, digest: sha256, asOf: isoTime })
      .strict(),
    grant: agentGrantView,
    submittedAt: isoTime,
    updatedAt: isoTime,
    reviews: z.array(agentProposalReview).max(20),
    accepted: z
      .object({
        digest: sha256,
        version: z.number().int().positive(),
        by: displayName,
        at: isoTime,
      })
      .strict()
      .nullable(),
    handoff: z
      .object({
        id: z.uuid(),
        state: z.literal("prepared"),
        execution: z.literal("not-performed"),
        destination: z.enum([
          "existing-release-flow",
          "existing-delivery-flow",
        ]),
        createdAt: isoTime,
        artifact: agentHandoffArtifact,
      })
      .strict()
      .nullable(),
    nextAction: z.string(),
    execution: z.literal("not-performed"),
  })
  .strict();
export type AgentProposalView = z.infer<typeof agentProposalView>;

export const agentProposalSnapshot = z
  .object({
    ok: z.literal(true),
    version: z.literal(agentProposalSuite),
    workspace: z
      .object({
        id: scopedId,
        name: z.string().max(80),
        role: z.enum(["owner", "editor", "viewer"]),
      })
      .strict(),
    proposals: z.array(agentProposalView).max(20),
    limit: z.literal(20),
    execution: z.literal("not-performed"),
  })
  .strict();
export type AgentProposalSnapshot = z.infer<typeof agentProposalSnapshot>;

export const agentVerifyResult = z
  .object({
    ok: z.boolean(),
    version: z.literal(agentProposalSuite),
    proposal: scopedId,
    state: agentProposalState,
    versionNumber: z.number().int().positive(),
    storedDigest: sha256,
    currentDigest: sha256.nullable(),
    digestMatches: z.boolean(),
    acceptedDigest: sha256.nullable(),
    acceptedMatchesCurrent: z.boolean(),
    source: z
      .object({
        state: z.enum([
          "current",
          "stale",
          "missing",
          "pinned-commit",
          "unchecked",
        ]),
        detail: z.string(),
      })
      .strict(),
    grant: z
      .object({
        state: z.enum([
          "active",
          "expired",
          "revoked",
          "missing",
          "scope-mismatch",
        ]),
        detail: z.string(),
      })
      .strict(),
    handoff: z
      .object({
        state: z.enum(["prepared", "none"]),
        digestMatches: z.boolean(),
      })
      .strict(),
    checks: z.array(
      z
        .object({
          id: z.string(),
          ok: z.boolean(),
          detail: z.string(),
        })
        .strict(),
    ),
    execution: z.literal("not-performed"),
  })
  .strict();
export type AgentVerifyResult = z.infer<typeof agentVerifyResult>;

export class AgentProposalError extends Error {
  code: string;
  humanAction: string;
  constructor(code: string, message: string, humanAction: string) {
    super(message);
    this.name = "AgentProposalError";
    this.code = code;
    this.humanAction = humanAction;
  }
}

const secretPatterns: { label: string; pattern: RegExp }[] = [
  {
    label: "bearer token",
    pattern: /\bBearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+/-]{12,}/i,
  },
  {
    label: "OpenAI-style key",
    pattern: /\bsk_(?:live|test|proj)_[A-Za-z0-9_-]{8,}/,
  },
  { label: "AWS key id", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    label: "GitHub token",
    pattern:
      /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  },
  { label: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  {
    label: "private key",
    pattern:
      /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|-----BEGIN OPENSSH PRIVATE KEY-----/,
  },
  {
    label: "labelled secret",
    pattern:
      /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?(?!\[REDACTED\])[^\s"']{8,}/i,
  },
  {
    label: "environment-style secret",
    pattern:
      /(?:^|[\s"'`+-])(?:[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|SALT|AUTH)[A-Z0-9_]*)\s*=\s*(?!\[REDACTED\])[^\s"'`#]{6,}/,
  },
  {
    label: "credential URL",
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{4,}@/i,
  },
  {
    label: "JWT",
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
];

/** Return labelled locations only; never echo the suspected value. */
export function scanSecretMaterial(
  value: unknown,
  path = "",
  found: { path: string; label: string }[] = [],
): { path: string; label: string }[] {
  if (typeof value === "string") {
    for (const { label, pattern } of secretPatterns)
      if (pattern.test(value)) found.push({ path: path || "value", label });
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      scanSecretMaterial(entry, `${path}[${index}]`, found),
    );
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value))
      scanSecretMaterial(entry, path ? `${path}.${key}` : key, found);
  }
  return found;
}

export function assertNoSecretMaterial(value: unknown, where: string): void {
  const secrets = scanSecretMaterial(value);
  if (!secrets.length) return;
  throw new AgentProposalError(
    "SECRET_MATERIAL",
    `${where} contains secret-like material at ${secrets
      .map((item) => `${item.path} (${item.label})`)
      .join(", ")}. The value was not stored.`,
    "Remove the value, rotate it through the owning console, and re-submit with a redacted reference such as [REDACTED].",
  );
}

/** Stable JSON: object keys sorted, array order retained, no undefined. */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new AgentProposalError(
        "INVALID_CANONICAL_VALUE",
        "A digest input contains a non-finite number.",
        "Use a finite numeric value.",
      );
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return "[" + value.map((entry) => canonicalJson(entry)).join(",") + "]";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => JSON.stringify(key) + ":" + canonicalJson(record[key]))
        .join(",") +
      "}"
    );
  }
  throw new AgentProposalError(
    "INVALID_CANONICAL_VALUE",
    "A digest input contains a value that cannot be canonicalised.",
    "Use JSON text, numbers, booleans, arrays and plain objects only.",
  );
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Exclude check timestamps from the reviewable identity. */
export function proposalDigestSource(
  source: AgentStoredSource,
): Record<string, unknown> {
  return source.kind === "local-path"
    ? {
        kind: source.kind,
        path: source.path,
        contentHash: source.contentHash,
        files: source.files,
        bytes: source.bytes,
      }
    : {
        kind: source.kind,
        repository: source.repository,
        commit: source.commit,
        checkout: source.checkout,
        contentHash: source.contentHash,
        files: source.files,
        bytes: source.bytes,
      };
}

export function proposalDigestContent(input: {
  briefing: { id: string; digest: string };
  rolePack: AgentRolePack;
  rolePackVersion: string;
  workspace: string;
  app: string;
  environment: AgentEnvironment;
  proposer: AgentActor;
  source: AgentStoredSource;
  evidence: AgentEvidence[];
  risk: AgentRisk;
  change: AgentChange;
}): Record<string, unknown> {
  return {
    schema: agentProposalVersion,
    briefing: { id: input.briefing.id, digest: input.briefing.digest },
    rolePack: input.rolePack,
    rolePackVersion: input.rolePackVersion,
    workspace: input.workspace,
    app: input.app,
    environment: input.environment,
    proposer: input.proposer,
    source: proposalDigestSource(input.source),
    evidence: [...input.evidence].sort((a, b) => a.id.localeCompare(b.id)),
    risk: input.risk,
    change: input.change,
  };
}

export function proposalReviewDigest(input: {
  scope: {
    workspace: string;
    app: string;
    environment: string;
    rolePack: string;
  };
  sourceIdentity: string;
  evidence: AgentEvidence[];
  risk: AgentRisk;
  change: AgentChange;
}): Record<string, unknown> {
  return {
    schema: agentProposalVersion,
    scope: input.scope,
    sourceIdentity: input.sourceIdentity,
    evidence: [...input.evidence]
      .map((item) => item.id)
      .sort((a, b) => a.localeCompare(b)),
    risk: input.risk,
    change: input.change,
  };
}

export interface AgentBriefingContent {
  version: typeof agentBriefingVersion;
  suite: typeof agentProposalSuite;
  asOf: string;
  rolePack: {
    id: AgentRolePack;
    label: string;
    title: string;
    version: string;
    purpose: string;
    job: string;
  };
  scope: {
    workspace: { id: string; name: string };
    app: string;
    environment: AgentEnvironment;
    owner: AgentActor;
    fallback: AgentActor;
    grant: { id: string; mode: "proposal-only"; expiresAt: string };
  };
  inputs: RolePack["inputs"];
  requiredEvidence: string[];
  permittedEvidence: AgentEvidence[];
  outputSchema: {
    rolePackFields: RolePack["output"];
    proposalFields: string[];
  };
  stopRules: string[];
  prohibitedActions: string[];
  sourceRules: string[];
  proposalDigestRule: string;
  execution: "not-performed";
}

export function getAgentRolePack(id: string): RolePack | undefined {
  return rolePacks.find((pack) => pack.id === id);
}

export function buildAgentBriefing(input: {
  asOf: string;
  grant: {
    id: string;
    mode: "proposal-only";
    expiresAt: string;
    workspace: { id: string; name: string };
    app: string;
    environment: AgentEnvironment;
    rolePack: AgentRolePack;
    owner: AgentActor;
    fallback: AgentActor;
  };
  evidence: AgentEvidence[];
}): {
  content: AgentBriefingContent;
  markdown: string;
} {
  const pack = getAgentRolePack(input.grant.rolePack);
  if (!pack)
    throw new AgentProposalError(
      "UNKNOWN_ROLE_PACK",
      `Unknown role pack: ${input.grant.rolePack}.`,
      `Choose one of: ${rolePackIds.join(", ")}.`,
    );
  const asOf = isoTime.parse(input.asOf);
  const environment = agentEnvironment.parse(input.grant.environment);
  if (input.grant.environment.kind === "production")
    throw new AgentProposalError(
      "PRODUCTION_TARGET",
      "Agent proposals are limited to local and preview environments.",
      "Select an isolated local or Preview environment. Production proposals are not supported by this slice.",
    );
  const evidence = input.evidence
    .map((item) => agentEvidence.parse(item))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!evidence.length)
    throw new AgentProposalError(
      "MISSING_EVIDENCE",
      "A briefing needs at least one permitted evidence reference.",
      "Add bounded, redacted evidence from the selected environment.",
    );
  const seen = new Set<string>();
  for (const item of evidence) {
    if (seen.has(item.id))
      throw new AgentProposalError(
        "DUPLICATE_EVIDENCE",
        `Evidence id ${item.id} appears more than once.`,
        "Use one reference per evidence id.",
      );
    seen.add(item.id);
    if (item.environment !== environment.id)
      throw new AgentProposalError(
        "WRONG_ENVIRONMENT",
        `Evidence ${item.id} was captured in ${item.environment}, not ${environment.id}.`,
        "Use evidence from the selected environment or reconcile the target first.",
      );
    if (Date.parse(item.observedAt) > Date.parse(asOf))
      throw new AgentProposalError(
        "FUTURE_EVIDENCE",
        `Evidence ${item.id} is observed after the briefing time.`,
        "Correct the evidence timestamp; do not invent a fresh observation.",
      );
    const age = (Date.parse(asOf) - Date.parse(item.observedAt)) / 3_600_000;
    if (age > agentEvidenceHours[pack.id])
      throw new AgentProposalError(
        "STALE_EVIDENCE",
        `Evidence ${item.id} is ${Math.round(age)}h old; ${pack.id} allows ${agentEvidenceHours[pack.id]}h.`,
        "Refresh the named evidence and generate a new briefing.",
      );
  }
  assertNoSecretMaterial(evidence, "Briefing evidence");
  const inputRequirements = pack.inputs.map(
    (field) =>
      `${field.label}${field.required ? " (required)" : " (optional)"} — ${field.note}`,
  );
  const content: AgentBriefingContent = {
    version: agentBriefingVersion,
    suite: agentProposalSuite,
    asOf,
    rolePack: {
      id: pack.id,
      label: pack.label,
      title: pack.title,
      version: pack.version,
      purpose: pack.purpose,
      job: pack.job,
    },
    scope: {
      workspace: input.grant.workspace,
      app: input.grant.app,
      environment,
      owner: input.grant.owner,
      fallback: input.grant.fallback,
      grant: {
        id: input.grant.id,
        mode: input.grant.mode,
        expiresAt: input.grant.expiresAt,
      },
    },
    inputs: pack.inputs,
    requiredEvidence: pack.evidence,
    permittedEvidence: evidence,
    outputSchema: {
      rolePackFields: pack.output,
      proposalFields: [
        "source identity: repository + commit, or local path + content hash",
        "evidence ids drawn only from permittedEvidence",
        "risk: low, medium or high",
        "proposed change: a bounded diff or 1-20 structured actions",
      ],
    },
    stopRules: [
      ...pack.stops,
      "The selected workspace, app, environment, role pack or agent does not match the grant: stop before submitting.",
      "The grant is revoked or expired: stop; ask the accountable owner for a new grant.",
      "Evidence is stale, from another environment or not listed here: refresh it and generate a new briefing.",
      "The proposed source moved after submission: the proposal is stale and cannot be accepted.",
      "Secret-like material is present: remove it, rotate it through the owning console and re-submit a redacted reference.",
      "The agent is asked to approve, deploy, merge, spend or change access: stop. Those actions are outside this grant.",
    ],
    prohibitedActions: [
      ...pack.prohibited,
      "Approve or reject this proposal, including your own submission.",
      "Deploy, merge, publish, run a migration, change a binding, rotate a credential or change access.",
      "Request, store or repeat credentials, tokens, private keys or environment values.",
      "Create a second proposal with the same digest to manufacture a different review state.",
    ],
    sourceRules: [
      "Use repo + commit for an immutable source pin, or local path + content hash for a mutable checkout.",
      "Local paths must stay inside the selected repository and contain at most 50 files and 2 MB.",
      "The server rechecks a local source at review, accept and verify time; a changed hash is stale.",
      "A repository commit is treated as pinned. A supplied checkout is rechecked for content drift.",
    ],
    proposalDigestRule:
      "The canonical SHA-256 digest covers scope, source identity, cited evidence, risk and the exact proposed change. It excludes ids and timestamps, so identical content is idempotent and any mutation changes the digest.",
    execution: "not-performed",
  };
  const markdown = renderAgentBriefing(content, inputRequirements);
  return { content, markdown };
}

function md(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export function renderAgentBriefing(
  content: AgentBriefingContent,
  inputRequirements: string[],
): string {
  return `# ${content.rolePack.label} agent briefing

Version ${content.rolePack.version} · suite ${content.suite} · as of ${content.asOf}
Workspace ${content.scope.workspace.name} (${content.scope.workspace.id}) · app ${content.scope.app} · ${content.scope.environment.kind}/${content.scope.environment.id} · account ${content.scope.environment.account}
Grant ${content.scope.grant.id} · ${content.scope.grant.mode} · expires ${content.scope.grant.expiresAt}
Accountable owner ${content.scope.owner.name} · fallback ${content.scope.fallback.name}

> This briefing is read-only for the agent. It is not an approval, not a deployment instruction and not an access grant. Submit a proposal, then stop. A separate human reviews it.

## Job

${md(content.rolePack.job)}

## Inputs

${inputRequirements.map((line) => `- ${line}`).join("\n")}

## Required evidence

${content.requiredEvidence.map((line) => `- ${line}`).join("\n")}

## Permitted evidence (${content.permittedEvidence.length})

${content.permittedEvidence
  .map(
    (item) =>
      `- **${item.id}** · ${item.kind} · ${item.source} · observed ${item.observedAt} · environment ${item.environment} — ${item.summary}`,
  )
  .join("\n")}

## Output schema

Return a proposal with:
${content.outputSchema.proposalFields.map((line) => `- ${line}`).join("\n")}

Then answer the role-pack fields:
${content.outputSchema.rolePackFields.map((field) => `- **${field.name}:** ${field.detail}`).join("\n")}

## Source rules

${content.sourceRules.map((line) => `- ${line}`).join("\n")}

## Stop and escalate

${content.stopRules.map((line) => `- ${line}`).join("\n")}

## Prohibited

${content.prohibitedActions.map((line) => `- ${line}`).join("\n")}

## Approval digest

${content.proposalDigestRule}

## Execution

Nothing is executed by briefing, submission or acceptance. A separate handoff artifact may be prepared for the existing authorised release flow after a human accepts the exact digest.
`;
}
