import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  agentProposalSnapshot,
  agentProposalView,
  agentHandoffArtifact,
  agentGrantSnapshot,
  agentGrantView,
  agentConnectionSecret,
  type AgentConnectionSecret,
  type AgentGrantSnapshot,
  type AgentGrantView,
  type AgentHandoffArtifact,
  type AgentProposalSnapshot,
  type AgentProposalView,
} from "../../lib/agent-proposal-contract";
import { confirmWorkspace } from "../stacks/workspace-scope";

const base = "/_emdash/api/plugins/composer-stacks/";

export async function showProposalCall(
  workspace: string,
  proposal: string,
): Promise<AgentProposalView> {
  const response = await apiFetch(
    base +
      "proposalsRead?" +
      new URLSearchParams({ action: "show", workspace, proposal }),
    { cache: "no-store" },
  );
  const value = await parseApiResponse<unknown>(
    response,
    "The saved investigation could not be confirmed. Refresh before reviewing.",
  );
  const parsed = agentProposalView.safeParse(value);
  if (!parsed.success)
    throw Error(
      "The saved investigation could not be validated. Refresh before reviewing.",
    );
  confirmWorkspace(workspace, parsed.data.workspace);
  if (parsed.data.id !== proposal)
    throw Error(
      "The response named another proposal. Refresh before reviewing.",
    );
  return parsed.data;
}

export async function proposalCall(
  action: string,
  workspace?: string,
  fields: Record<string, unknown> = {},
): Promise<AgentProposalSnapshot> {
  const response = await apiFetch(
    base +
      "proposalsRead?" +
      new URLSearchParams({
        action,
        ...(workspace ? { workspace } : {}),
        ...(typeof fields.state === "string" ? { state: fields.state } : {}),
      }),
    { cache: "no-store" },
  );
  const value = await parseApiResponse<unknown>(
    response,
    "The proposal list could not be confirmed. Refresh its saved state before retrying.",
  );
  const parsed = agentProposalSnapshot.safeParse(value);
  if (!parsed.success)
    throw Error(
      value &&
        typeof value === "object" &&
        "message" in value &&
        typeof value.message === "string"
        ? value.message
        : "The proposal list could not be validated. Refresh before reviewing.",
    );
  confirmWorkspace(workspace, parsed.data.workspace.id);
  return parsed.data;
}

export interface ProposalReviewResult {
  proposal: AgentProposalView;
  execution: "not-performed";
}
export interface ProposalHandoffResult {
  proposal: AgentProposalView;
  artifact: AgentHandoffArtifact;
  execution: "not-performed";
}

export async function reviewProposalCall(
  workspace: string,
  fields: Record<string, unknown>,
): Promise<ProposalReviewResult> {
  const response = await apiFetch(base + "proposalsWrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, action: "review", workspace }),
  });
  const value = await parseApiResponse<unknown>(
    response,
    "The review could not be confirmed. Refresh the proposal before retrying.",
  );
  const proposal = agentProposalView.safeParse(
    value && typeof value === "object" && "proposal" in value
      ? value.proposal
      : null,
  );
  if (!proposal.success)
    throw Error(
      value &&
        typeof value === "object" &&
        "message" in value &&
        typeof value.message === "string"
        ? value.message
        : "The review response could not be validated. Refresh before retrying.",
    );
  confirmWorkspace(workspace, proposal.data.workspace);
  return { proposal: proposal.data, execution: "not-performed" };
}

export async function handoffProposalCall(
  workspace: string,
  fields: Record<string, unknown>,
): Promise<ProposalHandoffResult> {
  const response = await apiFetch(base + "proposalsWrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, action: "handoff", workspace }),
  });
  const value = await parseApiResponse<unknown>(
    response,
    "The handoff could not be confirmed. Refresh the accepted digest before retrying.",
  );
  const proposal = agentProposalView.safeParse(
    value && typeof value === "object" && "proposal" in value
      ? value.proposal
      : null,
  );
  const artifact = agentHandoffArtifact.safeParse(
    value && typeof value === "object" && "artifact" in value
      ? value.artifact
      : null,
  );
  if (!proposal.success || !artifact.success)
    throw Error(
      value &&
        typeof value === "object" &&
        "message" in value &&
        typeof value.message === "string"
        ? value.message
        : "The handoff response could not be validated. Refresh before retrying.",
    );
  confirmWorkspace(workspace, proposal.data.workspace);
  return {
    proposal: proposal.data,
    artifact: artifact.data,
    execution: "not-performed",
  };
}

function message(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

export async function grantsCall(
  workspace?: string,
): Promise<AgentGrantSnapshot> {
  const response = await apiFetch(
    base +
      "proposalsRead?" +
      new URLSearchParams({
        action: "grants",
        ...(workspace ? { workspace } : {}),
      }),
    { cache: "no-store" },
  );
  const value = await parseApiResponse<unknown>(
    response,
    "The agent connections could not be confirmed. Refresh before authorising one.",
  );
  const parsed = agentGrantSnapshot.safeParse(value);
  if (!parsed.success)
    throw Error(
      message(
        value,
        "The agent connections could not be validated. Refresh before authorising one.",
      ),
    );
  confirmWorkspace(workspace, parsed.data.workspace.id);
  return parsed.data;
}

export interface AgentConnectionResult {
  grant: AgentGrantView;
  connection: AgentConnectionSecret;
}

async function connectionWrite(
  fields: Record<string, unknown>,
  workspace: string,
): Promise<AgentConnectionResult> {
  const response = await apiFetch(base + "proposalsWrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...fields, workspace }),
  });
  const value = await parseApiResponse<unknown>(
    response,
    "The agent connection could not be confirmed. Refresh before retrying.",
  );
  const grant = agentGrantView.safeParse(
    value && typeof value === "object" && "grant" in value ? value.grant : null,
  );
  const connection = agentConnectionSecret.safeParse(
    value && typeof value === "object" && "connection" in value
      ? value.connection
      : null,
  );
  if (!grant.success || !connection.success)
    throw Error(
      message(
        value,
        "The agent connection response could not be validated. Refresh before retrying.",
      ),
    );
  confirmWorkspace(workspace, grant.data.workspace);
  return { grant: grant.data, connection: connection.data };
}

export async function createGrantCall(
  workspace: string,
  fields: Record<string, unknown>,
) {
  return connectionWrite({ ...fields, action: "grant" }, workspace);
}

export async function rotateConnectionCall(workspace: string, grant: string) {
  return connectionWrite({ action: "connection-rotate", grant }, workspace);
}

export async function revokeGrantCall(
  workspace: string,
  grant: string,
  reason: string,
): Promise<AgentGrantView> {
  const response = await apiFetch(base + "proposalsWrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "grant-revoke",
      workspace,
      grant,
      reason,
    }),
  });
  const value = await parseApiResponse<unknown>(
    response,
    "The revocation could not be confirmed. Refresh before retrying.",
  );
  const parsed = agentGrantView.safeParse(
    value && typeof value === "object" && "grant" in value ? value.grant : null,
  );
  if (!parsed.success)
    throw Error(
      message(
        value,
        "The revocation response could not be validated. Refresh before retrying.",
      ),
    );
  confirmWorkspace(workspace, parsed.data.workspace);
  return parsed.data;
}
