import { useEffect, useRef, useState } from "react";
import type {
  AgentConnectionSecret,
  AgentGrantSnapshot,
  AgentGrantView,
} from "../../lib/agent-proposal-contract";
import {
  createGrantCall,
  grantsCall,
  revokeGrantCall,
  rotateConnectionCall,
} from "./api";

const packs = [
  "service-owner",
  "programmer",
  "architect",
  "devops",
  "security",
  "qa",
] as const;

const initial = {
  app: "",
  environment: "",
  kind: "preview" as "local" | "preview",
  account: "",
  rolePack: "programmer" as (typeof packs)[number],
  agentId: "agent:local",
  agentName: "Local agent",
  fallbackId: "",
  expiresInHours: 24,
};

/**
 * Owner-facing connection workflow for one workspace.
 *
 * The owner picks the app, environment and role pack, sees the exact permitted
 * capabilities, and authorises one expiring proposal-only connection. The
 * credential is displayed once and can be rotated or revoked here. Nothing in
 * this panel approves a proposal, deploys or changes access.
 */
export function ConnectAgent({
  workspace,
  onChanged,
}: {
  workspace: string;
  onChanged?: () => void;
}) {
  const [snapshot, setSnapshot] = useState<AgentGrantSnapshot>();
  const [form, setForm] = useState(initial);
  const [secret, setSecret] = useState<AgentConnectionSecret>();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const live = useRef(true);
  const pending = useRef(false);

  async function load(message = "") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await grantsCall(workspace);
      if (!live.current) return;
      setSnapshot(next);
      setForm((previous) => ({
        ...previous,
        app: previous.app || next.apps[0] || "",
        fallbackId:
          previous.fallbackId ||
          next.members.find((member) => member.id !== next.self)?.id ||
          "",
      }));
      if (message) setNotice(message);
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The agent connections could not be confirmed.",
        );
    } finally {
      if (live.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      pending.current = false;
    };
  }, [workspace]);

  const canAuthorise = snapshot?.workspace.role === "owner";
  const canRevoke =
    snapshot?.workspace.role === "owner" ||
    snapshot?.workspace.role === "editor";
  const fallbackChoices =
    snapshot?.members.filter((member) => member.id !== snapshot.self) ?? [];

  async function authorise() {
    if (!snapshot || pending.current || !canAuthorise) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setSecret(undefined);
    try {
      const result = await createGrantCall(snapshot.workspace.id, {
        app: form.app,
        environment: {
          id: form.environment,
          kind: form.kind,
          account: form.account,
        },
        rolePack: form.rolePack,
        agent: { id: form.agentId, name: form.agentName },
        fallbackId: form.fallbackId,
        expiresInHours: Number(form.expiresInHours),
      });
      if (!live.current) return;
      setSecret(result.connection);
      setNotice(
        "Connection authorised. The credential below is shown once. It is proposal-only and expires automatically.",
      );
      onChanged?.();
      pending.current = false;
      await load("");
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The agent connection could not be authorised.",
        );
    } finally {
      if (live.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  async function rotate(grant: AgentGrantView) {
    if (!snapshot || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await rotateConnectionCall(
        snapshot.workspace.id,
        grant.id,
      );
      if (!live.current) return;
      setSecret(result.connection);
      setNotice(
        "Credential rotated. The previous value stopped working immediately; the new value is shown once.",
      );
      pending.current = false;
      await load("");
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The credential could not be rotated.",
        );
    } finally {
      if (live.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  async function revoke(grant: AgentGrantView) {
    if (!snapshot || pending.current || reason.trim().length < 8) {
      setError("Write at least 8 characters explaining the revocation.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await revokeGrantCall(snapshot.workspace.id, grant.id, reason.trim());
      if (!live.current) return;
      setReason("");
      setNotice(
        "Grant revoked. The credential is refused from now on; existing proposals stay reviewable.",
      );
      onChanged?.();
      pending.current = false;
      await load("");
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The grant could not be revoked.",
        );
    } finally {
      if (live.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  async function copyLaunch() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.launch.join("\n"));
      setNotice(
        "Launch commands copied. Keep the credential out of prompts and logs.",
      );
    } catch {
      setNotice(
        "Your browser could not copy. Select the launch commands below.",
      );
    }
  }

  return (
    <section className="ap-connect" aria-labelledby="ap-connect-title">
      <div className="ap-detail-heading">
        <h2 id="ap-connect-title">Connect an agent</h2>
        {snapshot && <strong>{snapshot.grants.length} connection(s)</strong>}
      </div>
      <p>
        Authorise one expiring, revocable connection for a named agent. It can
        read the scope and briefing and submit a proposal. It cannot approve,
        prepare a handoff, deploy, spend, read secrets or change access — those
        stay with a signed-in human. Your EmDash session, Cloudflare Access,
        Cloudflare credentials and Git credentials are separate and are never
        copied into an agent connection.
      </p>
      {snapshot && (
        <div className="ap-capabilities">
          <div>
            <h3>Permitted for this connection</h3>
            <ul>
              {snapshot.capabilities.map((item) => (
                <li key={item.id}>
                  <strong>{item.label}</strong>
                  <small>
                    {" "}
                    {item.authority} · {item.id}
                  </small>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Reserved for humans</h3>
            <ul>
              {snapshot.reserved.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {error && (
        <p className="ap-error" role="alert">
          {error}
        </p>
      )}
      <p className="ap-status" role="status">
        {busy ? "Checking agent connections…" : notice}
      </p>

      {snapshot && canAuthorise ? (
        <div className="ap-grant-form">
          <h3>New connection</h3>
          <div className="ap-grid">
            <label>
              App
              <select
                value={form.app}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, app: event.target.value })
                }
              >
                {snapshot.apps.map((app) => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Environment kind
              <select
                value={form.kind}
                disabled={busy}
                onChange={(event) =>
                  setForm({
                    ...form,
                    kind: event.target.value as typeof form.kind,
                  })
                }
              >
                <option value="preview">Isolated Preview</option>
                <option value="local">Local</option>
              </select>
            </label>
            <label>
              Environment id
              <input
                value={form.environment}
                disabled={busy}
                placeholder="env-preview-qa"
                onChange={(event) =>
                  setForm({ ...form, environment: event.target.value })
                }
              />
            </label>
            <label>
              Provider account (label only)
              <input
                value={form.account}
                disabled={busy}
                placeholder="preview-account-label"
                onChange={(event) =>
                  setForm({ ...form, account: event.target.value })
                }
              />
            </label>
            <label>
              Role pack
              <select
                value={form.rolePack}
                disabled={busy}
                onChange={(event) =>
                  setForm({
                    ...form,
                    rolePack: event.target.value as typeof form.rolePack,
                  })
                }
              >
                {packs.map((pack) => (
                  <option key={pack} value={pack}>
                    {pack}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Agent id
              <input
                value={form.agentId}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, agentId: event.target.value })
                }
              />
            </label>
            <label>
              Agent name
              <input
                value={form.agentName}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, agentName: event.target.value })
                }
              />
            </label>
            <label>
              Fallback owner
              <select
                value={form.fallbackId}
                disabled={busy || !fallbackChoices.length}
                onChange={(event) =>
                  setForm({ ...form, fallbackId: event.target.value })
                }
              >
                {!fallbackChoices.length && (
                  <option value="">Invite another owner or editor first</option>
                )}
                {fallbackChoices.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expires in hours
              <input
                type="number"
                min={1}
                max={72}
                value={form.expiresInHours}
                disabled={busy}
                onChange={(event) =>
                  setForm({
                    ...form,
                    expiresInHours: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <button
            type="button"
            disabled={
              busy ||
              !form.app ||
              form.environment.trim().length < 6 ||
              form.account.trim().length < 1 ||
              !form.fallbackId ||
              form.expiresInHours < 1 ||
              form.expiresInHours > 72
            }
            onClick={() => void authorise()}
          >
            Authorise proposal-only connection
          </button>
          <p className="ap-hint">
            The fallback must already be an owner or editor of this workspace.
            Production environments are refused.
          </p>
        </div>
      ) : (
        <p className="ap-hint">
          Only the workspace owner can authorise or rotate an agent connection.
          Editors can revoke one and review proposals.
        </p>
      )}

      {secret && (
        <div className="ap-secret" role="group" aria-label="New credential">
          <h3>Credential — shown once</h3>
          <p>
            <strong>Store this now.</strong> The database keeps only a hash. The
            value expires {secret.expiresAt} and is refused the moment the grant
            is revoked or the credential rotated.
          </p>
          <code className="ap-token">{secret.token}</code>
          <dl className="ap-facts">
            <dt>Grant</dt>
            <dd>{secret.grant}</dd>
            <dt>Prefix</dt>
            <dd>{secret.prefix}</dd>
            <dt>Capabilities</dt>
            <dd>{secret.capabilities.map((item) => item.id).join(", ")}</dd>
            <dt>Execution</dt>
            <dd>{secret.execution}</dd>
          </dl>
          <h3>Connect the local agent</h3>
          <ol>
            {secret.launch.map((line) => (
              <li key={line}>
                <code>{line}</code>
              </li>
            ))}
          </ol>
          <div className="ap-actions-row">
            <button type="button" onClick={() => void copyLaunch()}>
              Copy launch commands
            </button>
            <button type="button" onClick={() => setSecret(undefined)}>
              I have saved the credential
            </button>
          </div>
        </div>
      )}

      {snapshot && (
        <div className="ap-grants">
          <h3>Connections</h3>
          {!snapshot.grants.length && (
            <p className="ap-empty">
              No agent connection yet. Authorise one above, then launch the
              scoped local endpoint or use the EmDash MCP tools.
            </p>
          )}
          {canRevoke && snapshot.grants.length > 0 && (
            <label>
              Revocation reason
              <textarea
                value={reason}
                rows={2}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Name why this agent no longer needs access."
              />
            </label>
          )}
          <ul className="ap-grant-list">
            {snapshot.grants.map((grant) => (
              <li key={grant.id}>
                <div>
                  <strong>{grant.agent.name}</strong>
                  <small>
                    {" "}
                    · {grant.app} · {grant.environment.kind}/
                    {grant.environment.id} · {grant.rolePack} · {grant.mode}
                  </small>
                </div>
                <dl className="ap-facts">
                  <dt>State</dt>
                  <dd>
                    {grant.state} · expires {grant.expiresAt}
                  </dd>
                  <dt>Owner</dt>
                  <dd>
                    {grant.owner.name} · fallback {grant.fallback.name}
                  </dd>
                  <dt>Connection</dt>
                  <dd>
                    {grant.connection.issued
                      ? `${grant.connection.prefix}… · issued ${grant.connection.issuedAt} · last used ${grant.connection.lastUsedAt ?? "never"}`
                      : "no credential issued"}
                  </dd>
                  <dt>Grant id</dt>
                  <dd>
                    <code>{grant.id}</code>
                  </dd>
                </dl>
                <div className="ap-actions-row">
                  <button
                    type="button"
                    disabled={busy || !canAuthorise || grant.state !== "active"}
                    onClick={() => void rotate(grant)}
                  >
                    Rotate credential
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !canRevoke ||
                      grant.state === "revoked" ||
                      reason.trim().length < 8
                    }
                    onClick={() => void revoke(grant)}
                  >
                    Revoke grant
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
