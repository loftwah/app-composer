import { useEffect, useRef, useState } from "react";
import {
  workspaceCall,
  type AccessSnapshot,
  type Incoming,
  type Workspace,
} from "./workspaces/api";
import { useNavigationGuard } from "./stacks/use-navigation-guard";
import { workspaceSelection } from "./stacks/workspace-scope";
import "./workspace-access.css";

type InviteDraft = {
  email: string;
  role: "editor" | "viewer";
  generation: number;
};
const emptyDraft = (): InviteDraft => ({
  email: "",
  role: "viewer",
  generation: 0,
});

export function WorkspaceAccessPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [selected, setSelected] = useState<string>();
  const [access, setAccess] = useState<AccessSnapshot>();
  const [drafts, setDrafts] = useState<Record<string, InviteDraft>>({});
  const [roles, setRoles] = useState<Record<string, "editor" | "viewer">>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copy, setCopy] = useState("");
  const [requestedInvitation, setRequestedInvitation] = useState<string>();
  const pending = useRef(false);
  const generation = useRef(0);
  const target = useRef<string | undefined>(undefined);
  const latestDrafts = useRef(drafts);
  const latestName = useRef(newName);
  const live = useRef(true);
  const draft = selected ? (drafts[selected] ?? emptyDraft()) : emptyDraft();
  const owner = access?.workspace.role === "owner";
  const existingInvitation = access?.invitations.some(
    (entry) =>
      entry.status === "pending" &&
      entry.email === draft.email.trim().toLowerCase(),
  );

  const load = async (requested = target.current) => {
    const request = ++generation.current;
    setAccess(undefined);
    setCopy("");
    const listing = await workspaceCall("list");
    if (!live.current || request !== generation.current) return;
    setWorkspaces(listing.workspaces ?? []);
    setIncoming(listing.incoming ?? []);
    const chosen = requested ?? listing.workspaces?.[0]?.id;
    if (!chosen) throw Error("No workspace is available for this account.");
    const opened = await workspaceCall("open", { workspace: chosen });
    if (!opened.access || opened.access.workspace.id !== chosen)
      throw Error("The server did not confirm the selected workspace.");
    if (!live.current || request !== generation.current) return;
    target.current = chosen;
    setSelected(chosen);
    setAccess(opened.access);
    setWorkspaces(opened.workspaces ?? []);
    setIncoming(opened.incoming ?? []);
    setRoles({});
    setUncertain(false);
    return opened.access;
  };
  const run = async (work: () => Promise<string>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const note = await work();
      if (live.current) setMessage(note);
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Workspace access is unavailable. Your entries remain here.",
        );
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  useEffect(() => {
    live.current = true;
    void run(async () => {
      target.current = workspaceSelection(window.location.search);
      const invitation = new URLSearchParams(window.location.search).getAll(
        "invitation",
      );
      if (
        invitation.length > 1 ||
        (invitation.length && !/^[a-z0-9-]{6,64}$/.test(invitation[0]))
      )
        throw Error(
          "This invitation page selection is invalid. Open Workspace access without that link.",
        );
      setRequestedInvitation(invitation[0]);
      await load();
      return "";
    });
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  const hasEntries =
    newName.length > 0 ||
    Object.values(drafts).some((entry) => entry.email.length > 0);
  useNavigationGuard({
    changed: hasEntries || uncertain,
    pending: busy,
    onPending: () =>
      setMessage(
        "Wait for the current workspace operation before leaving. Your entries remain here.",
      ),
  });

  const updateDraft = (patch: Partial<Pick<InviteDraft, "email" | "role">>) => {
    if (!selected) return;
    const previous = latestDrafts.current[selected] ?? emptyDraft();
    const next = {
      ...latestDrafts.current,
      [selected]: {
        ...previous,
        ...patch,
        generation: previous.generation + 1,
      },
    };
    latestDrafts.current = next;
    setDrafts(next);
    setMessage("");
  };
  const change = (
    action: string,
    fields: Record<string, unknown>,
    options: {
      workspace: string;
      after?: () => void;
      openCreated?: boolean;
    },
  ) =>
    run(async () => {
      if (uncertain)
        throw Error(
          "Refresh access to check the previous result before making another change.",
        );
      let response: Awaited<ReturnType<typeof workspaceCall>>;
      try {
        response = await workspaceCall(action, fields);
        if (
          response.changed?.workspace !== options.workspace &&
          !options.openCreated
        )
          throw Error("The server acknowledged another workspace.");
        if (
          options.openCreated &&
          !response.workspaces?.some(
            (space) =>
              space.id === response.changed?.workspace &&
              space.role === "owner" &&
              space.name === String(fields.name).trim(),
          )
        )
          throw Error(
            "The server did not confirm the workspace name you submitted.",
          );
      } catch (cause) {
        setUncertain(true);
        throw cause;
      }
      try {
        const refreshed = await load(
          options.openCreated ? response.changed?.workspace : target.current,
        );
        if (
          action === "invite" &&
          !refreshed?.invitations.some(
            (entry) =>
              entry.id === response.changed?.invitation &&
              entry.email === String(fields.email).toLowerCase() &&
              entry.role === fields.role &&
              entry.status === "pending",
          )
        )
          throw Error(
            "The pending invitation could not be verified. Your entries remain here; refresh access before retrying.",
          );
      } catch (cause) {
        setUncertain(true);
        throw cause;
      }
      options.after?.();
      return action === "invite"
        ? "Pending invitation recorded for seven days. No email was sent and no CMS account or Access permission was created."
        : action === "accept"
          ? "Workspace invitation accepted. Choose that workspace to open its stacks."
          : action === "revokeInvitation"
            ? "Pending invitation revoked. It can no longer be accepted."
            : action === "removeMember"
              ? "Workspace membership removed. Existing app records and stacks remain in this workspace."
              : action === "changeRole"
                ? "Workspace role updated. The next request uses the new role."
                : "Workspace created. Your existing personal workspace and saved stacks are unchanged.";
    });

  const invite = () => {
    if (!access || !selected) return;
    const submitted = { ...draft };
    void change(
      "invite",
      {
        workspace: selected,
        expectedRevision: access.workspace.revision,
        email: submitted.email.trim(),
        role: submitted.role,
      },
      {
        workspace: selected,
        after: () => {
          if (
            latestDrafts.current[selected]?.generation !== submitted.generation
          )
            return;
          const next = {
            ...latestDrafts.current,
            [selected]: {
              ...submitted,
              email: "",
              generation: submitted.generation + 1,
            },
          };
          latestDrafts.current = next;
          setDrafts(next);
        },
      },
    );
  };
  const disabled = busy || uncertain;

  return (
    <section className="composer-admin ca-workspace-access">
      <div className="ca-heading">
        <div>
          <h1>Workspace access</h1>
          <p>Choose a workspace and manage its editor and viewer access.</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await load();
              return "Current workspace access refreshed. Your entries are still here.";
            })
          }
        >
          Refresh access
        </button>
      </div>
      <p>
        Sign in with an existing Access-authorized Composer account. Workspace
        membership does not grant site administration or bypass Access.
        Invitations here are pending records; no email is sent.
      </p>
      {error && (
        <p role="alert" className="ca-stack-error">
          {error}
        </p>
      )}
      <p role="status" className="ca-message">
        {message || (busy ? "Checking workspace access…" : "")}
      </p>
      {uncertain && (
        <p role="status">
          The last result is not confirmed. Refresh access before making another
          change; your entries remain here.
        </p>
      )}
      <div className="ca-access-layout">
        <aside>
          <h2>Your workspaces</h2>
          <ul className="ca-stack-list">
            {workspaces.map((space) => (
              <li key={space.id}>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={selected === space.id}
                  onClick={() =>
                    void run(async () => {
                      await load(space.id);
                      return "Opened workspace access. Invitation entries are kept with their original workspace.";
                    })
                  }
                >
                  <strong>{space.name}</strong>
                  <span>
                    {space.role} · access revision {space.revision}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="ca-form"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newName;
              void change(
                "create",
                { name },
                {
                  workspace: "",
                  openCreated: true,
                  after: () => {
                    if (latestName.current === name) {
                      latestName.current = "";
                      setNewName("");
                    }
                  },
                },
              );
            }}
          >
            <label>
              New workspace name
              <input
                required
                maxLength={60}
                value={newName}
                onChange={(event) => {
                  latestName.current = event.target.value;
                  setNewName(event.target.value);
                }}
              />
            </label>
            <button type="submit" disabled={disabled || !newName.trim()}>
              Create workspace
            </button>
          </form>
        </aside>
        <div>
          {access && (
            <>
              <h2>{access.workspace.name}</h2>
              <p>
                Your role: <strong>{access.workspace.role}</strong> · access
                revision {access.workspace.revision}
              </p>
              <p>
                <a
                  href={`/_emdash/admin/plugins/composer-stacks/stacks?workspace=${access.workspace.id}`}
                >
                  Open this workspace’s stacks
                </a>
              </p>
              {!owner && (
                <p>
                  A workspace owner manages memberships and invitations.{" "}
                  {access.workspace.role === "viewer"
                    ? "You can read and export stacks."
                    : "You can create, edit and publish stacks."}
                </p>
              )}
              {owner && (
                <>
                  <h3>Members</h3>
                  <p>
                    Owner roles are protected here. Ownership transfer,
                    personal-owner removal and workspace deletion require a
                    separate reviewed action.
                  </p>
                  <div className="ca-access-members">
                    {access.members.map((member) => (
                      <article key={member.id}>
                        <div>
                          <strong>{member.name || member.id}</strong>
                          {member.email && <p>{member.email}</p>}
                          <p>
                            {member.role}
                            {member.personal
                              ? " · personal workspace owner"
                              : ""}
                          </p>
                        </div>
                        {member.role !== "owner" && !member.personal && (
                          <div className="ca-actions">
                            <label>
                              Role for {member.name || member.id}
                              <select
                                disabled={disabled}
                                value={roles[member.id] ?? member.role}
                                onChange={(event) =>
                                  setRoles((values) => ({
                                    ...values,
                                    [member.id]: event.target.value as
                                      "editor" | "viewer",
                                  }))
                                }
                              >
                                <option value="viewer">
                                  Viewer — read and export
                                </option>
                                <option value="editor">
                                  Editor — edit and publish
                                </option>
                              </select>
                            </label>
                            <button
                              type="button"
                              disabled={
                                disabled ||
                                !roles[member.id] ||
                                roles[member.id] === member.role
                              }
                              onClick={() =>
                                void change(
                                  "changeRole",
                                  {
                                    workspace: access.workspace.id,
                                    expectedRevision: access.workspace.revision,
                                    member: member.id,
                                    expectedRole: member.role,
                                    role: roles[member.id],
                                  },
                                  { workspace: access.workspace.id },
                                )
                              }
                            >
                              Update role
                            </button>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Remove ${member.name || member.id} from ${access.workspace.name}? Their access ends; the workspace’s stacks and app records remain.`,
                                  )
                                )
                                  void change(
                                    "removeMember",
                                    {
                                      workspace: access.workspace.id,
                                      expectedRevision:
                                        access.workspace.revision,
                                      member: member.id,
                                      expectedRole: member.role,
                                    },
                                    { workspace: access.workspace.id },
                                  );
                              }}
                            >
                              Remove member
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                  <h3>Prepare an invitation</h3>
                  <form
                    className="ca-form ca-access-invite"
                    onSubmit={(event) => {
                      event.preventDefault();
                      invite();
                    }}
                  >
                    <label>
                      Account email
                      <input
                        type="email"
                        required
                        maxLength={254}
                        autoComplete="off"
                        value={draft.email}
                        onChange={(event) =>
                          updateDraft({ email: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Workspace role
                      <select
                        value={draft.role}
                        onChange={(event) =>
                          updateDraft({
                            role: event.target.value as "editor" | "viewer",
                          })
                        }
                      >
                        <option value="viewer">Viewer — read and export</option>
                        <option value="editor">
                          Editor — edit and publish
                        </option>
                      </select>
                    </label>
                    {existingInvitation && (
                      <p>
                        A pending invitation already exists for this account.
                        Review or revoke it below before preparing another.
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={
                        disabled || !draft.email.trim() || existingInvitation
                      }
                    >
                      Record pending invitation
                    </button>
                  </form>
                  <h3>Invitations</h3>
                  {!access.invitations.length && (
                    <p>No workspace invitations recorded.</p>
                  )}
                  <ul className="ca-access-invitations">
                    {access.invitations.map((entry) => (
                      <li key={entry.id}>
                        <div>
                          <strong>{entry.email}</strong>
                          <p>
                            {entry.role} · {entry.status} · expires{" "}
                            {new Date(entry.expiresAt).toLocaleString()}
                          </p>
                        </div>
                        {entry.status === "pending" && (
                          <div className="ca-actions">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void (async () => {
                                  const link = `${window.location.origin}/_emdash/admin/plugins/composer-stacks/workspaces?invitation=${entry.id}`;
                                  try {
                                    await navigator.clipboard.writeText(link);
                                    setMessage(
                                      "Invitation page link copied. It grants no access on its own; no message was sent.",
                                    );
                                  } catch {
                                    setCopy(link);
                                  }
                                })()
                              }
                            >
                              Copy invitation page link
                            </button>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() =>
                                void change(
                                  "revokeInvitation",
                                  {
                                    workspace: access.workspace.id,
                                    expectedRevision: access.workspace.revision,
                                    invitation: entry.id,
                                    invitationRevision: entry.revision,
                                  },
                                  { workspace: access.workspace.id },
                                )
                              }
                            >
                              Revoke invitation
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {copy && (
                    <label className="ca-form">
                      Copy this invitation page link
                      <input
                        readOnly
                        value={copy}
                        onFocus={(event) => event.target.select()}
                      />
                    </label>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      <section
        className="ca-incoming-access"
        aria-label="Invitations for your account"
      >
        <h2>Invitations for your account</h2>
        <p>
          Only invitations matching your authenticated account email appear
          here. A copied page link cannot change the recipient or bypass
          sign-in.
        </p>
        {requestedInvitation &&
          !busy &&
          !incoming.some((entry) => entry.id === requestedInvitation) && (
            <p role="status">
              This invitation is unavailable for the signed-in account. It may
              be revoked, already accepted or addressed to another account.
            </p>
          )}
        {!incoming.length && <p>No pending invitations for this account.</p>}
        <ul className="ca-access-invitations">
          {incoming.map((entry) => (
            <li
              key={entry.id}
              aria-current={
                entry.id === requestedInvitation ? "true" : undefined
              }
            >
              <div>
                <strong>{entry.workspaceName}</strong>
                <p>
                  {entry.role} · {entry.status} · expires{" "}
                  {new Date(entry.expiresAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled || entry.status !== "pending"}
                onClick={() =>
                  void change(
                    "accept",
                    {
                      workspace: entry.workspace,
                      expectedRevision: entry.workspaceRevision,
                      invitation: entry.id,
                      invitationRevision: entry.revision,
                    },
                    { workspace: entry.workspace },
                  )
                }
              >
                Accept workspace invitation
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
