import type { D1Database } from '@cloudflare/workers-types';
import { z } from 'zod';
import { isCreatorRole } from './creator-access.ts';
import { resolveWorkspace, membership, requireCapability, publicStack, StackError } from './stacks.mjs';
import { workflowCommand, workflowRecipes, workflowVersion, workflowSnapshot, type WorkflowKind, type WorkflowRun } from './workflow-contract.ts';

const origin = 'https://composer.loftwah.com';
const authority = "EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role IN ('owner','editor'))";
const listing = z.object({ action: z.literal('list'), workspace: z.string().regex(/^[a-z0-9-]{6,64}$/).optional() }).strict();
interface Runtime { DB?: D1Database; PUBLIC_ORIGIN?: unknown; RESOURCE_ACCOUNT_ID?: unknown; RESOURCE_ENVIRONMENT?: unknown }
interface User { id: string; role: number; name?: string | null }
interface Context { user?: User; request: Request; input: unknown }
interface RecipeRow { workspace_id: string; recipe: WorkflowKind; revision: number; name: string; enabled: number; account_id: string; environment: string }
interface RunRow { id: string; workspace_id: string; recipe: WorkflowKind; event_id: string; source_id: string; source_revision: number; recipe_revision: number; synthetic: number; state: 'finished' | 'needs-attention'; revision: number; attempts: number; steps_json: string; result_json: string | null; message: string; account_id: string; environment: string; created_at: string }
interface Event { id: string; source: string; revision: number; sample?: boolean; fail?: boolean }
interface Evaluation { state: 'finished' | 'needs-attention'; steps: WorkflowRun['steps']; result: WorkflowRun['result']; message: string }
const conflict = () => new StackError('CONFLICT', 'The recipe, source or access changed. Refresh before continuing.', 409);
function selectedTarget(runtime: Runtime) {
  if (typeof runtime.RESOURCE_ACCOUNT_ID !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(runtime.RESOURCE_ACCOUNT_ID) || typeof runtime.RESOURCE_ENVIRONMENT !== 'string' || !/^[a-z0-9-]{1,40}$/.test(runtime.RESOURCE_ENVIRONMENT)) throw new StackError('UNAVAILABLE', 'Workflows need the server’s selected account and environment.');
  return { account: runtime.RESOURCE_ACCOUNT_ID, environment: runtime.RESOURCE_ENVIRONMENT };
}
async function recipeRow(db: D1Database, workspace: string, recipe: WorkflowKind) {
  return db.prepare('SELECT * FROM creator_workflow_recipes WHERE workspace_id=? AND recipe=?').bind(workspace, recipe).first<RecipeRow>();
}
function checkRecipe(row: RecipeRow | null, revision: number, target: ReturnType<typeof selectedTarget>) {
  if (!row || !row.enabled || row.revision !== revision || row.account_id !== target.account || row.environment !== target.environment) throw conflict();
}
function encodeRun(row: RunRow): WorkflowRun {
  return {
    id: row.id, recipe: row.recipe, event: row.event_id, source: row.source_id,
    sourceRevision: row.source_revision, recipeRevision: row.recipe_revision, synthetic: row.synthetic === 1,
    state: row.state, revision: row.revision, attempts: row.attempts,
    steps: JSON.parse(row.steps_json), result: row.result_json ? JSON.parse(row.result_json) : null,
    message: row.message, createdAt: row.created_at, retryable: row.state === 'needs-attention' && row.attempts < 3,
  };
}
async function snapshot(db: D1Database, workspace: { id: string; name: string; role: 'owner' | 'editor' | 'viewer' }, target: ReturnType<typeof selectedTarget>) {
  const [recipes, runs] = await Promise.all([
    db.prepare('SELECT * FROM creator_workflow_recipes WHERE workspace_id=?').bind(workspace.id).all<RecipeRow>(),
    db.prepare('SELECT * FROM creator_workflow_runs WHERE workspace_id=? AND account_id=? AND environment=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(workspace.id, target.account, target.environment).all<RunRow>(),
  ]);
  return workflowSnapshot.parse({
    ok: true, version: workflowVersion, workspace, target,
    recipes: workflowRecipes.map(recipe => {
      const saved = recipes.results.find(row => row.recipe === recipe.id);
      const matches = !saved || (saved.account_id === target.account && saved.environment === target.environment);
      return { id: recipe.id, name: saved?.name ?? recipe.name, revision: saved?.revision ?? 0, enabled: Boolean(saved?.enabled && matches), scopeMatches: matches };
    }),
    runs: runs.results.map(encodeRun), limit: 500, runner: 'on-demand-native',
  });
}

async function events(db: D1Database, workspace: string, recipe: WorkflowKind): Promise<Event[]> {
  if (recipe === 'release-summary') {
    const rows = await db.prepare("SELECT id,published_revision FROM creator_stacks WHERE workspace_id=? AND status='published' AND published_revision IS NOT NULL ORDER BY published_at DESC LIMIT 20").bind(workspace).all<{ id: string; published_revision: number }>();
    return rows.results.map(row => ({ id: `stack.published/1:${row.id}:${row.published_revision}`, source: row.id, revision: row.published_revision }));
  }
  const rows = await db.prepare("SELECT id,revision FROM creator_platform_requests WHERE workspace_id=? AND status='needs-attention' ORDER BY updated_at DESC LIMIT 20").bind(workspace).all<{ id: string; revision: number }>();
  return rows.results.map(row => ({ id: `platform.needs-attention/1:${row.id}:${row.revision}`, source: row.id, revision: row.revision }));
}
async function evaluate(db: D1Database, workspace: string, recipe: WorkflowKind, event: Event): Promise<Evaluation> {
  const failed = (message: string): Evaluation => ({ state: 'needs-attention', steps: ['observed'], result: null, message });
  if (event.sample) {
    if (event.fail) return failed('The fictional sample source is unavailable. Restore sample & retry to check the recovery branch.');
    return { state: 'finished', steps: ['observed', 'source-checked', 'draft-prepared'], result: { title: recipe === 'release-summary' ? 'Fictional Trail Notes · revision 1' : 'Fictional task needs attention', body: recipe === 'release-summary' ? 'A fictional publication was checked and a summary prepared. This sample changed no stack, published nothing and contacted no provider.' : 'A fictional failed request was grouped into this attention item. The next step is to inspect the request; no remediation or email was performed.', href: '/demo' }, message: 'Sample completed with deterministic fictional data. No live source or provider was used.' };
  }
  if (recipe === 'release-summary') {
    const row = await db.prepare('SELECT slug,name,status,published_revision FROM creator_stacks WHERE id=? AND workspace_id=?').bind(event.source, workspace).first<{ slug: string; name: string; status: string; published_revision: number | null }>();
    if (!row || row.status !== 'published' || row.published_revision !== event.revision) return failed('This publication changed or was unpublished. Keep this receipt and scan again for its current state.');
    const publication = await publicStack(db, row.slug);
    if (!publication || publication.revision !== event.revision) return failed('The exact public publication could not be validated. Repair its source through Creator stacks, then retry.');
    return { state: 'finished', steps: ['observed', 'source-checked', 'draft-prepared'], result: { title: `${publication.name.slice(0, 90)} · revision ${event.revision}`, body: `Prepared from the exact stored public revision ${event.revision}. Open the published stack and verify its real journey before sharing. This checks the publication record; it does not establish a Worker release, external links or physical-device acceptance.`, href: `/s/${row.slug}` }, message: 'The current immutable publication was checked. A private summary draft is ready for review.' };
  }
  const row = await db.prepare('SELECT status,revision FROM creator_platform_requests WHERE id=? AND workspace_id=?').bind(event.source, workspace).first<{ status: string; revision: number }>();
  if (!row || row.status !== 'needs-attention' || row.revision !== event.revision) return failed('The request changed or no longer needs attention. Open its current state; this old event will not trigger remediation.');
  return { state: 'finished', steps: ['observed', 'source-checked', 'draft-prepared'], result: { title: 'A platform task needs attention', body: 'The existing request is still in Needs attention. Open Internal platform, inspect the recorded reason and use only its supported reconcile/retry action. This item contains no private request body and authorises no remediation.', href: `/_emdash/admin/plugins/composer-stacks/platform?workspace=${workspace}` }, message: 'One actionable item prepared for this request revision. Repeated scans reuse the same event identity.' };
}
function currentSource(recipe: WorkflowKind, event: Event, workspace: string, evaluation: Evaluation): { sql: string; values: (string | number)[] } {
  if (event.sample || evaluation.state !== 'finished') return { sql: '', values: [] };
  return recipe === 'release-summary'
    ? { sql: " AND EXISTS(SELECT 1 FROM creator_stacks WHERE id=? AND workspace_id=? AND status='published' AND published_revision=?)", values: [event.source, workspace, event.revision] }
    : { sql: " AND EXISTS(SELECT 1 FROM creator_platform_requests WHERE id=? AND workspace_id=? AND status='needs-attention' AND revision=?)", values: [event.source, workspace, event.revision] };
}
async function storeRun(db: D1Database, user: User, workspace: string, recipe: WorkflowKind, recipeRevision: number, target: ReturnType<typeof selectedTarget>, event: Event) {
  const retained = await db.prepare('SELECT id FROM creator_workflow_runs WHERE workspace_id=? AND recipe=? AND event_id=? AND account_id=? AND environment=?').bind(workspace, recipe, event.id, target.account, target.environment).first();
  if (retained) return;
  const evaluation = await evaluate(db, workspace, recipe, event);
  const source = currentSource(recipe, event, workspace, evaluation);
  const count = await db.prepare('SELECT COUNT(*) AS n FROM creator_workflow_runs WHERE workspace_id=?').bind(workspace).first<{ n: number }>();
  if ((count?.n ?? 0) >= 500) throw new StackError('UNAVAILABLE', 'This workspace reached its 500 workflow receipt limit. Existing results remain readable.');
  const active = event.sample ? '' : ' AND EXISTS(SELECT 1 FROM creator_workflow_recipes WHERE workspace_id=? AND recipe=? AND revision=? AND enabled=1 AND account_id=? AND environment=?)';
  const rows = await db.prepare(`INSERT OR IGNORE INTO creator_workflow_runs (id,workspace_id,recipe,event_id,source_id,source_revision,account_id,environment,recipe_revision,synthetic,state,steps_json,result_json,message)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${authority}${active}${source.sql} AND (SELECT COUNT(*) FROM creator_workflow_runs WHERE workspace_id=?)<500 RETURNING id`)
    .bind(crypto.randomUUID(), workspace, recipe, event.id, event.source, event.revision, target.account, target.environment, recipeRevision, event.sample ? 1 : 0, evaluation.state, JSON.stringify(evaluation.steps), evaluation.result ? JSON.stringify(evaluation.result) : null, evaluation.message,
      workspace, user.id, ...(event.sample ? [] : [workspace, recipe, recipeRevision, target.account, target.environment]), ...source.values, workspace).first<{ id: string }>();
  if (!rows) {
    const existing = await db.prepare('SELECT id FROM creator_workflow_runs WHERE workspace_id=? AND recipe=? AND event_id=? AND account_id=? AND environment=?').bind(workspace, recipe, event.id, target.account, target.environment).first();
    if (!existing) throw conflict();
  }
}

/** Called only by the existing authenticated native plugin route. Source rows,
 * target and actions are server-selected; browser payloads cannot import events. */
export async function manageWorkflows(ctx: Context, runtime: Runtime) {
  try {
    if (!ctx.user || !isCreatorRole(ctx.user.role)) throw new StackError('FORBIDDEN', 'A signed-in Composer creator is required.', 403);
    if (runtime.PUBLIC_ORIGIN !== origin || !runtime.DB) throw new StackError('UNAVAILABLE', 'Native workflows are disconnected in this environment.');
    const writing = ctx.request.method === 'POST';
    if ((!writing && ctx.request.method !== 'GET') || (writing && (ctx.request.headers.get('Origin') !== origin || ctx.request.headers.get('X-EmDash-Request') !== '1')) || (!writing && ctx.request.headers.has('Origin') && ctx.request.headers.get('Origin') !== origin)) throw new StackError('FORBIDDEN', 'Open workflows from Composer administration.', 403);
    const target = selectedTarget(runtime), db = runtime.DB, user = ctx.user;
    const command = writing ? workflowCommand.parse(ctx.input) : listing.parse(ctx.input);
    const workspace = await resolveWorkspace(db, user, command.workspace ?? null);
    requireCapability(workspace.role, writing ? 'save' : 'read');
    if (command.action === 'save') {
      const previous = await recipeRow(db, workspace.id, command.recipe);
      if ((previous?.revision ?? 0) !== command.expectedRevision) throw conflict();
      const changed = previous
        ? await db.prepare(`UPDATE creator_workflow_recipes SET name=?,enabled=?,revision=revision+1,account_id=?,environment=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND recipe=? AND revision=? AND ${authority} RETURNING revision`).bind(command.name, command.enabled ? 1 : 0, target.account, target.environment, user.id, workspace.id, command.recipe, command.expectedRevision, workspace.id, user.id).first()
        : await db.prepare(`INSERT OR IGNORE INTO creator_workflow_recipes (workspace_id,recipe,name,enabled,account_id,environment,updated_by) SELECT ?,?,?,?,?,?,? WHERE ${authority} RETURNING revision`).bind(workspace.id, command.recipe, command.name, command.enabled ? 1 : 0, target.account, target.environment, user.id, workspace.id, user.id).first();
      if (!changed) throw conflict();
    } else if (command.action === 'scan') {
      checkRecipe(await recipeRow(db, workspace.id, command.recipe), command.expectedRevision, target);
      for (const event of await events(db, workspace.id, command.recipe)) await storeRun(db, user, workspace.id, command.recipe, command.expectedRevision, target, event);
    } else if (command.action === 'sample') {
      await storeRun(db, user, workspace.id, command.recipe, 0, target, { id: `sample/1:${command.operation}`, source: `sample-${command.operation}`, revision: 1, sample: true, fail: command.fail });
    } else if (command.action === 'retry') {
      const row = await db.prepare('SELECT * FROM creator_workflow_runs WHERE id=? AND workspace_id=? AND account_id=? AND environment=?').bind(command.run, workspace.id, target.account, target.environment).first<RunRow>();
      if (!row || row.revision !== command.expectedRevision || row.state !== 'needs-attention' || row.attempts >= 3) throw conflict();
      const active = await recipeRow(db, workspace.id, row.recipe);
      if (!row.synthetic) checkRecipe(active, active?.revision ?? 0, target);
      const evaluation = await evaluate(db, workspace.id, row.recipe, { id: row.event_id, source: row.source_id, revision: row.source_revision, sample: row.synthetic === 1 });
      const source = currentSource(row.recipe, { id: row.event_id, source: row.source_id, revision: row.source_revision, sample: row.synthetic === 1 }, workspace.id, evaluation);
      const activeSQL = row.synthetic ? '' : ' AND EXISTS(SELECT 1 FROM creator_workflow_recipes WHERE workspace_id=? AND recipe=? AND revision=? AND enabled=1 AND account_id=? AND environment=?)';
      const updated = await db.prepare(`UPDATE creator_workflow_runs SET state=?,steps_json=?,result_json=?,message=?,attempts=attempts+1,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND state='needs-attention' AND attempts<3 AND ${authority}${activeSQL}${source.sql} RETURNING id`)
        .bind(evaluation.state, JSON.stringify(evaluation.steps), evaluation.result ? JSON.stringify(evaluation.result) : null, evaluation.message, row.id, workspace.id, row.revision, workspace.id, user.id, ...(row.synthetic ? [] : [workspace.id, row.recipe, active!.revision, target.account, target.environment]), ...source.values).first();
      if (!updated) throw conflict();
    }
    const result = await snapshot(db, workspace, target);
    requireCapability(await membership(db, workspace.id, user.id), writing ? 'save' : 'read');
    return result;
  } catch (cause) {
    return cause instanceof StackError ? { ok: false as const, code: cause.code, message: cause.message }
      : cause instanceof z.ZodError ? { ok: false as const, code: 'INVALID', message: 'Choose a supported recipe and valid fields. Imported content cannot select an action, account or event.' }
      : { ok: false as const, code: 'UNAVAILABLE', message: 'The workflow result could not be confirmed. Refresh its persisted history before retrying.' };
  }
}
