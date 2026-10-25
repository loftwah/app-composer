import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { isCreatorRole } from "./creator-access.ts";
import { resolveWorkspace, requireCapability, StackError } from "./stacks.mjs";
import {
  AgentProposalError,
  agentBriefingVersion,
  agentChange,
  agentEvidence,
  agentGrantInput,
  agentGrantView,
  agentHandoffArtifact,
  agentHandoffInput,
  agentHuman,
  agentProposalSnapshot,
  agentProposalState,
  agentProposalSubmit,
  agentProposalSuite,
  agentProposalVersion,
  agentProposalView,
  agentReviewInput,
  agentRisk,
  agentStoredSource,
  agentVerifyResult,
  assertNoSecretMaterial,
  buildAgentBriefing,
  canonicalJson,
  getAgentRolePack,
  proposalDigestContent,
  sha256Hex,
  type AgentActor,
  type AgentBriefingContent,
  type AgentChange,
  type AgentEnvironment,
  type AgentEvidence,
  type AgentGrantView,
  type AgentHandoffArtifact,
  type AgentProposalState,
  type AgentProposalView,
  type AgentReviewDecision,
  type AgentRisk,
  type AgentRolePack,
  type AgentStoredSource,
  type AgentVerifyResult,
} from "./agent-proposal-contract.ts";

const origin = "https://composer.loftwah.com";
const readInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("list"),
      workspace: z
        .string()
        .regex(/^[a-z0-9-]{6,64}$/)
        .optional(),
      state: agentProposalState.optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("show"),
      workspace: z
        .string()
        .regex(/^[a-z0-9-]{6,64}$/)
        .optional(),
      proposal: z.string().regex(/^[a-z0-9-]{6,64}$/),
    })
    .strict(),
]);
const writeInput = z.discriminatedUnion("action", [
  agentReviewInput.omit({ actor: true }),
  agentHandoffInput.omit({ actor: true }),
]);

interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
}
interface User {
  id: string;
  role: number;
  name?: string | null;
}
interface Context {
  user?: User;
  request: Request;
  input: unknown;
}
interface GrantRow {
  id: string;
  workspace_id: string;
  app: string;
  environment_id: string;
  environment_kind: "local" | "preview";
  account_id: string;
  role_pack: AgentRolePack;
  agent_id: string;
  agent_name: string;
  owner_id: string;
  owner_name: string;
  fallback_id: string;
  fallback_name: string;
  mode: "proposal-only";
  revision: number;
  issued_by: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}
interface BriefingRow {
  id: string;
  grant_id: string;
  workspace_id: string;
  app: string;
  environment_id: string;
  role_pack: AgentRolePack;
  role_pack_version: string;
  as_of: string;
  evidence_json: string;
  content_json: string;
  digest: string;
}
interface ProposalRow {
  id: string;
  workspace_id: string;
  app: string;
  environment_id: string;
  environment_kind: "local" | "preview";
  account_id: string;
  role_pack: AgentRolePack;
  role_pack_version: string;
  briefing_id: string;
  briefing_digest: string;
  grant_id: string;
  proposer_id: string;
  proposer_name: string;
  proposer_key: string;
  current_version: number;
  digest: string;
  state: AgentProposalState;
  accepted_digest: string | null;
  accepted_version: number | null;
  accepted_by_id: string | null;
  accepted_by_name: string | null;
  accepted_at: string | null;
  submitted_at: string;
  updated_at: string;
}
interface VersionRow {
  workspace_id: string;
  proposal_id: string;
  version: number;
  digest: string;
  source_json: string;
  evidence_json: string;
  risk: AgentRisk;
  change_json: string;
  submitted_at: string;
}
interface ReviewRow {
  id: string;
  proposal_id: string;
  version: number;
  digest: string;
  decision: AgentReviewDecision;
  actor_id: string;
  actor_name: string;
  reason: string;
  created_at: string;
}
interface HandoffRow {
  id: string;
  proposal_id: string;
  version: number;
  digest: string;
  destination: "existing-release-flow" | "existing-delivery-flow";
  actor_id: string;
  actor_name: string;
  artifact_json: string;
  state: "prepared";
  execution: "not-performed";
  created_at: string;
}

export interface AgentSourceCheck {
  state: "current" | "stale" | "missing" | "pinned-commit" | "unchecked";
  detail: string;
  currentHash: string | null;
  checkedAt: string;
}

export interface AgentStoreOptions {
  now?: string;
  sourceCheck?: AgentSourceCheck;
  actorKind?: "human" | "agent";
  workspaceRole?: "owner" | "editor" | "viewer";
  deduplicate?: (proposal: AgentProposalView) => void;
}

const localSourceFreshMs = 10 * 60 * 1000;
const key = (value: string) => value.trim().toLowerCase();
const iso = (value: string) => new Date(value).toISOString();

function fail(code: string, message: string, status = 400): never {
  throw new StackError(code, message, status);
}

function fromContract(error: unknown): never {
  if (error instanceof AgentProposalError)
    fail(
      error.code,
      error.message,
      error.code === "PRODUCTION_TARGET" ? 403 : 400,
    );
  if (error instanceof StackError) throw error;
  throw error;
}

function parseOrFail<T>(
  schema: z.ZodType<T>,
  value: unknown,
  message: string,
): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      fail(
        "INVALID",
        `${message}${first ? ` ${first.path.join(".")}: ${first.message}` : ""}`,
      );
    }
    throw error;
  }
}

function grantView(row: GrantRow, now: string): AgentGrantView {
  const state =
    row.revoked_at !== null
      ? "revoked"
      : Date.parse(row.expires_at) <= Date.parse(now)
        ? "expired"
        : "active";
  return agentGrantView.parse({
    id: row.id,
    workspace: row.workspace_id,
    app: row.app,
    environment: {
      id: row.environment_id,
      kind: row.environment_kind,
      account: row.account_id,
    },
    rolePack: row.role_pack,
    mode: row.mode,
    agent: { id: row.agent_id, name: row.agent_name },
    owner: { id: row.owner_id, name: row.owner_name },
    fallback: { id: row.fallback_id, name: row.fallback_name },
    issuedBy: row.issued_by,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    revision: row.revision,
    state,
  });
}

function requireActiveGrant(row: GrantRow | null, now: string): GrantRow {
  if (!row) fail("GRANT_NOT_FOUND", "This proposal grant does not exist.", 404);
  if (row.revoked_at)
    fail(
      "GRANT_REVOKED",
      "This proposal grant was revoked. A new owner-issued grant is required.",
      403,
    );
  if (Date.parse(row.expires_at) <= Date.parse(now))
    fail(
      "GRANT_EXPIRED",
      "This proposal grant has expired. Ask the accountable owner for a new grant.",
      403,
    );
  return row;
}

async function grantRow(db: D1Database, id: string, workspace: string) {
  return db
    .prepare("SELECT * FROM creator_agent_grants WHERE id=? AND workspace_id=?")
    .bind(id, workspace)
    .first<GrantRow>();
}

function assertGrantScope(
  row: GrantRow,
  scope: {
    workspace?: string;
    app: string;
    environment: AgentEnvironment;
    rolePack: AgentRolePack;
    agent?: AgentActor;
  },
) {
  if (scope.workspace && row.workspace_id !== scope.workspace)
    fail("SCOPE_MISMATCH", "This grant belongs to another workspace.", 403);
  if (
    row.app !== scope.app ||
    row.environment_id !== scope.environment.id ||
    row.environment_kind !== scope.environment.kind ||
    row.account_id !== scope.environment.account ||
    row.role_pack !== scope.rolePack
  )
    fail(
      "SCOPE_MISMATCH",
      "The grant does not cover this app, environment or role pack.",
      403,
    );
  if (scope.agent && key(row.agent_id) !== key(scope.agent.id))
    fail(
      "SCOPE_MISMATCH",
      "This grant belongs to another agent identity.",
      403,
    );
}

function assertHumanReviewer(
  grant: GrantRow,
  actor: AgentActor,
  proposerKey: string,
  options: AgentStoreOptions,
) {
  if (options.actorKind === "agent")
    fail(
      "SELF_APPROVAL",
      "An agent identity cannot review or approve a proposal.",
      403,
    );
  if (key(actor.id) === proposerKey)
    fail("SELF_APPROVAL", "The proposer cannot review its own proposal.", 403);
  const allowed = [key(grant.owner_id), key(grant.fallback_id)];
  if (!allowed.includes(key(actor.id)))
    fail(
      "REVIEWER_NOT_AUTHORISED",
      "Only the named accountable owner or fallback can review this proposal.",
      403,
    );
}

function sourceView(
  source: AgentStoredSource,
  options: AgentStoreOptions,
  now: string,
  phase: "review" | "verify",
): AgentSourceCheck {
  if (options.sourceCheck) {
    const check = options.sourceCheck;
    if (check.state === "stale" || check.state === "missing") return check;
    if (
      source.kind === "local-path" &&
      (check.state !== "current" ||
        check.currentHash === null ||
        check.currentHash !== source.contentHash)
    )
      return {
        ...check,
        state: "stale",
        detail: "The current source hash does not match the submitted source.",
      };
    return check;
  }
  if (source.kind === "repo")
    return {
      state: "pinned-commit",
      detail: `Repository ${source.repository} is pinned to ${source.commit}. ${
        source.checkout
          ? "The checkout is not re-read in this runtime."
          : "No mutable checkout was supplied."
      }`,
      currentHash: source.contentHash,
      checkedAt: now,
    };
  const age = Date.parse(now) - Date.parse(source.checkedAt);
  if (phase === "verify" || age > localSourceFreshMs)
    return {
      state: "unchecked",
      detail:
        phase === "verify"
          ? "A local source must be rechecked by the CLI before it can be verified."
          : "This local source was checked more than 10 minutes ago. Recheck it from the local CLI before accepting.",
      currentHash: null,
      checkedAt: now,
    };
  return {
    state: "current",
    detail: `The source hash was checked at submission (${source.checkedAt}).`,
    currentHash: source.contentHash,
    checkedAt: source.checkedAt,
  };
}

function requireCurrentSource(
  source: AgentStoredSource,
  options: AgentStoreOptions,
  now: string,
  phase: "review" | "verify",
): AgentSourceCheck {
  const check = sourceView(source, options, now, phase);
  if (check.state === "stale")
    fail(
      "SOURCE_STALE",
      `The proposed source moved after submission. ${check.detail}`,
      409,
    );
  if (check.state === "missing")
    fail(
      "SOURCE_MISSING",
      `The proposed source is unavailable. ${check.detail}`,
      409,
    );
  if (check.state === "unchecked") fail("SOURCE_UNVERIFIED", check.detail, 409);
  return check;
}

async function versionRow(db: D1Database, proposal: string, version: number) {
  return db
    .prepare(
      "SELECT * FROM creator_agent_proposal_versions WHERE proposal_id=? AND version=?",
    )
    .bind(proposal, version)
    .first<VersionRow>();
}

function decodeSource(row: VersionRow): AgentStoredSource {
  try {
    return agentStoredSource.parse(JSON.parse(row.source_json));
  } catch {
    fail(
      "CORRUPT_RECORD",
      "The stored source identity is invalid. No review action was performed.",
      409,
    );
  }
}
function decodeEvidence(row: VersionRow): AgentEvidence[] {
  try {
    return z
      .array(agentEvidence)
      .min(1)
      .max(20)
      .parse(JSON.parse(row.evidence_json));
  } catch {
    fail(
      "CORRUPT_RECORD",
      "The stored evidence references are invalid. No review action was performed.",
      409,
    );
  }
}
function decodeChange(row: VersionRow): AgentChange {
  try {
    return agentChange.parse(JSON.parse(row.change_json));
  } catch {
    fail(
      "CORRUPT_RECORD",
      "The stored proposed change is invalid. No review action was performed.",
      409,
    );
  }
}
async function currentDigest(
  proposal: ProposalRow,
  version: VersionRow,
  briefing: BriefingRow,
): Promise<string> {
  const content = proposalDigestContent({
    briefing: { id: proposal.briefing_id, digest: proposal.briefing_digest },
    rolePack: proposal.role_pack,
    rolePackVersion: proposal.role_pack_version,
    workspace: proposal.workspace_id,
    app: proposal.app,
    environment: {
      id: proposal.environment_id,
      kind: proposal.environment_kind,
      account: proposal.account_id,
    },
    proposer: { id: proposal.proposer_id, name: proposal.proposer_name },
    source: decodeSource(version),
    evidence: decodeEvidence(version),
    risk: agentRisk.parse(version.risk),
    change: decodeChange(version),
  });
  if (briefing.digest !== proposal.briefing_digest)
    fail(
      "DIGEST_MISMATCH",
      "The briefing digest changed after submission.",
      409,
    );
  const briefingContent = JSON.parse(briefing.content_json);
  const briefingContentDigest = await sha256Hex(canonicalJson(briefingContent));
  if (briefingContentDigest !== briefing.digest)
    fail(
      "DIGEST_MISMATCH",
      "The stored briefing content changed after submission.",
      409,
    );
  return sha256Hex(canonicalJson(content));
}

function nextAction(state: AgentProposalState, handoff: boolean): string {
  if (state === "submitted")
    return "Review the exact digest. Accept, request changes or reject. Accepting does not execute anything.";
  if (state === "changes-requested")
    return "Submit a new version that answers the review reason. The previous digest is no longer current.";
  if (state === "rejected")
    return "This proposal is closed. A new briefing and proposal are required if the owner asks for another attempt.";
  return handoff
    ? "The digest is accepted and a handoff artifact is prepared. Execution remains with the existing released flow."
    : "The digest is accepted. Prepare a separate handoff for the existing release flow; acceptance alone executes nothing.";
}

async function buildView(
  db: D1Database,
  row: ProposalRow,
  now: string,
): Promise<AgentProposalView> {
  const [version, grant, reviews, handoff, briefing] = await Promise.all([
    versionRow(db, row.id, row.current_version),
    grantRow(db, row.grant_id, row.workspace_id),
    db
      .prepare(
        "SELECT * FROM creator_agent_proposal_reviews WHERE proposal_id=? ORDER BY created_at DESC,id DESC LIMIT 20",
      )
      .bind(row.id)
      .all<ReviewRow>(),
    db
      .prepare(
        "SELECT * FROM creator_agent_proposal_handoffs WHERE proposal_id=? AND version=?",
      )
      .bind(row.id, row.current_version)
      .first<HandoffRow>(),
    db
      .prepare("SELECT * FROM creator_agent_briefings WHERE id=?")
      .bind(row.briefing_id)
      .first<BriefingRow>(),
  ]);
  if (!version || !grant || !briefing)
    fail(
      "CORRUPT_RECORD",
      "This proposal is incomplete. No review action is available.",
      409,
    );
  if (row.state === "accepted" && row.accepted_digest !== version.digest)
    fail(
      "DIGEST_MISMATCH",
      "The accepted digest no longer matches the stored content.",
      409,
    );
  const view = {
    id: row.id,
    version: row.current_version,
    state: row.state,
    risk: agentRisk.parse(version.risk),
    workspace: row.workspace_id,
    app: row.app,
    environment: {
      id: row.environment_id,
      kind: row.environment_kind,
      account: row.account_id,
    },
    rolePack: row.role_pack,
    rolePackVersion: row.role_pack_version,
    proposer: { id: row.proposer_id, name: row.proposer_name },
    source: decodeSource(version),
    evidence: decodeEvidence(version),
    change: decodeChange(version),
    digest: row.digest,
    briefing: {
      id: briefing.id,
      digest: briefing.digest,
      asOf: briefing.as_of,
    },
    grant: grantView(grant, now),
    submittedAt: version.submitted_at,
    updatedAt: row.updated_at,
    reviews: reviews.results.map((review) => ({
      id: review.id,
      version: review.version,
      digest: review.digest,
      decision: review.decision,
      actor: { id: review.actor_id, name: review.actor_name },
      reason: review.reason,
      createdAt: review.created_at,
    })),
    accepted:
      row.state === "accepted" &&
      row.accepted_digest &&
      row.accepted_version &&
      row.accepted_by_name &&
      row.accepted_at
        ? {
            digest: row.accepted_digest,
            version: row.accepted_version,
            by: row.accepted_by_name,
            at: row.accepted_at,
          }
        : null,
    handoff: handoff
      ? {
          id: handoff.id,
          state: handoff.state,
          execution: handoff.execution,
          destination: handoff.destination,
          createdAt: handoff.created_at,
          artifact: agentHandoffArtifact.parse(
            JSON.parse(handoff.artifact_json),
          ),
        }
      : null,
    nextAction: nextAction(row.state, Boolean(handoff)),
    execution: "not-performed" as const,
  };
  return agentProposalView.parse(view);
}

/** Owner action: issue a proposal-only grant. Never an execution grant. */
export async function provisionAgentGrant(
  db: D1Database,
  input: unknown,
  options: AgentStoreOptions = {},
): Promise<AgentGrantView> {
  const now = options.now ? iso(options.now) : new Date().toISOString();
  const command = parseOrFail(
    agentGrantInput,
    input,
    "The grant could not be read.",
  );
  try {
    assertNoSecretMaterial(command, "Grant");
  } catch (error) {
    fromContract(error);
  }
  if (Date.parse(command.expiresAt) <= Date.parse(now))
    fail("GRANT_EXPIRED", "A new grant must expire in the future.", 400);
  const workspace = await db
    .prepare("SELECT id FROM creator_workspaces WHERE id=?")
    .bind(command.workspace)
    .first<{ id: string }>();
  if (!workspace)
    fail("WORKSPACE_NOT_FOUND", "That workspace does not exist.", 404);
  const issuedAt = now;
  const id = `grant-${crypto.randomUUID()}`;
  await db
    .prepare(
      "INSERT INTO creator_agent_grants (id,workspace_id,app,environment_id,environment_kind,account_id,role_pack,agent_id,agent_name,owner_id,owner_name,fallback_id,fallback_name,mode,revision,issued_by,issued_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      id,
      command.workspace,
      command.app,
      command.environment.id,
      command.environment.kind,
      command.environment.account,
      command.rolePack,
      command.agent.id,
      command.agent.name,
      command.owner.id,
      command.owner.name,
      command.fallback.id,
      command.fallback.name,
      "proposal-only",
      1,
      command.issuedBy,
      issuedAt,
      command.expiresAt,
    )
    .run();
  const row = await grantRow(db, id, command.workspace);
  if (!row)
    fail(
      "UNAVAILABLE",
      "The grant could not be saved. No proposal authority was issued.",
      500,
    );
  return grantView(row, now);
}

/** Owner action: revoke a grant. Existing proposals stay inspectable. */
export async function revokeAgentGrant(
  db: D1Database,
  input: {
    workspace: string;
    grant: string;
    actor: AgentActor;
    reason: string;
  },
  options: AgentStoreOptions = {},
): Promise<AgentGrantView> {
  const now = options.now ? iso(options.now) : new Date().toISOString();
  const command = parseOrFail(
    z
      .object({
        workspace: z.string().regex(/^[a-z0-9-]{6,64}$/),
        grant: z.string().regex(/^[a-z0-9-]{6,64}$/),
        actor: agentHuman,
        reason: z.string().trim().min(8).max(400),
      })
      .strict(),
    input,
    "The revocation could not be read.",
  );
  if (options.actorKind === "agent")
    fail(
      "SELF_APPROVAL",
      "An agent cannot revoke or issue its own grant.",
      403,
    );
  const row = await grantRow(db, command.grant, command.workspace);
  if (!row) fail("GRANT_NOT_FOUND", "This proposal grant does not exist.", 404);
  if (
    ![key(row.owner_id), key(row.fallback_id)].includes(key(command.actor.id))
  )
    fail(
      "REVIEWER_NOT_AUTHORISED",
      "Only the named owner or fallback can revoke this grant.",
      403,
    );
  if (row.revoked_at) return grantView(row, now);
  await db
    .prepare(
      "UPDATE creator_agent_grants SET revoked_at=?,revoked_by=?,revoke_reason=?,revision=revision+1 WHERE id=? AND workspace_id=? AND revoked_at IS NULL",
    )
    .bind(now, command.actor.name, command.reason, row.id, row.workspace_id)
    .run();
  const fresh = await grantRow(db, row.id, row.workspace_id);
  return grantView(fresh ?? row, now);
}

/** Read-only briefing for the selected grant. Deterministic for equal input. */
export async function createAgentBriefing(
  db: D1Database,
  input: {
    workspace: string;
    grant: string;
    asOf: string;
    evidence: unknown;
  },
  _options: AgentStoreOptions = {},
): Promise<{
  id: string;
  digest: string;
  content: AgentBriefingContent;
  markdown: string;
  created: boolean;
}> {
  const command = parseOrFail(
    z
      .object({
        workspace: z.string().regex(/^[a-z0-9-]{6,64}$/),
        grant: z.string().regex(/^[a-z0-9-]{6,64}$/),
        asOf: z.iso.datetime({ offset: false }),
        evidence: z.array(agentEvidence).min(1).max(20),
      })
      .strict(),
    input,
    "The briefing request could not be read.",
  );
  const asOf = iso(command.asOf);
  const grant = requireActiveGrant(
    await grantRow(db, command.grant, command.workspace),
    asOf,
  );
  const workspace = await db
    .prepare("SELECT id,name FROM creator_workspaces WHERE id=?")
    .bind(command.workspace)
    .first<{ id: string; name: string }>();
  if (!workspace)
    fail("WORKSPACE_NOT_FOUND", "That workspace does not exist.", 404);
  let built;
  try {
    built = buildAgentBriefing({
      asOf,
      grant: {
        id: grant.id,
        mode: grant.mode,
        expiresAt: grant.expires_at,
        workspace: { id: grant.workspace_id, name: workspace.name },
        app: grant.app,
        environment: {
          id: grant.environment_id,
          kind: grant.environment_kind,
          account: grant.account_id,
        },
        rolePack: grant.role_pack,
        owner: { id: grant.owner_id, name: grant.owner_name },
        fallback: { id: grant.fallback_id, name: grant.fallback_name },
      },
      evidence: command.evidence,
    });
  } catch (error) {
    fromContract(error);
  }
  const digest = await sha256Hex(canonicalJson(built.content));
  const id = `brf-${digest.slice(0, 32)}`;
  const evidence = [...built.content.permittedEvidence].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO creator_agent_briefings (id,grant_id,workspace_id,app,environment_id,role_pack,role_pack_version,as_of,evidence_json,content_json,digest) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      id,
      grant.id,
      grant.workspace_id,
      grant.app,
      grant.environment_id,
      grant.role_pack,
      getAgentRolePack(grant.role_pack)?.version ?? "1.0.0",
      asOf,
      JSON.stringify(evidence),
      canonicalJson(built.content),
      digest,
    )
    .run();
  const row = await db
    .prepare("SELECT * FROM creator_agent_briefings WHERE id=?")
    .bind(id)
    .first<BriefingRow>();
  if (!row)
    fail(
      "UNAVAILABLE",
      "The briefing could not be saved. No proposal can be submitted from it.",
      500,
    );
  if (row.digest !== digest)
    fail(
      "DIGEST_MISMATCH",
      "The saved briefing does not match this request.",
      409,
    );
  return {
    id: row.id,
    digest: row.digest,
    content: JSON.parse(row.content_json) as AgentBriefingContent,
    markdown: built.markdown,
    created: (result.meta?.changes ?? 0) > 0,
  };
}

async function loadBriefing(db: D1Database, id: string, workspace: string) {
  const row = await db
    .prepare(
      "SELECT * FROM creator_agent_briefings WHERE id=? AND workspace_id=?",
    )
    .bind(id, workspace)
    .first<BriefingRow>();
  if (!row)
    fail(
      "BRIEFING_NOT_FOUND",
      "This briefing is not in the selected workspace.",
      404,
    );
  const parsed = JSON.parse(row.content_json) as AgentBriefingContent;
  const digest = await sha256Hex(canonicalJson(parsed));
  if (digest !== row.digest)
    fail(
      "DIGEST_MISMATCH",
      "The stored briefing changed after it was generated.",
      409,
    );
  return { row, content: parsed };
}

/** Agent action: submit a scoped proposal. The CLI computes the source hash. */
export async function submitAgentProposal(
  db: D1Database,
  input: unknown,
  options: AgentStoreOptions & { source: AgentStoredSource },
): Promise<{ view: AgentProposalView; deduplicated: boolean }> {
  const now = options.now ? iso(options.now) : new Date().toISOString();
  const command = parseOrFail(
    agentProposalSubmit,
    input,
    "The proposal could not be read.",
  );
  try {
    assertNoSecretMaterial(command, "Proposal");
  } catch (error) {
    fromContract(error);
  }
  const grant = requireActiveGrant(
    await grantRow(db, command.grant, command.workspace),
    now,
  );
  assertGrantScope(grant, {
    workspace: command.workspace,
    app: command.app,
    environment: command.environment,
    rolePack: command.rolePack,
    agent: command.agent,
  });
  const { row: briefing, content } = await loadBriefing(
    db,
    command.briefing,
    command.workspace,
  );
  if (
    briefing.grant_id !== grant.id ||
    briefing.app !== command.app ||
    briefing.environment_id !== command.environment.id ||
    briefing.role_pack !== command.rolePack
  )
    fail(
      "SCOPE_MISMATCH",
      "The briefing does not match this grant and proposal scope.",
      403,
    );
  const permitted = new Map(
    content.permittedEvidence.map((item) => [item.id, item]),
  );
  const ids = [...new Set(command.evidence)].sort((a, b) => a.localeCompare(b));
  if (ids.length !== command.evidence.length)
    fail("DUPLICATE_EVIDENCE", "Cite each evidence id once.", 400);
  const evidence = ids.map((id) => {
    const item = permitted.get(id);
    if (!item)
      fail(
        "UNPERMITTED_EVIDENCE",
        `Evidence ${id} is not in this briefing. Generate a new briefing to add it.`,
        403,
      );
    return item;
  });
  const source = agentStoredSource.parse(options.source);
  if (
    source.kind !== command.source.kind ||
    (source.kind === "repo" &&
      command.source.kind === "repo" &&
      (source.repository !== command.source.repository ||
        source.commit !== command.source.commit)) ||
    (source.kind === "local-path" &&
      command.source.kind === "local-path" &&
      source.path !== command.source.path.replace(/^\.\//, ""))
  )
    fail(
      "SOURCE_MISMATCH",
      "The checked source does not match the submitted source.",
      409,
    );
  const pack = getAgentRolePack(command.rolePack);
  if (!pack) fail("INVALID", "Choose a known role pack.", 400);
  const digestContent = proposalDigestContent({
    briefing: { id: briefing.id, digest: briefing.digest },
    rolePack: command.rolePack,
    rolePackVersion: pack.version,
    workspace: command.workspace,
    app: command.app,
    environment: command.environment,
    proposer: command.agent,
    source,
    evidence,
    risk: command.risk,
    change: command.change,
  });
  const digest = await sha256Hex(canonicalJson(digestContent));
  const duplicate = await db
    .prepare(
      "SELECT workspace_id,proposal_id FROM creator_agent_proposal_versions WHERE workspace_id=? AND digest=?",
    )
    .bind(command.workspace, digest)
    .first<{ workspace_id: string; proposal_id: string }>();
  if (duplicate) {
    const row = await db
      .prepare(
        "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
      )
      .bind(duplicate.proposal_id, command.workspace)
      .first<ProposalRow>();
    if (!row)
      fail(
        "CORRUPT_RECORD",
        "The duplicate proposal record is incomplete.",
        409,
      );
    return { view: await buildView(db, row, now), deduplicated: true };
  }
  let proposalId: string;
  let version: number;
  if (command.proposal) {
    const row = await db
      .prepare(
        "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
      )
      .bind(command.proposal, command.workspace)
      .first<ProposalRow>();
    if (!row)
      fail(
        "PROPOSAL_NOT_FOUND",
        "This proposal is not in the selected workspace.",
        404,
      );
    assertGrantScope(grant, {
      workspace: row.workspace_id,
      app: row.app,
      environment: {
        id: row.environment_id,
        kind: row.environment_kind,
        account: row.account_id,
      },
      rolePack: row.role_pack,
    });
    if (row.grant_id !== grant.id)
      fail(
        "SCOPE_MISMATCH",
        "A proposal revision must use the grant that created it.",
        403,
      );
    if (row.state === "accepted" || row.state === "rejected")
      fail(
        "TERMINAL",
        "This proposal is closed. Open a new briefing and proposal instead of revising it.",
        409,
      );
    proposalId = row.id;
    version = row.current_version + 1;
  } else {
    proposalId = `prop-${crypto.randomUUID()}`;
    version = 1;
  }
  try {
    if (version === 1) {
      await db.batch([
        db
          .prepare(
            "INSERT INTO creator_agent_proposals (id,workspace_id,app,environment_id,environment_kind,account_id,role_pack,role_pack_version,briefing_id,briefing_digest,grant_id,proposer_id,proposer_name,proposer_key,current_version,digest,state,submitted_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            proposalId,
            command.workspace,
            command.app,
            command.environment.id,
            command.environment.kind,
            command.environment.account,
            command.rolePack,
            pack.version,
            briefing.id,
            briefing.digest,
            grant.id,
            command.agent.id,
            command.agent.name,
            key(command.agent.id),
            1,
            digest,
            "submitted",
            now,
            now,
          ),
        db
          .prepare(
            "INSERT INTO creator_agent_proposal_versions (workspace_id,proposal_id,version,digest,source_json,evidence_json,risk,change_json,submitted_at) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            command.workspace,
            proposalId,
            1,
            digest,
            JSON.stringify(source),
            JSON.stringify(evidence),
            command.risk,
            JSON.stringify(command.change),
            now,
          ),
      ]);
    } else {
      await db.batch([
        db
          .prepare(
            "INSERT INTO creator_agent_proposal_versions (workspace_id,proposal_id,version,digest,source_json,evidence_json,risk,change_json,submitted_at) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            command.workspace,
            proposalId,
            version,
            digest,
            JSON.stringify(source),
            JSON.stringify(evidence),
            command.risk,
            JSON.stringify(command.change),
            now,
          ),
        db
          .prepare(
            "UPDATE creator_agent_proposals SET current_version=?,digest=?,state='submitted',accepted_digest=NULL,accepted_version=NULL,accepted_by_id=NULL,accepted_by_name=NULL,accepted_at=NULL,updated_at=? WHERE id=? AND workspace_id=? AND current_version=?",
          )
          .bind(
            version,
            digest,
            now,
            proposalId,
            command.workspace,
            version - 1,
          ),
      ]);
    }
  } catch (error) {
    const raced = await db
      .prepare(
        "SELECT workspace_id,proposal_id FROM creator_agent_proposal_versions WHERE workspace_id=? AND digest=?",
      )
      .bind(command.workspace, digest)
      .first<{ workspace_id: string; proposal_id: string }>();
    if (raced) {
      const row = await db
        .prepare(
          "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
        )
        .bind(raced.proposal_id, command.workspace)
        .first<ProposalRow>();
      if (row)
        return { view: await buildView(db, row, now), deduplicated: true };
    }
    throw error;
  }
  const row = await db
    .prepare(
      "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
    )
    .bind(proposalId, command.workspace)
    .first<ProposalRow>();
  if (!row)
    fail(
      "UNAVAILABLE",
      "The proposal could not be confirmed after submission. Check its saved state before retrying.",
      500,
    );
  if (row.current_version !== version || row.digest !== digest)
    fail(
      "CONFLICT",
      "The proposal changed while it was submitted. Refresh before retrying.",
      409,
    );
  return { view: await buildView(db, row, now), deduplicated: false };
}

export async function listAgentProposals(
  db: D1Database,
  input: { workspace: string; state?: AgentProposalState },
  options: AgentStoreOptions = {},
): Promise<AgentProposalView[]> {
  const now = options.now ? iso(options.now) : new Date().toISOString();
  const rows = input.state
    ? await db
        .prepare(
          "SELECT * FROM creator_agent_proposals WHERE workspace_id=? AND state=? ORDER BY updated_at DESC,id DESC LIMIT 20",
        )
        .bind(input.workspace, input.state)
        .all<ProposalRow>()
    : await db
        .prepare(
          "SELECT * FROM creator_agent_proposals WHERE workspace_id=? ORDER BY updated_at DESC,id DESC LIMIT 20",
        )
        .bind(input.workspace)
        .all<ProposalRow>();
  return Promise.all(rows.results.map((row) => buildView(db, row, now)));
}

export async function showAgentProposal(
  db: D1Database,
  input: { workspace: string; proposal: string },
  options: AgentStoreOptions = {},
): Promise<AgentProposalView> {
  const now = options.now ? iso(options.now) : new Date().toISOString();
  const row = await db
    .prepare(
      "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
    )
    .bind(input.proposal, input.workspace)
    .first<ProposalRow>();
  if (!row)
    fail(
      "PROPOSAL_NOT_FOUND",
      "This proposal is not in the selected workspace.",
      404,
    );
  return buildView(db, row, now);
}

/** Human decision. Accept stores the exact digest but performs no execution. */
export async function reviewAgentProposal(
  db: D1Database,
  input: unknown,
  options: AgentStoreOptions = {},
): Promise<{ view: AgentProposalView; execution: "not-performed" }> {
  const now = options.now ? iso(options.now) : new Date().toISOString();
  const command = parseOrFail(
    agentReviewInput,
    input,
    "The review could not be read.",
  );
  const row = await db
    .prepare(
      "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
    )
    .bind(command.proposal, command.workspace)
    .first<ProposalRow>();
  if (!row)
    fail(
      "PROPOSAL_NOT_FOUND",
      "This proposal is not in the selected workspace.",
      404,
    );
  if (row.environment_id !== command.environment)
    fail(
      "SCOPE_MISMATCH",
      "This proposal targets a different environment.",
      403,
    );
  const grant = requireActiveGrant(
    await grantRow(db, row.grant_id, row.workspace_id),
    now,
  );
  assertGrantScope(grant, {
    workspace: row.workspace_id,
    app: row.app,
    environment: {
      id: row.environment_id,
      kind: row.environment_kind,
      account: row.account_id,
    },
    rolePack: row.role_pack,
  });
  assertHumanReviewer(grant, command.actor, row.proposer_key, options);
  if (options.workspaceRole) {
    requireCapability(options.workspaceRole, "read");
    if (command.decision === "accept" && options.workspaceRole !== "owner")
      fail("FORBIDDEN", "Only the workspace owner can accept a proposal.", 403);
    if (options.workspaceRole === "viewer")
      fail("FORBIDDEN", "A viewer cannot review a proposal.", 403);
  }
  if (row.state === "accepted")
    fail(
      "ALREADY_ACCEPTED",
      "This proposal is already accepted. Open a new proposal for another change.",
      409,
    );
  if (row.state === "rejected")
    fail(
      "TERMINAL",
      "This proposal is closed. Open a new briefing and proposal.",
      409,
    );
  if (
    command.expectedVersion !== row.current_version ||
    command.expectedDigest !== row.digest
  )
    fail(
      "CONFLICT",
      "The proposal changed since it was opened. Refresh before reviewing.",
      409,
    );
  const version = await versionRow(db, row.id, row.current_version);
  if (!version)
    fail(
      "INCOMPLETE",
      "The proposal has no complete submitted version. It cannot be accepted.",
      409,
    );
  const briefingRow = await db
    .prepare("SELECT * FROM creator_agent_briefings WHERE id=?")
    .bind(row.briefing_id)
    .first<BriefingRow>();
  if (!briefingRow)
    fail("CORRUPT_RECORD", "The source briefing is missing.", 409);
  const recomputed = await currentDigest(row, version, briefingRow);
  if (
    recomputed !== row.digest ||
    recomputed !== version.digest ||
    recomputed !== command.expectedDigest
  )
    fail(
      "DIGEST_MISMATCH",
      "The proposal content no longer matches the reviewed digest. Acceptance was refused.",
      409,
    );
  if (command.decision === "accept")
    requireCurrentSource(decodeSource(version), options, now, "review");
  const reviewId = crypto.randomUUID();
  const accepted = command.decision === "accept";
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO creator_agent_proposal_reviews (id,proposal_id,version,digest,decision,actor_id,actor_name,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          reviewId,
          row.id,
          row.current_version,
          recomputed,
          command.decision,
          command.actor.id,
          command.actor.name,
          command.reason,
          now,
        ),
      db
        .prepare(
          accepted
            ? "UPDATE creator_agent_proposals SET state='accepted',accepted_digest=?,accepted_version=?,accepted_by_id=?,accepted_by_name=?,accepted_at=?,updated_at=? WHERE id=? AND workspace_id=? AND current_version=? AND digest=?"
            : command.decision === "request-changes"
              ? "UPDATE creator_agent_proposals SET state='changes-requested',accepted_digest=NULL,accepted_version=NULL,accepted_by_id=NULL,accepted_by_name=NULL,accepted_at=NULL,updated_at=? WHERE id=? AND workspace_id=? AND current_version=? AND digest=?"
              : "UPDATE creator_agent_proposals SET state='rejected',accepted_digest=NULL,accepted_version=NULL,accepted_by_id=NULL,accepted_by_name=NULL,accepted_at=NULL,updated_at=? WHERE id=? AND workspace_id=? AND current_version=? AND digest=?",
        )
        .bind(
          ...(accepted
            ? [
                recomputed,
                row.current_version,
                command.actor.id,
                command.actor.name,
                now,
                now,
                row.id,
                row.workspace_id,
                row.current_version,
                recomputed,
              ]
            : [now, row.id, row.workspace_id, row.current_version, recomputed]),
        ),
    ]);
  } catch (error) {
    if (error instanceof Error && /UNIQUE|constraint/i.test(error.message))
      fail(
        "ALREADY_REVIEWED",
        "This version already has a decision. Refresh its state.",
        409,
      );
    throw error;
  }
  const fresh = await db
    .prepare(
      "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
    )
    .bind(row.id, row.workspace_id)
    .first<ProposalRow>();
  if (!fresh) fail("UNAVAILABLE", "The review could not be confirmed.", 500);
  if (
    fresh.current_version !== row.current_version ||
    fresh.digest !== recomputed ||
    fresh.state === "submitted"
  )
    fail(
      "CONFLICT",
      "The proposal changed while it was reviewed. Refresh before retrying.",
      409,
    );
  return { view: await buildView(db, fresh, now), execution: "not-performed" };
}

/** Separate handoff artifact for the existing authorised release flow. */
export async function prepareAgentHandoff(
  db: D1Database,
  input: unknown,
  options: AgentStoreOptions = {},
): Promise<{ view: AgentProposalView; artifact: AgentHandoffArtifact }> {
  const now = options.now ? iso(options.now) : new Date().toISOString();
  const command = parseOrFail(
    agentHandoffInput,
    input,
    "The handoff request could not be read.",
  );
  if (options.actorKind === "agent")
    fail("SELF_APPROVAL", "An agent cannot prepare its own handoff.", 403);
  if (options.workspaceRole && options.workspaceRole !== "owner")
    fail("FORBIDDEN", "Only the workspace owner can prepare a handoff.", 403);
  const row = await db
    .prepare(
      "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
    )
    .bind(command.proposal, command.workspace)
    .first<ProposalRow>();
  if (!row)
    fail(
      "PROPOSAL_NOT_FOUND",
      "This proposal is not in the selected workspace.",
      404,
    );
  if (row.environment_id !== command.environment)
    fail(
      "SCOPE_MISMATCH",
      "This proposal targets a different environment.",
      403,
    );
  if (row.state !== "accepted" || !row.accepted_digest)
    fail(
      "NOT_ACCEPTED",
      "Accept the exact digest before preparing a handoff.",
      409,
    );
  const grant = requireActiveGrant(
    await grantRow(db, row.grant_id, row.workspace_id),
    now,
  );
  if (key(command.actor.id) !== key(grant.owner_id))
    fail(
      "REVIEWER_NOT_AUTHORISED",
      "Only the accountable owner can prepare a handoff.",
      403,
    );
  if (key(command.actor.id) === row.proposer_key)
    fail("SELF_APPROVAL", "The proposer cannot prepare its own handoff.", 403);
  if (command.expectedDigest !== row.accepted_digest)
    fail(
      "DIGEST_MISMATCH",
      "The expected digest is not the accepted digest.",
      409,
    );
  const version = await versionRow(db, row.id, row.current_version);
  const briefingRow = await db
    .prepare("SELECT * FROM creator_agent_briefings WHERE id=?")
    .bind(row.briefing_id)
    .first<BriefingRow>();
  if (!version || !briefingRow)
    fail(
      "INCOMPLETE",
      "The accepted proposal is incomplete. No handoff was prepared.",
      409,
    );
  const recomputed = await currentDigest(row, version, briefingRow);
  if (recomputed !== row.accepted_digest)
    fail(
      "DIGEST_MISMATCH",
      "The accepted content changed. No handoff was prepared.",
      409,
    );
  requireCurrentSource(decodeSource(version), options, now, "review");
  const existing = await db
    .prepare(
      "SELECT * FROM creator_agent_proposal_handoffs WHERE proposal_id=? AND version=?",
    )
    .bind(row.id, row.current_version)
    .first<HandoffRow>();
  if (existing) {
    return {
      view: await buildView(db, row, now),
      artifact: agentHandoffArtifact.parse(JSON.parse(existing.artifact_json)),
    };
  }
  const artifact = agentHandoffArtifact.parse({
    version: "composer.agent-handoff/1",
    id: crypto.randomUUID(),
    proposal: row.id,
    proposalVersion: row.current_version,
    digest: recomputed,
    workspace: row.workspace_id,
    app: row.app,
    environment: {
      id: row.environment_id,
      kind: row.environment_kind,
      account: row.account_id,
    },
    rolePack: row.role_pack,
    source: decodeSource(version),
    evidence: decodeEvidence(version),
    risk: agentRisk.parse(version.risk),
    change: decodeChange(version),
    acceptedBy: row.accepted_by_name ?? grant.owner_name,
    acceptedAt: row.accepted_at ?? now,
    destination: command.destination,
    execution: "not-performed",
    state: "prepared",
    requires: [
      "A human with existing release authority must compare this artifact with the current source before acting.",
      "Execution happens only through the existing guarded release or delivery flow, with its own checks and approvals.",
      "This artifact grants no deploy, merge, spend, credential or access authority.",
    ],
  });
  await db
    .prepare(
      "INSERT OR IGNORE INTO creator_agent_proposal_handoffs (id,proposal_id,version,digest,destination,actor_id,actor_name,artifact_json,state,execution,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      artifact.id,
      row.id,
      row.current_version,
      recomputed,
      command.destination,
      command.actor.id,
      command.actor.name,
      JSON.stringify(artifact),
      "prepared",
      "not-performed",
      now,
    )
    .run();
  const fresh = await db
    .prepare(
      "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
    )
    .bind(row.id, row.workspace_id)
    .first<ProposalRow>();
  if (!fresh) fail("UNAVAILABLE", "The handoff could not be confirmed.", 500);
  return { view: await buildView(db, fresh, now), artifact };
}

/** Recompute the exact reviewable content and report every consistency check. */
export async function verifyAgentProposal(
  db: D1Database,
  input: { workspace: string; proposal: string },
  options: AgentStoreOptions = {},
): Promise<AgentVerifyResult> {
  const now = options.now ? iso(options.now) : new Date().toISOString();
  const row = await db
    .prepare(
      "SELECT * FROM creator_agent_proposals WHERE id=? AND workspace_id=?",
    )
    .bind(input.proposal, input.workspace)
    .first<ProposalRow>();
  if (!row)
    fail(
      "PROPOSAL_NOT_FOUND",
      "This proposal is not in the selected workspace.",
      404,
    );
  const version = await versionRow(db, row.id, row.current_version);
  const briefingRow = await db
    .prepare("SELECT * FROM creator_agent_briefings WHERE id=?")
    .bind(row.briefing_id)
    .first<BriefingRow>();
  const grant = await grantRow(db, row.grant_id, row.workspace_id);
  const source = version ? decodeSource(version) : null;
  const recomputed =
    version && briefingRow
      ? await currentDigest(row, version, briefingRow)
      : null;
  const sourceCheck = source
    ? sourceView(source, options, now, "verify")
    : {
        state: "missing" as const,
        detail: "No submitted source exists.",
        currentHash: null,
        checkedAt: now,
      };
  const grantState: "active" | "expired" | "revoked" | "missing" = grant
    ? grantView(grant, now).state
    : "missing";
  const handoff = await db
    .prepare(
      "SELECT * FROM creator_agent_proposal_handoffs WHERE proposal_id=? AND version=?",
    )
    .bind(row.id, row.current_version)
    .first<HandoffRow>();
  const checks = [
    {
      id: "version-exists",
      ok: Boolean(version),
      detail: version
        ? `Version ${version.version} is present.`
        : "The current version row is missing; partial intent is not accepted.",
    },
    {
      id: "digest-current",
      ok: Boolean(
        recomputed &&
        recomputed === row.digest &&
        version?.digest === row.digest,
      ),
      detail:
        recomputed === row.digest
          ? "The recomputed digest matches the stored proposal digest."
          : "The recomputed digest does not match the stored digest.",
    },
    {
      id: "digest-matches-version",
      ok: Boolean(version && version.digest === row.digest),
      detail:
        version?.digest === row.digest
          ? "The current version digest matches the proposal."
          : "The current version digest does not match the proposal.",
    },
    {
      id: "accepted-digest",
      ok:
        row.state !== "accepted" ||
        Boolean(
          row.accepted_digest &&
          recomputed &&
          row.accepted_digest === recomputed,
        ),
      detail:
        row.state === "accepted"
          ? row.accepted_digest === recomputed
            ? "The accepted digest matches the current content."
            : "The accepted digest no longer matches the current content."
          : "No acceptance is recorded.",
    },
    {
      id: "grant-active",
      ok: grantState === "active",
      detail: `Grant is ${grantState}.`,
    },
    {
      id: "source-current",
      ok:
        sourceCheck.state === "current" ||
        sourceCheck.state === "pinned-commit",
      detail: `${sourceCheck.state}: ${sourceCheck.detail}`,
    },
    {
      id: "handoff-digest",
      ok: !handoff || handoff.digest === row.accepted_digest,
      detail: handoff
        ? handoff.digest === row.accepted_digest
          ? "The prepared handoff pins the accepted digest."
          : "The prepared handoff does not match the accepted digest."
        : "No handoff is prepared.",
    },
  ];
  const result = {
    ok: checks.every((check) => check.ok),
    version: agentProposalSuite,
    proposal: row.id,
    state: row.state,
    versionNumber: row.current_version,
    storedDigest: row.digest,
    currentDigest: recomputed,
    digestMatches: recomputed === row.digest,
    acceptedDigest: row.accepted_digest,
    acceptedMatchesCurrent: Boolean(
      row.accepted_digest && recomputed === row.accepted_digest,
    ),
    source: {
      state: sourceCheck.state,
      detail: sourceCheck.detail,
    },
    grant: {
      state: grantState,
      detail: grant
        ? `Grant ${grant.id} is ${grantState}; expires ${grant.expires_at}.`
        : "No grant is attached.",
    },
    handoff: {
      state: handoff ? "prepared" : "none",
      digestMatches: !handoff || handoff.digest === row.accepted_digest,
    },
    checks,
    execution: "not-performed" as const,
  };
  return agentVerifyResult.parse(result);
}

/** Native admin route: read proposals or record one human decision. */
export async function manageAgentProposals(
  ctx: Context,
  runtime: Runtime,
): Promise<unknown> {
  try {
    if (!ctx.user || !isCreatorRole(ctx.user.role))
      fail("FORBIDDEN", "A signed-in Composer creator is required.", 403);
    if (!runtime.DB || runtime.PUBLIC_ORIGIN !== origin)
      fail(
        "UNAVAILABLE",
        "Agent proposals are disconnected in this environment.",
      );
    if (
      ctx.request.method !== "GET" &&
      ctx.request.headers.has("Origin") &&
      ctx.request.headers.get("Origin") !== origin
    )
      fail("FORBIDDEN", "Open this view from Composer administration.", 403);
    if (
      ctx.request.method !== "GET" &&
      ctx.request.headers.get("X-EmDash-Request") !== "1"
    )
      fail("FORBIDDEN", "Open this view from Composer administration.", 403);
    const url = new URL(ctx.request.url);
    for (const name of url.searchParams.keys())
      if (url.searchParams.getAll(name).length !== 1)
        fail("INVALID", "Choose each proposal filter once.");
    const db = runtime.DB;
    const user = ctx.user;
    if (ctx.request.method === "GET") {
      const input = parseOrFail(
        readInput,
        ctx.input,
        "The proposal view could not be read.",
      );
      const workspace = await resolveWorkspace(
        db,
        user,
        input.workspace ?? null,
      );
      requireCapability(workspace.role, "read");
      if (input.action === "show")
        return agentProposalView.parse(
          await showAgentProposal(
            db,
            { workspace: workspace.id, proposal: input.proposal },
            { workspaceRole: workspace.role },
          ),
        );
      const proposals = await listAgentProposals(
        db,
        { workspace: workspace.id, state: input.state },
        { workspaceRole: workspace.role },
      );
      return agentProposalSnapshot.parse({
        ok: true,
        version: agentProposalSuite,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          role: workspace.role,
        },
        proposals,
        limit: 20,
        execution: "not-performed",
      });
    }
    const input = parseOrFail(
      writeInput,
      ctx.input,
      "The proposal decision could not be read.",
    );
    const workspace = await resolveWorkspace(db, user, input.workspace);
    requireCapability(workspace.role, "save");
    if (workspace.role === "viewer")
      fail("FORBIDDEN", "A viewer cannot review a proposal.", 403);
    const actor = { id: user.id, name: user.name?.trim() || user.id };
    if (input.action === "review") {
      const result = await reviewAgentProposal(
        db,
        { ...input, workspace: workspace.id, actor },
        { workspaceRole: workspace.role },
      );
      return {
        ok: true,
        version: agentProposalSuite,
        proposal: result.view,
        execution: result.execution,
      };
    }
    const result = await prepareAgentHandoff(
      db,
      { ...input, workspace: workspace.id, actor },
      { workspaceRole: workspace.role },
    );
    return {
      ok: true,
      version: agentProposalSuite,
      proposal: result.view,
      artifact: result.artifact,
      execution: result.artifact.execution,
    };
  } catch (error) {
    if (error instanceof AgentProposalError)
      throw new StackError(
        error.code,
        error.message,
        error.code === "PRODUCTION_TARGET" ? 403 : 400,
      );
    throw error;
  }
}

export { agentBriefingVersion, agentProposalVersion };
