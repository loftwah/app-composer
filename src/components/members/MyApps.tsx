import { useEffect, useRef, useState } from "react";
import {
  memberCall,
  memberSession,
  sameAccount,
  actorConstraint,
  confirmedActor,
  type MemberSession,
} from "./api";
import { profile, decodeProfile, type Profile } from "./profile";
import ProfileEditor from "./ProfileEditor";
import GuestbookTools from "./GuestbookTools";
import PlatformRequests from "./PlatformRequests";
import {
  memberPageSelection,
  memberScopeBlocked,
  acceptInvitationPreservingScope,
} from "./selection";
import "./members.css";

export default function MyApps() {
  const [account, setAccount] = useState<MemberSession>();
  const [selected, setSelected] = useState("");
  const [snapshot, setSnapshot] = useState<Profile>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Checking your EmDash session…");
  const [view, setView] = useState("profile");
  const pending = useRef(false),
    generation = useRef(0),
    live = useRef(true),
    dirty = useRef(false),
    appDrafts = useRef({ guestbook: false, platform: false }),
    scope = useRef("");
  const currentAccount = useRef<MemberSession | undefined>(undefined);
  const load = async (id = scope.current, readProfile = true) => {
    const mine = ++generation.current;
    const next = await memberSession();
    if (!live.current || mine !== generation.current) return;
    if (
      id &&
      scope.current &&
      id !== scope.current &&
      memberScopeBlocked(dirty.current, false, appDrafts.current)
    )
      throw Error(
        "Current work started while workspace access was loading. Your entries and operation identities are retained; finish or check them before changing workspace.",
      );
    if (currentAccount.current && !sameAccount(currentAccount.current, next)) {
      setSnapshot(undefined);
      dirty.current = false;
    }
    currentAccount.current = next;
    setAccount(next);
    const workspace = id
      ? next.workspaces.find((w) => w.id === id)
      : next.workspaces[0];
    scope.current = workspace?.id ?? "";
    setSelected(scope.current);
    if (!workspace) {
      setSnapshot(undefined);
      if (id)
        throw Error(
          "The selected workspace is not confirmed for this account. Your address will not fall back to another workspace.",
        );
      setStatus(
        "Your account is signed in. Accept an invitation below to join its workspace; a profile has not been created.",
      );
      return;
    }
    if (!readProfile) {
      setSnapshot(undefined);
      setStatus("Workspace access loaded. Choose an available action below.");
      return;
    }
    const grant =
      next.grants.find(
        (g) =>
          g.workspace === workspace.id &&
          g.app === "showcase" &&
          g.resource !== "new-profile" &&
          g.action === "maintain",
      ) ??
      next.grants.find(
        (g) =>
          g.workspace === workspace.id &&
          g.app === "showcase" &&
          g.resource === "new-profile" &&
          g.action === "create",
      );
    if (!grant) {
      setSnapshot(undefined);
      setStatus(
        next.grants.some(
          (entry) =>
            entry.workspace === workspace.id &&
            entry.app === "guestbook" &&
            entry.status !== "revoked",
        )
          ? "Your shared app tools are available in My apps. Profile editing needs a separate grant."
          : "Workspace membership is active. Ask its owner for the profile or app actions you need.",
      );
      return;
    }
    const response = await memberCall("profile", {
      workspace: workspace.id,
      operation: "read",
      expectedActor: actorConstraint(next),
      ...(grant.resource !== "new-profile" ? { resource: grant.resource } : {}),
    });
    const confirmed = await memberSession();
    if (!live.current || mine !== generation.current) return;
    if (!sameAccount(next, confirmed)) {
      setSnapshot(undefined);
      currentAccount.current = confirmed;
      setAccount(confirmed);
      dirty.current = false;
      throw Error(
        "The signed-in account changed. Refresh to open its own apps.",
      );
    }
    setAccount(confirmed);
    currentAccount.current = confirmed;
    const result = response.result as Record<string, unknown> | undefined;
    if (
      !confirmedActor(response, next) ||
      (grant.resource !== "new-profile" && result?.resource !== grant.resource)
    )
      throw Error(
        "The app result belongs to another account or profile. Refresh before continuing.",
      );
    setSnapshot(result?.profile === null ? undefined : decodeProfile(result));
    setStatus(
      dirty.current
        ? "Saved profile refreshed. Your unsaved edits are retained for comparison."
        : result?.profile === null
          ? "Your profile permission is ready. Create your profile when you are ready to choose its public identity."
          : "Your saved profile is open.",
    );
  };
  useEffect(() => {
    live.current = true;
    try {
      const initial = memberPageSelection(location.search);
      setView(initial.view);
      void load(initial.workspace ?? "", initial.view !== "platform").catch(
        (e) =>
          setError(
            e instanceof Error
              ? e.message
              : "Sign in with EmDash to open your apps.",
          ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Choose a valid member view.",
      );
    }
    const before = (event: BeforeUnloadEvent) => {
      if (
        dirty.current ||
        pending.current ||
        Object.values(appDrafts.current).some(Boolean)
      )
        event.preventDefault();
    };
    const follow = (event: MouseEvent) => {
      const anchor =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        anchor instanceof HTMLAnchorElement &&
        !anchor.target &&
        anchor.origin === location.origin &&
        anchor.pathname !== location.pathname &&
        (dirty.current ||
          pending.current ||
          Object.values(appDrafts.current).some(Boolean)) &&
        !window.confirm(
          "You have unsaved edits or an operation in progress. Leave this page?",
        )
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", follow);
    return () => {
      live.current = false;
      generation.current++;
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", follow);
    };
  }, []);
  const execute = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error
            ? e.message
            : "The action was not confirmed. Your edits are retained.",
        );
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  const request = async (
    operation: string,
    command?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    if (pending.current)
      throw Error("Wait for the current operation to finish.");
    const principal = currentAccount.current;
    if (!principal || !selected)
      throw Error("Refresh your current workspace access.");
    const mine = generation.current;
    pending.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const before = await memberSession();
      if (!sameAccount(principal, before)) {
        setSnapshot(undefined);
        dirty.current = false;
        setAccount(before);
        currentAccount.current = before;
        throw Error(
          "The signed-in account changed. Refresh before continuing.",
        );
      }
      const response = await memberCall("profile", {
        workspace: selected,
        operation,
        expectedActor: actorConstraint(principal),
        ...(snapshot
          ? { resource: snapshot.resource, expectedRevision: snapshot.revision }
          : {}),
        ...(command ? { command } : {}),
      });
      const after = await memberSession();
      if (
        !live.current ||
        mine !== generation.current ||
        !sameAccount(principal, after)
      ) {
        setSnapshot(undefined);
        setAccount(after);
        currentAccount.current = after;
        dirty.current = false;
        throw Error(
          "The account or workspace changed while this operation was running. Refresh its saved state.",
        );
      }
      const result = response.result;
      if (
        !confirmedActor(response, principal) ||
        (snapshot &&
          typeof result === "object" &&
          result !== null &&
          (result as Record<string, unknown>).resource !== snapshot.resource)
      )
        throw Error(
          "The app result does not match the selected account and profile. Refresh before continuing.",
        );
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw Error(
          "The app did not confirm its result. Refresh before retrying.",
        );
      const parsed = profile.safeParse(result);
      if (parsed.success) setSnapshot(parsed.data);
      setAccount(after);
      currentAccount.current = after;
      setStatus(
        operation === "publish"
          ? "Profile published. Open it and verify the public card."
          : operation === "hide"
            ? "Public profile hidden. Your saved content is retained."
            : operation === "create"
              ? "Your private profile is ready. Add your identity and links, then prepare a card."
              : operation === "read"
                ? "Saved profile refreshed. Your unsaved edits are retained."
                : "Saved in your profile draft. Publish the profile when it is ready.",
      );
      return result as Record<string, unknown>;
    } catch (e) {
      if (live.current)
        setError(
          e instanceof Error
            ? e.message
            : "The outcome is uncertain. Check the saved profile before retrying.",
        );
      throw e;
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  const act = async (operation: string, command?: Record<string, unknown>) => {
    try {
      return decodeProfile(await request(operation, command));
    } catch {
      return undefined;
    }
  };
  const grants = account?.grants.filter((g) => g.workspace === selected) ?? [];
  const can = (action: string) =>
    grants.some(
      (g) =>
        g.app === "showcase" &&
        g.resource === snapshot?.resource &&
        g.action === action,
    );
  return (
    <div className="member-workbench">
      <div className="member-heading">
        <div>
          <h1>My profile / My apps</h1>
          <p>
            {account?.actor.name
              ? `${account.actor.name}, choose what you want to work on.`
              : "Your profile and the app tools shared with you, through one EmDash sign-in."}
          </p>
        </div>
        {account?.workspaces.some((w) => w.role === "owner") && (
          <a href="/people">People & access</a>
        )}
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
          <a className="button" href="/_emdash/admin/login?redirect=/me">
            Sign in with EmDash
          </a>
        </p>
      )}
      <div className="member-actions">
        <button disabled={busy} onClick={() => void execute(() => load())}>
          Refresh my access
        </button>
        {account?.operator && (
          <a href="/_emdash/admin">Operator administration</a>
        )}
      </div>
      {account?.incoming.length !== 0 &&
        account?.incoming.map((invite) => (
          <section key={invite.id}>
            <h2>{invite.workspaceName ?? "Workspace invitation"}</h2>
            <p>
              Invitation for your signed-in login email · {invite.status}.
              Accepting adds workspace membership; it does not publish a profile
              or grant CMS administration.
            </p>
            <button
              disabled={
                busy ||
                invite.status !== "pending" ||
                Date.parse(invite.expiresAt) <= Date.now()
              }
              onClick={() => {
                if (
                  memberScopeBlocked(
                    dirty.current,
                    pending.current,
                    appDrafts.current,
                  )
                ) {
                  setError(
                    "Finish or check the current profile, application request or contribution before accepting an invitation into another workspace. Your entries and operation identities are retained.",
                  );
                  return;
                }
                void execute(async () => {
                  const switched = await acceptInvitationPreservingScope(
                    () =>
                      memberScopeBlocked(
                        dirty.current,
                        false,
                        appDrafts.current,
                      ),
                    async () => {
                      await memberCall("accept", {
                        expectedActor: actorConstraint(account),
                        workspace: invite.workspace,
                        expectedRevision: invite.workspaceRevision,
                        invitation: invite.id,
                        invitationRevision: invite.revision,
                      });
                    },
                    () => load(invite.workspace, view !== "platform"),
                  );
                  if (!switched) {
                    setStatus(
                      "Workspace invitation accepted. Finish or check the current work before selecting the new workspace; your entries and operation identities are retained.",
                    );
                  }
                });
              }}
            >
              Accept workspace invitation
            </button>
          </section>
        ))}
      {!!account?.workspaces.length && (
        <label className="member-scope">
          Workspace
          <select
            value={selected}
            disabled={busy}
            onChange={(event) => {
              if (
                memberScopeBlocked(
                  dirty.current,
                  pending.current,
                  appDrafts.current,
                )
              ) {
                setError(
                  "Finish or check the current profile, application request or contribution before changing workspace. Your entries and operation identities are retained.",
                );
                return;
              }
              const id = event.target.value;
              setSnapshot(undefined);
              void execute(() => load(id, view !== "platform"));
            }}
          >
            {account.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && (
        <nav className="member-actions" aria-label="My work">
          <button
            aria-pressed={view === "profile"}
            onClick={() => {
              setView("profile");
              if (!snapshot) void execute(() => load());
            }}
          >
            My profile
          </button>
          <button
            aria-pressed={view === "apps"}
            onClick={() => setView("apps")}
          >
            My apps
          </button>
          {account?.workspaces.some(
            (workspace) =>
              workspace.id === selected &&
              ["owner", "editor"].includes(workspace.role),
          ) && (
            <button
              aria-pressed={view === "platform"}
              onClick={() => setView("platform")}
            >
              Team application requests
            </button>
          )}
        </nav>
      )}
      <div hidden={view !== "profile"}>
        {snapshot ? (
          <ProfileEditor
            key={`${account?.actor.issuer}/${account?.actor.subject}/${selected}/${snapshot.resource}`}
            snapshot={snapshot}
            busy={busy}
            canPublish={can("publish")}
            canExport={can("export")}
            act={act}
            request={request}
            dirtyChanged={(value) => {
              dirty.current = value;
            }}
          />
        ) : (
          selected && (
            <section>
              <h2>Your own Linkarooie profile</h2>
              <p>
                Choose your public name and links in a private draft. Creating a
                profile does not publish it.
              </p>
              {grants.some(
                (g) =>
                  g.app === "showcase" &&
                  g.resource === "new-profile" &&
                  g.action === "create",
              ) ? (
                <button disabled={busy} onClick={() => void act("create")}>
                  Create my profile
                </button>
              ) : (
                <p>
                  Your workspace owner can grant profile access in People &
                  access.
                </p>
              )}
            </section>
          )
        )}
      </div>
      <div hidden={view !== "apps"}>
        <h2>Tools shared with you</h2>
        {grants.every((g) => g.app !== "guestbook") ? (
          <p>
            No Guestbook actions are shared with you in this workspace. Your
            profile permissions are separate.
          </p>
        ) : (
          <GuestbookTools
            key={`${account?.actor.subject}/${selected}`}
            grants={grants.filter((g) => g.app === "guestbook")}
            workspace={selected}
            account={account!}
            refreshAccess={() => load()}
            dirtyChanged={(value) => {
              appDrafts.current.guestbook = value;
            }}
          />
        )}
      </div>
      <div hidden={view !== "platform"}>
        {account &&
          account.workspaces.some(
            (workspace) =>
              workspace.id === selected &&
              ["owner", "editor"].includes(workspace.role),
          ) && (
            <PlatformRequests
              key={`${account.actor.subject}/${selected}/platform`}
              account={account}
              workspace={selected}
              dirtyChanged={(value) => {
                appDrafts.current.platform = value;
              }}
            />
          )}
        {account &&
          !account.workspaces.some(
            (workspace) =>
              workspace.id === selected &&
              ["owner", "editor"].includes(workspace.role),
          ) && (
            <p>
              Team application requests require explicit editor or owner
              delegation in the selected workspace. Profile and app grants alone
              do not grant this access.
            </p>
          )}
      </div>
    </div>
  );
}
