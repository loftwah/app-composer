// Route logic for the creator-stacks plugin. The host authenticates and
// authorises the caller before dispatch; this second boundary rechecks the
// admin role, the exact origin and the workspace membership, then applies the
// capability matrix. A workspace or owner id from the request body is only a
// selector and can never widen authority.
import {
  StackError,
  resolveWorkspace,
  requireCapability,
  listStacks,
  readStack,
  createStack,
  saveStack,
  publishStack,
  unpublishStack,
  setArchived,
  duplicateStack,
  deleteStack,
  listPublications,
  republishRevision,
  restoreRevisionToDraft,
  instanceConfiguration,
  exportStack,
  importStack,
  describeImport,
} from './stacks.mjs';
import { activationSummary } from './stack-activation.mjs';

const origin = 'https://composer.loftwah.com';
const fail = (code, message) => ({ ok: false, code, message });
const identifier = value => typeof value === 'string' && /^[a-z0-9-]{6,64}$/.test(value);

export async function manageStacks(ctx, runtime) {
  if (!ctx.user || ctx.user.role !== 50) return fail('FORBIDDEN', 'An invited Composer administrator is required.');
  if (runtime.PUBLIC_ORIGIN !== origin) return fail('UNAVAILABLE', 'Creator stacks are disconnected in this environment.');
  const request = ctx.request;
  const command = ctx.input && typeof ctx.input === 'object' && !Array.isArray(ctx.input) ? ctx.input : {};
  if (request.headers.get('Origin') && request.headers.get('Origin') !== origin) return fail('FORBIDDEN', 'Open this action from Composer administration.');
  const reading = request.method === 'GET';
  if (!reading && (request.headers.get('Origin') !== origin || request.headers.get('X-EmDash-Request') !== '1')) return fail('FORBIDDEN', 'Refresh Composer administration before saving.');
  const db = runtime.DB;
  if (!db || typeof db.prepare !== 'function') return fail('UNAVAILABLE', 'Creator stacks need the workspace database.');
  try {
    const workspace = await resolveWorkspace(db, ctx.user, command.workspace ?? null);
    const action = typeof command.action === 'string' ? command.action : '';
    if (reading) {
      requireCapability(workspace.role, 'read');
      if (action === 'list') return { ok: true, workspace, stacks: await listStacks(db, workspace.id) };
      if (action === 'open') return { ok: true, workspace, stack: await readStack(db, workspace.id, command.stack) };
      if (action === 'export') {
        const stack = await readStack(db, workspace.id, command.stack);
        return { ok: true, workspace, stack, export: exportStack(stack) };
      }
      if (action === 'publications') {
        if (!identifier(command.stack)) return fail('INVALID', 'Choose a valid stack.');
        return { ok: true, workspace, publications: await listPublications(db, workspace.id, command.stack) };
      }
      if (action === 'configuration') {
        if (!identifier(command.stack)) return fail('INVALID', 'Choose a valid stack.');
        const stack = await readStack(db, workspace.id, command.stack);
        const summary = activationSummary(stack.draft);
        return { ok: true, workspace, configuration: summary, instances: summary.entries.map(entry => instanceConfiguration(stack.draft, entry.instanceId)) };
      }
      return fail('INVALID', 'Choose a supported stacks action.');
    }
    if (action === 'create') {
      requireCapability(workspace.role, 'create');
      return { ok: true, workspace, stack: await createStack(db, workspace.id, command.name) };
    }
    if (action === 'import') {
      requireCapability(workspace.role, 'create');
      // Validated and summarised before the write, and the summary comes from
      // the validated document rather than from the file's own claims.
      const summary = describeImport(command.payload);
      const stack = await importStack(db, workspace.id, command.payload, { name: command.name });
      return { ok: true, workspace, stack, imported: summary };
    }
    if (action === 'save') {
      requireCapability(workspace.role, 'save');
      if (!identifier(command.stack)) return fail('INVALID', 'Choose a valid stack.');
      const document = command.document;
      if (document && typeof document === 'object' && typeof command.name === 'string' && command.name.trim()) document.name = command.name;
      return { ok: true, workspace, stack: await saveStack(db, workspace.id, command.stack, document, command.expectedRevision) };
    }
    if (action === 'publish') {
      requireCapability(workspace.role, 'publish');
      if (!identifier(command.stack)) return fail('INVALID', 'Choose a valid stack.');
      return { ok: true, workspace, stack: await publishStack(db, workspace.id, command.stack, command.expectedRevision) };
    }
    if (action === 'unpublish') {
      requireCapability(workspace.role, 'unpublish');
      if (!identifier(command.stack)) return fail('INVALID', 'Choose a valid stack.');
      return { ok: true, workspace, stack: await unpublishStack(db, workspace.id, command.stack, command.expectedRevision) };
    }
    if (action === 'archive' || action === 'restore') {
      requireCapability(workspace.role, action === 'archive' ? 'archive' : 'restore');
      if (!identifier(command.stack)) return fail('INVALID', 'Choose a valid stack.');
      return { ok: true, workspace, stack: await setArchived(db, workspace.id, command.stack, action === 'archive', command.expectedRevision) };
    }
    if (action === 'republish' || action === 'restoreRevision') {
      requireCapability(workspace.role, 'rollback');
      if (!identifier(command.stack)) return fail('INVALID', 'Choose a valid stack.');
      const revision = Number(command.revision);
      const stack = action === 'republish'
        ? await republishRevision(db, workspace.id, command.stack, revision, command.expectedRevision)
        : await restoreRevisionToDraft(db, workspace.id, command.stack, revision, command.expectedRevision);
      return { ok: true, workspace, stack };
    }
    if (action === 'duplicate') {
      requireCapability(workspace.role, 'duplicate');
      if (!identifier(command.stack)) return fail('INVALID', 'Choose a valid stack.');
      return { ok: true, workspace, stack: await duplicateStack(db, workspace.id, command.stack, command.expectedRevision) };
    }
    if (action === 'delete') {
      requireCapability(workspace.role, 'delete');
      if (!identifier(command.stack)) return fail('INVALID', 'Choose a valid stack.');
      return { ok: true, workspace, deleted: await deleteStack(db, workspace.id, command.stack, command.expectedRevision) };
    }
    return fail('INVALID', 'Choose a supported stacks action.');
  } catch (error) {
    if (error instanceof StackError) return fail(error.code, error.message);
    return fail('UNAVAILABLE', 'The workspace database could not complete this action. Refresh before retrying.');
  }
}
