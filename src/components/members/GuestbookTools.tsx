import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  beginContribution,
  confirmContribution,
  observeContribution,
  contributionRecovery,
  recoverContribution,
  type ContributionAttempt,
} from "./contribution-state";
import {
  memberCall,
  memberSession,
  sameAccount,
  actorConstraint,
  confirmedActor,
  type Grant,
  type MemberSession,
} from "./api";

const review = z.object({
  contract: z.union([z.literal(1), z.literal(2)]),
  resource: z.object({ id: z.string(), version: z.number().int().positive() }),
  items: z
    .array(
      z.object({
        id: z.string(),
        caption: z.string(),
        author: z.string(),
        status: z.string(),
        revision: z.number().int().positive(),
      }),
    )
    .max(200),
});
type Review = z.infer<typeof review>;
function drawPostcard(
  canvas: HTMLCanvasElement,
  message: string,
  alias: string,
) {
  const context = canvas.getContext("2d");
  if (!context) throw Error("This browser cannot prepare a postcard.");
  context.fillStyle = "#faf9f7";
  context.fillRect(0, 0, 1200, 900);
  context.fillStyle = "#17181b";
  context.font = "600 52px sans-serif";
  const words = message.split(/\s+/),
    lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (context.measureText(next).width > 960 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  lines
    .slice(0, 8)
    .forEach((text, index) =>
      context.fillText(text, 100, 180 + index * 72, 1000),
    );
  context.font = "32px sans-serif";
  context.fillText(alias || "A visitor", 100, 800, 1000);
  context.strokeStyle = "#fc5b05";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(100, 90);
  context.lineTo(1100, 90);
  context.stroke();
}
export default function GuestbookTools({
  grants,
  workspace,
  account,
  refreshAccess,
  dirtyChanged,
}: {
  grants: Grant[];
  workspace: string;
  account: MemberSession;
  refreshAccess: () => Promise<void>;
  dirtyChanged?: (value: boolean) => void;
}) {
  const resources = [...new Set(grants.map((g) => g.resource))];
  const [selected, setSelected] = useState(resources[0] ?? "");
  const [message, setMessage] = useState("");
  const [alias, setAlias] = useState((account.actor.name ?? "").slice(0, 60));
  const [consent, setConsent] = useState(false);
  const [list, setList] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [recovery, setRecovery] = useState<"retry" | "resume">();
  const recoveryObservation = useRef<unknown>(undefined);
  const attempt = useRef<ContributionAttempt | undefined>(undefined);
  const canvas = useRef<HTMLCanvasElement>(null),
    pending = useRef(false),
    live = useRef(true),
    generation = useRef(0);
  const allowed = (action: string) =>
    grants.some((g) => g.resource === selected && g.action === action);
  const membersOnly = grants.some(
    (g) => g.resource === selected && g.contributions === "members",
  );
  useEffect(() => {
    const changed = busy || uncertain || !!message.trim();
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
  }, [busy, uncertain, message, dirtyChanged]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (canvas.current) drawPostcard(canvas.current, message, alias);
  }, [message, alias]);
  const call = async (
    capability: "contribute" | "moderate" | "contribution-status",
    input: Record<string, unknown>,
  ) => {
    const before = await memberSession();
    if (!sameAccount(account, before)) {
      setList(undefined);
      throw Error("The account changed. Refresh your apps before continuing.");
    }
    const response = await memberCall("guestbook", {
      expectedActor: actorConstraint(account),
      workspace,
      resource: selected,
      capability,
      input,
    });
    const after = await memberSession();
    if (!confirmedActor(response, account)) {
      setList(undefined);
      throw Error(
        "The app result belongs to another account. Refresh your apps before continuing.",
      );
    }
    if (
      !sameAccount(account, after) ||
      !after.grants.some(
        (g) =>
          g.workspace === workspace &&
          g.resource === selected &&
          g.app === "guestbook" &&
          g.action ===
            (capability === "contribution-status" ? "contribute" : capability),
      )
    ) {
      setList(undefined);
      throw Error(
        "Access changed while this operation was running. Refresh your apps and check the saved result before retrying.",
      );
    }
    return response.result;
  };
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (e) {
      if (live.current) {
        setList(undefined);
        setError(
          e instanceof Error
            ? e.message
            : "The operation could not be confirmed. Refresh access before retrying.",
        );
      }
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  const reload = async () => {
    const mine = generation.current;
    const result = review.parse(await call("moderate", { operation: "list" }));
    if (result.resource.id !== selected)
      throw Error("The review list belongs to a different visitor book.");
    if (live.current && mine === generation.current) setList(result);
  };
  const finishContribution = () => {
    attempt.current = undefined;
    setUncertain(false);
    setRecovery(undefined);
    recoveryObservation.current = undefined;
    setMessage("");
    setConsent(false);
    setStatus(
      "Postcard submitted for review. It remains private until an authorised moderator approves it.",
    );
  };
  return (
    <section>
      <h3>Here / there</h3>
      <label className="member-scope">
        Selected visitor book
        <select
          disabled={busy || uncertain || !!message.trim()}
          value={selected}
          onChange={(e) => {
            generation.current++;
            setSelected(e.target.value);
            setList(undefined);
            setStatus("");
            setError("");
          }}
        >
          {resources.map((resource, index) => (
            <option key={resource} value={resource}>
              Shared visitor book {index + 1}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="member-error" role="alert">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite">
        {status}
      </p>
      {allowed("contribute") && (
        <details open>
          <summary>
            {membersOnly
              ? "Contribute a fictional member postcard"
              : "Contribute a postcard"}
          </summary>
          <p>
            {membersOnly
              ? "Use fictional messages and aliases only in this synthetic team service. Public postcard admission stays closed. "
              : ""}
            Your message is drawn on this device. It goes to this visitor book’s
            pending queue for a separately authorised moderator.
          </p>
          <form
            className="member-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!canvas.current || !consent || uncertain) return;
                const png = canvas.current.toDataURL("image/png").split(",")[1];
                const input = {
                  caption: message,
                  author: alias,
                  consent,
                  png,
                };
                if (membersOnly) {
                  attempt.current ??= beginContribution(selected, input);
                  setUncertain(true);
                  const result = await call(
                    "contribute",
                    attempt.current.input,
                  );
                  confirmContribution(attempt.current, result);
                  finishContribution();
                  return;
                }
                setUncertain(true);
                const result = await call("contribute", input);
                const receipt = z
                  .object({
                    id: z.string(),
                    resource: z.string(),
                    status: z.literal("pending"),
                  })
                  .parse(result);
                if (receipt.resource !== selected)
                  throw Error(
                    "The receipt does not confirm this visitor book. Check before retrying.",
                  );
                finishContribution();
              });
            }}
          >
            <label>
              Your message
              <textarea
                required
                maxLength={160}
                disabled={busy || uncertain}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <label>
              Public alias
              <input
                required
                maxLength={60}
                disabled={busy || uncertain}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </label>
            <figure className="member-preview">
              <canvas
                ref={canvas}
                width="1200"
                height="900"
                style={{ width: "100%", height: "auto" }}
                aria-label="Postcard preview"
              />
              <figcaption>
                The message and alias above will be public if approved.
              </figcaption>
            </figure>
            <label className="member-check">
              <input
                type="checkbox"
                required
                disabled={busy || uncertain}
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I agree to publish this message and alias if approved.
            </label>
            <button type="submit" disabled={busy || !consent || uncertain}>
              Submit for review
            </button>
            {uncertain && (
              <div>
                <p>
                  The submission result has not been confirmed. Your message and
                  original operation identity are retained.
                </p>
                {attempt.current ? (
                  <>
                    <p>
                      Operation <code>{attempt.current.input.operationId}</code>
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const pending = attempt.current;
                          if (!pending) return;
                          setRecovery(undefined);
                          recoveryObservation.current = undefined;
                          const observed = observeContribution(
                            pending,
                            await call("contribution-status", {
                              operationId: pending.input.operationId,
                            }),
                          );
                          if (
                            observed.outcome === "completed" &&
                            observed.receipt
                          ) {
                            finishContribution();
                            return;
                          }
                          const next = await contributionRecovery(
                            pending,
                            observed,
                          );
                          recoveryObservation.current = observed;
                          setRecovery(next);
                          setStatus(
                            observed.outcome === "not-recorded"
                              ? "No receipt is recorded. You may explicitly retry the same unchanged submission and operation."
                              : next === "resume"
                                ? "The original submission is pending with matching configuration and postcard data. You may explicitly resume that same unchanged operation."
                                : "The original submission remains pending but cannot currently be resumed. Keep its operation identity and check its receipt after the service is reviewed; no new submission was sent.",
                          );
                        })
                      }
                    >
                      Check original receipt
                    </button>
                    {recovery && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const pending = attempt.current;
                            if (!pending) return;
                            const observed = recoveryObservation.current;
                            setRecovery(undefined);
                            recoveryObservation.current = undefined;
                            await recoverContribution(
                              pending,
                              observed,
                              (input) => call("contribute", input),
                            );
                            finishContribution();
                          })
                        }
                      >
                        {recovery === "resume"
                          ? "Resume the same submission"
                          : "Retry the same submission"}
                      </button>
                    )}
                  </>
                ) : (
                  <p>
                    Ask the visitor-book owner to check its queue before
                    submitting again. This older contribution path has no member
                    receipt lookup.
                  </p>
                )}
              </div>
            )}
          </form>
        </details>
      )}
      {allowed("moderate") && (
        <details open>
          <summary>Review this visitor book</summary>
          <p>
            This permission allows review of this book’s contributions. It does
            not grant profile ownership, exports or moderation of another book.
          </p>
          <button disabled={busy} onClick={() => void run(reload)}>
            Load contributions to review
          </button>
          {list && (
            <ul className="member-rows">
              {list.items.length === 0 ? (
                <li>No contributions need review in this visitor book.</li>
              ) : (
                list.items.map((item) => (
                  <li key={item.id}>
                    <div>
                      <h3>{item.caption}</h3>
                      <p>
                        {item.author} · {item.status}
                      </p>
                      <div className="member-actions">
                        {["approved", "hidden", "rejected"]
                          .filter((status) => status !== item.status)
                          .map((status) => (
                            <button
                              key={status}
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await call("moderate", {
                                    operation: "moderate",
                                    operationId: crypto.randomUUID(),
                                    expectedVersion: list.resource.version,
                                    item: item.id,
                                    itemRevision: item.revision,
                                    status,
                                  });
                                  await reload();
                                  setStatus(
                                    status === "approved"
                                      ? "Contribution approved in this visitor book."
                                      : status === "hidden"
                                        ? "Contribution hidden. Dependent public media follows its source visibility."
                                        : "Contribution rejected.",
                                  );
                                })
                              }
                            >
                              {status === "approved"
                                ? "Approve"
                                : status === "hidden"
                                  ? "Hide"
                                  : "Reject"}
                            </button>
                          ))}
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </details>
      )}
      <button disabled={busy} onClick={() => void run(refreshAccess)}>
        Refresh app permissions
      </button>
    </section>
  );
}
