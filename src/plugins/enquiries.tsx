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
  type EnquiryItem,
  type EnquirySummary,
} from "../lib/enquiry-protocol";
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
    [publication, setPublication] = useState(""),
    [summary, setSummary] = useState<EnquirySummary>(),
    [summaryError, setSummaryError] = useState("");
  const summaryGeneration = useRef(0);
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
    pending: busy,
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
    selected = resource,
    filter = status,
    selectedPage = page,
  ) {
    if (!workspace || !selected) return;
    const n = ++generation.current;
    const raw = await call("inbox", {
      workspace,
      resource: selected,
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
      reply.inbox.resource.id !== selected ||
      reply.inbox.resource.workspace_id !== reply.workspace.id ||
      reply.inbox.status !== filter ||
      reply.inbox.page !== selectedPage
    )
      throw Error("The app returned another inbox selection.");
    if (!live.current || n !== generation.current) return;
    setInbox(reply.inbox);
  }
  async function loadSummary(selected = resource) {
    if (!workspace || !selected) return;
    const n = ++summaryGeneration.current;
    setSummary(undefined);
    setSummaryError("");
    try {
      const raw = await call("summary", {
        workspace,
        resource: selected,
      });
      const reply = z
        .object({
          ok: z.literal(true),
          workspace: workspaceSchema,
          summary: enquirySummary,
        })
        .strict()
        .parse(raw);
      if (reply.summary.resource.id !== selected)
        throw Error("The app summarised another visitor book.");
      if (!live.current || n !== summaryGeneration.current) return;
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
      if (!live.current) return;
      retain(undefined);
      setMessage(
        "The app confirmed this private change. No notification or publication was sent.",
      );
      await loadInbox();
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
    if (!stack) return "Earlier Composer page";
    const instance = stack.instances.find((row) => row.id === group.instance);
    return `${stack.name} · ${instance?.label ?? "Earlier instance"}`;
  };
  return (
    <div className="ce-inbox" aria-busy={busy || (!options && !error)}>
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
          records. No email, reply or notification is sent.
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
      <section className="ce-controls" aria-label="Private inbox selection">
        <label>
          Visitor book
          <select
            value={resource}
            disabled={busy || Boolean(held)}
            onChange={(event) => {
              setResource(event.target.value);
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
            disabled={busy || Boolean(held)}
            onChange={(event) => {
              setStatus(event.target.value);
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
      {canRead && resource && (
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
                <div className="ce-summary-wrap">
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
                {summary.capped && (
                  <p className="ce-muted">
                    This summary covers the 200 retained briefs available in the
                    current export. Older retained briefs may sit outside that
                    cap.
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
        inbox.resource.id === resource &&
        inbox.status === status &&
        inbox.page === page && (
          <>
            <section className="ce-form-controls">
              <div>
                <h2>Open a private form</h2>
                <p>
                  Forms start closed. A Composer form belongs to one immutable
                  publication; publishing a new revision does not open it
                  automatically. The standalone resource form has its own
                  setting.
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
            </section>
            <div className="ce-heading">
              <h2>
                {status === "all"
                  ? "Retained briefs"
                  : status[0].toUpperCase() + status.slice(1) + " briefs"}
              </h2>
              <button
                disabled={busy || Boolean(held)}
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
              immediately. A zero here means no retained entry matches this page
              and filter.
            </p>
            {inbox.items.length === 0 ? (
              <p className="ce-empty">No retained briefs on this page.</p>
            ) : (
              <div className="ce-briefs">
                {inbox.items.map((item) => (
                  <Brief
                    key={item.id}
                    item={item}
                    busy={busy || Boolean(held)}
                    change={(action) =>
                      void run(() =>
                        mutate({
                          action,
                          item: item.id,
                          expectedRevision: item.revision,
                        }),
                      )
                    }
                  />
                ))}
              </div>
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
          </>
        )}
    </div>
  );
}
function Brief({
  item,
  busy,
  change,
}: {
  item: EnquiryItem;
  busy: boolean;
  change: (action: "review" | "reject" | "delete") => void;
}) {
  return (
    <article className="ce-brief">
      <div className="ce-brief-heading">
        <p className="ce-kicker">
          {item.status} · {date(item.created_at)}
        </p>
        <span>Expires {date(item.expires_at)}</span>
      </div>
      <h3>{item.values.title}</h3>
      <p className="ce-goal">{item.values.goal}</p>
      <dl>
        <dt>Starting point</dt>
        <dd>{item.values.starting_point}</dd>
        {item.values.existing_site && (
          <>
            <dt>Existing site</dt>
            <dd>{item.values.existing_site}</dd>
          </>
        )}
        <dt>Delivery scope</dt>
        <dd>
          {item.provenance.kind === "standalone"
            ? "Standalone resource"
            : `Composer publication ${item.provenance.publication} · instance ${item.provenance.instance.slice(0, 8)}`}
        </dd>
      </dl>
      {item.values.deliverables.length > 0 && (
        <ul>
          {item.values.deliverables.map((row, index) => (
            <li key={index}>
              <strong>{row.item}</strong>
              {row.detail && <p>{row.detail}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="ce-muted">
        Private delivery consent recorded {date(item.consent_at)}. No
        publication or contact permission.
      </p>
      <div className="ce-actions">
        <button
          disabled={busy || item.status === "reviewed"}
          onClick={() => change("review")}
        >
          Mark reviewed
        </button>
        <button
          disabled={busy || item.status === "rejected"}
          onClick={() => change("reject")}
        >
          Reject privately
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Delete this private brief now? Its submitted text will be cleared; the bounded receipt remains until expiry.",
              )
            )
              change("delete");
          }}
        >
          Delete brief
        </button>
      </div>
    </article>
  );
}
