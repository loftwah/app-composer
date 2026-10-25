import type {
  TeamHubRequest,
  TeamHubSnapshot,
} from "../../lib/team-hub-contract.ts";

export function recoveryChecklist(): TeamHubRequest {
  return {
    title: "Recovery checklist — name the application",
    body: "Purpose: restore the selected application without changing another team.\nOwner: name the responsible teammate.\nWhen to use: describe the observed failure and affected environment.\nBefore starting: identify the exact backup, current release and required approval.\nSteps: write the reviewed reversible actions in the private attachment.\nVerify: independently check records, media and current access revocations.\nStop and escalate: describe the point where recovery is uncertain.",
    assignee: null,
    status: "open",
    attachment: {
      name: "recovery-runbook.txt",
      text: "Private team runbook\n\nApplication and environment:\nResponsible owner and reviewer:\nObserved failure:\nExact release / backup / object version:\nApproval and permitted action:\n\nRecovery steps:\n1. Preserve current evidence and confirm the selected target.\n2. Perform only the reviewed reversible action.\n3. Verify the affected user journey independently.\n4. Check that revocations, deletions and unrelated teams remain unchanged.\n\nObserved result and rollback:\n\nDo not put passwords, tokens, private keys or recovery codes in this document. This checklist does not itself approve or execute an action.\n",
    },
  };
}

export function filterTeamRequests(
  requests: TeamHubSnapshot["requests"],
  query: string,
  status: string,
  assignedTo: string | null,
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return requests.filter(
    (row) =>
      (status === "all" ||
        (status === "active"
          ? row.status !== "done"
          : row.status === status)) &&
      (!assignedTo || row.assignee === assignedTo) &&
      terms.every((term) =>
        `${row.title}\n${row.body}`.toLocaleLowerCase().includes(term),
      ),
  );
}
