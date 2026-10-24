import { z } from 'zod';

export const workflowVersion = 'composer.workflow/1';
const id = z.string().regex(/^[a-z0-9-]{6,64}$/);
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const workflowKind = z.enum(['release-summary', 'operation-attention']);
export type WorkflowKind = z.infer<typeof workflowKind>;
export const workflowRecipes = [
  { id: 'release-summary' as const, name: 'A summary after publication', when: 'A saved stack is published', condition: 'Its current immutable publication can be read', action: 'Prepare a checked summary draft', help: 'A draft based on the exact saved publication, with a link to open it. This does not publish a post or verify a deployed Worker.' },
  { id: 'operation-attention' as const, name: 'A failed task needs attention', when: 'An internal platform request needs attention', condition: 'The request still belongs to this workspace and is still failing', action: 'Prepare one actionable attention item', help: 'Group each request revision into one result with its existing recovery destination. No automatic remediation or email is performed.' },
];
export const workflowExport = z.object({
  version: z.literal(workflowVersion), recipe: workflowKind,
  name: z.string().trim().min(1).max(80),
  trigger: z.enum(['stack.published/1', 'platform.needs-attention/1']),
  action: z.enum(['prepare-summary', 'prepare-attention']),
  connectionReferences: z.array(z.string()).length(0),
}).strict().superRefine((value, ctx) => {
  if (value.trigger !== (value.recipe === 'release-summary' ? 'stack.published/1' : 'platform.needs-attention/1') || value.action !== (value.recipe === 'release-summary' ? 'prepare-summary' : 'prepare-attention')) ctx.addIssue({ code: 'custom', message: 'The recipe trigger and action do not match.' });
});
export function exportWorkflow(recipe: WorkflowKind, name: string) {
  return workflowExport.parse({ version: workflowVersion, recipe, name, trigger: recipe === 'release-summary' ? 'stack.published/1' : 'platform.needs-attention/1', action: recipe === 'release-summary' ? 'prepare-summary' : 'prepare-attention', connectionReferences: [] });
}
export const workflowCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), workspace: id, recipe: workflowKind, expectedRevision: revision, name: z.string().trim().min(1).max(80), enabled: z.boolean() }).strict(),
  z.object({ action: z.literal('scan'), workspace: id, recipe: workflowKind, expectedRevision: revision }).strict(),
  z.object({ action: z.literal('sample'), workspace: id, recipe: workflowKind, operation: z.uuid(), fail: z.boolean() }).strict(),
  z.object({ action: z.literal('retry'), workspace: id, run: z.uuid(), expectedRevision: revision.refine(value => value > 0) }).strict(),
]);
const result = z.object({ title: z.string().max(120), body: z.string().max(1600), href: z.string().regex(/^\/(s\/[a-z0-9-]+|_emdash\/admin\/plugins\/composer-stacks\/platform\?workspace=[a-z0-9-]+|demo)$/) }).strict();
export const workflowRun = z.object({
  id: z.uuid(), recipe: workflowKind, event: z.string().max(180), source: id,
  sourceRevision: revision, recipeRevision: revision, synthetic: z.boolean(),
  state: z.enum(['finished', 'needs-attention']), revision: revision,
  attempts: z.number().int().min(1).max(3), steps: z.array(z.enum(['observed', 'source-checked', 'draft-prepared'])).max(3),
  result: result.nullable(), message: z.string().max(1000), createdAt: z.string().max(40), retryable: z.boolean(),
}).strict();
export const workflowSnapshot = z.object({
  ok: z.literal(true), version: z.literal(workflowVersion),
  workspace: z.object({ id, name: z.string().max(80), role: z.enum(['owner', 'editor', 'viewer']) }),
  target: z.object({ account: z.string().min(1).max(80), environment: z.string().min(1).max(40) }),
  recipes: z.array(z.object({ id: workflowKind, name: z.string().max(80), revision, enabled: z.boolean(), scopeMatches: z.boolean() }).strict()).length(2),
  runs: z.array(workflowRun).max(50), limit: z.literal(500), runner: z.literal('on-demand-native'),
}).strict();
export type WorkflowSnapshot = z.infer<typeof workflowSnapshot>;
export type WorkflowRun = z.infer<typeof workflowRun>;
