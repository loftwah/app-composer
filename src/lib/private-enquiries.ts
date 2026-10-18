import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { isCreatorRole } from "./creator-access.ts";
import {
  resolveWorkspace,
  membership,
  requireCapability,
  publicStack,
  StackError,
} from "./stacks.mjs";
import { resourceConnection, type ResourceRuntime } from "./resource-client.ts";
import {
  enquiryCommand,
  enquiryID,
  enquiryIntent,
  enquiryInbox,
  enquiryExport,
  enquiryOperation,
  type EnquiryScope,
} from "./enquiry-protocol.ts";

export interface EnquiryRuntime extends ResourceRuntime {
  DB?: D1Database;
}
interface User {
  id: string;
  role: number;
  name?: string | null;
  email?: string;
}
interface Context {
  user?: User;
  request: Request;
  input: unknown;
}
interface ResourceRow {
  id: string;
  workspace_id: string;
  account_id: string;
  environment: string;
  target: string;
  configuration_revision: number | null;
  configuration_json: string | null;
  state: string;
}
interface PublicationRow {
  id: string;
  workspace_id: string;
  slug: string;
  published_revision: number;
  document_json: string;
}
const origin = "https://composer.loftwah.com";
const common = { workspace: enquiryID.optional() };
const readInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), ...common }).strict(),
  z
    .object({
      action: z.literal("inbox"),
      ...common,
      resource: enquiryID,
      status: z.enum(["pending", "reviewed", "rejected", "all"]).optional(),
      page: z
        .enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"])
        .optional(),
    })
    .strict(),
  z
    .object({ action: z.literal("export"), ...common, resource: enquiryID })
    .strict(),
  z
    .object({
      action: z.literal("receipt"),
      ...common,
      resource: enquiryID,
      operation: enquiryIntent,
    })
    .strict(),
]);
const writeInput = enquiryCommand;
const resourceInfo = (
  resource: ResourceRow,
  connection: ReturnType<typeof resourceConnection>,
  workspace: string,
) => {
  if (
    resource.workspace_id !== workspace ||
    resource.account_id !== connection.account ||
    resource.environment !== connection.environment ||
    resource.target !== connection.target ||
    resource.state !== "ready"
  )
    throw new StackError(
      "UNAVAILABLE",
      "This visitor book does not match the current app connection.",
    );
};
async function selectedResource(
  db: D1Database,
  workspace: string,
  id: string,
  connection: ReturnType<typeof resourceConnection>,
) {
  const row = await db
    .prepare(
      "SELECT * FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook'",
    )
    .bind(id, workspace)
    .first<ResourceRow>();
  if (!row)
    throw new StackError(
      "NOT_FOUND",
      "Choose a visitor book owned by this workspace.",
      404,
    );
  resourceInfo(row, connection, workspace);
  return row;
}
function checkResource(
  value: {
    id: string;
    workspace_id: string;
    account_id: string;
    environment: string;
    target: string;
  },
  selected: ResourceRow,
  connection: ReturnType<typeof resourceConnection>,
) {
  if (
    value.id !== selected.id ||
    value.workspace_id !== selected.workspace_id ||
    value.account_id !== connection.account ||
    value.environment !== connection.environment ||
    value.target !== connection.target
  )
    throw Error("The app returned another private resource.");
}
function appFailure(reply: { status: number; body: unknown }) {
  if (reply.status >= 200 && reply.status < 300) return;
  const value = z
    .object({
      error: z.string().max(700),
      outcome: z.literal("unknown").optional(),
    })
    .safeParse(reply.body);
  throw new StackError(
    reply.status >= 500
      ? "UNKNOWN"
      : reply.status === 409
        ? "CONFLICT"
        : "UNAVAILABLE",
    value.success
      ? value.data.error
      : "The app did not confirm this private enquiry request.",
    reply.status,
  );
}
export async function publicationEnquiry(
  db: D1Database,
  slug: string,
  instance: string,
) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug) || !enquiryID.safeParse(instance).success)
    return null;
  const row = await db
    .prepare(
      "SELECT s.id,s.workspace_id,s.slug,s.published_revision,p.document_json FROM creator_stacks s JOIN creator_stack_publications p ON p.stack_id=s.id AND p.revision=s.published_revision WHERE s.slug=? AND s.status='published' AND s.published_json IS NOT NULL",
    )
    .bind(slug)
    .first<PublicationRow>();
  if (!row) return null;
  const current = await publicStack(db, slug);
  if (
    !current ||
    current.id !== row.id ||
    current.revision !== row.published_revision ||
    JSON.stringify(current.document) !==
      JSON.stringify(JSON.parse(row.document_json))
  )
    return null;
  const document = current.document;
  const item = document.instances.find(
    (item) =>
      item.id === instance &&
      item.app === "guestbook" &&
      item.visible &&
      item.resource,
  );
  if (!item?.resource) return null;
  const scope: EnquiryScope = {
    kind: "composer.publication",
    resource: item.resource.id,
    configuration: item.resource.configurationRevision,
    stack: row.id,
    publication: row.published_revision,
    instance: item.id,
  };
  const key = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify([
            "composer.enquiry/1",
            row.id,
            row.published_revision,
            row.document_json,
            item.id,
            item.resource.id,
            item.resource.configurationRevision,
          ]),
        ),
      ),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return { row, scope, key, title: document.name, label: item.label };
}
export async function confirmPublication(
  db: D1Database,
  selected: NonNullable<Awaited<ReturnType<typeof publicationEnquiry>>>,
) {
  const current = await db
    .prepare(
      "SELECT s.id FROM creator_stacks s JOIN creator_stack_publications p ON p.stack_id=s.id AND p.revision=s.published_revision WHERE s.id=? AND s.workspace_id=? AND s.slug=? AND s.status='published' AND s.published_revision=? AND s.published_json IS NOT NULL AND p.document_json=?",
    )
    .bind(
      selected.row.id,
      selected.row.workspace_id,
      selected.row.slug,
      selected.row.published_revision,
      selected.row.document_json,
    )
    .first();
  if (!current)
    throw new StackError(
      "CONFLICT",
      "This publication changed or closed. Keep your brief and delivery intent.",
      409,
    );
}
export function appScope(scope: EnquiryScope) {
  const { resource, ...selection } = scope;
  void resource;
  return selection;
}

export async function manageEnquiries(ctx: Context, runtime: EnquiryRuntime) {
  const fail = (code: string, message: string) => ({
    ok: false as const,
    code,
    message,
  });
  if (!ctx.user || !isCreatorRole(ctx.user.role) || !ctx.user.id)
    return fail("FORBIDDEN", "A signed-in Composer creator is required.");
  if (runtime.PUBLIC_ORIGIN !== origin || !runtime.DB)
    return fail(
      "UNAVAILABLE",
      "Private enquiries are disconnected in this environment.",
    );
  const reading = ctx.request.method === "GET";
  if (
    (ctx.request.headers.has("Origin") &&
      ctx.request.headers.get("Origin") !== origin) ||
    (!reading &&
      (ctx.request.method !== "POST" ||
        ctx.request.headers.get("Origin") !== origin ||
        ctx.request.headers.get("X-EmDash-Request") !== "1"))
  )
    return fail("FORBIDDEN", "Open this action from Composer administration.");
  try {
    if (reading)
      for (const key of new URL(ctx.request.url).searchParams.keys())
        if (new URL(ctx.request.url).searchParams.getAll(key).length !== 1)
          throw new StackError("INVALID", "Choose each inbox filter once.");
    const parsedInput = (reading ? readInput : writeInput).safeParse(ctx.input);
    if (!parsedInput.success)
      return fail(
        "INVALID",
        "Choose only the declared private inbox fields and bounded filters.",
      );
    const input = parsedInput.data,
      db = runtime.DB,
      user = ctx.user;
    const workspace = await resolveWorkspace(db, user, input.workspace ?? null);
    requireCapability(workspace.role, "read");
    if (input.action === "list") {
      const rows = await db
        .prepare(
          "SELECT id,configuration_json,state FROM creator_app_resources WHERE workspace_id=? AND app='guestbook' ORDER BY created_at,id LIMIT 32",
        )
        .bind(workspace.id)
        .all<{
          id: string;
          configuration_json: string | null;
          state: string;
        }>();
      const stacks = await db
        .prepare(
          "SELECT id,slug,name,published_revision,published_json FROM creator_stacks WHERE workspace_id=? AND status='published' AND published_json IS NOT NULL ORDER BY updated_at DESC,id LIMIT 50",
        )
        .bind(workspace.id)
        .all<{
          id: string;
          slug: string;
          name: string;
          published_revision: number;
          published_json: string;
        }>();
      const stackOptions = (
        await Promise.all(
          stacks.results.map(async (row) => {
            const current = await publicStack(db, row.slug);
            if (
              !current ||
              current.id !== row.id ||
              current.revision !== row.published_revision
            )
              return null;
            return {
              id: row.id,
              slug: row.slug,
              name: current.name,
              publication: row.published_revision,
              instances: current.document.instances
                .filter(
                  (item) =>
                    item.app === "guestbook" && item.visible && item.resource,
                )
                .map((item) => ({
                  id: item.id,
                  label: item.label,
                  resource: item.resource!.id,
                  configuration: item.resource!.configurationRevision,
                })),
            };
          }),
        )
      ).filter((row) => row !== null);
      requireCapability(await membership(db, workspace.id, user.id), "read");
      return {
        ok: true as const,
        workspace,
        resources: rows.results.map((row) => {
          let title = "Visitor book";
          try {
            const value = JSON.parse(row.configuration_json ?? "{}");
            if (typeof value.title === "string")
              title = value.title.slice(0, 80);
          } catch {
            /* No unvalidated remote body is presented. */
          }
          return { id: row.id, label: title, state: row.state };
        }),
        stacks: stackOptions,
      };
    }
    requireCapability(workspace.role, "save");
    const connection = resourceConnection(runtime, workspace.id),
      resource = await selectedResource(
        db,
        workspace.id,
        input.resource,
        connection,
      );
    const guard = async (owner = false) => {
      const role = await membership(db, workspace.id, user.id);
      requireCapability(role, "save");
      if (owner && role !== "owner")
        throw new StackError(
          "FORBIDDEN",
          "Only this workspace owner can open or close enquiry forms.",
          403,
        );
      await selectedResource(db, workspace.id, resource.id, connection);
    };
    if (input.action === "inbox" || input.action === "export") {
      const remote = await connection.enquiry(
        resource.id,
        input.action === "export" ? "export" : "",
        undefined,
        undefined,
        input.action === "inbox"
          ? { status: input.status ?? "pending", page: input.page ?? "1" }
          : undefined,
      );
      appFailure(remote);
      await guard();
      const reply =
        input.action === "inbox"
          ? enquiryInbox.parse(remote.body)
          : enquiryExport.parse(remote.body);
      checkResource(reply.resource, resource, connection);
      if (reply.source !== connection.source)
        throw Error("The app returned another source.");
      for (const item of reply.items)
        if (
          item.provenance.resource !== resource.id ||
          item.provenance.configuration !== item.configuration_revision
        )
          throw Error("A private entry has inconsistent provenance.");
      return {
        ok: true as const,
        workspace,
        ...(input.action === "inbox" ? { inbox: reply } : { export: reply }),
      };
    }
    if (input.action === "receipt") {
      const remote = await connection.enquiry(
        resource.id,
        "receipt",
        undefined,
        undefined,
        { operation: input.operation },
      );
      appFailure(remote);
      await guard();
      const raw = z
        .discriminatedUnion("recorded", [
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
        ])
        .parse(remote.body);
      if (raw.recorded) {
        const r = raw.result.resource;
        if (
          raw.result.operation !== input.operation ||
          r.id !== resource.id ||
          r.workspace !== workspace.id ||
          r.account !== connection.account ||
          r.environment !== connection.environment ||
          r.target !== connection.target
        )
          throw Error("The operation belongs to another resource.");
      }
      return { ok: true as const, workspace, receipt: raw };
    }
    if (!("source" in input) || input.source !== connection.source)
      throw new StackError(
        "CONFLICT",
        "The app source changed. Check the retained operation; do not replay it against another source.",
        409,
      );
    let command: Record<string, unknown>,
      publication: Awaited<ReturnType<typeof publicationEnquiry>> = null;
    if (input.action === "configure") {
      await guard(true);
      let scope: EnquiryScope;
      if (input.mode === "publication") {
        if (!input.stack || !input.instance)
          throw new StackError(
            "INVALID",
            "Choose a currently published stack and its visitor-book instance.",
          );
        const row = await db
          .prepare(
            "SELECT slug FROM creator_stacks WHERE id=? AND workspace_id=?",
          )
          .bind(input.stack, workspace.id)
          .first<{ slug: string }>();
        publication = row
          ? await publicationEnquiry(db, row.slug, input.instance)
          : null;
        if (
          !publication ||
          publication.row.workspace_id !== workspace.id ||
          publication.scope.resource !== resource.id ||
          publication.scope.kind !== "composer.publication" ||
          publication.scope.publication !== input.publication ||
          input.configuration !== undefined
        )
          throw new StackError(
            "CONFLICT",
            "This current publication does not use the selected visitor book.",
            409,
          );
        scope = publication.scope;
      } else {
        if (input.stack || input.instance || input.publication)
          throw new StackError(
            "INVALID",
            "Standalone forms do not select a Composer stack.",
          );
        const status = await connection.status(resource.id);
        await guard(true);
        if (
          !status.configuration ||
          status.configuration.revision !== input.configuration
        )
          throw new StackError(
            "UNAVAILABLE",
            "Activate a visitor-book configuration before opening its form.",
          );
        scope = {
          kind: "standalone",
          resource: resource.id,
          configuration: status.configuration.revision,
        };
      }
      command = {
        contract: 1,
        action: "configure",
        scope: appScope(scope),
        enabled: input.enabled,
        expectedVersion: input.expectedVersion,
        expectedScopeRevision: input.expectedScopeRevision,
        operation: input.operation,
      };
    } else
      command = {
        contract: 1,
        action: input.action,
        item: input.item,
        expectedRevision: input.expectedRevision,
        expectedVersion: input.expectedVersion,
        operation: input.operation,
      };
    await guard(input.action === "configure");
    if (publication) await confirmPublication(db, publication);
    const remote = await connection.enquiry(
      resource.id,
      "",
      command,
      undefined,
      undefined,
      async () => {
        await guard(input.action === "configure");
        if (publication) await confirmPublication(db, publication);
      },
    );
    appFailure(remote);
    // Permission loss after a committed remote operation cannot turn it into an
    // unchanged result. The client retains the operation until receipt checking.
    await guard(input.action === "configure");
    const result = enquiryOperation.parse(remote.body),
      r = result.resource;
    if (
      result.source !== connection.source ||
      result.operation !== input.operation ||
      result.action !== input.action ||
      r.id !== resource.id ||
      r.workspace !== workspace.id ||
      r.account !== connection.account ||
      r.environment !== connection.environment ||
      r.target !== connection.target ||
      r.version !== input.expectedVersion + 1
    )
      throw Error(
        "The app acknowledgement does not match this exact operation.",
      );
    if (input.action === "configure") {
      if (
        !result.scope ||
        result.item ||
        result.scope.enabled !== input.enabled ||
        result.scope.revision !== input.expectedScopeRevision + 1 ||
        JSON.stringify(appScope(result.scope.provenance)) !==
          JSON.stringify(command.scope)
      )
        throw Error("The app acknowledged another form scope.");
    } else if (
      !result.item ||
      result.scope ||
      result.item.id !== input.item ||
      result.item.revision !== input.expectedRevision + 1 ||
      result.item.status !==
        (input.action === "review"
          ? "reviewed"
          : input.action === "reject"
            ? "rejected"
            : "deleted")
    )
      throw Error("The app acknowledged another private entry.");
    return { ok: true as const, workspace, result };
  } catch (error) {
    return fail(
      error instanceof StackError ? error.code : "UNKNOWN",
      error instanceof StackError
        ? error.message
        : "The private enquiry response could not be validated. Keep the operation identity and check its receipt before another change.",
    );
  }
}
