import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import type {
  AgentProposalSnapshot,
  AgentProposalState,
  AgentProposalView,
} from "../lib/agent-proposal-contract";
import {
  handoffProposalCall,
  proposalCall,
  reviewProposalCall,
} from "./proposals/api";
import { workspaceSelection } from "./stacks/workspace-scope";
import { ConnectAgent } from "./proposals/connect-agent";
import "./proposals-page.css";

const stateLabels: Record<AgentProposalState, string> = {
  submitted: "Submitted",
  "changes-requested": "Changes requested",
  rejected: "Rejected",
  accepted: "Accepted",
};
const riskLabels = { low: "Low", medium: "Medium", high: "High" } as const;

export function ProposalsPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <Proposals key={search} search={search} />;
}

export function Proposals({ search }: { search: string }) {
  const [snapshot, setSnapshot] = useState<AgentProposalSnapshot>();
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState<"all" | AgentProposalState>("all");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [manual, setManual] = useState("");
  const pending = useRef(false),
    live = useRef(true),
    generation = useRef(0);
  const selection = useRef<string | undefined>(undefined);
  const invalidScope = useRef(false);
  const canWrite = Boolean(snapshot && snapshot.workspace.role !== "viewer");
  const canAccept = Boolean(snapshot && snapshot.workspace.role === "owner");
  const shown =
    snapshot?.proposals.filter(
      (view) => filter === "all" || view.state === filter,
    ) ?? [];
  const current =
    snapshot?.proposals.find((view) => view.id === selected) ?? shown[0];

  async function load(message = "") {
    if (pending.current || invalidScope.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const epoch = ++generation.current;
    try {
      const result = await proposalCall("list", selection.current);
      if (!live.current || epoch !== generation.current) return false;
      selection.current = result.workspace.id;
      setSnapshot(result);
      setSelected((previous) =>
        result.proposals.some((view) => view.id === previous)
          ? previous
          : (result.proposals[0]?.id ?? ""),
      );
      if (message) setNotice(message);
      return true;
    } catch (cause) {
      if (live.current && epoch === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The proposal list could not be confirmed. Refresh before reviewing.",
        );
      return false;
    } finally {
      if (live.current && epoch === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    live.current = true;
    try {
      selection.current = workspaceSelection(search);
      void load();
    } catch (cause) {
      invalidScope.current = true;
      setError(
        cause instanceof Error
          ? cause.message
          : "Choose a workspace from Workspace access.",
      );
    }
    return () => {
      live.current = false;
      generation.current++;
      pending.current = false;
    };
  }, []);

  function replace(view: AgentProposalView) {
    setSnapshot((previous) =>
      previous
        ? {
            ...previous,
            proposals: previous.proposals.map((item) =>
              item.id === view.id ? view : item,
            ),
          }
        : previous,
    );
    setSelected(view.id);
  }

  async function review(decision: "accept" | "request-changes" | "reject") {
    if (!current || !selection.current || pending.current) return;
    if (reason.trim().length < 8) {
      setError("Write at least 8 characters explaining this decision.");
      return;
    }
    if (decision === "accept" && !canAccept) {
      setError("Only the workspace owner can accept a proposal.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const epoch = ++generation.current;
    try {
      const result = await reviewProposalCall(selection.current, {
        proposal: current.id,
        environment: current.environment.id,
        decision,
        reason: reason.trim(),
        expectedDigest: current.digest,
        expectedVersion: current.version,
      });
      if (!live.current || epoch !== generation.current) return;
      replace(result.proposal);
      setReason("");
      setNotice(
        decision === "accept"
          ? "Accepted the exact digest. Nothing was executed. Prepare a separate handoff only when the existing release flow is ready."
          : decision === "reject"
            ? "Rejected. The proposer must start a new briefing and proposal."
            : "Changes requested. The next version must answer this reason and will receive a new digest.",
      );
    } catch (cause) {
      if (live.current && epoch === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The decision could not be confirmed. Refresh before retrying.",
        );
    } finally {
      if (live.current && epoch === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  async function handoff() {
    if (!current || !current.accepted || !selection.current || pending.current)
      return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const epoch = ++generation.current;
    try {
      const result = await handoffProposalCall(selection.current, {
        proposal: current.id,
        environment: current.environment.id,
        expectedDigest: current.accepted.digest,
        destination: "existing-release-flow",
      });
      if (!live.current || epoch !== generation.current) return;
      replace(result.proposal);
      setNotice(
        "Handoff prepared for the existing release flow. Execution was not performed and no deployment authority was granted.",
      );
    } catch (cause) {
      if (live.current && epoch === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The handoff could not be confirmed. Refresh the accepted digest.",
        );
    } finally {
      if (live.current && epoch === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  async function copyArtifact(view: AgentProposalView) {
    if (!view.handoff) return;
    const text = JSON.stringify(view.handoff.artifact, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setNotice(
        "Handoff artifact copied. A human with existing release authority must compare it with the current source.",
      );
      setManual("");
    } catch {
      setManual(text);
      setNotice("Your browser could not copy this. Select the artifact below.");
    }
  }

  return (
    <div className="composer-proposals">
      <div className="ap-heading">
        <h1>Agent proposals</h1>
        <button
          type="button"
          disabled={busy || invalidScope.current}
          onClick={() => void load("Saved proposals refreshed.")}
        >
          Refresh
        </button>
      </div>
      <p className="ap-scope">
        {snapshot ? (
          <>
            Workspace <strong>{snapshot.workspace.name}</strong> ·{" "}
            {snapshot.workspace.role} · proposals are limited to local and
            isolated Preview environments
          </>
        ) : (
          "Confirming the selected workspace…"
        )}
      </p>
      <p className="ap-proof">
        <strong>Proposal-only local slice.</strong> A proposal is a reviewable
        record, not an approval or a deployment instruction. Accepting stores
        the exact digest and executes nothing. A separate handoff is prepared
        for the existing authorised release flow. No hosted agent service,
        provider credential or production execution is connected.
      </p>
      <div className="ap-links">
        <a href="/roles">Role packs</a>
        <a href="/docs/agent-proposals">How proposals work</a>
        <a href="/_emdash/admin/plugins/composer-stacks/workspaces">
          Workspace access
        </a>
      </div>
      {error && (
        <p className="ap-error" role="alert">
          {error}
        </p>
      )}
      <p className="ap-status" role="status">
        {busy ? "Checking the saved proposal…" : notice}
      </p>
      {snapshot && (
        <>
          <ConnectAgent
            workspace={snapshot.workspace.id}
            onChanged={() => void load("Saved proposals refreshed.")}
          />
          <div className="ap-controls">
            <label>
              Show
              <select
                value={filter}
                disabled={busy}
                onChange={(event) =>
                  setFilter(event.target.value as typeof filter)
                }
              >
                <option value="all">All states</option>
                <option value="submitted">Submitted</option>
                <option value="changes-requested">Changes requested</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <p>
              {shown.length} shown · latest {snapshot.limit} · newest first
            </p>
          </div>
          <div className="ap-workspace">
            <section className="ap-list" aria-label="Choose a proposal">
              {!shown.length && (
                <p className="ap-empty">
                  {snapshot.proposals.length
                    ? "No proposals match this state. Choose All states."
                    : "No proposals yet. Generate a briefing and submit one through node scripts/agent-proposal.mjs."}
                </p>
              )}
              {shown.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className="ap-row"
                  aria-pressed={current?.id === view.id}
                  onClick={() => {
                    setSelected(view.id);
                    setManual("");
                  }}
                >
                  <span>
                    <strong>{view.change.summary}</strong>
                    <small>
                      {view.rolePack} · {view.app} · {view.environment.id}
                    </small>
                  </span>
                  <span>
                    <b>{stateLabels[view.state]}</b>
                    <small>
                      {riskLabels[view.risk]} risk · v{view.version}
                    </small>
                  </span>
                </button>
              ))}
            </section>
            <section className="ap-detail" aria-label="Selected proposal">
              {current ? (
                <>
                  <div className="ap-detail-heading">
                    <h2>{current.change.summary}</h2>
                    <strong>{stateLabels[current.state]}</strong>
                  </div>
                  <p className="ap-next">
                    <strong>Next action:</strong> {current.nextAction}
                  </p>
                  <dl className="ap-facts">
                    <dt>Scope</dt>
                    <dd>
                      {current.workspace} · {current.app} ·{" "}
                      {current.environment.kind}/{current.environment.id} ·
                      account {current.environment.account}
                    </dd>
                    <dt>Role pack</dt>
                    <dd>
                      {current.rolePack} {current.rolePackVersion}
                    </dd>
                    <dt>Risk</dt>
                    <dd>{riskLabels[current.risk]}</dd>
                    <dt>Proposer</dt>
                    <dd>
                      {current.proposer.name} ({current.proposer.id})
                    </dd>
                    <dt>Grant</dt>
                    <dd>
                      {current.grant.id} · {current.grant.mode} ·{" "}
                      {current.grant.state} · expires {current.grant.expiresAt}
                    </dd>
                    <dt>Owner</dt>
                    <dd>
                      {current.grant.owner.name} · fallback{" "}
                      {current.grant.fallback.name}
                    </dd>
                    <dt>Digest</dt>
                    <dd>
                      <code>{current.digest}</code>
                    </dd>
                    <dt>Briefing</dt>
                    <dd>
                      <code>{current.briefing.id}</code> · as of{" "}
                      {current.briefing.asOf}
                    </dd>
                    <dt>Source</dt>
                    <dd>
                      {current.source.kind === "repo" ? (
                        <>
                          {current.source.repository}@
                          <code>{current.source.commit}</code>
                          {current.source.checkout
                            ? ` · checkout ${current.source.checkout}`
                            : ""}
                        </>
                      ) : (
                        <>
                          {current.source.path} · content hash{" "}
                          <code>{current.source.contentHash}</code> · checked{" "}
                          {current.source.checkedAt}
                        </>
                      )}
                    </dd>
                    <dt>Submitted</dt>
                    <dd>{current.submittedAt} UTC</dd>
                    <dt>Updated</dt>
                    <dd>{current.updatedAt} UTC</dd>
                  </dl>

                  <h3>Proposed change</h3>
                  <p>{current.change.summary}</p>
                  {current.change.kind === "diff" ? (
                    <pre className="ap-patch">{current.change.patch}</pre>
                  ) : (
                    <ol className="ap-actions">
                      {current.change.actions.map((action, index) => (
                        <li key={`${action.op}-${index}`}>
                          <strong>{action.op}</strong> {action.target} —{" "}
                          {action.detail}
                        </li>
                      ))}
                    </ol>
                  )}

                  <h3>Evidence ({current.evidence.length})</h3>
                  <ul className="ap-evidence">
                    {current.evidence.map((item) => (
                      <li key={item.id}>
                        <strong>{item.id}</strong> · {item.kind} ·{" "}
                        <span>{item.source}</span> · observed {item.observedAt}{" "}
                        · {item.environment}
                        <br />
                        {item.summary}
                      </li>
                    ))}
                  </ul>

                  <h3>Review history</h3>
                  {current.reviews.length ? (
                    <ol className="ap-reviews">
                      {current.reviews.map((review) => (
                        <li key={review.id}>
                          <strong>{review.decision}</strong> · v{review.version}{" "}
                          · {review.actor.name} · {review.createdAt} UTC
                          <p>{review.reason}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="ap-empty">No decision recorded.</p>
                  )}

                  {current.state !== "accepted" &&
                    current.state !== "rejected" && (
                      <div className="ap-review">
                        <h3>Record a decision</h3>
                        <p>
                          Compare the exact digest above with the proposed
                          source. Accept records this digest only; it does not
                          deploy, merge or run anything.
                        </p>
                        <label>
                          Reason
                          <textarea
                            value={reason}
                            rows={4}
                            disabled={busy || !canWrite}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Name the evidence you checked and any condition on the decision."
                          />
                        </label>
                        <div className="ap-actions-row">
                          <button
                            type="button"
                            disabled={
                              busy || !canAccept || reason.trim().length < 8
                            }
                            onClick={() => void review("accept")}
                          >
                            Accept this digest — no execution
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy || !canWrite || reason.trim().length < 8
                            }
                            onClick={() => void review("request-changes")}
                          >
                            Request changes
                          </button>
                          <button
                            type="button"
                            disabled={
                              busy || !canWrite || reason.trim().length < 8
                            }
                            onClick={() => void review("reject")}
                          >
                            Reject
                          </button>
                        </div>
                        {!canAccept && (
                          <p className="ap-hint">
                            Only the workspace owner can accept. Editors can
                            request changes or reject.
                          </p>
                        )}
                      </div>
                    )}

                  {current.accepted && (
                    <div className="ap-accepted">
                      <h3>Accepted digest</h3>
                      <p>
                        <code>{current.accepted.digest}</code>
                      </p>
                      <p>
                        Accepted by {current.accepted.by} at{" "}
                        {current.accepted.at} UTC · version{" "}
                        {current.accepted.version}. Nothing was executed.
                      </p>
                      {!current.handoff && canAccept && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handoff()}
                        >
                          Prepare handoff for the existing release flow
                        </button>
                      )}
                      {!canAccept && !current.handoff && (
                        <p className="ap-hint">
                          The workspace owner can prepare the separate handoff.
                        </p>
                      )}
                      {current.source.kind === "local-path" &&
                        !current.handoff && (
                          <p className="ap-hint">
                            A local source check is fresh for 10 minutes in the
                            admin route. Recheck it with the local CLI before
                            preparing the handoff.
                          </p>
                        )}
                    </div>
                  )}

                  {current.handoff && (
                    <div className="ap-handoff">
                      <h3>Handoff artifact</h3>
                      <p>
                        <strong>Execution not performed.</strong> This artifact
                        is for the existing authorised release or delivery flow.
                        It grants no deploy, merge, spend, credential or access
                        authority.
                      </p>
                      <dl className="ap-facts">
                        <dt>Destination</dt>
                        <dd>{current.handoff.destination}</dd>
                        <dt>State</dt>
                        <dd>{current.handoff.state}</dd>
                        <dt>Created</dt>
                        <dd>{current.handoff.createdAt} UTC</dd>
                      </dl>
                      <pre className="ap-patch">
                        {JSON.stringify(current.handoff.artifact, null, 2)}
                      </pre>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void copyArtifact(current)}
                      >
                        Copy handoff artifact
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="ap-empty">
                  Choose a proposal to inspect its scope, digest, evidence and
                  next action.
                </p>
              )}
            </section>
          </div>
        </>
      )}
      {manual && (
        <label className="ap-manual">
          Manual copy — select this artifact
          <textarea
            value={manual}
            readOnly
            rows={10}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
    </div>
  );
}
