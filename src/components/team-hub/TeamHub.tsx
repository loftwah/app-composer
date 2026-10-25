import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  teamHubRequest,
  teamHubSnapshot,
  type TeamHubRequest,
  type TeamHubSnapshot,
} from "../../lib/team-hub-contract";
import { filterTeamRequests, recoveryChecklist } from "./workspace";
import "./team-hub.css";

interface Scope {
  workspaces: { id: string; name: string; role: string }[];
  environment: string;
  account: string;
}
interface History {
  revision: number;
  actor: string;
  at: string;
  request: { title: string; body: string; status: string };
}
const blank = (): TeamHubRequest => ({
  title: "",
  body: "",
  assignee: null,
  status: "open",
  attachment: null,
});
async function call(action: string, fields: Record<string, unknown> = {}) {
  const read = [
    "scope",
    "read",
    "history",
    "attachment",
    "connection",
  ].includes(action);
  const response = await apiFetch(
    "/_emdash/api/plugins/composer-members/" +
      (read
        ? "teamHubRead?" +
          new URLSearchParams({ action, ...(fields as Record<string, string>) })
        : "teamHubWrite"),
    read
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...fields }),
        },
  );
  try {
    return await parseApiResponse<unknown>(
      response,
      "Your team result could not be confirmed. Keep your entries and reload before retrying.",
    );
  } catch (error) {
    if (response.status === 401 || response.status === 403)
      throw Object.assign(
        new Error(
          error instanceof Error
            ? error.message
            : "Your app access is no longer available.",
        ),
        { accessDenied: true },
      );
    throw error;
  }
}
export default function TeamHub() {
  const [scope, setScope] = useState<Scope>();
  const [workspace, setWorkspace] = useState(() =>
    typeof location === "undefined"
      ? ""
      : (new URLSearchParams(location.search).get("workspace") ?? ""),
  );
  const [saved, setSaved] = useState<TeamHubSnapshot>();
  const [form, setForm] = useState<TeamHubRequest>(blank);
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [member, setMember] = useState(""),
    [capability, setCapability] = useState("use");
  const [history, setHistory] = useState<History[]>();
  const [connection, setConnection] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedOnly, setAssignedOnly] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false),
    alive = useRef(true),
    dirty = useRef(false);
  const start = () => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    return true;
  };
  const finish = () => {
    pending.current = false;
    if (alive.current) setBusy(false);
  };
  const fail = (error: unknown) => {
    if (error instanceof Error && "accessDenied" in error) {
      setSaved(undefined);
      setHistory(undefined);
      setForm(blank());
      dirty.current = false;
    }
    if (alive.current)
      setError(
        error instanceof Error
          ? error.message
          : "This team result could not be confirmed.",
      );
  };
  async function load(id = workspace) {
    if (!start()) return;
    if (id !== workspace) {
      setSaved(undefined);
      setWorkspace(id);
      setSelected(undefined);
      setHistory(undefined);
      setQuery("");
      setStatusFilter("all");
      setAssignedOnly(false);
    }
    try {
      const all = (await call("scope")) as Scope;
      if (!all || !Array.isArray(all.workspaces))
        throw Error("Team membership could not be confirmed.");
      if (alive.current) setScope(all);
      const chosen = id || all.workspaces[0]?.id;
      if (!chosen) {
        setSaved(undefined);
        setNotice(
          "Your account has no accepted team membership. Review an invitation in My apps.",
        );
        return;
      }
      if (!all.workspaces.some((item) => item.id === chosen))
        throw Error("This account is not a member of the selected team.");
      const data = teamHubSnapshot.parse(
        await call("read", { workspace: chosen }),
      );
      if (data.target.workspace !== chosen)
        throw Error("The server returned another team. Nothing was applied.");
      if (alive.current) {
        setWorkspace(chosen);
        setSaved(data);
        setForm(blank());
        setSelected(undefined);
        setHistory(undefined);
        dirty.current = false;
      }
    } catch (error) {
      if (alive.current) setSaved(undefined);
      fail(error);
    } finally {
      finish();
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    const protect = (event: BeforeUnloadEvent) => {
      if (dirty.current || pending.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => {
      alive.current = false;
      window.removeEventListener("beforeunload", protect);
    };
  }, []);
  function edit(patch: Partial<TeamHubRequest>) {
    if (!pending.current) {
      setForm({ ...form, ...patch });
      dirty.current = true;
      setNotice("");
    }
  }
  async function mutate(action: string, fields: Record<string, unknown> = {}) {
    if (!saved || !start()) return;
    setNotice("");
    try {
      const data = teamHubSnapshot.parse(
        await call(action, {
          workspace: saved.target.workspace,
          expectedRevision: saved.revision,
          ...fields,
        }),
      );
      if (data.target.workspace !== saved.target.workspace)
        throw Error(
          "The saved team did not match this form. Reload before retrying.",
        );
      if (alive.current) {
        setSaved(data);
        setNotice(
          action === "save"
            ? "Request saved. Its previous version is retained."
            : action === "enable"
              ? "Team Hub enabled for your account. Share it explicitly with eligible teammates."
              : action === "grant"
                ? "App permission granted. Workspace membership and Access admission remain separate."
                : "App permission revoked. Its next application request is refused.",
        );
        if (action === "save") {
          setSelected(undefined);
          setForm(blank());
          setHistory(undefined);
          dirty.current = false;
        }
      }
    } catch (error) {
      fail(error);
    } finally {
      finish();
    }
  }
  const people = [
    ...new Map(
      (saved?.people ?? []).map((person) => [person.id, person]),
    ).values(),
  ];
  const appMembers = people.filter((person) =>
    saved?.people.some(
      (row) =>
        row.id === person.id &&
        row.action === "contribute" &&
        row.status === "active" &&
        !row.disabled,
    ),
  );
  const selectedRecord = saved?.requests.find((row) => row.id === selected);
  const visibleRequests = filterTeamRequests(
    saved?.requests ?? [],
    query,
    statusFilter,
    assignedOnly ? (saved?.actor.id ?? null) : null,
  );
  function newRequest(checklist = false) {
    if (
      pending.current ||
      (dirty.current &&
        !window.confirm("Discard unsaved entries and start another request?"))
    )
      return;
    setSelected(undefined);
    setHistory(undefined);
    setForm(checklist ? recoveryChecklist() : blank());
    dirty.current = checklist;
    setNotice(
      checklist
        ? "Private recovery checklist started. Replace its prompts and save deliberately; it grants no execution authority."
        : "New request. Your saved requests are retained.",
    );
    titleInput.current?.focus();
  }
  async function open(id: string) {
    if (
      dirty.current &&
      !window.confirm("Discard unsaved entries and open this saved request?")
    )
      return;
    const row = saved?.requests.find((item) => item.id === id);
    if (!row || !start()) return;
    try {
      const attached = row.attachment
        ? ((await call("attachment", { workspace, id })) as {
            attachment: TeamHubRequest["attachment"];
          })
        : null;
      const versions = (await call("history", { workspace, id })) as {
        history: History[];
      };
      if (alive.current) {
        setSelected(id);
        setForm({
          title: row.title,
          body: row.body,
          assignee: row.assignee,
          status: row.status,
          attachment: attached?.attachment ?? null,
        });
        setHistory(versions.history);
        dirty.current = false;
      }
    } catch (error) {
      fail(error);
    } finally {
      finish();
    }
  }
  async function attach(file?: File) {
    if (!file || !start()) return;
    try {
      if (!file.name.endsWith(".txt") || file.size > 16000)
        throw Error("Choose a plain-text .txt file smaller than 16 KB.");
      const text = await file.text();
      if (alive.current) {
        setForm((prior) => ({
          ...prior,
          attachment: { name: file.name, text },
        }));
        dirty.current = true;
      }
    } catch (error) {
      fail(error);
    } finally {
      finish();
    }
  }
  async function download(id: string) {
    if (!start()) return;
    try {
      const reply = (await call("attachment", { workspace, id })) as {
        attachment: { name: string; text: string };
      };
      const url = URL.createObjectURL(
        new Blob([reply.attachment.text], { type: "text/plain;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = reply.attachment.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      fail(error);
    } finally {
      finish();
    }
  }
  async function checkConnection() {
    if (!start()) return;
    try {
      const reply = (await call("connection", { workspace })) as {
        message: string;
      };
      if (alive.current) setConnection(reply.message);
    } catch (error) {
      fail(error);
    } finally {
      finish();
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = teamHubRequest.safeParse(form);
    if (!parsed.success) {
      setError(
        "Add a title and useful detail, choose a supported status, and attach plain text only.",
      );
      return;
    }
    void mutate("save", {
      id: selected ?? crypto.randomUUID(),
      expectedRequestRevision: selectedRecord?.revision ?? 0,
      request: parsed.data,
    });
  }
  return (
    <section className="team-hub" aria-busy={busy}>
      <header>
        <h1>Team Hub</h1>
        <p>Your team’s actions, assigned work and the decisions behind them.</p>
      </header>
      <p role="status">{busy ? "Confirming current team access…" : notice}</p>
      {error && (
        <p role="alert" className="th-error">
          {error}
        </p>
      )}
      {scope && (
        <label className="th-team">
          Team
          <select
            aria-label="Team"
            value={workspace}
            disabled={busy}
            onChange={(event) => {
              if (
                !dirty.current ||
                window.confirm("Discard unsaved entries and switch teams?")
              )
                void load(event.target.value);
            }}
          >
            {scope.workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!saved ? (
        <p>
          <button disabled={busy} onClick={() => void load()}>
            Reload team access
          </button>{" "}
          · <a href="/me">Review membership in My apps</a>
        </p>
      ) : (
        <>
          <div className="th-context">
            <strong>
              {scope?.workspaces.find((item) => item.id === workspace)?.name}
            </strong>
            <span>
              {saved.actor.role === "owner"
                ? "Team owner"
                : saved.actor.role === "editor"
                  ? "Editor"
                  : "Viewer"}
            </span>
            <span>{saved.target.environment}</span>
          </div>
          <p className="th-profile">
            Local native-passkey qualification. Production passwordless sign-in
            and mandatory MFA are not yet qualified; this profile cannot open
            production Team Hub data.
          </p>
          {!saved.enabled ? (
            <section>
              <h2>Open a private space for this team</h2>
              <p>
                Enabling grants app access to your account only. Add eligible
                teammates deliberately after checking their workspace
                membership.
              </p>
              <button disabled={busy} onClick={() => void mutate("enable")}>
                Enable Team Hub for this team
              </button>
            </section>
          ) : (
            <>
              <nav className="th-nav" aria-label="Team tasks">
                <a href="#team-actions">Actions</a>
                <a href="#team-people">People & access</a>
                <a href="#team-activity">Activity</a>
              </nav>
              <div className="th-work">
                <section id="team-actions">
                  <h2>Today’s actions</h2>
                  <div className="th-filters">
                    <label>
                      Find a request
                      <input
                        type="search"
                        aria-label="Find a request"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <label>
                      Show status
                      <select
                        aria-label="Show status"
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value)
                        }
                      >
                        <option value="all">All requests</option>
                        <option value="active">Open and in progress</option>
                        <option value="open">Open</option>
                        <option value="in-progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </label>
                    <label className="th-checkbox">
                      <input
                        type="checkbox"
                        checked={assignedOnly}
                        onChange={(event) =>
                          setAssignedOnly(event.target.checked)
                        }
                      />
                      Assigned to me
                    </label>
                  </div>
                  <p className="th-results" role="status">
                    {visibleRequests.length} of {saved.requests.length} requests
                    shown
                  </p>
                  {!saved.requests.length ? (
                    <p>
                      No actions yet. An editor or owner can add the first
                      request and assign it to an app member.
                    </p>
                  ) : !visibleRequests.length ? (
                    <p>
                      No requests match these filters. Change the search or
                      status to find saved work.
                    </p>
                  ) : (
                    <ul className="th-requests">
                      {visibleRequests.map((row) => (
                        <li key={row.id}>
                          <div>
                            <button
                              className="th-open"
                              aria-current={
                                selected === row.id ? "true" : undefined
                              }
                              disabled={busy}
                              onClick={() => void open(row.id)}
                            >
                              {row.title}
                            </button>
                            <p>
                              {row.status.replaceAll("-", " ")} ·{" "}
                              {people.find(
                                (person) => person.id === row.assignee,
                              )?.name ?? "Unassigned"}{" "}
                              · version {row.revision}
                            </p>
                            {row.attachment && (
                              <button
                                disabled={busy}
                                onClick={() => void download(row.id)}
                              >
                                Download {row.attachment.name}
                              </button>
                            )}
                          </div>
                          <p>{row.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="th-editor">
                  <h2>{selected ? "Review request" : "Add a request"}</h2>
                  {saved.actor.role !== "viewer" && (
                    <div className="th-start">
                      <button disabled={busy} onClick={() => newRequest()}>
                        New request
                      </button>
                      <button disabled={busy} onClick={() => newRequest(true)}>
                        Start recovery checklist
                      </button>
                    </div>
                  )}
                  {saved.actor.role !== "viewer" ? (
                    <form onSubmit={submit}>
                      <fieldset disabled={busy}>
                        <legend className="th-sr-only">Request details</legend>
                        <label>
                          Title
                          <input
                            ref={titleInput}
                            aria-label="Title"
                            required
                            minLength={2}
                            maxLength={100}
                            value={form.title}
                            onChange={(event) =>
                              edit({ title: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          What needs to happen?
                          <textarea
                            aria-label="What needs to happen?"
                            required
                            minLength={2}
                            maxLength={3000}
                            value={form.body}
                            onChange={(event) =>
                              edit({ body: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          Assigned to
                          <select
                            aria-label="Assigned to"
                            value={form.assignee ?? ""}
                            onChange={(event) =>
                              edit({ assignee: event.target.value || null })
                            }
                          >
                            <option value="">Unassigned</option>
                            {appMembers.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name ?? "Team member"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Status
                          <select
                            aria-label="Status"
                            value={form.status}
                            onChange={(event) =>
                              edit({
                                status: event.target
                                  .value as TeamHubRequest["status"],
                              })
                            }
                          >
                            <option value="open">Open</option>
                            <option value="in-progress">In progress</option>
                            <option value="done">Done</option>
                          </select>
                        </label>
                        <label>
                          Private text attachment
                          <input
                            aria-label="Private text attachment"
                            type="file"
                            accept="text/plain,.txt"
                            onChange={(event) => {
                              void attach(event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        {form.attachment && (
                          <p>
                            {form.attachment.name}{" "}
                            <button
                              type="button"
                              onClick={() => edit({ attachment: null })}
                            >
                              Remove from this revision
                            </button>
                          </p>
                        )}
                        <button className="primary" type="submit">
                          Save request
                        </button>
                      </fieldset>
                    </form>
                  ) : (
                    <p>
                      You can read requests, private checklists and attachments.
                      An editor or owner makes changes.
                    </p>
                  )}
                  {selectedRecord && saved.actor.role === "viewer" && (
                    <article
                      className="th-reading"
                      aria-label="Selected request"
                    >
                      <h3>{selectedRecord.title}</h3>
                      <p>{selectedRecord.body}</p>
                    </article>
                  )}
                  {history && (
                    <details open>
                      <summary>Previous versions</summary>
                      <ol>
                        {history.map((row) => (
                          <li key={row.revision}>
                            <strong>
                              Version {row.revision} · {row.request.status}
                            </strong>
                            <p>{row.request.title}</p>
                            <p>{row.request.body}</p>
                            <small>{row.at} UTC</small>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </section>
              </div>
              <section id="team-people">
                <h2>People & access</h2>
                <p>
                  Workspace membership, sign-in admission and app access are
                  separate.{" "}
                  <a href={"/me?workspace=" + workspace}>
                    Review membership and invitations in My apps.
                  </a>{" "}
                  An invitation does not change Access policy or establish email
                  delivery.
                </p>
                {saved.actor.manage && (
                  <p>
                    <a
                      href={
                        "/_emdash/admin/plugins/composer-stacks/workspaces?workspace=" +
                        workspace
                      }
                    >
                      Invite or review team membership
                    </a>
                  </p>
                )}
                <details>
                  <summary>Help a teammate enter this app</summary>
                  <ol>
                    <li>
                      Confirm that the installation operator has admitted their
                      sign-in identity. A workspace invitation does not change
                      that policy.
                    </li>
                    <li>
                      Invite them to this team, then ask them to accept the
                      invitation in My apps.
                    </li>
                    <li>
                      Grant this app permission below. Their team role
                      determines whether they can read or edit requests.
                    </li>
                  </ol>
                  <p>
                    If access is removed, saved requests and earlier decisions
                    stay with the team. The next request checks their current
                    permissions.
                  </p>
                </details>
                <ul className="th-people">
                  {people.map((person) => (
                    <li key={person.id}>
                      <div>
                        <strong>{person.name ?? "Team member"}</strong>
                        <p>
                          {person.disabled
                            ? "Account disabled"
                            : person.role +
                              " · " +
                              (appMembers.some((row) => row.id === person.id)
                                ? "app access active"
                                : "app grant required")}
                        </p>
                      </div>
                      {saved.actor.manage &&
                        saved.people
                          .filter(
                            (row) =>
                              row.id === person.id && row.status === "active",
                          )
                          .map((grant) => (
                            <button
                              key={grant.grantId}
                              disabled={busy || person.id === saved.actor.id}
                              onClick={() =>
                                void mutate("revoke", {
                                  grant: grant.grantId,
                                  expectedGrantRevision: grant.revision,
                                })
                              }
                            >
                              Revoke{" "}
                              {grant.action === "maintain"
                                ? "management"
                                : "app access"}
                            </button>
                          ))}
                    </li>
                  ))}
                </ul>
                {saved.actor.manage && (
                  <form
                    className="th-grant"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void mutate("grant", { member, capability });
                    }}
                  >
                    <label>
                      Eligible teammate
                      <select
                        aria-label="Eligible teammate"
                        required
                        disabled={busy}
                        value={member}
                        onChange={(event) => setMember(event.target.value)}
                      >
                        <option value="">Choose an existing team member</option>
                        {people
                          .filter((person) => !person.disabled)
                          .map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name ?? person.id}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      App permission
                      <select
                        aria-label="App permission"
                        disabled={busy}
                        value={capability}
                        onChange={(event) => setCapability(event.target.value)}
                      >
                        <option value="use">
                          Use the app with their team role
                        </option>
                        <option value="manage">
                          Manage grants — team owners only
                        </option>
                      </select>
                    </label>
                    <button disabled={busy || !member}>
                      Grant this app permission
                    </button>
                  </form>
                )}
              </section>
              <section id="team-activity">
                <h2>Recent private activity</h2>
                <ol>
                  {saved.activity.map((row) => (
                    <li key={row.hub_revision}>
                      {row.event} ·{" "}
                      {people.find((person) => person.id === row.actor_id)
                        ?.name ?? "Team member"}{" "}
                      · {row.created_at} UTC
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <h2>Private connection</h2>
                <p>
                  Only an explicitly configured service binding can be checked.
                  The browser never chooses an address or receives its
                  credential.
                </p>
                <button disabled={busy} onClick={() => void checkConnection()}>
                  Check approved connection
                </button>
                <p role="status">{connection}</p>
              </section>
            </>
          )}
          <button
            disabled={busy}
            onClick={() => {
              if (
                !dirty.current ||
                window.confirm(
                  "Reload the saved team and discard unsaved entries?",
                )
              )
                void load();
            }}
          >
            Reload saved team
          </button>
        </>
      )}
    </section>
  );
}
