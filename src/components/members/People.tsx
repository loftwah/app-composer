import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { z } from "zod";
import {
  grant,
  memberCall,
  memberSession,
  sameAccount,
  actorConstraint,
  type MemberSession,
  type Workspace,
} from "./api";
import "./members.css";

const people = z.object({
  workspace: z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    revision: z.number(),
  }),
  members: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      email: z.string().nullable(),
      role: z.string(),
    }),
  ),
  invitations: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      status: z.string(),
      revision: z.number(),
      expiresAt: z.string(),
    }),
  ),
  grants: z.array(grant),
  resources: z.array(z.object({ id: z.string(), name: z.string() })).max(128),
  audit: z.array(z.unknown()).optional(),
});
type PeopleData = z.infer<typeof people>;

export default function People() {
  const [account, setAccount] = useState<MemberSession>();
  const [data, setData] = useState<PeopleData>();
  const [selected, setSelected] = useState("");
  const [email, setEmail] = useState("");
  const [member, setMember] = useState("");
  const [app, setApp] = useState("showcase");
  const [resource, setResource] = useState("new-profile");
  const [capability, setCapability] = useState("create");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading your workspace access…");
  const [error, setError] = useState("");
  const pending = useRef(false),
    generation = useRef(0),
    live = useRef(true);
  const workspace = useRef("");
  const load = async (id = workspace.current) => {
    const mine = ++generation.current;
    const next = await memberSession();
    if (!live.current || mine !== generation.current) return;
    if (account && !sameAccount(account, next)) {
      setData(undefined);
      setEmail("");
      setMember("");
    }
    setAccount(next);
    const owned = next.workspaces.filter((w) => w.role === "owner");
    const choice = owned.find((w) => w.id === id) ?? owned[0];
    if (!choice) {
      setData(undefined);
      setStatus(
        "Only a workspace owner can manage people. Your profile and granted tools are in My apps.",
      );
      return;
    }
    workspace.current = choice.id;
    setSelected(choice.id);
    const result = await memberCall("people", { workspace: choice.id }, true);
    const decoded = people.safeParse(result.access ?? result);
    if (!decoded.success)
      throw Error(
        "Workspace access could not be read. Your entries are retained; refresh before editing people.",
      );
    const parsed = decoded.data;
    const confirmed = await memberSession();
    if (!live.current || mine !== generation.current) return;
    if (!sameAccount(next, confirmed)) {
      setData(undefined);
      setAccount(confirmed);
      setEmail("");
      setMember("");
      throw Error(
        "The signed-in account changed while access was loading. Refresh before managing people.",
      );
    }
    setData({
      ...parsed,
      grants: parsed.grants.filter((g) => g.status !== "revoked"),
    });
    setStatus("");
  };
  useEffect(() => {
    live.current = true;
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Access is unavailable."),
    );
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const current = await memberSession();
      if (!account || !sameAccount(account, current)) {
        setData(undefined);
        setAccount(current);
        throw Error(
          "The signed-in account changed. Refresh access before editing people.",
        );
      }
      await action();
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error
            ? e.message
            : "This action was not confirmed. Refresh access before retrying.",
        );
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  const invite = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      if (!data) return;
      await memberCall("invite", {
        expectedActor: actorConstraint(account!),
        workspace: selected,
        expectedRevision: data.workspace.revision,
        email,
        role: "viewer",
      });
      setEmail("");
      await load();
      setStatus(
        "Invitation prepared. No email was sent. Admission and an EmDash account are separate steps; the intended person accepts it in My apps.",
      );
    });
  };
  const addGrant = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      if (!data) return;
      await memberCall("grant", {
        expectedActor: actorConstraint(account!),
        workspace: selected,
        expectedRevision: data.workspace.revision,
        member,
        app,
        resource,
        capability,
      });
      await load();
      setStatus(
        "Selected permission granted. Other app permissions are unchanged.",
      );
    });
  };
  const owners: Workspace[] =
    account?.workspaces.filter((w) => w.role === "owner") ?? [];
  return (
    <div className="member-workbench">
      <div className="member-heading">
        <div>
          <h1>People & access</h1>
          <p>
            Invite a friend into a workspace, then choose the exact tools they
            may use.
          </p>
        </div>
        <a href="/me">My profile / My apps</a>
      </div>
      {error && (
        <p role="alert" className="member-error">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite">
        {status}
      </p>
      {!account && (
        <p>
          <a className="button" href="/_emdash/admin/login?redirect=/people">
            Sign in with EmDash
          </a>
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(() => load())}
      >
        Refresh access
      </button>
      {owners.length > 0 && (
        <label className="member-scope">
          Workspace
          <select
            value={selected}
            disabled={busy}
            onChange={(event) => {
              const id = event.target.value;
              setData(undefined);
              void run(() => load(id));
            }}
          >
            {owners.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {data && (
        <>
          <section>
            <h2>Invite a friend</h2>
            <p>
              Prepare membership for their login email. Your configured
              authentication system must admit them and create their account
              before they can accept. This action does not send an email or
              change the sign-in policy.
            </p>
            <form onSubmit={invite} className="member-form">
              <label>
                Friend’s login email
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </label>
              <button disabled={busy} type="submit">
                Prepare invitation
              </button>
            </form>
            <ul className="member-rows">
              {data.invitations.map((i) => (
                <li key={i.id}>
                  <div>
                    <strong>{i.email}</strong>
                    <p>
                      {i.status} · expires{" "}
                      {new Date(i.expiresAt).toLocaleDateString("en-AU")}
                    </p>
                  </div>
                  {i.status === "pending" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await memberCall("revokeInvitation", {
                            expectedActor: actorConstraint(account!),
                            workspace: selected,
                            expectedRevision: data.workspace.revision,
                            invitation: i.id,
                            invitationRevision: i.revision,
                          });
                          await load();
                          setStatus(
                            "Invitation revoked. Existing content is retained.",
                          );
                        })
                      }
                    >
                      Revoke invitation
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Choose an app permission</h2>
            <p>
              A profile starts with Create. Add Maintain, Publish and Export
              separately to make those actions available when it is created.
              Guestbook permissions apply to one existing visitor book.
            </p>
            <form onSubmit={addGrant} className="member-form">
              <label>
                Person
                <select
                  required
                  disabled={busy}
                  value={member}
                  onChange={(e) => setMember(e.target.value)}
                >
                  <option value="">Choose a member</option>
                  {data.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email ?? "Workspace member"} · {m.role}
                    </option>
                  ))}
                </select>
              </label>
              <div className="member-fields">
                <label>
                  App
                  <select
                    value={app}
                    disabled={busy}
                    onChange={(e) => {
                      setApp(e.target.value);
                      setResource(
                        e.target.value === "showcase" ? "new-profile" : "",
                      );
                      setCapability(
                        e.target.value === "showcase" ? "create" : "contribute",
                      );
                    }}
                  >
                    <option value="showcase">Linkarooie profile</option>
                    <option value="guestbook">Here / there Guestbook</option>
                  </select>
                </label>
                <label>
                  Action
                  <select
                    value={capability}
                    disabled={busy}
                    onChange={(e) => setCapability(e.target.value)}
                  >
                    {(app === "showcase"
                      ? ["create", "maintain", "publish", "export"]
                      : ["contribute", "moderate"]
                    ).map((c) => (
                      <option key={c} value={c}>
                        {c[0]!.toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                {app === "showcase"
                  ? "Profile resource (new-profile before creation)"
                  : "Existing visitor-book resource"}
                <select
                  required
                  value={resource}
                  disabled={busy}
                  onChange={(e) => setResource(e.target.value)}
                >
                  <option value="">Choose a resource</option>
                  {app === "showcase" ? (
                    <>
                      <option value="new-profile">
                        Their personal profile · before creation
                      </option>
                      {[
                        ...new Set(
                          data.grants
                            .filter(
                              (g) =>
                                g.member === member &&
                                g.app === "showcase" &&
                                g.resource !== "new-profile",
                            )
                            .map((g) => g.resource),
                        ),
                      ].map((id) => (
                        <option key={id} value={id}>
                          Their existing personal profile
                        </option>
                      ))}
                    </>
                  ) : (
                    data.resources.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button type="submit" disabled={busy || !member}>
                Grant selected action
              </button>
            </form>
          </section>
          <section>
            <h2>Current permissions</h2>
            {data.grants.length === 0 ? (
              <p>
                No app actions have been granted. Choose a person and an action
                above.
              </p>
            ) : (
              <ul className="member-rows">
                {data.grants.map((g) => (
                  <li key={g.id}>
                    <div>
                      <strong>
                        {data.members.find((m) => m.id === g.member)?.name ??
                          "Member"}{" "}
                        · {g.app === "showcase" ? "Linkarooie" : "Guestbook"}
                      </strong>
                      <p>
                        {g.action} ·{" "}
                        {g.app === "showcase"
                          ? g.resource === "new-profile"
                            ? "Personal profile before creation"
                            : "Their personal profile"
                          : (data.resources.find(
                              (book) => book.id === g.resource,
                            )?.name ?? "Selected visitor book")}
                      </p>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await memberCall("revoke", {
                            expectedActor: actorConstraint(account!),
                            workspace: selected,
                            expectedRevision: data.workspace.revision,
                            member: g.member,
                            app: g.app,
                            resource: g.resource,
                            capability: g.action,
                            expectedGrantRevision: g.revision,
                          });
                          await load();
                          setStatus(
                            "Permission revoked. The next protected action is denied. Profile access and app content remain governed by their other permissions.",
                          );
                        })
                      }
                    >
                      Revoke {g.action}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <details>
            <summary>What each step means</summary>
            <ol>
              <li>
                Admission is controlled by the configured authentication system.
              </li>
              <li>EmDash creates and authenticates the account.</li>
              <li>The intended person accepts workspace membership.</li>
              <li>
                A permitted person creates their separate Linkarooie profile.
              </li>
              <li>Each granted app action is checked when used.</li>
            </ol>
            <p>
              Revocation prevents the next dispatch. An operation already sent
              to an app may have committed; refresh its state before retrying.
              Revocation preserves app content.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
