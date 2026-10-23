import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  memberCall,
  memberSession,
  sameAccount,
  type Grant,
  type MemberSession,
} from "./api";

const review = z.object({
  contract: z.literal(1),
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
}: {
  grants: Grant[];
  workspace: string;
  account: MemberSession;
  refreshAccess: () => Promise<void>;
}) {
  const resources = [...new Set(grants.map((g) => g.resource))];
  const [selected, setSelected] = useState(resources[0] ?? "");
  const [message, setMessage] = useState("");
  const [alias, setAlias] = useState(account.actor.name ?? "");
  const [consent, setConsent] = useState(false);
  const [list, setList] = useState<Review>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    pending = useRef(false),
    live = useRef(true),
    generation = useRef(0);
  const allowed = (action: string) =>
    grants.some((g) => g.resource === selected && g.action === action);
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
    capability: "contribute" | "moderate",
    input: Record<string, unknown>,
  ) => {
    const before = await memberSession();
    if (!sameAccount(account, before)) {
      setList(undefined);
      throw Error("The account changed. Refresh your apps before continuing.");
    }
    const response = await memberCall("guestbook", {
      workspace,
      resource: selected,
      capability,
      input,
    });
    const after = await memberSession();
    if (
      !sameAccount(account, after) ||
      !after.grants.some(
        (g) =>
          g.workspace === workspace &&
          g.resource === selected &&
          g.app === "guestbook" &&
          g.action === capability,
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
  return (
    <section>
      <h3>Here / there</h3>
      <label className="member-scope">
        Selected visitor book
        <select
          disabled={busy || !!message.trim()}
          value={selected}
          onChange={(e) => {
            generation.current++;
            setSelected(e.target.value);
            setList(undefined);
            setStatus("");
            setError("");
          }}
        >
          {resources.map((resource) => (
            <option key={resource}>{resource}</option>
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
          <summary>Contribute a postcard</summary>
          <p>
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
                setUncertain(true);
                const result = await call("contribute", {
                  caption: message,
                  author: alias,
                  consent,
                  png,
                });
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
                setUncertain(false);
                setMessage("");
                setConsent(false);
                setStatus(
                  "Postcard submitted for review. It remains private until an authorised moderator approves it.",
                );
              });
            }}
          >
            <label>
              Your message
              <textarea
                required
                maxLength={160}
                disabled={busy}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <label>
              Public alias
              <input
                required
                maxLength={60}
                disabled={busy}
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
                disabled={busy}
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I agree to publish this message and alias if approved.
            </label>
            <button type="submit" disabled={busy || !consent || uncertain}>
              Submit for review
            </button>
            {uncertain && (
              <p>
                The submission result has not been confirmed. Keep this message
                and ask the visitor-book owner to check its queue before
                submitting again.
              </p>
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
