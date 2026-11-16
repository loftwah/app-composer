import { useEffect, useRef, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import {
  deliveryLabels,
  enquiryLabels,
  journeyResponse,
  readJourneyPayload,
  replyLabels,
  replySubject,
  workflowLabels,
  type InboxJourney,
  type ManualExport,
  type ReplyView,
} from "../lib/inbox-journey-contract";
import { confirmWorkspace } from "./stacks/workspace-scope";
import { focusStoredRecord } from "./record-anchor";

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
  kind: "enquiry" | "workflow" | "delivery" | "reply";
  state: string;
  label: string;
}) {
  return (
    <span className="ce-chip" data-kind={kind} data-state={state}>
      {label}
    </span>
  );
}

type ReplyWrite =
  | {
      action: "replyDraft";
      expectedRevision: number;
      body: string;
      generator: "owner" | "agent";
      generatorId?: string;
    }
  | {
      action: "replyApprove";
      expectedRevision: number;
      expectedDigest: string;
    }
  | {
      action: "replyExport";
      expectedApproval: string;
      expectedDigest: string;
    }
  | {
      action: "replyDecline";
      expectedRevision: number;
    };

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ManualExportPanel({ exported }: { exported: ManualExport }) {
  const [notice, setNotice] = useState("");
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(label + " copied.");
    } catch {
      setNotice(
        "Copy was refused. Select the text below and copy it manually.",
      );
    }
  };
  return (
    <section
      className="ce-reply-receipt"
      aria-labelledby="ce-reply-receipt-title"
    >
      <div className="ce-stage-head">
        <h4 id="ce-reply-receipt-title">Manual export receipt</h4>
        <StateChip kind="reply" state="exported" label="Exported, not sent" />
      </div>
      <p>
        Composer did not send this reply. Copy the approved text and send it
        from your own mail client to the consented recipient, or keep the
        receipt as the record of this handoff.
      </p>
      <dl className="ce-facts compact">
        <div>
          <dt>Recipient</dt>
          <dd>
            {exported.recipient ??
              "Consent is no longer current. Do not send this reply; approve a current draft first."}
          </dd>
        </div>
        <div>
          <dt>Subject</dt>
          <dd>{exported.subject}</dd>
        </div>
        <div>
          <dt>Approved</dt>
          <dd>{bothZones(exported.approvedAt)}</dd>
        </div>
        <div>
          <dt>Exported</dt>
          <dd>{bothZones(exported.exportedAt)}</dd>
        </div>
        <div>
          <dt>Receipt</dt>
          <dd>
            <code className="ce-fingerprint">{exported.id}</code>
          </dd>
        </div>
      </dl>
      <pre className="ce-reply-exact" aria-label="Approved reply text">
        {exported.body}
      </pre>
      <div className="ce-actions">
        <button
          type="button"
          onClick={() =>
            void copy(exported.subject + "\n\n" + exported.body, "Reply text")
          }
        >
          Copy reply
        </button>
        <button
          type="button"
          onClick={() => void copy(exported.receipt, "Receipt")}
        >
          Copy receipt
        </button>
        <button
          type="button"
          className="ce-quiet"
          onClick={() =>
            downloadText(
              "reply-" + exported.id.slice(0, 8) + "-receipt.txt",
              exported.receipt,
            )
          }
        >
          Download receipt
        </button>
      </div>
      {notice && (
        <p role="status" className="ce-muted">
          {notice}
        </p>
      )}
      <details className="ce-details">
        <summary>Full receipt record</summary>
        <pre className="ce-reply-exact">{exported.receipt}</pre>
      </details>
    </section>
  );
}

function ReplyDetail({
  reply,
  exported,
  subject,
  busy,
  owner,
  editing,
  onDraft,
  onApprove,
  onExport,
  onDecline,
}: {
  reply: ReplyView;
  exported?: ManualExport;
  subject: string;
  busy: boolean;
  owner: boolean;
  editing: boolean;
  onDraft: (
    body: string,
    generator: "owner" | "agent",
    generatorId: string | undefined,
  ) => void;
  onApprove: (revision: number, digest: string) => void;
  onExport: (approval: string, digest: string) => void;
  onDecline: (revision: number) => void;
}) {
  const [body, setBody] = useState(reply.draft?.body ?? "");
  const [generator, setGenerator] = useState<"owner" | "agent">(
    reply.draft?.generator ?? "owner",
  );
  const [generatorId, setGeneratorId] = useState(
    reply.draft?.generatorId ?? "",
  );
  const [confirmed, setConfirmed] = useState(false);
  const revision = reply.draft?.revision ?? 0;
  useEffect(() => {
    setBody(reply.draft?.body ?? "");
    setGenerator(reply.draft?.generator ?? "owner");
    setGeneratorId(reply.draft?.generatorId ?? "");
    setConfirmed(false);
  }, [reply.state, revision, reply.draft?.digest]);
  const locked =
    busy || reply.state === "exported" || reply.state === "declined";
  const unsaved = reply.draft
    ? body !== reply.draft.body ||
      generator !== reply.draft.generator ||
      generatorId !== (reply.draft.generatorId ?? "")
    : body.trim().length > 0;
  const canSave =
    editing &&
    !locked &&
    body.trim().length > 0 &&
    body.length <= 4000 &&
    (generator === "owner" || generatorId.trim().length > 0) &&
    unsaved;
  const canApprove =
    owner &&
    !busy &&
    (reply.state === "draft" ||
      (reply.state === "invalidated" && reply.next.kind === "approve")) &&
    Boolean(reply.draft) &&
    !unsaved &&
    confirmed;
  const canExport = owner && !busy && reply.state === "approved";
  const canDecline =
    owner &&
    !busy &&
    ["draft", "approved", "invalidated"].includes(reply.state);
  const source = reply.source
    ? `brief revision ${reply.source.itemRevision} · ${reply.source.digest.slice(0, 12)}`
    : "not saved yet";
  return (
    <section className="ce-reply" aria-labelledby="ce-reply-title">
      <div className="ce-stage-head">
        <h3 id="ce-reply-title">Visitor reply</h3>
        <StateChip
          kind="reply"
          state={reply.state}
          label={replyLabels[reply.state]}
        />
      </div>
      <p>{reply.reason}</p>
      {reply.consent && (
        <dl className="ce-facts compact">
          <div>
            <dt>Reply consent</dt>
            <dd>
              Version {reply.consent.version} · consented{" "}
              {bothZones(reply.consent.consentedAt)}
            </dd>
          </div>
          <div>
            <dt>Consent expires</dt>
            <dd>{bothZones(reply.consent.expiresAt)}</dd>
          </div>
          <div>
            <dt>Recipient</dt>
            <dd>
              Consented address{" "}
              <code className="ce-fingerprint">
                {reply.consent.recipientFingerprint}
              </code>
            </dd>
          </div>
        </dl>
      )}
      {reply.eligible && (
        <>
          <label className="ce-reply-field">
            <span>Reply draft</span>
            <textarea
              value={body}
              maxLength={4000}
              rows={8}
              disabled={locked || !editing}
              onChange={(event) => {
                setBody(event.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <p className="ce-muted">
            {body.length} of 4000 characters. Plain text only; no HTML is
            rendered or sent. Saved drafts are bound to {source}.
          </p>
          <div className="ce-reply-source">
            <label>
              <span>Draft source</span>
              <select
                value={generator}
                disabled={locked || !editing}
                onChange={(event) => {
                  setGenerator(event.target.value as "owner" | "agent");
                  setConfirmed(false);
                }}
              >
                <option value="owner">Owner or editor (manual)</option>
                <option value="agent">Existing agent proposal</option>
              </select>
            </label>
            {generator === "agent" && (
              <label>
                <span>Agent identity</span>
                <input
                  type="text"
                  value={generatorId}
                  maxLength={80}
                  disabled={locked || !editing}
                  placeholder="e.g. workspace-agent/inbox-reply"
                  onChange={(event) => {
                    setGeneratorId(event.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
            )}
          </div>
          <div className="ce-actions">
            <button
              type="button"
              disabled={!canSave}
              onClick={() =>
                onDraft(
                  body,
                  generator,
                  generator === "agent" ? generatorId.trim() : undefined,
                )
              }
            >
              {reply.draft ? "Save draft revision" : "Save reply draft"}
            </button>
            {reply.draft && reply.state === "draft" && (
              <span className="ce-muted">
                Saved revision {reply.draft.revision} ·{" "}
                {reply.draft.digest.slice(0, 12)}
              </span>
            )}
          </div>
          {unsaved && reply.draft && (
            <p className="ce-muted">
              Unsaved changes are not part of the approved text. Save them to
              create a new revision, which requires approval again.
            </p>
          )}
        </>
      )}
      {reply.draft && (
        <div className="ce-reply-approval">
          <h4>
            {reply.state === "exported"
              ? "Exported approved text"
              : reply.state === "approved"
                ? "Approved text"
                : "Exact text for approval"}
          </h4>
          <p className="ce-muted">
            Manual subject: <strong>{subject}</strong>
          </p>
          <pre className="ce-reply-exact" aria-label="Saved reply text">
            {reply.draft.body}
          </pre>
          <p className="ce-muted">
            Draft revision {reply.draft.revision} · SHA-256{" "}
            <code className="ce-fingerprint">
              {reply.draft.digest.slice(0, 12)}
            </code>{" "}
            · source {source}
          </p>
          {(reply.state === "draft" ||
            (reply.state === "invalidated" &&
              reply.next.kind === "approve")) && (
            <>
              <label className="ce-reply-confirm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={busy || !owner || unsaved}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  I have read this exact text and approve this revision. I
                  understand Composer records a manual export and does not send
                  email.
                </span>
              </label>
              <div className="ce-actions">
                <button
                  type="button"
                  disabled={!canApprove}
                  onClick={() => {
                    if (reply.draft)
                      onApprove(reply.draft.revision, reply.draft.digest);
                  }}
                >
                  Approve this exact reply
                </button>
                {!owner && (
                  <span className="ce-muted">
                    Only the workspace owner can approve or export a reply.
                  </span>
                )}
              </div>
            </>
          )}
          {reply.state === "approved" && reply.approval && (
            <>
              <p className="ce-reply-warning">
                Approved by a workspace owner on{" "}
                {bothZones(reply.approval.approvedAt)}. This approval is valid
                until {bothZones(reply.approval.expiresAt)} and binds this exact
                text, brief revision, consent and recipient. No email has been
                sent.
              </p>
              <div className="ce-actions">
                <button
                  type="button"
                  disabled={!canExport}
                  onClick={() => {
                    if (reply.approval)
                      onExport(reply.approval.id, reply.draft?.digest ?? "");
                  }}
                >
                  Export approved reply for manual sending
                </button>
              </div>
              <p className="ce-muted">
                Exporting records a manual handoff and a receipt. Composer does
                not contact a provider and cannot claim the reply was sent.
              </p>
            </>
          )}
          {reply.state === "exported" && reply.receipt && (
            <>
              <p className="ce-reply-warning">
                Exported for manual sending on{" "}
                {bothZones(reply.receipt.exportedAt)}. Composer did not send
                this reply. The exact approved text is shown above; the receipt
                is retained with this brief.
              </p>
              {owner && !exported && reply.approval && (
                <div className="ce-actions">
                  <button
                    type="button"
                    className="ce-quiet"
                    disabled={busy}
                    onClick={() =>
                      onExport(
                        reply.approval?.id ?? reply.receipt?.id ?? "",
                        reply.draft?.digest ?? "",
                      )
                    }
                  >
                    Show manual export receipt
                  </button>
                </div>
              )}
            </>
          )}
          {canDecline && (
            <div className="ce-actions">
              <button
                type="button"
                className="ce-quiet"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Decline this reply? No message will be exported and the draft stays in the record.",
                    )
                  )
                    onDecline(reply.draft?.revision ?? revision);
                }}
              >
                Decline this reply
              </button>
            </div>
          )}
        </div>
      )}
      {exported && <ManualExportPanel exported={exported} />}
      {reply.timeline.length > 0 && (
        <div className="ce-reply-history">
          <h4>Reply timeline</h4>
          <ol className="ce-reply-timeline">
            {reply.timeline.map((event, index) => (
              <li key={index} data-kind={event.kind}>
                <strong>{event.kind}</strong>
                <span>{bothZones(event.at)}</span>
                <small>
                  Revision {event.draftRevision}
                  {event.digest ? " · " + event.digest : ""} ·{" "}
                  {event.actorId.slice(0, 8)}
                </small>
                {event.reason && <p>{event.reason}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {!reply.eligible && !reply.draft && (
        <p className="ce-muted">
          No reply action is offered for this brief. The no-contact enquiry
          still supports review, rejection, deletion, export and the separate
          owner notice.
        </p>
      )}
    </section>
  );
}

export function JourneyDetail({
  journey,
  busy,
  onAction,
  onEnquiryAction,
  onPreference,
  onRefresh,
  onReply,
}: {
  journey: InboxJourney;
  busy: boolean;
  onAction: (
    kind: "process" | "send" | "reconcile" | "relink" | "review",
  ) => void;
  onEnquiryAction: (action: "review" | "reject" | "delete") => void;
  onPreference: (enabled: boolean) => void;
  onRefresh: () => void;
  onReply: (payload: ReplyWrite) => void;
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
            <dt>Where it came from</dt>
            <dd>{scope}</dd>
          </div>
          <div>
            <dt>Brief text expires</dt>
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
                  "Delete this private brief now? The submitted text will be cleared immediately. The operation receipt remains until it expires.",
                )
              )
                onEnquiryAction("delete");
            }}
          >
            Delete brief
          </button>
        </div>
        <p className="ce-muted">
          The visitor agreed to private delivery on{" "}
          {shortDate(enquiry.createdAt)}. This does not grant permission to
          publish or contact them. Marking the brief reviewed records a
          decision; it does not send a notice, reply, make a sale or contact the
          visitor.
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
            No further action is available here. The brief remains in the
            app-owned Inbox, and no retry will run automatically.
          </p>
        )}
      </section>

      <ReplyDetail
        reply={journey.reply}
        exported={journey.manualExport}
        subject={replySubject(enquiry.title)}
        busy={busy}
        owner={owner}
        editing={editing}
        onDraft={(body, generator, generatorId) =>
          onReply({
            action: "replyDraft",
            expectedRevision: journey.reply.draft?.revision ?? 0,
            body,
            generator,
            ...(generatorId ? { generatorId } : {}),
          })
        }
        onApprove={(revision, digest) =>
          onReply({
            action: "replyApprove",
            expectedRevision: revision,
            expectedDigest: digest,
          })
        }
        onExport={(approval, digest) =>
          onReply({
            action: "replyExport",
            expectedApproval: approval,
            expectedDigest: digest,
          })
        }
        onDecline={(revision) =>
          onReply({ action: "replyDecline", expectedRevision: revision })
        }
      />

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
                <dt>Last status check</dt>
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
              <summary>Provider message ID</summary>
              <code>{delivery.providerReference}</code>
              <p>
                Provider acceptance does not confirm delivery to the recipient’s
                server, that the message was read, or a human response.
              </p>
            </details>
          )}
          {(delivery.state === "accepted" ||
            delivery.state === "uncertain" ||
            delivery.state === "attempted") && (
            <p className="ce-muted">
              {delivery.state === "accepted"
                ? "No resend is offered. A second send could deliver a duplicate."
                : "A resend is unavailable while the outcome is uncertain. Checking the saved status will not contact the provider or send the message again."}
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
    const status = journeyResponse(raw, writing);
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
      const next = readJourneyPayload(raw);
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

  async function act(action: "process" | "send" | "reconcile" | "relink") {
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
      const next = readJourneyPayload(raw);
      if (next.enquiry.id !== item)
        throw Error("The server returned another brief's journey.");
      setJourney(next);
      changed = true;
      setMessage(
        action === "process"
          ? "The event was processed. No provider was contacted."
          : action === "send"
            ? "The provider request finished. Check the recorded delivery state."
            : action === "relink"
              ? "The exact workflow link was restored. No provider was contacted."
              : "The saved status was checked. The provider was not contacted and nothing was sent.",
      );
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The action could not be confirmed. Refresh to check the saved status.",
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
  async function reply(payload: ReplyWrite) {
    if (pending.current) return;
    pending.current = true;
    setWorking(true);
    onBusyChange(true);
    setError("");
    setMessage("");
    try {
      const raw = await request("journeyWrite", true, {
        workspace,
        resource,
        item,
        ...payload,
      });
      if (!live.current) return;
      const next = readJourneyPayload(raw);
      if (next.enquiry.id !== item)
        throw Error("The server returned another brief's journey.");
      setJourney(next);
      setMessage(
        payload.action === "replyDraft"
          ? "The reply draft was saved. Nothing was sent."
          : payload.action === "replyApprove"
            ? "The exact reply revision was approved. No email was sent."
            : payload.action === "replyExport"
              ? next.manualExport?.idempotent
                ? "The existing manual export receipt was loaded. No second handoff was recorded."
                : "The manual export receipt was recorded. Composer did not send this reply."
              : "The reply was declined. Nothing was sent.",
      );
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The reply action could not be confirmed. Refresh to check the saved state.",
        );
    } finally {
      pending.current = false;
      if (live.current) {
        setWorking(false);
        onBusyChange(false);
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
      pending.current = false;
      await load();
      if (!live.current) return;
      setMessage(
        enabled
          ? "New enquiries will be queued for an owner notice. Sending stays separate."
          : "New enquiries will not be queued for an owner notice.",
      );
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
          onReply={(payload) => void reply(payload)}
        />
      )}
    </section>
  );
}
