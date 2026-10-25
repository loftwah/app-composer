import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  agentProposalSnapshot,
  agentProposalView,
  agentHandoffArtifact,
  type AgentHandoffArtifact,
  type AgentProposalSnapshot,
  type AgentProposalView,
} from "../../lib/agent-proposal-contract";
import { confirmWorkspace } from "../stacks/workspace-scope";

const base = "/_emdash/api/plugins/composer-stacks/";

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
