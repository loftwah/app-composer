// Read-only resource inventory for Composer's native owner experience.
// It reads only Composer's own D1 records: no Cloudflare API call, no service
// binding request, no queue, no tag write and no automatic retirement. Where a
// comparison needs a provider read that did not happen, the answer is unknown.
import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { isCreatorRole } from "./creator-access.ts";
import {
  membership,
  resolveWorkspace,
  requireCapability,
  StackError,
} from "./stacks.mjs";
import { appSettings } from "./app-settings.mjs";
import {
  configurationDigest,
  effectiveGuestbookConfiguration,
} from "./resource-client.ts";
import {
  resourceInventory,
  type InventoryResource,
} from "./resource-inventory-contract.ts";
import {
  classifyResource,
  compareProviderTags,
  configurationDifferences,
  countStatuses,
  expectedProviderTags,
  type OperationAction,
  type ResourceObservation,
} from "./resource-inventory-model.ts";

const origin = "https://composer.loftwah.com";
const resourceTarget = origin + "/guestbook";
/** One screen, one bounded read. Older records stay in their owning screens. */
const RESOURCE_LIMIT = 40;
const BINDING_LIMIT = 400;
const OPERATION_LIMIT = 400;

const inputSchema = z
  .object({
    action: z.literal("list"),
    workspace: z
      .string()
      .regex(/^[a-z0-9-]{6,64}$/)
      .optional(),
  })
  .strict();

interface Context {
  user?: { id: string; role: number; name?: string | null };
  request: Request;
  input: unknown;
}
interface Runtime {
  DB?: D1Database;
  PUBLIC_ORIGIN?: unknown;
  RESOURCE_ACCOUNT_ID?: unknown;
  RESOURCE_ENVIRONMENT?: unknown;
  GUESTBOOK?: { fetch(request: Request): Promise<Response> };
  GUESTBOOK_OWNER_TOKEN?: unknown;
}
interface ResourceRow {
  id: string;
  account_id: string;
  environment: string;
  target: string;
  version: number;
  state: InventoryResource["state"];
  configuration_revision: number | null;
  configuration_digest: string | null;
  configuration_source: string | null;
  configuration_json: string | null;
  created_at: string;
}
interface BindingRow {
  resource_id: string;
  instance_id: string;
  mode: "own" | "shared";
  stack_id: string;
  stack_name: string;
  stack_slug: string;
  stack_status: InventoryResource["bindings"][number]["stackStatus"];
  draft_json: string;
  published_json: string | null;
}
interface OperationRow {
  id: string;
  resource_id: string;
  action: OperationAction;
  state: "pending" | "confirmed" | "unknown" | "refused";
  created_at: string;
}

const configurationValues = z.record(z.string(), z.string());
const stackDocument = z
  .object({
    instances: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{6,64}$/),
            label: z.string().max(200).optional(),
            config: configurationValues,
            resource: z
              .object({
                id: z.string().regex(/^[a-z0-9-]{6,64}$/),
                configurationRevision: z
                  .number()
                  .int()
                  .positive()
                  .max(Number.MAX_SAFE_INTEGER),
              })
              .loose()
              .optional(),
          })
          .loose(),
      )
      .max(12),
  })
  .loose();
const storedConfiguration = z.object({
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  source: z.string().regex(/^[a-f0-9]{40}$/),
  values: configurationValues,
});

/** Stored timestamps are UTC without a zone marker; state them as UTC. */
function storedTimestamp(input: string) {
  const text = input.includes("T") ? input : input.replace(" ", "T") + "Z";
  const time = Date.parse(text);
  if (!Number.isFinite(time)) throw Error("Invalid stored observation date");
  return new Date(time).toISOString();
}

function parseDocument(value: string | null) {
  if (!value) return null;
  try {
    const parsed = stackDocument.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function recordedConfiguration(
  row: ResourceRow,
): InventoryResource["configuration"] {
  if (
    !row.configuration_revision ||
    !row.configuration_digest ||
    !row.configuration_source ||
    !row.configuration_json
  )
    return null;
  try {
    const value = storedConfiguration.parse({
      revision: row.configuration_revision,
      digest: row.configuration_digest,
      source: row.configuration_source,
      values: JSON.parse(row.configuration_json),
    });
    return value;
  } catch {
    return null;
  }
}

export async function manageResourceInventory(ctx: Context, runtime: Runtime) {
  try {
    if (!ctx.user || !isCreatorRole(ctx.user.role))
      throw new StackError(
        "FORBIDDEN",
        "A signed-in Composer creator is required.",
        403,
      );
    if (!runtime.DB || runtime.PUBLIC_ORIGIN !== origin)
      throw new StackError(
        "UNAVAILABLE",
        "Resource inventory is disconnected in this environment.",
      );
    if (
      ctx.request.method !== "GET" ||
      (ctx.request.headers.has("Origin") &&
        ctx.request.headers.get("Origin") !== origin)
    )
      throw new StackError(
        "FORBIDDEN",
        "Open this read-only inventory from Composer administration.",
        403,
      );
    const url = new URL(ctx.request.url);
    for (const key of url.searchParams.keys())
      if (url.searchParams.getAll(key).length !== 1)
        throw new StackError("INVALID", "Choose each inventory filter once.");
    const input = inputSchema.parse(ctx.input),
      db = runtime.DB,
      user = ctx.user;
    const workspace = await resolveWorkspace(db, user, input.workspace ?? null);
    requireCapability(workspace.role, "read");
    const target = z
      .object({
        account: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
        environment: z.string().regex(/^[a-z0-9-]{1,40}$/),
      })
      .parse({
        account: runtime.RESOURCE_ACCOUNT_ID,
        environment: runtime.RESOURCE_ENVIRONMENT,
      });
    const installedSource = z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .nullable()
      .parse(appSettings.guestbook?.source?.commit ?? null);
    const bindingAvailable = Boolean(
      runtime.GUESTBOOK && typeof runtime.GUESTBOOK.fetch === "function",
    );
    const credentialPresent =
      typeof runtime.GUESTBOOK_OWNER_TOKEN === "string" &&
      Boolean(runtime.GUESTBOOK_OWNER_TOKEN.trim());

    const now = Date.now();
    const inventory = await readResourceInventory(db, {
      workspace,
      account: target.account,
      environment: target.environment,
      installedSource,
      now,
    });
    const resources = inventory.resources;
    const currentRole = await membership(db, workspace.id, user.id);
    requireCapability(currentRole, "read");
    return resourceInventory.parse({
      ok: true,
      version: "composer.resources/1",
      synthetic: false,
      workspace: { ...workspace, role: currentRole },
      installation: {
        account: target.account,
        environment: target.environment,
        target: resourceTarget,
        service: "GUESTBOOK",
        bindingAvailable,
        credentialPresent,
        appSource: installedSource,
      },
      provider: {
        state: "unverified",
        tags: [],
        verifiedAt: null,
        note: "Composer stores no verified Cloudflare tag snapshot for this account, and this screen performs no provider read. Provider tags are unverified here rather than assumed. Tags are not ownership, access or billing authority.",
      },
      readAt: new Date(now).toISOString(),
      atLimit: inventory.atLimit,
      counts: countStatuses(resources),
      resources,
    });
  } catch (cause) {
    return {
      ok: false as const,
      code: cause instanceof StackError ? cause.code : "UNAVAILABLE",
      message:
        cause instanceof StackError
          ? cause.message
          : "Resource inventory could not confirm this selected workspace. Refresh or open Creator stacks.",
    };
  }
}

/**
 * One bounded read of Composer's own resource records. The owner Overview and
 * the App resources screen both call this so their problem counts cannot
 * disagree for the same workspace.
 */
export interface ResourceInventoryRead {
  resources: InventoryResource[];
  atLimit: boolean;
}
export interface ResourceInventoryReadOptions {
  workspace: { id: string; name: string };
  account: string;
  environment: string;
  installedSource: string | null;
  now: number;
}
export async function readResourceInventory(
  db: D1Database,
  options: ResourceInventoryReadOptions,
): Promise<ResourceInventoryRead> {
  const { workspace, installedSource, now } = options;
  const target = { account: options.account, environment: options.environment };
  const rows = await db
    .prepare(
      "SELECT id,account_id,environment,target,version,state,configuration_revision,configuration_digest,configuration_source,configuration_json,created_at FROM creator_app_resources WHERE workspace_id=? AND app='guestbook' ORDER BY created_at,id LIMIT ?",
    )
    .bind(workspace.id, RESOURCE_LIMIT)
    .all<ResourceRow>();
  const bindings = await db
    .prepare(
      "SELECT b.resource_id,b.instance_id,b.mode,b.stack_id,s.name AS stack_name,s.slug AS stack_slug,s.status AS stack_status,s.draft_json,s.published_json FROM creator_stack_resource_bindings b JOIN creator_stacks s ON s.id=b.stack_id WHERE s.workspace_id=? ORDER BY b.resource_id,s.name,b.instance_id LIMIT ?",
    )
    .bind(workspace.id, BINDING_LIMIT)
    .all<BindingRow>();
  const operations = await db
    .prepare(
      "SELECT o.id,o.resource_id,o.action,o.state,o.created_at FROM creator_resource_operations o WHERE o.resource_id IN (SELECT id FROM creator_app_resources WHERE workspace_id=?) ORDER BY o.created_at DESC,o.rowid DESC LIMIT ?",
    )
    .bind(workspace.id, OPERATION_LIMIT)
    .all<OperationRow>();

  const bindingsByResource = new Map<string, BindingRow[]>();
  for (const row of bindings.results) {
    const list = bindingsByResource.get(row.resource_id) ?? [];
    list.push(row);
    bindingsByResource.set(row.resource_id, list);
  }
  const confirmed = new Map<string, OperationRow>(),
    unfinished = new Map<string, OperationRow>();
  for (const row of operations.results) {
    if (row.state === "confirmed" && !confirmed.has(row.resource_id))
      confirmed.set(row.resource_id, row);
    if (
      (row.state === "pending" || row.state === "unknown") &&
      !unfinished.has(row.resource_id)
    )
      unfinished.set(row.resource_id, row);
  }

  const actionHref =
    "/_emdash/admin/plugins/composer-stacks/stacks?" +
    new URLSearchParams({ workspace: workspace.id });
  const resources: InventoryResource[] = [];
  for (const row of rows.results) {
    const bound = bindingsByResource.get(row.id) ?? [];
    const configuration = recordedConfiguration(row);
    const expected = await expectedConfiguration(row, bound, installedSource);
    const pinned: number[] = [];
    for (const binding of bound) {
      const published = parseDocument(binding.published_json);
      const instance = published?.instances.find(
        (entry) => entry.id === binding.instance_id,
      );
      if (instance?.resource?.id === row.id)
        pinned.push(instance.resource.configurationRevision);
    }
    const labels = {
      workspace: workspace.name,
      stack: bound[0]?.stack_name ?? null,
      instance: bound[0] ? instanceLabel(bound[0]) : null,
      app: "Guestbook" as const,
      environment: row.environment,
    };
    const providerTags = compareProviderTags(
      expectedProviderTags({
        workspace: workspace.name,
        app: "guestbook",
        environment: row.environment,
        resource: row.id,
      }),
      null,
    );
    const observation: ResourceObservation = {
      id: row.id,
      state: row.state,
      configuration,
      expected: {
        available: expected.values !== null,
        basis: expected.basis,
        values: expected.values,
        digest: expected.digest,
        source: expected.source,
        note: expected.note,
      },
      targetMatches:
        row.account_id === target.account &&
        row.environment === target.environment &&
        row.target === resourceTarget,
      bindings: bound.length,
      unfinished: unfinished.has(row.id)
        ? {
            action: unfinished.get(row.id)!.action,
            state:
              unfinished.get(row.id)!.state === "pending"
                ? "pending"
                : "unknown",
            at: storedTimestamp(unfinished.get(row.id)!.created_at),
          }
        : null,
      lastConfirmedAt: confirmed.has(row.id)
        ? storedTimestamp(confirmed.get(row.id)!.created_at)
        : null,
      published:
        pinned.length > 0
          ? {
              pinned,
              current: configuration?.revision ?? null,
            }
          : null,
      providerTags,
      actionHref,
    };
    const { status, findings } = classifyResource(observation, now);
    resources.push({
      id: row.id,
      app: "guestbook",
      service: "GUESTBOOK",
      account: row.account_id,
      environment: row.environment,
      target: row.target,
      recordedAt: storedTimestamp(row.created_at),
      state: row.state,
      version: row.version,
      status,
      configuration,
      expected,
      differences: configurationDifferences(
        configuration?.values ?? null,
        expected.values,
      ),
      bindings: bound.map((binding) => ({
        stackId: binding.stack_id,
        stackName: binding.stack_name,
        stackSlug: binding.stack_slug,
        stackStatus: binding.stack_status,
        instanceId: binding.instance_id,
        instanceLabel: instanceLabel(binding) ?? binding.instance_id,
        mode: binding.mode,
      })),
      published: observation.published,
      lastConfirmedOperation: confirmed.has(row.id)
        ? {
            action: confirmed.get(row.id)!.action,
            at: storedTimestamp(confirmed.get(row.id)!.created_at),
          }
        : null,
      unfinishedOperation: observation.unfinished,
      labels,
      providerTags,
      findings,
    });
  }
  return { resources, atLimit: rows.results.length >= RESOURCE_LIMIT };
}
function instanceLabel(binding: BindingRow) {
  const draft = parseDocument(binding.draft_json);
  const instance = draft?.instances.find(
    (entry) => entry.id === binding.instance_id,
  );
  return instance?.label?.trim() || binding.instance_id;
}

/**
 * The saved draft is the owner's expectation. A shared-only reference inherits
 * the resource's own confirmed configuration, so it has no separate local
 * override to compare.
 */
async function expectedConfiguration(
  row: ResourceRow,
  bound: BindingRow[],
  installedSource: string | null,
): Promise<InventoryResource["expected"]> {
  if (bound.length === 0)
    return {
      basis: "unavailable",
      stackId: null,
      stackName: null,
      instanceId: null,
      instanceLabel: null,
      digest: null,
      source: null,
      values: null,
      note: "No saved stack instance references this resource.",
    };
  const owner = bound.find((binding) => binding.mode === "own");
  if (!owner)
    return {
      basis: "inherited",
      stackId: bound[0]!.stack_id,
      stackName: bound[0]!.stack_name,
      instanceId: bound[0]!.instance_id,
      instanceLabel: instanceLabel(bound[0]!),
      digest: null,
      source: null,
      values: null,
      note: "This saved stack reuses the confirmed configuration of another instance, so there is no separate local override to compare.",
    };
  const draft = parseDocument(owner.draft_json);
  if (!draft)
    return {
      basis: "unavailable",
      stackId: owner.stack_id,
      stackName: owner.stack_name,
      instanceId: owner.instance_id,
      instanceLabel: owner.instance_id,
      digest: null,
      source: null,
      values: null,
      note: "The saved stack document could not be read, so its expected settings are unknown.",
    };
  const instance = draft.instances.find(
    (entry) => entry.id === owner.instance_id,
  );
  if (!instance)
    return {
      basis: "unavailable",
      stackId: owner.stack_id,
      stackName: owner.stack_name,
      instanceId: owner.instance_id,
      instanceLabel: owner.instance_id,
      digest: null,
      source: null,
      values: null,
      note: "The saved instance that owned this resource is no longer in the stack draft.",
    };
  try {
    const values = effectiveGuestbookConfiguration(instance.config);
    return {
      basis: "saved-draft",
      stackId: owner.stack_id,
      stackName: owner.stack_name,
      instanceId: owner.instance_id,
      instanceLabel: instanceLabel(owner),
      digest: await configurationDigest(values),
      source: installedSource,
      values,
      note: null,
    };
  } catch {
    return {
      basis: "unavailable",
      stackId: owner.stack_id,
      stackName: owner.stack_name,
      instanceId: owner.instance_id,
      instanceLabel: instanceLabel(owner),
      digest: null,
      source: installedSource,
      values: null,
      note: "The saved instance settings do not satisfy the declared Guestbook configuration, so no expected configuration can be computed.",
    };
  }
}
