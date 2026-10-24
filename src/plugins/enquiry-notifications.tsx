import { useEffect, useRef, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { z } from "zod";
import { enquiryID, enquiryIntent } from "../lib/enquiry-protocol";
import { confirmWorkspace } from "./stacks/workspace-scope";
import { focusStoredRecord } from './record-anchor';
const replySchema = z
  .object({
    ok: z.literal(true),
    workspace: z
      .object({ id: enquiryID, role: z.enum(["owner", "editor", "viewer"]) })
      .passthrough(),
    resource: enquiryID,
    preference: z
      .object({
        enabled: z.boolean(),
        revision: z.number().int().nonnegative(),
      })
      .strict(),
    connection: z
      .object({
        ready: z.boolean(),
        destination: z.string().nullable(),
        timezone: z.literal("UTC"),
        delivery: z.literal("not-verified"),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            id: enquiryIntent,
            state: z.enum([
              "queued",
              "blocked",
              "sending",
              "accepted",
              "failed",
              "uncertain",
            ]),
            attempts: z.number().int().min(0).max(3),
            reason: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
            provider_id: z.string().nullable(),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
type Reply = z.infer<typeof replySchema>;
const labels = {
  queued: "Waiting for owner action",
  blocked: "Connection needs attention",
  sending: "Send outcome needs checking",
  accepted: "Accepted by provider",
  failed: "Send failed",
  uncertain: "Send outcome uncertain",
};
export function EnquiryNotifications({
  workspace,
  resource,
  disabled,
  onBusyChange,
}: {
  workspace: string;
  resource: string;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [reply, setReply] = useState<Reply>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const live = useRef(true),
    pending = useRef(false);
  const anchorFocused = useRef(false);
  useEffect(() => {
    if (reply && !anchorFocused.current) anchorFocused.current = focusStoredRecord('notification-');
  }, [reply]);
  async function call(
    action = "notificationStatus",
    fields: Record<string, unknown> = {},
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const writing = action !== "notificationStatus",
        values = { action, workspace, resource, ...fields };
      const response = await apiFetch(
        "/_emdash/api/plugins/composer-stacks/" +
          (writing
            ? "enquiriesWrite"
            : "enquiriesRead?" +
              new URLSearchParams({ action, workspace, resource })),
        writing
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(values),
              signal: AbortSignal.timeout(20000),
            }
          : { cache: "no-store", signal: AbortSignal.timeout(20000) },
      );
      const raw = await parseApiResponse<unknown>(
        response,
        "Notification state could not be confirmed. Refresh before another action.",
      );
      const envelope = z
        .object({ ok: z.boolean(), message: z.string().optional() })
        .parse(raw);
      if (!envelope.ok)
        throw Error(envelope.message ?? "Notification request refused.");
      const next = replySchema.parse(raw);
      confirmWorkspace(workspace, next.workspace.id);
      if (next.resource !== resource)
        throw Error(
          "The server returned another visitor book’s notifications.",
        );
      if (live.current) setReply(next);
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Refresh the exact notification state before another action.",
        );
    } finally {
      pending.current = false;
      if (live.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  useEffect(() => {
    live.current = true;
    void call();
    return () => {
      live.current = false;
      onBusyChange(false);
    };
  }, []);
  const owner = reply?.workspace.role === "owner",
    locked = busy || disabled;
  return (
    <section
      className="ce-notifications"
      aria-labelledby="ce-notification-title"
      aria-busy={busy}
    >
      <h2 id="ce-notification-title">Owner notifications</h2>
      <p>
        Queue a separate notice when this visitor book receives a new enquiry.
        Sending requires an owner action. The brief stays in your Inbox if mail
        fails.
      </p>
      {error && (
        <p role="alert" className="ce-alert">
          {error}
        </p>
      )}
      <button disabled={locked} onClick={() => void call()}>
        Refresh notification status
      </button>
      {reply && (
        <>
          <p>
            <strong>
              {reply.preference.enabled
                ? "New notifications are queued"
                : "Notifications are off"}
            </strong>
            .{" "}
            {reply.connection.ready
              ? "The owner mail connection is configured."
              : "The owner mail connection is not enabled or configured."}
          </p>
          <p>
            Destination: {reply.connection.destination ?? "Not configured"}.
            Times use UTC. No digest, quiet hours or automatic sending is
            configured here.
          </p>
          {owner && (
            <button
              disabled={locked}
              onClick={() =>
                void call("notificationPreference", {
                  enabled: !reply.preference.enabled,
                  expectedRevision: reply.preference.revision,
                })
              }
            >
              {reply.preference.enabled
                ? "Pause new notifications"
                : "Queue notifications for new enquiries"}
            </button>
          )}
          {reply.items.length === 0 ? (
            <p>
              No notification records for this visitor book. Existing briefs are
              not mailed retroactively.
            </p>
          ) : (
            <ul aria-label="Latest 30 notification records">
              {reply.items.map((item) => (
                <li key={item.id} id={`notification-${item.id}`}>
                  <strong>{labels[item.state]}</strong>
                  <p>
                    {item.reason ||
                      "Waiting for an explicit owner send action."}
                  </p>
                  <p className="ce-muted">
                    {new Date(item.updated_at).toLocaleString("en-AU", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC · {item.attempts} of 3 attempts
                  </p>
                  {owner &&
                    reply.preference.enabled &&
                    ["queued", "blocked", "failed"].includes(item.state) &&
                    item.attempts < 3 && (
                      <button
                        disabled={locked}
                        onClick={() =>
                          void call("notificationSend", { operation: item.id })
                        }
                      >
                        {item.state === "queued"
                          ? "Send owner notification"
                          : "Try owner notification again"}
                      </button>
                    )}
                  {["sending", "uncertain"].includes(item.state) && (
                    <p>
                      The provider may already have received this message.
                      Sending again is held until its outcome can be reconciled.
                    </p>
                  )}
                  {item.state === "accepted" && (
                    <p>
                      Provider acceptance is recorded. Delivery to a recipient
                      server and reading have not been verified.
                    </p>
                  )}
                  <details>
                    <summary>Notification identity</summary>
                    <code>{item.id}</code>
                    {item.provider_id && (
                      <p>
                        Provider message: <code>{item.provider_id}</code>
                      </p>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
