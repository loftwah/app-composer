import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { prepareModerationOutcome, recordModerationOutcome } from './private-outcome-proof.ts';
import { z } from 'zod';
import type { Stack, StackDocument, StackInstance } from './stacks.mjs';
import { membership, requireCapability, normaliseStack, StackError } from './stacks.mjs';
import {
  resourceConnection, effectiveGuestbookConfiguration, configurationDigest,
  type ResourceRuntime, type ResourceCommand, type RemoteOutcome, type AppAcknowledgement,
} from './resource-client.ts';

interface StackRow {
  id: string; workspace_id: string; slug: string; name: string;
  status: 'draft' | 'published' | 'archived'; revision: number;
  draft_json: string; published_json: string | null; published_revision: number | null;
  updated_at: string; published_at: string | null;
}
interface ResourceRow {
  id: string; workspace_id: string; app: 'guestbook'; account_id: string;
  environment: string; target: string; version: number;
  state: 'reserved' | 'ready' | 'unknown' | 'refused';
  configuration_revision: number | null; configuration_digest: string | null;
  configuration_source: string | null; configuration_json: string | null;
}
interface BindingRow extends ResourceRow { instance_id: string; mode: 'own' | 'shared' }
interface OperationRow {
  id: string; resource_id: string; action: ResourceCommand['action'];
  state: 'pending' | 'confirmed' | 'unknown' | 'refused';
  source_revision: string; request_json: string; result_json: string | null;
}
export interface ResourceBindingView {
  instance: string;
  resource: string;
  app: 'guestbook';
  shared: boolean;
  state: ResourceRow['state'];
  version: number;
  configuration: { revision: number; digest: string; source: string; values: Record<string, string>; path: string } | null;
}
export interface ResourceOperationResult {
  outcome: 'applied' | 'unchanged' | 'refused' | 'partial' | 'unknown';
  stack: Stack;
  resources: ResourceBindingView[];
  completed: string[];
  problems: { instance: string; outcome: 'refused' | 'unknown'; message: string }[];
  publicationUnchanged: true;
}
interface MutationContext {
  db: D1Database; user: string; workspace: string; row: StackRow; document: StackDocument;
  measureOutcomes?: boolean;
}
const conflict = () => new StackError('CONFLICT', 'This stack changed while the app operation was running. Keep your edits and reconcile its resource before retrying.', 409);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{6,64}$/.test(value);
const stackView = (row: StackRow): Stack => ({
  id: row.id, slug: row.slug, name: row.name, status: row.status, revision: row.revision,
  publishedRevision: row.published_revision, updatedAt: row.updated_at, publishedAt: row.published_at,
  draft: JSON.parse(row.draft_json) as StackDocument,
  published: row.published_json ? JSON.parse(row.published_json) as StackDocument : null,
});

async function context(db: D1Database, user: string, workspace: string, stack: string, expected: number): Promise<MutationContext> {
  if (!id(stack) || !Number.isSafeInteger(expected) || expected < 1) throw new StackError('INVALID', 'Choose the stack and its current saved revision.');
  requireCapability(await membership(db, workspace, user), 'save');
  const row = await db.prepare('SELECT * FROM creator_stacks WHERE id=? AND workspace_id=?').bind(stack, workspace).first<StackRow>();
  if (!row) throw new StackError('NOT_FOUND', 'This stack is not in the selected workspace.', 404);
  if (row.revision !== expected) throw conflict();
  if (row.status === 'archived') throw new StackError('CONFLICT', 'Restore this stack before configuring its resources.', 409);
  return { db, user, workspace, row, document: normaliseStack(JSON.parse(row.draft_json)) as StackDocument };
}

async function guard(ctx: MutationContext) {
  requireCapability(await membership(ctx.db, ctx.workspace, ctx.user), 'save');
  const current = await ctx.db.prepare("SELECT id FROM creator_stacks WHERE id=? AND workspace_id=? AND revision=? AND draft_json=? AND status!='archived'")
    .bind(ctx.row.id, ctx.workspace, ctx.row.revision, ctx.row.draft_json).first();
  if (!current) throw conflict();
}

// Every reservation, journal/status write and binding change advances the same
// stack revision. The unique nonce makes later statements conditional on THIS
// successful CAS, even if a competing lifecycle write reached revision + 1.
async function change(ctx: MutationContext, build: (condition: string, values: string[]) => D1PreparedStatement[], document?: StackDocument) {
  await guard(ctx);
  const nonce = crypto.randomUUID();
  const condition = 'EXISTS(SELECT 1 FROM creator_stacks WHERE id=? AND workspace_id=? AND resource_mutation=?)';
  const values = [ctx.row.id, ctx.workspace, nonce];
  const results = await ctx.db.batch([
    ctx.db.prepare("UPDATE creator_stacks SET revision=revision+1,resource_mutation=?,draft_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND draft_json=? AND status!='archived' AND EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role IN ('owner','editor')) RETURNING *")
      .bind(nonce, document ? JSON.stringify(normaliseStack(document)) : ctx.row.draft_json, ctx.row.id, ctx.workspace, ctx.row.revision, ctx.row.draft_json, ctx.workspace, ctx.user),
    ...build(condition, values),
  ]);
  const row = results[0]?.results?.[0] as unknown as StackRow | undefined;
  if (!row) throw conflict();
  ctx.row = row;
  if (document) ctx.document = normaliseStack(JSON.parse(row.draft_json)) as StackDocument;
}

async function binding(db: D1Database, workspace: string, stack: string, instance: string): Promise<BindingRow | null> {
  return db.prepare(`SELECT r.*,b.instance_id,b.mode FROM creator_stack_resource_bindings b
    JOIN creator_app_resources r ON r.id=b.resource_id JOIN creator_stacks s ON s.id=b.stack_id
    WHERE b.stack_id=? AND b.instance_id=? AND s.workspace_id=? AND r.workspace_id=?`)
    .bind(stack, instance, workspace, workspace).first<BindingRow>();
}
const view = (row: BindingRow): ResourceBindingView => ({
  instance: row.instance_id, resource: row.id, app: row.app, shared: row.mode === 'shared', state: row.state, version: row.version,
  configuration: row.configuration_revision && row.configuration_digest && row.configuration_source && row.configuration_json ? {
    revision: row.configuration_revision, digest: row.configuration_digest, source: row.configuration_source,
    values: JSON.parse(row.configuration_json) as Record<string, string>, path: `/guestbook/r/${row.id}/c/${row.configuration_revision}/`,
  } : null,
});

export async function listStackResources(db: D1Database, workspace: string, stack: string): Promise<ResourceBindingView[]> {
  const rows = await db.prepare(`SELECT r.*,b.instance_id,b.mode FROM creator_stack_resource_bindings b
    JOIN creator_app_resources r ON r.id=b.resource_id JOIN creator_stacks s ON s.id=b.stack_id
    WHERE b.stack_id=? AND s.workspace_id=? AND r.workspace_id=? ORDER BY b.instance_id LIMIT 12`)
    .bind(stack, workspace, workspace).all<BindingRow>();
  return rows.results.map(view);
}

export async function availableWorkspaceResources(db: D1Database, workspace: string) {
  const resources = await db.prepare("SELECT * FROM creator_app_resources WHERE workspace_id=? ORDER BY created_at,id LIMIT 32")
    .bind(workspace).all<ResourceRow>();
  return resources.results.map(row => view({ ...row, instance_id: '', mode: 'shared' }));
}

async function allocate(ctx: MutationContext, instance: StackInstance, connection: ReturnType<typeof resourceConnection>): Promise<BindingRow> {
  const existing = await binding(ctx.db, ctx.workspace, ctx.row.id, instance.id);
  if (existing) return existing;
  const resource = crypto.randomUUID();
  await change(ctx, (condition, values) => [
    ctx.db.prepare(`INSERT INTO creator_app_resources(id,workspace_id,app,account_id,environment,target)
      SELECT ?,?,'guestbook',?,?,? WHERE ${condition}`).bind(resource, ctx.workspace, connection.account, connection.environment, connection.target, ...values),
    ctx.db.prepare(`INSERT INTO creator_stack_resource_bindings(stack_id,instance_id,resource_id,mode)
      SELECT ?,?,?,'own' WHERE ${condition}`).bind(ctx.row.id, instance.id, resource, ...values),
  ]);
  const created = await binding(ctx.db, ctx.workspace, ctx.row.id, instance.id);
  if (!created) throw conflict();
  return created;
}

async function unfinished(db: D1Database, resource: string): Promise<OperationRow | null> {
  return db.prepare("SELECT * FROM creator_resource_operations WHERE resource_id=? AND state IN ('pending','unknown') ORDER BY created_at,id LIMIT 1").bind(resource).first<OperationRow>();
}

async function record(ctx: MutationContext, operation: OperationRow, outcome: RemoteOutcome) {
  const reply = outcome.reply, configuration = reply?.configuration;
  const active = ['activate', 'moderate', 'control'].includes(operation.action) && configuration;
  await change(ctx, (condition, values) => [
    ctx.db.prepare(`UPDATE creator_resource_operations SET state=?,result_json=? WHERE id=? AND ${condition}`)
      .bind(outcome.outcome === 'applied' ? 'confirmed' : outcome.outcome, reply ? JSON.stringify(reply) : null, operation.id, ...values),
    ctx.db.prepare(`UPDATE creator_app_resources SET state=?,version=COALESCE(?,version),
      configuration_revision=COALESCE(?,configuration_revision),configuration_digest=COALESCE(?,configuration_digest),
      configuration_source=COALESCE(?,configuration_source),configuration_json=COALESCE(?,configuration_json)
      WHERE id=? AND version<=COALESCE(?,version) AND ${condition}`)
      .bind(outcome.outcome === 'applied' ? (active ? 'ready' : 'reserved') : outcome.outcome,
        reply?.resource.version ?? null, active ? configuration.revision : null, active ? configuration.digest : null,
        active ? configuration.source : null, active ? JSON.stringify(configuration.values) : null,
        operation.resource_id, reply?.resource.version ?? null, ...values),
  ]);
  if (ctx.measureOutcomes !== false && outcome.outcome === 'applied' && operation.action === 'moderate') {
    try { await recordModerationOutcome(ctx.db, ctx.workspace, ctx.row.id, operation.id); }
    catch { /* A reporting outage cannot change the app's confirmed result. */ }
  }
}

async function operation(ctx: MutationContext, instance: StackInstance, resource: ResourceRow, connection: ReturnType<typeof resourceConnection>, action: ResourceCommand['action'], fields: Omit<ResourceCommand, 'action' | 'operationId'>, retry: boolean, operationId: string = crypto.randomUUID()): Promise<RemoteOutcome> {
  let pending = await unfinished(ctx.db, resource.id);
  if (pending) {
    try {
      const confirmed = await connection.reconcile(resource.id, pending.id, JSON.parse(pending.request_json) as ResourceCommand, pending.source_revision);
      if (confirmed) { const outcome: RemoteOutcome = { outcome: 'applied', reply: confirmed }; await record(ctx, pending, outcome); return outcome; }
      if (!retry || pending.source_revision !== connection.source) return { outcome: 'unknown', message: 'This operation is not confirmed. Its recorded request must be reconciled before a new operation is started.' };
    } catch { return { outcome: 'unknown', message: 'The app operation could not be reconciled. Nothing was resubmitted.' }; }
  } else {
    const command: ResourceCommand = { action, operationId, ...fields };
    pending = { id: command.operationId, resource_id: resource.id, action, state: 'pending', source_revision: connection.source, request_json: JSON.stringify(command), result_json: null };
    await change(ctx, (condition, values) => [ctx.db.prepare(`INSERT INTO creator_resource_operations(id,resource_id,stack_id,instance_id,action,state,source_revision,request_json)
      SELECT ?,?,?,?,?,'pending',?,? WHERE ${condition}`)
      .bind(pending!.id, resource.id, ctx.row.id, instance.id, action, connection.source, pending!.request_json, ...values)]);
  }
  const command = JSON.parse(pending.request_json) as ResourceCommand;
  // Capture only before the first dispatch. A retry must use its original proof;
  // later current state must never manufacture an earlier transition.
  if (ctx.measureOutcomes !== false && !retry && pending.action === 'moderate') {
    try { await prepareModerationOutcome({ db: ctx.db, user: ctx.user, workspace: ctx.workspace, stack: ctx.row.id, instance: instance.id }, pending, connection, () => guard(ctx)); }
    catch { /* Missing proof drops measurement; the app operation still proceeds. */ }
  }
  const outcome = await connection.command(resource.id, command, () => guard(ctx));
  await record(ctx, pending, outcome);
  return outcome;
}

function sameTarget(resource: ResourceRow, connection: ReturnType<typeof resourceConnection>) {
  if (resource.account_id !== connection.account || resource.environment !== connection.environment || resource.target !== connection.target) {
    throw new StackError('FORBIDDEN', 'This resource belongs to another selected app target or environment.', 403);
  }
}

async function refresh(ctx: MutationContext, selected: ResourceRow, actual: AppAcknowledgement): Promise<boolean> {
  const configuration = actual.configuration;
  const state = configuration ? 'ready' : 'reserved';
  const revision = configuration?.revision ?? null, digest = configuration?.digest ?? null;
  const source = configuration?.source ?? null, valuesJSON = configuration ? JSON.stringify(configuration.values) : null;
  if (selected.version === actual.resource.version && selected.state === state && selected.configuration_revision === revision &&
      selected.configuration_digest === digest && selected.configuration_source === source && selected.configuration_json === valuesJSON) return false;
  // Refresh only private confirmed metadata. The saved draft and immutable
  // publication remain byte-for-byte intact, guarded by the stack revision CAS.
  await change(ctx, (condition, values) => [ctx.db.prepare(`UPDATE creator_app_resources SET version=?,state=?,
    configuration_revision=?,configuration_digest=?,configuration_source=?,configuration_json=?
    WHERE id=? AND workspace_id=? AND version<=? AND ${condition}`)
    .bind(actual.resource.version, state, revision, digest, source, valuesJSON, selected.id, ctx.workspace, actual.resource.version, ...values)]);
  return true;
}

export async function applyStackResources(db: D1Database, user: string, workspace: string, stack: string, expected: number, runtime: ResourceRuntime): Promise<ResourceOperationResult> {
  const ctx = await context(db, user, workspace, stack, expected), connection = resourceConnection(runtime, workspace);
  const completed: string[] = [], problems: ResourceOperationResult['problems'] = [];
  for (const instance of ctx.document.instances) {
    if (instance.app !== 'guestbook' || instance.binding.mode === 'shared') continue;
    let selected = await allocate(ctx, instance, connection);
    sameTarget(selected, connection);
    // Explicitly reused resources inherit their selected app configuration.
    // A local own/default override must never write to a shared resource.
    if (selected.mode === 'shared') continue;
    const desired = effectiveGuestbookConfiguration(instance.config), digest = await configurationDigest(desired);
    const pending = await unfinished(db, selected.id);
    if (pending) {
      const recovered = await operation(ctx, instance, selected, connection, pending.action, {}, true);
      if (recovered.outcome !== 'applied') { problems.push({ instance: instance.id, outcome: recovered.outcome, message: recovered.message ?? 'Reconcile this resource before continuing.' }); break; }
      selected = (await binding(db, workspace, stack, instance.id))!;
    }
    if (!selected.configuration_revision && !await db.prepare("SELECT id FROM creator_resource_operations WHERE resource_id=? AND action='create' AND state='confirmed'").bind(selected.id).first()) {
      const created = await operation(ctx, instance, selected, connection, 'create', {}, false);
      if (created.outcome !== 'applied') { problems.push({ instance: instance.id, outcome: created.outcome, message: created.message ?? 'The resource creation is unconfirmed.' }); break; }
      selected = (await binding(db, workspace, stack, instance.id))!;
    }
    if (selected.state === 'ready' && selected.configuration_digest === digest && selected.configuration_source === connection.source) continue;
    const staged = await operation(ctx, instance, selected, connection, 'stage', { expectedVersion: selected.version, configuration: desired }, false);
    if (staged.outcome !== 'applied' || !staged.reply?.configuration) { problems.push({ instance: instance.id, outcome: staged.outcome === 'refused' ? 'refused' : 'unknown', message: staged.message ?? 'The app did not confirm staging.' }); break; }
    const activated = await operation(ctx, instance, selected, connection, 'activate', { expectedVersion: staged.reply.resource.version, configurationRevision: staged.reply.configuration.revision, configurationDigest: staged.reply.configuration.digest }, false);
    if (activated.outcome !== 'applied') { problems.push({ instance: instance.id, outcome: activated.outcome, message: activated.message ?? 'The app did not confirm activation.' }); break; }
    completed.push(instance.id);
  }
  const resources = await listStackResources(db, workspace, stack);
  await guard(ctx);
  return { outcome: problems.length ? (completed.length ? 'partial' : problems[0]!.outcome) : (completed.length ? 'applied' : 'unchanged'), stack: stackView(ctx.row), resources, completed, problems, publicationUnchanged: true };
}

export async function reconcileStackResources(db: D1Database, user: string, workspace: string, stack: string, expected: number, runtime: ResourceRuntime): Promise<ResourceOperationResult> {
  const ctx = await context(db, user, workspace, stack, expected), connection = resourceConnection(runtime, workspace);
  const completed: string[] = [], problems: ResourceOperationResult['problems'] = [];
  for (const instance of ctx.document.instances.filter(instance => instance.app === 'guestbook' && instance.binding.mode !== 'shared')) {
    let selected = await binding(db, workspace, stack, instance.id);
    if (!selected) continue;
    sameTarget(selected, connection);
    const pending = await unfinished(db, selected.id);
    let recovered = false;
    if (pending) {
      const outcome = await operation(ctx, instance, selected, connection, pending.action, {}, false);
      if (outcome.outcome !== 'applied') {
        problems.push({ instance: instance.id, outcome: outcome.outcome, message: outcome.message ?? 'The app operation remains unconfirmed.' });
        continue;
      }
      recovered = true;
      selected = (await binding(db, workspace, stack, instance.id))!;
    }
    let actual: AppAcknowledgement;
    try {
      actual = await connection.status(selected.id);
      if (actual.resource.version < selected.version) throw Error('The app returned an older resource version.');
    } catch {
      problems.push({ instance: instance.id, outcome: 'unknown', message: 'The current app resource could not be verified. Nothing was resubmitted.' });
      continue;
    }
    if (await refresh(ctx, selected, actual) || recovered) completed.push(instance.id);
  }
  await guard(ctx);
  return { outcome: problems.length ? (completed.length ? 'partial' : 'unknown') : (completed.length ? 'applied' : 'unchanged'), stack: stackView(ctx.row), resources: await listStackResources(db, workspace, stack), completed, problems, publicationUnchanged: true };
}

export async function reuseStackResource(db: D1Database, user: string, workspace: string, stack: string, expected: number, instanceId: string, resourceId: string, runtime: ResourceRuntime): Promise<ResourceOperationResult> {
  const ctx = await context(db, user, workspace, stack, expected), connection = resourceConnection(runtime, workspace);
  const instance = ctx.document.instances.find(instance => instance.id === instanceId && instance.app === 'guestbook' && instance.binding.mode === 'own');
  if (!instance || !id(resourceId)) throw new StackError('INVALID', 'Choose an independently listed Guestbook instance and the resource to reuse.');
  const selected = await db.prepare("SELECT * FROM creator_app_resources WHERE id=? AND workspace_id=? AND state='ready'").bind(resourceId, workspace).first<ResourceRow>();
  if (!selected) throw new StackError('FORBIDDEN', 'This resource is not ready in the selected workspace.', 403);
  sameTarget(selected, connection);
  const actual = await connection.status(resourceId);
  if (!actual.configuration || actual.resource.activeRevision !== actual.configuration.revision) throw new StackError('UNAVAILABLE', 'The selected resource has no confirmed active configuration.');
  const inherited = { ...ctx.document, instances: ctx.document.instances.map(entry => entry.id === instanceId ? { ...entry, config: actual.configuration!.values } : entry) };
  await change(ctx, (condition, values) => [
    db.prepare(`UPDATE creator_app_resources SET version=?,state='ready',configuration_revision=?,configuration_digest=?,configuration_source=?,configuration_json=?
      WHERE id=? AND workspace_id=? AND version<=? AND ${condition}`)
      .bind(actual.resource.version, actual.configuration!.revision, actual.configuration!.digest, actual.configuration!.source, JSON.stringify(actual.configuration!.values), resourceId, workspace, actual.resource.version, ...values),
    db.prepare(`INSERT INTO creator_stack_resource_bindings(stack_id,instance_id,resource_id,mode) SELECT ?,?,?,'shared' WHERE ${condition}
      ON CONFLICT(stack_id,instance_id) DO UPDATE SET resource_id=excluded.resource_id,mode='shared'`)
      .bind(stack, instanceId, resourceId, ...values),
  ], inherited);
  return { outcome: 'applied', stack: stackView(ctx.row), resources: await listStackResources(db, workspace, stack), completed: [instanceId], problems: [], publicationUnchanged: true };
}

const ownerSelection = z.object({
  stack: z.string().regex(/^[a-z0-9-]{6,64}$/),
  instance: z.string().regex(/^[a-z0-9-]{6,64}$/),
  expectedRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
const ownerMutation = z.discriminatedUnion("command", [
  z
    .object({
      command: z.literal("moderate"),
      operationId: z.uuid(),
      resource: z.string().regex(/^[a-z0-9-]{6,64}$/),
      expectedVersion: z
        .number()
        .int()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER),
      item: z.string().regex(/^[a-z0-9-]{6,64}$/),
      itemRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      status: z.enum(["approved", "hidden", "deleted"]),
    })
    .strict(),
  z
    .object({
      command: z.literal("control"),
      operationId: z.uuid(),
      resource: z.string().regex(/^[a-z0-9-]{6,64}$/),
      expectedVersion: z
        .number()
        .int()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER),
      visible: z.boolean(),
      paused: z.boolean(),
    })
    .strict(),
]);

async function ownerContext(
  db: D1Database,
  user: string,
  workspace: string,
  input: unknown,
  runtime: ResourceRuntime,
) {
  const parsed = ownerSelection.safeParse(input);
  if (!parsed.success)
    throw new StackError(
      "INVALID",
      "Choose the saved stack, visitor book and current revision.",
    );
  const selection = parsed.data;
  const ctx = await context(
    db,
    user,
    workspace,
    selection.stack,
    selection.expectedRevision,
  );
  const instance = ctx.document.instances.find(
    (entry) => entry.id === selection.instance && entry.app === "guestbook",
  );
  const source =
    instance?.binding.mode === "shared"
      ? ctx.document.instances.find(
          (entry) =>
            entry.id === instance.binding.shareOf &&
            entry.app === "guestbook" &&
            entry.binding.mode === "own",
        )
      : instance;
  if (!instance || !source)
    throw new StackError(
      "NOT_FOUND",
      "This saved instance is not an owned visitor book in this stack.",
      404,
    );
  const selected = await binding(db, workspace, ctx.row.id, source.id);
  if (!selected?.configuration_revision)
    throw new StackError(
      "CONFLICT",
      "Apply this saved visitor book before managing its content.",
      409,
    );
  const connection = resourceConnection(runtime, workspace);
  sameTarget(selected, connection);
  return {
    ctx,
    instance,
    selected,
    connection,
    shared: instance.binding.mode === "shared" || selected.mode === "shared",
  };
}
type OwnerContext = Awaited<ReturnType<typeof ownerContext>>;

async function contentView(owner: OwnerContext) {
  const { ctx, instance, selected, connection, shared } = owner;
  const { actual, items } = await connection.content(selected.id);
  await guard(ctx);
  if (actual.resource.version < selected.version || !actual.configuration)
    throw new StackError(
      "UNAVAILABLE",
      "The app did not confirm this visitor book and its current configuration.",
    );
  return {
    instance: instance.id,
    resource: selected.id,
    shared,
    title: actual.configuration.values.title,
    path: `/guestbook/r/${selected.id}/c/${actual.configuration.revision}/`,
    version: actual.resource.version,
    visible: actual.resource.visible,
    paused: actual.resource.paused,
    pending: Boolean(await unfinished(ctx.db, selected.id)),
    items: items.map((item) => ({
      id: item.id,
      caption: item.caption,
      author: item.author,
      status: item.status,
      revision: item.revision,
      synthetic: Boolean(item.synthetic),
      createdAt: item.created_at,
    })),
  };
}

export async function readResourceContent(
  db: D1Database,
  user: string,
  workspace: string,
  input: unknown,
  runtime: ResourceRuntime,
) {
  return contentView(await ownerContext(db, user, workspace, input, runtime));
}

export async function readResourceMedia(
  db: D1Database,
  user: string,
  workspace: string,
  input: unknown,
  item: unknown,
  runtime: ResourceRuntime,
) {
  if (!id(item))
    throw new StackError(
      "INVALID",
      "Choose a postcard from this visitor book.",
    );
  const owner = await ownerContext(db, user, workspace, input, runtime);
  const bytes = await owner.connection.media(owner.selected.id, item);
  // Membership, saved binding and revision are rechecked after the app await.
  await guard(owner.ctx);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return {
    instance: owner.instance.id,
    resource: owner.selected.id,
    item,
    png: btoa(binary),
  };
}

export async function manageResourceContent(
  db: D1Database,
  user: string,
  workspace: string,
  input: unknown,
  mutation: unknown,
  runtime: ResourceRuntime,
  measurement: { suppress?: boolean } = {},
) {
  const owner = await ownerContext(db, user, workspace, input, runtime);
  const { ctx, instance, selected, connection } = owner;
  ctx.measureOutcomes = !measurement.suppress;
  let outcome: RemoteOutcome | { outcome: "unchanged"; message?: string };
  if (mutation === "reconcile" || mutation === "retry") {
    const pending = await unfinished(db, selected.id);
    const retry =
      mutation === "retry" &&
      pending &&
      ["moderate", "control"].includes(pending.action);
    outcome = pending
      ? await operation(
          ctx,
          instance,
          selected,
          connection,
          pending.action,
          {},
          Boolean(retry),
        )
      : { outcome: "unchanged" };
    if (outcome.outcome !== "unknown" && outcome.outcome !== "refused") {
      try {
        const actual = await connection.status(selected.id);
        if (actual.resource.version < selected.version)
          throw Error("Older app resource.");
        if (await refresh(ctx, selected, actual))
          outcome = { outcome: "applied", reply: actual };
      } catch {
        outcome = {
          outcome: "unknown",
          message:
            "The current visitor book could not be verified. Nothing was resubmitted. Check again before changing it.",
        };
      }
    }
  } else {
    const parsed = ownerMutation.safeParse(mutation);
    if (!parsed.success)
      throw new StackError(
        "INVALID",
        "Choose a supported visitor book change with its current item and app revisions.",
      );
    if (parsed.data.resource !== selected.id)
      throw new StackError(
        "CONFLICT",
        "The saved instance now selects another visitor book. Refresh its content before changing it.",
        409,
      );
    if (await unfinished(db, selected.id)) {
      outcome = {
        outcome: "unknown",
        message:
          "Check the unfinished app operation before making another change. Nothing was resubmitted.",
      };
    } else {
      const {
        command,
        operationId,
        resource: _resource,
        ...fields
      } = parsed.data;
      // A client token may identify only one operation. Reconciliation reads
      // the recorded request; an ordinary click never replays a receipt.
      if (
        await db
          .prepare("SELECT id FROM creator_resource_operations WHERE id=?")
          .bind(operationId)
          .first()
      )
        throw new StackError(
          "CONFLICT",
          "This operation was already submitted. Check its result before making another change.",
          409,
        );
      outcome = await operation(
        ctx,
        instance,
        selected,
        connection,
        command,
        fields,
        false,
        operationId,
      );
    }
  }
  await guard(ctx);
  let book: Awaited<ReturnType<typeof contentView>> | undefined;
  try {
    book = await contentView(owner);
  } catch {
    /* A confirmed write stays confirmed even if the follow-up read fails. */
  }
  const resources = await listStackResources(db, workspace, ctx.row.id);
  await guard(ctx);
  return {
    outcome: outcome.outcome,
    message: outcome.message,
    stack: stackView(ctx.row),
    resources,
    book,
    publicationUnchanged: true as const,
  };
}

export async function resourcePublication(db: D1Database, workspace: string, stack: string, document: StackDocument, runtime?: ResourceRuntime) {
  const connection = runtime && document.instances.some(instance => instance.app === 'guestbook') ? resourceConnection(runtime, workspace) : null;
  const verified = new Set<string>();
  const instances = [];
  for (const instance of document.instances) {
    if (instance.app !== 'guestbook') { instances.push(instance); continue; }
    const source = instance.binding.mode === 'shared' ? document.instances.find(entry => entry.id === instance.binding.shareOf) : instance;
    if (!source) throw new StackError('INVALID', 'Choose the source Guestbook instance.');
    const selected = await binding(db, workspace, stack, source.id);
    if (!selected || selected.state !== 'ready' || !selected.configuration_revision || !selected.configuration_digest || !selected.configuration_source || !selected.configuration_json) throw new StackError('CONFLICT', 'Apply and confirm this Guestbook instance before publishing.', 409);
    if (connection && !verified.has(selected.id)) {
      sameTarget(selected, connection);
      const actual = await connection.status(selected.id);
      if (!actual.resource.visible) throw new StackError('CONFLICT', 'This Guestbook is not currently public. Review its resource controls before publishing.', 409);
      verified.add(selected.id);
    }
    const values = effectiveGuestbookConfiguration(JSON.parse(selected.configuration_json) as Record<string, string>);
    if (selected.mode === 'own' && await configurationDigest(effectiveGuestbookConfiguration(source.config)) !== selected.configuration_digest) throw new StackError('CONFLICT', 'This Guestbook has unapplied settings. Apply them before publishing.', 409);
    instances.push({ ...instance, config: instance.binding.mode === 'shared' ? {} : values, resource: {
      id: selected.id, configurationRevision: selected.configuration_revision, digest: selected.configuration_digest,
      source: selected.configuration_source, path: `/guestbook/r/${selected.id}/c/${selected.configuration_revision}/`,
      shared: selected.mode === 'shared' || instance.binding.mode === 'shared',
    } });
  }
  return { ...document, instances };
}
