import { useEffect, useRef, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  decodePlatformList,
  type PlatformSnapshot,
  type PlatformRequestInput,
} from "../../plugins/platform/protocol";
import { actorConstraint, confirmedActor, type MemberSession } from "./api";

const endpoint = "/_emdash/api/plugins/composer-members/";
export default function PlatformRequests({
  workspace,
  account,
  dirtyChanged,
}: {
  workspace: string;
  account: MemberSession;
  dirtyChanged?: (value: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>();
  const [name, setName] = useState("");
  const [contributions, setContributions] = useState<"closed" | "members">(
    "closed",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    revision: number;
    action: "update" | "revise";
    request: PlatformRequestInput;
  }>();
  const pending = useRef(false),
    live = useRef(true),
    key = useRef(crypto.randomUUID());
  useEffect(() => {
    const changed = busy || uncertain || !!name.trim();
    dirtyChanged?.(changed);
    const leave = (event: BeforeUnloadEvent) => {
      if (changed) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("beforeunload", leave);
      dirtyChanged?.(false);
    };
  }, [busy, uncertain, name, dirtyChanged]);
  const read = async () => {
    const response = await apiFetch(
      endpoint +
        "platformRead?" +
        new URLSearchParams({ action: "list", workspace }),
      { cache: "no-store", redirect: "error" },
    );
    const raw = await parseApiResponse<Record<string, unknown>>(response);
    if (!confirmedActor(raw, account))
      throw Error(
        "The platform reply belongs to another account. Refresh your apps.",
      );
    const value = decodePlatformList(raw);
    if (value.workspace.id !== workspace)
      throw Error(
        "The platform reply belongs to another workspace. Refresh before continuing.",
      );
    if (live.current) {
      setSnapshot(value);
      setUncertain(false);
    }
  };
  const act = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      if (live.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The operation is unconfirmed. Refresh its saved requests before retrying.",
        );
        setUncertain(true);
      }
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  const write = async (action: string, fields: Record<string, unknown>) => {
    const response = await apiFetch(endpoint + "platformWrite", {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...fields,
        action,
        workspace,
        expectedActor: actorConstraint(account),
      }),
    });
    const raw = await parseApiResponse<Record<string, unknown>>(response);
    if (!confirmedActor(raw, account))
      throw Error(
        "Your signed-in account changed. Keep the request identity and refresh your apps.",
      );
    const value = decodePlatformList(raw);
    if (value.workspace.id !== workspace)
      throw Error("The request belongs to another workspace.");
    if (live.current) setSnapshot(value);
  };
  useEffect(() => {
    live.current = true;
    void act(read);
    return () => {
      live.current = false;
    };
  }, []);
  return (
    <section>
      <h2>Team application requests</h2>
      <p>
        Your current workspace editor or owner delegation permits self-service
        under saved operator policy. Policy changes and independent review stay
        in native administration.
      </p>
      {error && (
        <p role="alert" className="member-error">
          {error}
        </p>
      )}
      <button disabled={busy} onClick={() => void act(read)}>
        Refresh saved requests
      </button>
      {snapshot && (
        <>
          <p>
            {snapshot.workspace.name} · {snapshot.workspace.role}.{" "}
            {snapshot.runner.message}
          </p>
          {!snapshot.profile?.enabled && (
            <p>
              An admitted operator must enable workspace standing policy before
              an application can run.
            </p>
          )}
          <form
            className="member-form"
            onSubmit={(event) => {
              event.preventDefault();
              void act(async () => {
                const request = {
                  ...(editing?.request ?? {
                    version: 1,
                    recipe: "guestbook",
                    environment: "preview",
                    dataClass: "synthetic",
                    location: "provider-default",
                    quota: "small",
                  }),
                  name,
                  ...(contributions === "members" ||
                  editing?.request.contributions !== undefined
                    ? { contributions }
                    : {}),
                };
                await write(
                  editing?.action ?? "submit",
                  editing
                    ? {
                        id: editing.id,
                        expectedRevision: editing.revision,
                        request,
                      }
                    : { key: key.current, request },
                );
                if (live.current) {
                  setName("");
                  setEditing(undefined);
                  key.current = crypto.randomUUID();
                }
              });
            }}
          >
            <label>
              Application name
              <input
                required
                maxLength={64}
                disabled={busy || uncertain}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Contributions
              <select
                disabled={busy || uncertain}
                value={contributions}
                onChange={(event) =>
                  setContributions(event.target.value as "closed" | "members")
                }
              >
                <option value="closed">Closed</option>
                <option value="members">
                  Invited members only · public postcards closed
                </option>
              </select>
            </label>
            <p>
              Synthetic preview on the existing Guestbook runtime. Member
              contributions need a qualified source, workspace policy opt-in and
              a separate app-specific grant.
            </p>
            {editing && (
              <p>
                Editing the exact saved request revision {editing.revision}. Its
                remaining requirements are retained.
              </p>
            )}
            <button disabled={busy || uncertain || !name.trim()} type="submit">
              {editing ? "Evaluate revised request" : "Request application"}
            </button>
            {editing && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(undefined);
                  setName("");
                  setContributions("closed");
                }}
              >
                Cancel revision
              </button>
            )}
          </form>
          <ul className="member-rows">
            {snapshot.requests.map((request) => (
              <li key={request.id}>
                <div>
                  <h3>{request.name}</h3>
                  <p>
                    {request.status} · {request.decision.outcome}
                  </p>
                  {request.sourceObservation && (
                    <p>
                      Stored plan source: {request.sourceObservation.kind} ·{" "}
                      <code>{request.plan.source.commit}</code>.
                      {request.sourceObservation.kind === "historical" && (
                        <>
                          {" "}
                          Current Composer pin:{" "}
                          <code>{request.sourceObservation.currentCommit}</code>
                          . Plan an update to revalidate the saved service; its
                          original audit plan is retained.
                        </>
                      )}
                    </p>
                  )}
                  {request.reason && <p>{request.reason}</p>}
                  {request.decision.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                  {request.status === "complete" && request.url && (
                    <a href={request.url}>Open application</a>
                  )}
                  {request.actorIsRequester &&
                    [
                      "complete",
                      "waiting",
                      "denied",
                      "sent-back",
                      "needs-attention",
                    ].includes(request.status) && (
                      <button
                        disabled={busy || uncertain}
                        onClick={() => {
                          if (
                            name.trim() &&
                            !window.confirm(
                              "Replace the unsaved request entries with this saved request?",
                            )
                          )
                            return;
                          setEditing({
                            id: request.id,
                            revision: request.revision,
                            action:
                              request.status === "complete"
                                ? "update"
                                : "revise",
                            request: request.request,
                          });
                          setName(request.name);
                          setContributions(
                            request.request.contributions ?? "closed",
                          );
                        }}
                      >
                        {request.status === "complete"
                          ? "Plan an update"
                          : "Revise saved request"}
                      </button>
                    )}
                  {request.resumable && (
                    <button
                      disabled={busy || uncertain}
                      onClick={() =>
                        void act(() =>
                          write(
                            request.resources.some(
                              (resource) => resource.state === "unknown",
                            )
                              ? "reconcile"
                              : "run",
                            {
                              id: request.id,
                              expectedRevision: request.revision,
                            },
                          ),
                        )
                      }
                    >
                      Recheck saved operation
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
