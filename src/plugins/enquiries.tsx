import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { z } from "zod";
import {
  enquiryCommand,
  enquiryID,
  enquiryInbox,
  enquiryExport,
  enquirySummary,
  enquiryOperation,
  enquiryScope,
  type EnquiryScope,
  type EnquiryInbox,
  type EnquirySummary,
} from "../lib/enquiry-protocol";
import { enquiryLabels, enquiryState } from "../lib/inbox-journey-contract";
import { enquiriesLead } from "../lib/enquiries-lead";
import { InboxJourneyPanel } from "./inbox-journey-panel";
import { workspaceSelection, confirmWorkspace } from "./stacks/workspace-scope";
import { useNavigationGuard } from "./stacks/use-navigation-guard";
import "./enquiries.css";
const workspaceSchema = z
  .object({
    id: enquiryID,
    name: z.string().max(120),
    role: z.enum(["owner", "editor", "viewer"]),
  })
  .strict();
const optionSchema = z
  .object({
    ok: z.literal(true),
    workspace: workspaceSchema,
    resources: z
      .array(
        z
          .object({
            id: enquiryID,
            label: z.string().max(80),
            state: z.enum(["reserved", "ready", "unknown", "refused"]),
          })
          .strict(),
      )
      .max(32),
    stacks: z
      .array(
        z
          .object({
            id: enquiryID,
            slug: z.string().max(60),
            name: z.string().max(80),
            publication: z.number().int().positive(),
            instances: z
              .array(
                z
                  .object({
                    id: enquiryID,
                    label: z.string().max(80),
                    resource: enquiryID,
                    configuration: z.number().int().positive(),
                  })
                  .strict(),
              )
              .max(12),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
type Options = z.infer<typeof optionSchema>;
interface HeldOperation {
  resource: string;
  source: string;
  command: Record<string, unknown>;
  workspace: string;
  expectedScope?: EnquiryScope;
}
async function call(action: string, fields: Record<string, unknown>) {
  const write = ["configure", "review", "reject", "delete"].includes(action),
    values = { action, ...fields };
  const controller = new AbortController(),
    timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await apiFetch(
      "/_emdash/api/plugins/composer-stacks/" +
        (write
          ? "enquiriesWrite"
          : "enquiriesRead?" +
            new URLSearchParams(values as Record<string, string>)),
      write
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
            signal: controller.signal,
          }
        : { cache: "no-store", signal: controller.signal },
    );
    const raw = await parseApiResponse<unknown>(
      response,
      "The private enquiry request could not be confirmed.",
    );
    const envelope = z
      .object({
        ok: z.boolean(),
        workspace: workspaceSchema.optional(),
        message: z.string().optional(),
      })
      .parse(raw);
    if (!envelope.ok)
      throw Error(
        envelope.message ?? "The app did not confirm this private request.",
      );
    confirmWorkspace(
      typeof fields.workspace === "string" ? fields.workspace : undefined,
      envelope.workspace?.id,
    );
    return raw;
  } finally {
    clearTimeout(timeout);
  }
}
const date = (value: string) =>
  new Date(value.replace(" ", "T") + "Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
export function EnquiriesPage() {
  const search = useLocation({ select: (location) => location.searchStr });
  return <WorkspaceEnquiries key={search} search={search} />;
}
function WorkspaceEnquiries({ search }: { search: string }) {
  const [options, setOptions] = useState<Options>(),
    [resource, setResource] = useState(""),
    [status, setStatus] = useState("pending"),
    [page, setPage] = useState(1),
    [inbox, setInbox] = useState<EnquiryInbox>(),
    [selected, setSelected] = useState(""),
    [publication, setPublication] = useState(""),
    [summary, setSummary] = useState<EnquirySummary>(),
    [summaryError, setSummaryError] = useState("");
  const summaryGeneration = useRef(0);
  const resourceRef = useRef("");
  resourceRef.current = resource;
  const [detailBusy, setDetailBusy] = useState(false);
  const [checkedAbsent, setCheckedAbsent] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [held, setHeld] = useState<HeldOperation>();
  const pending = useRef(false),
    live = useRef(true),
    generation = useRef(0),
    heldRef = useRef<HeldOperation | undefined>(undefined);
  const workspace = options?.workspace.id;
  const storageKey = "composer.enquiry-operation/1:" + (workspace ?? "default");
  const retain = (value: HeldOperation | undefined) => {
    setCheckedAbsent(false);
    heldRef.current = value;
    setHeld(value);
    try {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* This mounted page retains the exact operation when tab storage is unavailable. */
    }
  };
  useNavigationGuard({
    changed: Boolean(held),
    pending: busy || detailBusy,
    onPending: () =>
      setError("Wait for this private app request before leaving."),
  });
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
    };
  }, []);
  async function run(task: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (cause) {
      if (live.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "The private inbox is unavailable.",
        );
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function loadOptions() {
    const requested = options?.workspace.id ?? workspaceSelection(search);
    const n = ++generation.current;
    const reply = optionSchema.parse(
      await call("list", requested ? { workspace: requested } : {}),
    );
    if (!live.current || n !== generation.current) return;
    setOptions(reply);
    setResource(
      (current) =>
        current ||
        (() => {
          const values = new URLSearchParams(search).getAll("resource");
          return values.length === 1 &&
            reply.resources.some(
              (row) => row.id === values[0] && row.state === "ready",
            )
            ? values[0]
            : "";
        })() ||
        reply.resources.find((row) => row.state === "ready")?.id ||
        "",
    );
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(
          "composer.enquiry-operation/1:" + reply.workspace.id,
        ) ?? "null",
      ) as unknown;
      const parsed = z
        .object({
          resource: enquiryID,
          source: z.string().regex(/^[a-f0-9]{40}$/),
          workspace: z.literal(reply.workspace.id),
          command: enquiryCommand,
          expectedScope: enquiryScope.optional(),
        })
        .strict()
        .safeParse(saved);
      if (parsed.success) {
        heldRef.current = parsed.data;
        setHeld(parsed.data);
        setResource(parsed.data.resource);
        setMessage(
          "An earlier private operation is uncertain. Check its receipt before another change.",
        );
      }
    } catch {
      /* No enquiry body is persisted in browser storage. */
    }
  }
  async function loadInbox(
    selectedResource = resource,
    filter = status,
    selectedPage = page,
  ) {
    if (!workspace || !selectedResource) return;
    const n = ++generation.current;
    const raw = await call("inbox", {
      workspace,
      resource: selectedResource,
      status: filter,
      page: String(selectedPage),
    });
    const reply = z
      .object({
        ok: z.literal(true),
        workspace: workspaceSchema,
        inbox: enquiryInbox,
      })
      .strict()
      .parse(raw);
    if (
      reply.inbox.resource.id !== selectedResource ||
      reply.inbox.resource.workspace_id !== reply.workspace.id ||
      reply.inbox.status !== filter ||
      reply.inbox.page !== selectedPage
    )
      throw Error("The app returned another inbox selection.");
    if (!live.current || n !== generation.current) return;
    setInbox(reply.inbox);
    setSelected((current) => {
      if (reply.inbox.items.some((item) => item.id === current)) return current;
      const requested = new URLSearchParams(search).getAll("item");
      const exact =
        requested.length === 1 &&
        reply.inbox.items.some((item) => item.id === requested[0])
          ? requested[0]
          : "";
      return exact || reply.inbox.items[0]?.id || "";
    });
  }
  async function loadSummary(selectedResource = resource) {
    if (!workspace || !selectedResource) return;
    const n = ++summaryGeneration.current;
    setSummary(undefined);
    setSummaryError("");
    try {
      const raw = await call("summary", {
        workspace,
        resource: selectedResource,
      });
      const reply = z
        .object({
          ok: z.literal(true),
          workspace: workspaceSchema,
          summary: enquirySummary,
        })
        .strict()
        .parse(raw);
      if (
        reply.summary.resource.id !== selectedResource ||
        reply.summary.resource.workspace_id !== workspace
      )
        throw Error("The app summarised another visitor book.");
      if (
        !live.current ||
        n !== summaryGeneration.current ||
        resourceRef.current !== selectedResource
      )
        return;
      setSummary(reply.summary);
      setSummaryError("");
    } catch (cause) {
      if (!live.current || n !== summaryGeneration.current) return;
      setSummary(undefined);
      setSummaryError(
        cause instanceof Error
          ? cause.message
          : "The page summary is unavailable. This is not a zero count.",
      );
    }
  }
  useEffect(() => {
    void run(loadOptions);
  }, []);
  useEffect(() => {
    if (options && resource && !heldRef.current) void loadSummary();
  }, [resource, options?.workspace.id]);
  useEffect(() => {
    if (options && resource && !heldRef.current) void run(() => loadInbox());
  }, [resource, status, page, options?.workspace.id]);
  async function mutate(command: Record<string, unknown>) {
    if (!inbox || !workspace || heldRef.current) return;
    const exact = enquiryCommand.parse({
      ...command,
      resource,
      workspace,
      operation: crypto.randomUUID(),
      expectedVersion: inbox.resource.version,
      source: inbox.source,
    });
    const expectedScope: EnquiryScope | undefined =
      exact.action === "configure"
        ? currentPublication
          ? {
              kind: "composer.publication",
              resource,
              configuration: currentPublication.item.configuration,
              stack: currentPublication.stack.id,
              publication: currentPublication.stack.publication,
              instance: currentPublication.item.id,
            }
          : {
              kind: "standalone",
              resource,
              configuration: inbox.resource.active_revision!,
            }
        : undefined;
    const hold: HeldOperation = {
      resource,
      workspace,
      source: inbox.source,
      command: exact,
      ...(expectedScope ? { expectedScope } : {}),
    };
    retain(hold);
    try {
      const raw = await call(
        String(exact.action),
        Object.fromEntries(
          Object.entries(exact).filter(([key]) => key !== "action"),
        ),
      );
      const reply = z
        .object({
          ok: z.literal(true),
          workspace: workspaceSchema,
          result: enquiryOperation,
        })
        .strict()
        .parse(raw);
      checkOperation(reply.result, hold);
      retain(undefined);
      if (!live.current) return;
      setMessage(
        "The app confirmed this private change. No notification or publication was sent.",
      );
      try {
        await loadInbox();
      } catch {
        setError(
          "The app confirmed this private change, but the inbox could not be refreshed. Refresh it before another change.",
        );
      }
      await loadSummary();
    } catch (cause) {
      throw Error(
        (cause instanceof Error
          ? cause.message
          : "The operation is uncertain.") +
          " Its exact operation is retained; check the receipt before another change.",
      );
    }
  }
  function checkOperation(
    result: z.infer<typeof enquiryOperation>,
    hold: HeldOperation,
  ) {
    const c = hold.command;
    if (
      result.operation !== c.operation ||
      result.source !== hold.source ||
      result.action !== c.action ||
      result.resource.id !== hold.resource ||
      result.resource.workspace !== hold.workspace ||
      result.resource.version !== Number(c.expectedVersion) + 1
    )
      throw Error("The receipt belongs to another exact operation.");
    if (
      c.action !== "configure" &&
      (!result.item ||
        result.item.id !== c.item ||
        result.item.revision !== Number(c.expectedRevision) + 1 ||
        result.item.status !==
          (c.action === "review"
            ? "reviewed"
            : c.action === "reject"
              ? "rejected"
              : "deleted"))
    )
      throw Error("The receipt names another private entry.");
    if (
      c.action === "configure" &&
      (!result.scope ||
        result.scope.enabled !== c.enabled ||
        result.scope.revision !== Number(c.expectedScopeRevision) + 1)
    )
      throw Error("The receipt names another form state.");
    if (
      c.action === "configure" &&
      JSON.stringify(result.scope?.provenance) !==
        JSON.stringify(hold.expectedScope)
    )
      throw Error("The receipt names another exact form scope.");
  }
  async function reconcile() {
    const hold = heldRef.current;
    if (!hold) return;
    const raw = await call("receipt", {
      workspace: hold.workspace,
      resource: hold.resource,
      operation: hold.command.operation,
    });
    const reply = z
      .object({
        ok: z.literal(true),
        workspace: workspaceSchema,
        receipt: z.discriminatedUnion("recorded", [
          z
            .object({ contract: z.literal(1), recorded: z.literal(false) })
            .strict(),
          z
            .object({
              contract: z.literal(1),
              recorded: z.literal(true),
              result: enquiryOperation,
            })
            .strict(),
        ]),
      })
      .strict()
      .parse(raw);
    if (!reply.receipt.recorded) {
      setCheckedAbsent(true);
      setMessage(
        "No receipt is currently available. This does not prove rollback. The operation stays retained; nothing was resubmitted.",
      );
      return;
    }
    checkOperation(reply.receipt.result, hold);
    if (!live.current) return;
    retain(undefined);
    setMessage("The exact app operation is confirmed. No retry was sent.");
    await loadInbox(hold.resource);
    await loadSummary(hold.resource);
  }
  async function retryExact() {
    const hold = heldRef.current;
    if (!hold || !checkedAbsent) return;
    setCheckedAbsent(false);
    const raw = await call(
      String(hold.command.action),
      Object.fromEntries(
        Object.entries(hold.command).filter(([key]) => key !== "action"),
      ),
    );
    const reply = z
      .object({
        ok: z.literal(true),
        workspace: workspaceSchema,
        result: enquiryOperation,
      })
      .strict()
      .parse(raw);
    checkOperation(reply.result, hold);
    if (!live.current) return;
    retain(undefined);
    setMessage(
      "The exact retained operation is confirmed. No new operation identity was allocated.",
    );
    await loadInbox(hold.resource);
    await loadSummary(hold.resource);
  }
  async function exportInbox() {
    if (!workspace || !resource) return;
    const raw = await call("export", { workspace, resource });
    const reply = z
      .object({
        ok: z.literal(true),
        workspace: workspaceSchema,
        export: enquiryExport,
      })
      .strict()
      .parse(raw);
    if (reply.export.resource.id !== resource)
      throw Error("The app exported another resource.");
    const blob = new Blob([JSON.stringify(reply.export, null, 2) + "\n"], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "private-enquiries-" + resource + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(
      "Downloaded this app-owned private inbox. Keep the file private; it contains submitted briefs.",
    );
  }
  const currentPublication = options?.stacks
    .flatMap((stack) =>
      stack.instances
        .filter((item) => item.resource === resource)
        .map((item) => ({ stack, item, key: stack.id + ":" + item.id })),
    )
    .find((item) => item.key === publication);
  const configuredScope = inbox?.scopes.find((scope) =>
    currentPublication
      ? scope.provenance.kind === "composer.publication" &&
        scope.provenance.resource === resource &&
        scope.provenance.stack === currentPublication.stack.id &&
        scope.provenance.publication === currentPublication.stack.publication &&
        scope.provenance.instance === currentPublication.item.id
      : scope.provenance.kind === "standalone" &&
        scope.provenance.resource === resource,
  );
  const selectedScope =
    configuredScope?.provenance.configuration ===
    (currentPublication?.item.configuration ?? inbox?.resource.active_revision)
      ? configuredScope
      : undefined;
  const canRead = options?.workspace.role !== "viewer",
    canConfigure = options?.workspace.role === "owner";
  const configure = (enabled: boolean) =>
    mutate({
      action: "configure",
      mode: currentPublication ? "publication" : "standalone",
      ...(currentPublication
        ? {
            stack: currentPublication.stack.id,
            instance: currentPublication.item.id,
            publication: currentPublication.stack.publication,
          }
        : { configuration: inbox?.resource.active_revision }),
      expectedScopeRevision: configuredScope?.revision ?? 0,
      enabled,
    });
  const pageLabel = (group: NonNullable<EnquirySummary>["groups"][number]) => {
    if (group.kind === "standalone") return "Standalone visitor book";
    const stack = options?.stacks.find((row) => row.id === group.stack);
    if (!stack) return "Other Composer page";
    const instance = stack.instances.find((row) => row.id === group.instance);
    return `${stack.name} · ${instance?.label ?? "Other instance"}`;
  };
  const readyBooks =
    options?.resources
      .filter((row) => row.state === "ready")
      .map((row) => ({ id: row.id, label: row.label })) ?? [];
  const selectedBook = readyBooks.find((row) => row.id === resource);
  const matchingInbox =
    inbox &&
    inbox.resource.id === resource &&
    inbox.status === status &&
    inbox.page === page
      ? inbox
      : undefined;
  const pendingCount = summary?.groups.reduce(
    (total, group) => total + group.pending,
    0,
  );
  const lead = enquiriesLead({
    ready: Boolean(options),
    role: options?.workspace.role,
    workspaceName: options?.workspace.name,
    environment: matchingInbox?.resource.environment,
    account: matchingInbox?.resource.account_id,
    readyBooks,
    selectedBook,
    status,
    inbox: matchingInbox
      ? {
          resourceId: matchingInbox.resource.id,
          status: matchingInbox.status,
          page: matchingInbox.page,
          items: matchingInbox.items.map((item) => ({
            id: item.id,
            title: item.values.title,
            status: item.status,
            createdAt: item.created_at,
          })),
        }
      : undefined,
    inboxReady: Boolean(matchingInbox),
    pendingCount,
    summaryReady: Boolean(summary),
  });
  const showPending = () => {
    setStatus("pending");
    setSelected("");
    setPage(1);
  };
  const leadTitle =
    lead.kind === "read-only"
      ? "Read-only workspace"
      : lead.kind === "setup"
        ? "Set up a private inbox"
        : lead.kind === "brief"
          ? lead.item.title
          : lead.kind === "pending-elsewhere"
            ? `${lead.book.label} has ${lead.count} pending brief${lead.count === 1 ? "" : "s"}`
            : lead.kind === "no-pending"
              ? `${lead.book.label} · no pending briefs`
              : lead.kind === "book"
                ? lead.book.label
                : "";
  return (
    <div
      className="ce-inbox"
      aria-busy={busy || detailBusy || (!options && !error)}
    >
      {(busy || (!options && !error)) && (
        <p role="status">Loading private app data…</p>
      )}
      <header>
        <p className="ce-kicker">
          PRIVATE WORKSPACE · {options?.workspace.name ?? "Loading"}
        </p>
        <h1>Enquiries</h1>
        <p>
          Read a brief, mark it reviewed, or remove it. Guestbook owns the
          records. Notifications are separate from review and start off. No
          reply is sent.
        </p>
        <p>
          Each retained brief now links to its owner-notice workflow and
          delivery state. Processing is explicit; reviewing a brief sends
          nothing.
        </p>
      </header>
      {error && (
        <p className="ce-alert" role="alert">
          {error}
          {!options && (
            <>
              <br />
              <button disabled={busy} onClick={() => void run(loadOptions)}>
                Retry visitor books
              </button>
            </>
          )}
        </p>
      )}
      {message && (
        <p role="status" className="ce-message">
          {message}
        </p>
      )}
      {held && (
        <section
          className="ce-retained"
          aria-label="Retained enquiry operation"
        >
          <h2>Check an uncertain change</h2>
          <p>
            The app may already have committed this operation. Its identity is
            retained in this tab without any submitted brief.
          </p>
          <code>{String(held.command.operation)}</code>
          <button disabled={busy} onClick={() => void run(reconcile)}>
            Check exact operation receipt
          </button>
          <button
            disabled={busy || !checkedAbsent}
            onClick={() => void run(retryExact)}
          >
            Retry exact retained change
          </button>
          <p>
            Retry uses the same operation, scope and revisions, only after a
            successful missing-receipt check. A source or scope change refuses
            replay.
          </p>
        </section>
      )}
      {options && lead.kind !== "loading" && (
        <section className="ce-lead" aria-labelledby="ce-lead-title">
          <p className="ce-lead-kicker">Next</p>
          <h2 id="ce-lead-title">{leadTitle}</h2>
          {lead.kind === "brief" ? (
            <>
              <p className="ce-lead-state">
                <span
                  className="ce-chip"
                  data-kind="enquiry"
                  data-state={enquiryState(lead.item.status)}
                >
                  {enquiryLabels[enquiryState(lead.item.status)]}
                </span>
                <span>{lead.book.label}</span>
              </p>
              <p className="ce-lead-facts">
                <span>
                  Visitor book <strong>{lead.book.label}</strong>
                </span>
                <span>
                  Latest pending{" "}
                  <time dateTime={lead.item.createdAt}>
                    {date(lead.item.createdAt)}
                  </time>
                </span>
              </p>
              <div className="ce-actions">
                <a className="ce-primary" href="#enquiry-review">
                  Open review
                </a>
              </div>
              <p>
                Reviewing is an explicit owner decision. Nothing is marked
                reviewed here; the full brief and workflow stay in the existing
                panel.
              </p>
            </>
          ) : lead.kind === "pending-elsewhere" ? (
            <>
              <p className="ce-lead-state">Pending briefs outside this view</p>
              <p className="ce-lead-facts">
                <span>
                  Visitor book <strong>{lead.book.label}</strong>
                </span>
                <span>
                  Pending <strong>{lead.count}</strong>
                </span>
              </p>
              <div className="ce-actions">
                <button
                  type="button"
                  className="ce-primary"
                  disabled={busy || detailBusy || Boolean(held)}
                  onClick={showPending}
                >
                  Show pending briefs
                </button>
              </div>
              <p>
                The current filter does not list them. Show pending uses the
                existing inbox filter and sends nothing.
              </p>
            </>
          ) : lead.kind === "no-pending" ? (
            <>
              <p className="ce-lead-state">
                {lead.summaryKnown
                  ? "Pending 0"
                  : "No pending result in this view"}
              </p>
              <p className="ce-lead-facts">
                <span>
                  Visitor book <strong>{lead.book.label}</strong>
                </span>
              </p>
              <p>
                Composer does not mark anything reviewed automatically. New
                briefs appear when the app retains them.
              </p>
            </>
          ) : lead.kind === "setup" ? (
            <>
              <p className="ce-lead-state">No ready visitor book</p>
              <p>
                Create a Creator stack, add Here / there, then apply its
                resource before opening a form.
              </p>
              <div className="ce-actions">
                <a
                  className="ce-primary"
                  href="/_emdash/admin/plugins/composer-stacks/stacks"
                >
                  Open Creator stacks
                </a>
              </div>
            </>
          ) : lead.kind === "read-only" ? (
            <>
              <p className="ce-lead-state">Owner or editor required</p>
              <p>
                This workspace grants read-only stack access. Private submitted
                briefs require an owner or editor membership.
              </p>
            </>
          ) : (
            <>
              <p className="ce-lead-state">Private inbox</p>
              <p className="ce-lead-facts">
                <span>
                  Visitor book <strong>{lead.book.label}</strong>
                </span>
              </p>
              {status !== "pending" && (
                <div className="ce-actions">
                  <button
                    type="button"
                    className="ce-primary"
                    disabled={busy || detailBusy || Boolean(held)}
                    onClick={showPending}
                  >
                    Show pending briefs
                  </button>
                </div>
              )}
              <p>
                {status === "pending"
                  ? "Checking the selected visitor book for its latest pending brief."
                  : "Choose Pending to open the latest retained brief. The selection below keeps the existing filters and page size."}
              </p>
            </>
          )}
          <p className="ce-lead-meta">
            Workspace <strong>{options.workspace.name}</strong> ·{" "}
            {options.workspace.role} ·{" "}
            <strong>
              {matchingInbox?.resource.environment ??
                (resource ? "Environment loading" : "No visitor book selected")}
            </strong>
            {matchingInbox && (
              <>
                {" "}
                · Account <code>{matchingInbox.resource.account_id}</code>
              </>
            )}
          </p>
        </section>
      )}
      <section className="ce-controls" aria-label="Private inbox selection">
        <label>
          Visitor book
          <select
            value={resource}
            disabled={busy || detailBusy || Boolean(held)}
            onChange={(event) => {
              summaryGeneration.current++;
              setResource(event.target.value);
              setSelected("");
              setPublication("");
              setInbox(undefined);
              setSummary(undefined);
              setSummaryError("");
              setPage(1);
            }}
          >
            <option value="">Choose a visitor book</option>
            {options?.resources.map((row) => (
              <option
                key={row.id}
                value={row.id}
                disabled={row.state !== "ready"}
              >
                {row.label} · {row.id.slice(0, 8)}
                {row.state !== "ready" ? " · " + row.state : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review state
          <select
            value={status}
            disabled={busy || detailBusy || Boolean(held)}
            onChange={(event) => {
              setStatus(event.target.value);
              setSelected("");
              setPage(1);
            }}
          >
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="rejected">Rejected</option>
            <option value="all">All retained</option>
          </select>
        </label>
        <button
          disabled={busy || !resource || !canRead}
          onClick={() =>
            void run(async () => {
              await loadOptions();
              await loadInbox();
              await loadSummary();
            })
          }
        >
          Refresh inbox
        </button>
      </section>
      {options && options.resources.length === 0 && !busy && (
        <p>
          No app-owned visitor book is ready here. Create a Creator stack, add
          Here / there, then apply its resource before opening a form.
        </p>
      )}
      {options && !canRead && (
        <p>
          This workspace grants read-only stack access. Private submitted briefs
          require an owner or editor membership.
        </p>
      )}
      {inbox &&
        canRead &&
        workspace &&
        inbox.resource.id === resource &&
        inbox.status === status &&
        inbox.page === page && (
          <div className="ce-inbox-layout">
            <section className="ce-list" aria-labelledby="ce-list-title">
              <div className="ce-heading">
                <h2 id="ce-list-title">
                  {status === "all"
                    ? "Retained briefs"
                    : status[0].toUpperCase() + status.slice(1) + " briefs"}
                </h2>
                <button
                  disabled={busy || detailBusy || Boolean(held)}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Download this visitor book’s retained private briefs? Keep the resulting file private.",
                      )
                    )
                      void run(exportInbox);
                  }}
                >
                  Export private inbox
                </button>
              </div>
              <p className="ce-muted">
                Bodies expire after 30 days; minimal delivery and operation
                receipts remain for 35 days. Deleted briefs are cleared
                immediately. Choose a brief to read it and see its workflow and
                delivery state.
              </p>
              {inbox.items.length === 0 ? (
                <p className="ce-empty">No retained briefs on this page.</p>
              ) : (
                <ul className="ce-rows" aria-label="Retained briefs">
                  {inbox.items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="ce-row"
                        aria-current={selected === item.id ? "true" : undefined}
                        disabled={busy || Boolean(held)}
                        onClick={() => setSelected(item.id)}
                      >
                        <span className="ce-row-title">
                          {item.values.title}
                        </span>
                        <span className="ce-row-meta">
                          <span
                            className="ce-chip"
                            data-kind="enquiry"
                            data-state={enquiryState(item.status)}
                          >
                            {enquiryLabels[enquiryState(item.status)]}
                          </span>
                          <span>{date(item.created_at)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <nav className="ce-pages" aria-label="Enquiry inbox pages">
                <button
                  disabled={busy || Boolean(held) || page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>Page {page} · up to 20 briefs</span>
                <button
                  disabled={
                    busy ||
                    Boolean(held) ||
                    page === 10 ||
                    inbox.items.length < 20
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            </section>
            <div className="ce-detail-slot" id="enquiry-review">
              {selected ? (
                <InboxJourneyPanel
                  key={selected + ":" + inbox.resource.version}
                  workspace={workspace}
                  resource={resource}
                  item={selected}
                  busy={busy || Boolean(held)}
                  onBusyChange={setDetailBusy}
                  onEnquiryAction={async (action, revision) => {
                    await run(() =>
                      mutate({
                        action,
                        item: selected,
                        expectedRevision: revision,
                      }),
                    );
                  }}
                  onChanged={() => {
                    void run(async () => {
                      await loadInbox();
                      await loadSummary();
                    });
                  }}
                />
              ) : (
                <p className="ce-empty">
                  Choose a brief to read it and see its workflow and delivery
                  state.
                </p>
              )}
            </div>
          </div>
        )}
      {canRead && resource && !held && (
        <section className="ce-summary" aria-labelledby="ce-summary-title">
          <h2 id="ce-summary-title">Enquiries by page</h2>
          <p>
            Counts of retained briefs for this visitor book, grouped by the
            published page or standalone scope that delivered them. Reviewed
            means an owner marked the brief; it is not a sale, contact or
            conversion.
          </p>
          {summaryError ? (
            <p className="ce-alert" role="alert">
              {summaryError}
            </p>
          ) : summary ? (
            summary.groups.length > 0 ? (
              <>
                <div
                  className="ce-summary-wrap"
                  role="region"
                  aria-label="Enquiries by page table"
                  tabIndex={0}
                >
                  <table>
                    <caption>
                      {summary.total} retained brief
                      {summary.total === 1 ? "" : "s"} · bodies expire after 30
                      days
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Page</th>
                        <th scope="col">Reviewed</th>
                        <th scope="col">Pending</th>
                        <th scope="col">Rejected</th>
                        <th scope="col">Total</th>
                        <th scope="col">Latest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.groups.map((group) => (
                        <tr
                          key={[
                            group.kind,
                            group.stack,
                            group.publication,
                            group.instance,
                          ].join(":")}
                        >
                          <th scope="row">
                            {pageLabel(group)}
                            {group.publication !== null && (
                              <small>
                                Published revision {group.publication}
                              </small>
                            )}
                          </th>
                          <td>{group.reviewed}</td>
                          <td>{group.pending}</td>
                          <td>{group.rejected}</td>
                          <td>{group.total}</td>
                          <td>
                            {group.latest ? date(group.latest) : "Unavailable"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {summary.atExportLimit && (
                  <p className="ce-muted">
                    This export reached Composer's 200-record acceptance limit.
                    Older retained briefs may sit outside it; this is not a
                    claim that the app has no further records.
                  </p>
                )}
              </>
            ) : (
              <p className="ce-empty">
                No retained briefs belong to this visitor book.
              </p>
            )
          ) : (
            <p role="status">Loading page summary…</p>
          )}
        </section>
      )}
      {inbox &&
        canRead &&
        workspace &&
        inbox.resource.id === resource &&
        inbox.status === status &&
        inbox.page === page && (
          <details className="ce-form-controls">
            <summary>Visitor book form</summary>
            <div>
              <h2>Open a private form</h2>
              <p>
                Forms start closed. A Composer form belongs to one immutable
                publication; publishing a new revision does not open it
                automatically. The standalone resource form has its own setting.
              </p>
            </div>
            <label>
              Form scope
              <select
                value={publication}
                disabled={busy || Boolean(held) || !canConfigure}
                onChange={(event) => setPublication(event.target.value)}
              >
                <option value="">Standalone resource form</option>
                {options?.stacks.flatMap((stack) =>
                  stack.instances
                    .filter((item) => item.resource === resource)
                    .map((item) => (
                      <option
                        key={stack.id + ":" + item.id}
                        value={stack.id + ":" + item.id}
                      >
                        {stack.name} · {item.label} · published{" "}
                        {stack.publication}
                      </option>
                    )),
                )}
              </select>
            </label>
            <p>
              <strong>
                {selectedScope?.enabled
                  ? "Enabled in the app"
                  : "Closed in the app"}
              </strong>
              . Current publication and source privacy controls still apply.
            </p>
            <div className="ce-actions">
              <button
                disabled={busy || Boolean(held) || !canConfigure}
                onClick={() => void run(() => configure(true))}
              >
                Enable this form
              </button>
              <button
                disabled={
                  busy || Boolean(held) || !canConfigure || !selectedScope
                }
                onClick={() => void run(() => configure(false))}
              >
                Close this form
              </button>
              {selectedScope?.enabled && (
                <a
                  href={
                    currentPublication
                      ? `/s/${currentPublication.stack.slug}/enquiry/${currentPublication.item.id}`
                      : `/guestbook/r/${resource}/c/${selectedScope.provenance.configuration}/enquiry`
                  }
                  target="_blank"
                  rel="noopener"
                >
                  Open form
                </a>
              )}
            </div>
            {!canConfigure && (
              <p>
                Only the workspace owner can open or close forms. Editors can
                review private briefs.
              </p>
            )}
          </details>
        )}
    </div>
  );
}
