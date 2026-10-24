import { useEffect, useRef, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { z } from "zod";
import {
  deliveryLabels,
  enquiryLabels,
  inboxJourney,
  workflowLabels,
  type InboxJourney,
} from "../lib/inbox-journey-contract";
import { confirmWorkspace } from "./stacks/workspace-scope";
import { focusStoredRecord } from "./record-anchor";

const envelope = z
  .object({ ok: z.boolean(), message: z.string().optional() })
  .strict();

function instant(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(value)) return null;
  const normalised = value.endsWith("Z")
    ? value
    : value.replace(" ", "T") + "Z";
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}
function stamp(value: string | null, zone: "UTC" | "Australia/Melbourne") {
  if (!value) return "Not recorded";
  const date = instant(value);
  if (!date) return value;
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}/${part("month")}/${part("day")} ${part("hour")}:${part("minute")} ${part("timeZoneName")}`;
}
const bothZones = (value: string | null) =>
  `${stamp(value, "UTC")} · ${stamp(value, "Australia/Melbourne")}`;
const shortDate = (value: string) => {
  const date = instant(value);
  return date
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date)
    : value;
};

function StateChip({
  kind,
  state,
  label,
}: {
  kind: "enquiry" | "workflow" | "delivery";
  state: string;
  label: string;
}) {
  return (
    <span className="ce-chip" data-kind={kind} data-state={state}>
      {label}
    </span>
  );
}

export function JourneyDetail({
  journey,
  busy,
  onAction,
  onEnquiryAction,
  onPreference,
  onRefresh,
}: {
  journey: InboxJourney;
  busy: boolean;
  onAction: (kind: "process" | "send" | "reconcile" | "review") => void;
  onEnquiryAction: (action: "review" | "reject" | "delete") => void;
  onPreference: (enabled: boolean) => void;
  onRefresh: () => void;
}) {
  const { enquiry, workflow, delivery, next, notificationPreference } = journey;
  const owner = journey.workspace.role === "owner";
  const editing = journey.workspace.role !== "viewer";
  const primary = next.kind === "none" ? null : next.kind;
  const scope =
    enquiry.provenance.kind === "standalone"
      ? "Standalone visitor book"
      : `Composer publication ${enquiry.provenance.publication} · page ${enquiry.provenance.instance.slice(0, 8)}`;
  return (
    <article
      className="ce-journey"
      aria-labelledby="ce-journey-title"
      aria-busy={busy}
    >
      <header className="ce-journey-head">
        <p className="ce-kicker">
          Private brief · received {bothZones(enquiry.createdAt)}
        </p>
        <div className="ce-journey-heading">
          <h2 id="ce-journey-title">{enquiry.title}</h2>
          <StateChip
            kind="enquiry"
            state={enquiry.status}
            label={enquiryLabels[enquiry.status]}
          />
        </div>
        <p className="ce-goal">{enquiry.goal}</p>
        <dl className="ce-facts">
          <div>
            <dt>Starting point</dt>
            <dd>{enquiry.startingPoint}</dd>
          </div>
          {enquiry.existingSite && (
            <div>
              <dt>Existing site</dt>
              <dd>{enquiry.existingSite}</dd>
            </div>
          )}
          <div>
            <dt>Delivery scope</dt>
            <dd>{scope}</dd>
          </div>
          <div>
            <dt>Bodies expire</dt>
            <dd>{bothZones(enquiry.expiresAt)}</dd>
          </div>
        </dl>
        {enquiry.deliverables.length > 0 && (
          <ul className="ce-deliverables">
            {enquiry.deliverables.map((row, index) => (
              <li key={index}>
                <strong>{row.item}</strong>
                {row.detail && <span>{row.detail}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="ce-actions">
          <button
            type="button"
            disabled={busy || !editing || enquiry.status !== "new"}
            onClick={() => onEnquiryAction("review")}
          >
            Mark reviewed
          </button>
          <button
            type="button"
            disabled={busy || !editing || enquiry.status === "rejected"}
            onClick={() => onEnquiryAction("reject")}
          >
            Reject privately
          </button>
          <button
            type="button"
            disabled={busy || !editing}
            onClick={() => {
              if (
                window.confirm(
                  "Delete this private brief now? Its submitted text will be cleared; the bounded receipt remains until expiry.",
                )
              )
                onEnquiryAction("delete");
            }}
          >
            Delete brief
          </button>
        </div>
        <p className="ce-muted">
          Private delivery consent recorded {shortDate(enquiry.createdAt)}. No
          publication or contact permission. Reviewed is an owner decision; it
          is not a reply, sale or contact and it does not send the owner notice.
        </p>
      </header>

      <ol className="ce-flow" aria-label="Enquiry journey state">
        <li data-state={enquiry.status}>
          <span>Brief</span>
          <strong>{enquiryLabels[enquiry.status]}</strong>
          <small>Guestbook owns this record</small>
        </li>
        <li data-state={workflow.state}>
          <span>Workflow</span>
          <strong>{workflowLabels[workflow.state]}</strong>
          <small>
            {workflow.attempts} of {workflow.maxAttempts} attempts
          </small>
        </li>
        <li data-state={delivery.state}>
          <span>Delivery</span>
          <strong>{deliveryLabels[delivery.state]}</strong>
          <small>
            {delivery.attempts} of {delivery.maxAttempts} attempts
          </small>
        </li>
      </ol>

      <section
        className="ce-next"
        data-kind={next.kind}
        aria-labelledby="ce-next-title"
      >
        <p className="ce-kicker">Next action</p>
        <h3 id="ce-next-title">{next.label}</h3>
        <p>{next.detail}</p>
        {primary && (
          <>
            <button
              type="button"
              disabled={busy || !next.enabled}
              onClick={() => onAction(primary)}
            >
              {next.label}
            </button>
            {!next.enabled && (
              <p className="ce-muted">
                {next.actor === "owner"
                  ? "Only the workspace owner can do this."
                  : "Owner or editor access is required."}
              </p>
            )}
          </>
        )}
        {!primary && (
          <p className="ce-muted">
            This is an explicit stop, not a hidden retry. The brief remains in
            the app-owned Inbox.
          </p>
        )}
      </section>

      <div className="ce-journey-grid">
        <section className="ce-stage" aria-labelledby="ce-workflow-title">
          <div className="ce-stage-head">
            <h3 id="ce-workflow-title">Workflow</h3>
            <StateChip
              kind="workflow"
              state={workflow.state}
              label={workflowLabels[workflow.state]}
            />
          </div>
          <p>{workflow.reason}</p>
          <dl className="ce-facts compact">
            <div>
              <dt>Attempts</dt>
              <dd>
                {workflow.attempts} of {workflow.maxAttempts}
              </dd>
            </div>
            <div>
              <dt>Recorded by</dt>
              <dd>
                {workflow.actor
                  ? workflow.actor.kind === "system"
                    ? "Receipt hook"
                    : "Workspace member"
                  : "No record"}
              </dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{bothZones(workflow.updatedAt)}</dd>
            </div>
          </dl>
        </section>

        <section
          className="ce-stage"
          id={
            workflow.outboxId ? "notification-" + workflow.outboxId : undefined
          }
          aria-labelledby="ce-delivery-title"
        >
          <div className="ce-stage-head">
            <h3 id="ce-delivery-title">Delivery</h3>
            <StateChip
              kind="delivery"
              state={delivery.state}
              label={deliveryLabels[delivery.state]}
            />
          </div>
          <p>{delivery.reason}</p>
          <dl className="ce-facts compact">
            <div>
              <dt>Owner mail</dt>
              <dd>
                {delivery.destination.configured &&
                notificationPreference.enabled
                  ? "Server connection present"
                  : "Not enabled or configured"}
              </dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>
                {delivery.destination.verified
                  ? "Verified owner identity"
                  : delivery.destination.configured &&
                      notificationPreference.enabled
                    ? "Configured, not verified for this owner"
                    : "Not configured"}
                {delivery.destination.fingerprint && (
                  <>
                    {" "}
                    <code className="ce-fingerprint">
                      {delivery.destination.fingerprint}
                    </code>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Attempts</dt>
              <dd>
                {delivery.attempts} of {delivery.maxAttempts}
              </dd>
            </div>
            {delivery.reconciledAt && (
              <div>
                <dt>Last reconciliation</dt>
                <dd>{bothZones(delivery.reconciledAt)}</dd>
              </div>
            )}
          </dl>
          <p className="ce-muted">
            Times use UTC in storage; this detail also shows
            Australia/Melbourne. No digest, quiet hours or automatic sending is
            configured here.
          </p>
          {delivery.providerReference && (
            <details className="ce-details">
              <summary>Provider message identity</summary>
              <code>{delivery.providerReference}</code>
              <p>
                Acceptance is not delivery to a recipient server, reading or a
                human confirmation.
              </p>
            </details>
          )}
          {(delivery.state === "accepted" ||
            delivery.state === "uncertain" ||
            delivery.state === "attempted") && (
            <p className="ce-muted">
              {delivery.state === "accepted"
                ? "No resend is offered. A second send could deliver a duplicate."
                : "A resend is not offered until this outcome can be reconciled. Reconciliation never sends."}
            </p>
          )}
          <div className="ce-actions">
            {owner && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPreference(!notificationPreference.enabled)}
              >
                {notificationPreference.enabled
                  ? "Pause new notifications"
                  : "Queue notifications for new enquiries"}
              </button>
            )}
            <button
              type="button"
              className="ce-quiet"
              disabled={busy}
              onClick={onRefresh}
            >
              Refresh journey
            </button>
          </div>
          <p className="ce-muted">
            Owner mail is host-managed. This page never shows the recipient
            address, sender, provider key or a test send.
          </p>
        </section>
      </div>
    </article>
  );
}

export function InboxJourneyPanel({
  workspace,
  resource,
  item,
  busy,
  onBusyChange,
  onEnquiryAction,
  onChanged,
}: {
  workspace: string;
  resource: string;
  item: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onEnquiryAction: (
    action: "review" | "reject" | "delete",
    revision: number,
  ) => Promise<void>;
  onChanged: () => void;
}) {
  const [journey, setJourney] = useState<InboxJourney>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const live = useRef(true);
  const pending = useRef(false);
  const generation = useRef(0);
  const anchorFocused = useRef(false);
  useEffect(() => {
    if (journey && !anchorFocused.current)
      anchorFocused.current = focusStoredRecord("notification-");
  }, [journey]);

  async function request(
    path: string,
    writing: boolean,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
  ) {
    const response = await apiFetch(
      "/_emdash/api/plugins/composer-stacks/" +
        (writing ? path : path + "?" + new URLSearchParams(query ?? {})),
      writing
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(20000),
          }
        : { cache: "no-store", signal: AbortSignal.timeout(20000) },
    );
    const raw = await parseApiResponse<unknown>(
      response,
      "The enquiry journey could not be confirmed. Refresh before another action.",
    );
    const status = envelope.parse(raw);
    if (!status.ok)
      throw Error(status.message ?? "The enquiry journey request was refused.");
    return raw;
  }
  async function load() {
    if (pending.current) return;
    const epoch = ++generation.current;
    pending.current = true;
    setWorking(true);
    onBusyChange(true);
    setError("");
    try {
      const raw = await request("journeyRead", false, undefined, {
        action: "journey",
        workspace,
        resource,
        item,
      });
      if (!live.current || epoch !== generation.current) return;
      const next = inboxJourney.parse(raw);
      confirmWorkspace(workspace, next.workspace.id);
      if (next.enquiry.id !== item)
        throw Error("The server returned another brief's journey.");
      setJourney(next);
      setMessage("");
    } catch (cause) {
      if (live.current && epoch === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The enquiry journey is unavailable. Refresh before another action.",
        );
    } finally {
      pending.current = false;
      if (live.current && epoch === generation.current) {
        setWorking(false);
        onBusyChange(false);
      }
    }
  }
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      generation.current++;
      onBusyChange(false);
    };
  }, [workspace, resource, item]);

  async function act(action: "process" | "send" | "reconcile") {
    if (pending.current) return;
    pending.current = true;
    setWorking(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    let changed = false;
    try {
      const raw = await request("journeyWrite", true, {
        action,
        workspace,
        resource,
        item,
      });
      if (!live.current) return;
      const next = inboxJourney.parse(raw);
      if (next.enquiry.id !== item)
        throw Error("The server returned another brief's journey.");
      setJourney(next);
      changed = true;
      setMessage(
        action === "process"
          ? "The event was processed. No provider was contacted."
          : action === "send"
            ? "The provider request finished. Check the recorded delivery state."
            : "The recorded state was re-read. Nothing was sent.",
      );
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The action could not be confirmed. Refresh its exact state.",
        );
    } finally {
      pending.current = false;
      if (live.current) {
        setWorking(false);
        onBusyChange(false);
        if (changed) onChanged();
      }
    }
  }
  async function preference(enabled: boolean) {
    if (!journey || pending.current) return;
    pending.current = true;
    setWorking(true);
    onBusyChange(true);
    setError("");
    try {
      await request("enquiriesWrite", true, {
        action: "notificationPreference",
        workspace,
        resource,
        enabled,
        expectedRevision: journey.notificationPreference.revision,
      });
      if (!live.current) return;
      setMessage(
        enabled
          ? "New enquiries will be queued for an owner notice. Sending stays separate."
          : "New enquiries will not be queued for an owner notice.",
      );
      pending.current = false;
      await load();
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The notification preference could not be confirmed.",
        );
    } finally {
      pending.current = false;
      if (live.current) {
        setWorking(false);
        onBusyChange(false);
      }
    }
  }
  async function enquire(action: "review" | "reject" | "delete") {
    if (!journey || pending.current) return;
    setError("");
    try {
      await onEnquiryAction(action, journey.enquiry.revision);
      if (live.current) await load();
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The private brief change could not be confirmed.",
        );
    }
  }
  const locked = busy || working;
  return (
    <section className="ce-detail" aria-label="Selected enquiry journey">
      {error && (
        <p className="ce-alert" role="alert">
          {error}
          <br />
          <button type="button" disabled={locked} onClick={() => void load()}>
            Refresh journey
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="ce-message">
          {message}
        </p>
      )}
      {!journey && !error && <p role="status">Loading the enquiry journey…</p>}
      {journey && (
        <JourneyDetail
          journey={journey}
          busy={locked}
          onAction={(kind) =>
            kind === "review" ? void enquire("review") : void act(kind)
          }
          onEnquiryAction={(action) => void enquire(action)}
          onPreference={(enabled) => void preference(enabled)}
          onRefresh={() => void load()}
        />
      )}
    </section>
  );
}
