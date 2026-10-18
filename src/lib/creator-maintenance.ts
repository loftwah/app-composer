import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { isCreatorRole } from "./creator-access.ts";
import {
  StackError,
  resolveWorkspace,
  membership,
  requireCapability,
  listStacks,
  readStack,
} from "./stacks.mjs";
import { listStackResources } from "./stack-resources.ts";
import { resourceConnection, type ResourceRuntime } from "./resource-client.ts";
import type {
  MaintenanceStack,
  MaintenanceCheck,
} from "../plugins/maintenance/protocol.ts";

const origin = "https://composer.loftwah.com";
const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const selected = z
  .object({
    action: z.enum(["check", "export"]),
    workspace: id,
    stack: id,
    instance: id,
    expectedRevision: z.coerce
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
const listing = z
  .object({ action: z.literal("list"), workspace: id.optional() })
  .strict();
interface User {
  id: string;
  role: number;
  email?: string;
  name?: string | null;
}
interface Context {
  user?: User;
  request: Request;
  input: unknown;
}
interface Runtime extends ResourceRuntime {
  DB?: D1Database;
}
interface ResourceRow {
  id: string;
  account_id: string;
  environment: string;
  target: string;
  version: number;
  state: "reserved" | "ready" | "unknown" | "refused";
  configuration_revision: number | null;
  configuration_digest: string | null;
  configuration_source: string | null;
}
const unavailable = {
  workerDeployment: "unavailable",
  media: "not-checked",
  metrics: "unavailable",
  costs: "unavailable",
} as const;
const conflict = () =>
  new StackError(
    "CONFLICT",
    "The saved stack or binding changed during this check. Refresh its saved selection; no draft or publication was changed.",
    409,
  );

export async function manageMaintenance(ctx: Context, runtime: Runtime) {
  try {
    if (!ctx.user || !isCreatorRole(ctx.user.role))
      throw new StackError(
        "FORBIDDEN",
        "A signed-in Composer creator is required.",
        403,
      );
    if (runtime.PUBLIC_ORIGIN !== origin || !runtime.DB)
      throw new StackError(
        "UNAVAILABLE",
        "Workspace maintenance is disconnected in this environment.",
      );
    if (
      ctx.request.method !== "GET" ||
      (ctx.request.headers.has("Origin") &&
        ctx.request.headers.get("Origin") !== origin)
    )
      throw new StackError(
        "FORBIDDEN",
        "Open this read-only check from Composer administration.",
        403,
      );
    const input = z.union([listing, selected]).parse(ctx.input);
    const db = runtime.DB,
      user = ctx.user;
    const workspace = await resolveWorkspace(db, user, input.workspace ?? null);
    requireCapability(workspace.role, "read");
    if (input.action === "list") {
      const stacks: MaintenanceStack[] = [];
      for (const stack of await listStacks(db, workspace.id)) {
        const bindings = await listStackResources(db, workspace.id, stack.id);
        stacks.push({
          id: stack.id,
          name: stack.name,
          revision: stack.revision,
          status: stack.status,
          instances: stack.draft.instances.map(
            (instance: { id: string; app: string; label: string }) => {
              const binding = bindings.find(
                (entry) => entry.instance === instance.id,
              );
              return {
                id: instance.id,
                app: instance.app,
                label: instance.label,
                resource: binding?.resource ?? null,
                state: binding?.state ?? "unbound",
                shared: binding?.shared ?? false,
              };
            },
          ),
        });
      }
      requireCapability(await membership(db, workspace.id, user.id), "read");
      return { ok: true, workspace, stacks };
    }
    const capability = input.action === "export" ? "save" : "read";
    requireCapability(workspace.role, capability);
    const stack = await readStack(db, workspace.id, input.stack);
    const candidate = stack.draft.instances.find(
      (instance: { id: string }) => instance.id === input.instance,
    );
    if (stack.revision !== input.expectedRevision) throw conflict();
    if (!candidate || candidate.app !== "guestbook")
      throw new StackError(
        "INVALID",
        "Choose a saved Guestbook instance. Other apps have no owned-resource maintenance contract here.",
      );
    const row = await db
      .prepare(
        `SELECT r.* FROM creator_stack_resource_bindings b JOIN creator_app_resources r ON r.id=b.resource_id
      WHERE b.stack_id=? AND b.instance_id=? AND r.workspace_id=? AND r.app='guestbook'`,
      )
      .bind(stack.id, input.instance, workspace.id)
      .first<ResourceRow>();
    if (!row)
      throw new StackError(
        "UNAVAILABLE",
        "This saved instance has no app-owned resource yet. Apply its saved configuration from Creator stacks.",
      );
    const draftJSON = JSON.stringify(stack.draft);
    const guard = async () => {
      requireCapability(
        await membership(db, workspace.id, user.id),
        capability,
      );
      const current = await readStack(db, workspace.id, stack.id);
      if (
        current.revision !== stack.revision ||
        JSON.stringify(current.draft) !== draftJSON
      )
        throw conflict();
      const binding = await db
        .prepare(
          `SELECT r.id FROM creator_stack_resource_bindings b JOIN creator_app_resources r ON r.id=b.resource_id
        WHERE b.stack_id=? AND b.instance_id=? AND b.resource_id=? AND r.workspace_id=? AND r.account_id=? AND r.environment=? AND r.target=?
          AND r.version=? AND r.state=? AND r.configuration_revision IS ? AND r.configuration_digest IS ? AND r.configuration_source IS ?`,
        )
        .bind(
          stack.id,
          input.instance,
          row.id,
          workspace.id,
          row.account_id,
          row.environment,
          row.target,
          row.version,
          row.state,
          row.configuration_revision,
          row.configuration_digest,
          row.configuration_source,
        )
        .first();
      if (!binding) throw conflict();
    };
    const connection = resourceConnection(runtime, workspace.id);
    if (
      row.account_id !== connection.account ||
      row.environment !== connection.environment ||
      row.target !== connection.target
    )
      throw new StackError(
        "FORBIDDEN",
        "The saved resource belongs to another account, environment or target.",
        403,
      );
    const pending = await db
      .prepare(
        "SELECT id FROM creator_resource_operations WHERE resource_id=? AND state IN ('pending','unknown') LIMIT 1",
      )
      .bind(row.id)
      .first();
    if (input.action === "export") {
      if (pending || row.state !== "ready")
        throw new StackError(
          "CONFLICT",
          "Check the unresolved app operation from Creator stacks before exporting.",
          409,
        );
      const portable = await connection.portable(row.id);
      if (
        portable.source.version !== row.version ||
        portable.configuration.revision !== row.configuration_revision ||
        portable.configuration.digest !== row.configuration_digest ||
        portable.configuration.source !== row.configuration_source
      )
        throw conflict();
      await guard();
      return { ok: true, workspace, portable };
    }
    const expected = {
      account: connection.account,
      environment: connection.environment,
      target: connection.target,
      source: connection.source,
      version: row.version,
      configuration:
        row.configuration_revision &&
        row.configuration_digest &&
        row.configuration_source
          ? {
              revision: row.configuration_revision,
              digest: row.configuration_digest,
              source: row.configuration_source,
            }
          : null,
    };
    let check: MaintenanceCheck;
    try {
      const { actual, portabilitySupported } = await connection.inspect(row.id);
      const actualConfig = actual.configuration
        ? {
            revision: actual.configuration.revision,
            digest: actual.configuration.digest,
            source: actual.configuration.source,
          }
        : null;
      const matched =
        actual.configuration !== null &&
        row.state === "ready" &&
        actual.resource.version === row.version &&
        JSON.stringify(actualConfig) === JSON.stringify(expected.configuration);
      check = {
        stack: stack.id,
        revision: stack.revision,
        instance: input.instance,
        resource: row.id,
        checkedAt: new Date().toISOString(),
        outcome: pending ? "pending" : matched ? "matched" : "stale",
        message: pending
          ? "An app operation is unresolved. Use Check app operation in Creator stacks before another change."
          : matched
            ? "The connected app source, runtime scope and saved resource configuration matched at this check."
            : "The app resource differs from the saved confirmation. Reconcile it in Creator stacks; this check changes nothing.",
        expected,
        actual: {
          account: actual.resource.account,
          environment: actual.resource.environment,
          target: actual.resource.target,
          source: connection.source,
          version: actual.resource.version,
          configuration: actualConfig,
          visible: actual.resource.visible,
          paused: actual.resource.paused,
        },
        portabilitySupported,
        coverage: {
          ...unavailable,
          source: "matched",
          resource: matched ? "matched" : "different",
        },
      };
    } catch {
      check = {
        stack: stack.id,
        revision: stack.revision,
        instance: input.instance,
        resource: row.id,
        checkedAt: new Date().toISOString(),
        outcome: pending ? "pending" : "unavailable",
        message:
          "The current app source, resource or runtime scope could not be verified. No deployment or recovery health is inferred.",
        expected,
        actual: null,
        portabilitySupported: false,
        coverage: {
          ...unavailable,
          source: "unverified",
          resource: "unverified",
        },
      };
    }
    await guard();
    return { ok: true, workspace, check };
  } catch (failure) {
    if (failure instanceof StackError)
      return { ok: false, code: failure.code, message: failure.message };
    return {
      ok: false,
      code: failure instanceof z.ZodError ? "INVALID" : "UNAVAILABLE",
      message:
        failure instanceof z.ZodError
          ? "Choose an exact saved maintenance selection."
          : "Maintenance could not be confirmed. No saved draft or publication was changed.",
    };
  }
}
