// Creator workspaces and saved stacks (#113/#114).
//
// A stack is a named, saved composition of mini-app instances. It stores
// presentation and route configuration only: app-owned records, media and
// credentials stay in the app that owns them. Every operation resolves the
// caller's workspace from server-side membership; a client-supplied workspace
// or owner id is never trusted on its own.
export const STACK_VERSION = 1;
export const LIMITS = {
  workspaceName: 60,
  stackName: 80,
  slug: 40,
  description: 240,
  instances: 12,
  instanceLabel: 60,
  instanceCaption: 200,
};
export const THEMES = ['daylight', 'midnight'];
export const STATUSES = ['draft', 'published', 'archived'];
// The reviewed apps a stack may reference. Keep in step with src/lib/apps.ts.
export const STACK_APPS = {
  guestbook: { name: 'Here / there', route: '/guestbook', standalone: 'https://guestbook.loftwah.com' },
  showcase: { name: 'Linkarooie', route: '/showcase', standalone: 'https://showcase.loftwah.com' },
  linkcheck: { name: 'Link Check', route: 'https://share.loftwah.com', standalone: 'https://share.loftwah.com' },
  hello: { name: 'Hello World', route: 'https://ready.loftwah.com', standalone: 'https://ready.loftwah.com' },
  state: { name: 'Carry / forward', route: 'https://ai.loftwah.com', standalone: 'https://ai.loftwah.com' },
};
// Least privilege for the first invited-creator slice. Owner adds workspace and
// destructive actions; editor works on content; viewer reads and exports.
const CAPABILITIES = {
  owner: ['read', 'export', 'create', 'save', 'publish', 'unpublish', 'archive', 'restore', 'duplicate', 'delete'],
  editor: ['read', 'export', 'create', 'save', 'publish', 'unpublish', 'archive', 'restore', 'duplicate'],
  viewer: ['read', 'export'],
};
export class StackError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export function capabilityFor(role, action) {
  const allowed = CAPABILITIES[role];
  return Boolean(allowed && allowed.includes(action));
}
export function requireCapability(role, action) {
  if (!capabilityFor(role, action)) throw new StackError('FORBIDDEN', 'This role cannot ' + action + ' in this workspace.', 403);
}

const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const isOptionalText = (value, max) => value === undefined || value === null || (typeof value === 'string' && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value));
const isId = value => typeof value === 'string' && /^[a-z0-9-]{6,64}$/.test(value);

export function slugify(name) {
  const slug = String(name).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITS.slug).replace(/-+$/g, '');
  if (!slug) throw new StackError('INVALID', 'Choose a name with at least one letter or number.');
  return slug;
}

// Validate and normalise a whole stack document. Unknown apps, duplicate
// instance ids, unsupported fields and out-of-range values are refused before
// anything is written.
export function normaliseStack(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StackError('INVALID', 'Choose a stack document.');
  if (input.version !== STACK_VERSION) throw new StackError('INVALID', 'This stack document version is not supported.');
  if (!isText(input.name, LIMITS.stackName)) throw new StackError('INVALID', 'Name the stack in up to ' + LIMITS.stackName + ' characters.');
  if (!isOptionalText(input.description, LIMITS.description)) throw new StackError('INVALID', 'Keep the description under ' + LIMITS.description + ' characters.');
  const theme = input.theme ?? 'midnight';
  if (!THEMES.includes(theme)) throw new StackError('INVALID', 'Choose a supported theme.');
  if (!Array.isArray(input.instances) || input.instances.length > LIMITS.instances) throw new StackError('INVALID', 'A stack holds up to ' + LIMITS.instances + ' app instances.');
  const seen = new Set();
  const instances = input.instances.map(instance => {
    if (!instance || typeof instance !== 'object' || Array.isArray(instance)) throw new StackError('INVALID', 'Check every app instance.');
    if (!isId(instance.id)) throw new StackError('INVALID', 'Every instance needs a stable identifier.');
    if (seen.has(instance.id)) throw new StackError('INVALID', 'Two instances cannot share an identifier.');
    seen.add(instance.id);
    const app = STACK_APPS[instance.app];
    if (!app) throw new StackError('INVALID', 'Choose a reviewed app for every instance.');
    if (!isText(instance.label, LIMITS.instanceLabel)) throw new StackError('INVALID', 'Give every instance a short label.');
    if (!isOptionalText(instance.caption, LIMITS.instanceCaption)) throw new StackError('INVALID', 'Keep instance captions under ' + LIMITS.instanceCaption + ' characters.');
    if (instance.visible !== undefined && typeof instance.visible !== 'boolean') throw new StackError('INVALID', 'Visibility must be on or off.');
    return {
      id: instance.id,
      app: instance.app,
      label: instance.label.trim(),
      caption: typeof instance.caption === 'string' ? instance.caption.trim() : '',
      visible: instance.visible !== false,
    };
  });
  return {
    version: STACK_VERSION,
    name: input.name.trim(),
    description: typeof input.description === 'string' ? input.description.trim() : '',
    theme,
    instances,
  };
}

export function emptyStack(name) {
  return { version: STACK_VERSION, name: name.trim(), description: '', theme: 'midnight', instances: [] };
}

// The workspace bootstrap: an authenticated creator gets one personal
// workspace, created once and reused. Membership is the only source of
// authority for every later call.
export async function workspaceForUser(db, user) {
  if (!user || typeof user.id !== 'string' || !user.id) throw new StackError('FORBIDDEN', 'Sign in to use creator stacks.', 403);
  const existing = await db.prepare(
    'SELECT w.id, w.name, m.role FROM creator_members m JOIN creator_workspaces w ON w.id = m.workspace_id WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1',
  ).bind(user.id).first();
  if (existing) return { id: existing.id, name: existing.name, role: existing.role };
  const id = crypto.randomUUID();
  const name = (typeof user.name === 'string' && user.name.trim().slice(0, LIMITS.workspaceName)) || 'My workspace';
  await db.prepare('INSERT INTO creator_workspaces (id, name) VALUES (?, ?)').bind(id, name).run();
  await db.prepare('INSERT INTO creator_members (workspace_id, user_id, role) VALUES (?, ?, ?)').bind(id, user.id, 'owner').run();
  return { id, name, role: 'owner' };
}

export async function membership(db, workspaceId, userId) {
  const row = await db.prepare('SELECT role FROM creator_members WHERE workspace_id = ? AND user_id = ?').bind(workspaceId, userId).first();
  return row ? row.role : null;
}

// Resolve the workspace the caller asked for. A client-supplied id is only a
// selector: without matching membership it is refused, never silently replaced.
export async function resolveWorkspace(db, user, requestedId) {
  const own = await workspaceForUser(db, user);
  if (!requestedId) return own;
  if (typeof requestedId !== 'string' || !isId(requestedId)) throw new StackError('INVALID', 'Choose a valid workspace.');
  const role = await membership(db, requestedId, user.id);
  if (!role) throw new StackError('FORBIDDEN', 'This workspace is not yours.', 403);
  const row = await db.prepare('SELECT id, name FROM creator_workspaces WHERE id = ?').bind(requestedId).first();
  if (!row) throw new StackError('NOT_FOUND', 'That workspace no longer exists.', 404);
  return { id: row.id, name: row.name, role };
}

const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const toStack = row => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  status: row.status,
  revision: row.revision,
  publishedRevision: row.published_revision ?? null,
  updatedAt: row.updated_at,
  publishedAt: row.published_at ?? null,
  draft: parse(row.draft_json),
  published: row.published_json ? parse(row.published_json) : null,
});

export async function listStacks(db, workspaceId) {
  const { results } = await db.prepare(
    'SELECT id, slug, name, status, revision, published_revision, updated_at, published_at, draft_json, published_json FROM creator_stacks WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 50',
  ).bind(workspaceId).all();
  return (results ?? []).map(toStack);
}

export async function readStack(db, workspaceId, stackId) {
  if (!isId(stackId)) throw new StackError('INVALID', 'Choose a valid stack.');
  const row = await db.prepare('SELECT * FROM creator_stacks WHERE id = ? AND workspace_id = ?').bind(stackId, workspaceId).first();
  if (!row) throw new StackError('NOT_FOUND', 'That stack is not in this workspace.', 404);
  return toStack(row);
}

export async function createStack(db, workspaceId, name) {
  if (!isText(name, LIMITS.stackName)) throw new StackError('INVALID', 'Name the stack in up to ' + LIMITS.stackName + ' characters.');
  const slug = slugify(name);
  const existing = await db.prepare('SELECT id FROM creator_stacks WHERE slug = ?').bind(slug).first();
  if (existing) throw new StackError('CONFLICT', 'Another stack already uses that share address. Choose a different name.', 409);
  const id = crypto.randomUUID();
  const document = emptyStack(name);
  await db.prepare('INSERT INTO creator_stacks (id, workspace_id, slug, name, draft_json) VALUES (?, ?, ?, ?, ?)')
    .bind(id, workspaceId, slug, document.name, JSON.stringify(document)).run();
  return readStack(db, workspaceId, id);
}

export async function saveStack(db, workspaceId, stackId, document, expectedRevision) {
  const current = await readStack(db, workspaceId, stackId);
  if (current.status === 'archived') throw new StackError('CONFLICT', 'Restore this stack before editing it.', 409);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw new StackError('CONFLICT', 'This stack changed in another window. Reopen it before saving.', 409);
  const next = normaliseStack(document);
  await db.prepare('UPDATE creator_stacks SET draft_json = ?, name = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ?')
    .bind(JSON.stringify(next), next.name, stackId, workspaceId, current.revision).run();
  const updated = await readStack(db, workspaceId, stackId);
  if (updated.revision === current.revision) throw new StackError('CONFLICT', 'This stack changed while you saved. Reopen it before saving again.', 409);
  return updated;
}

export async function publishStack(db, workspaceId, stackId, expectedRevision) {
  const current = await readStack(db, workspaceId, stackId);
  if (current.status === 'archived') throw new StackError('CONFLICT', 'Restore this stack before publishing it.', 409);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw new StackError('CONFLICT', 'This stack changed in another window. Reopen it before publishing.', 409);
  if (!current.draft.instances.length) throw new StackError('INVALID', 'Add at least one app instance before publishing.');
  await db.prepare(
    "UPDATE creator_stacks SET status = 'published', published_json = draft_json, published_revision = revision, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ?",
  ).bind(stackId, workspaceId, current.revision).run();
  return readStack(db, workspaceId, stackId);
}

export async function unpublishStack(db, workspaceId, stackId) {
  const current = await readStack(db, workspaceId, stackId);
  if (current.status !== 'published') throw new StackError('CONFLICT', 'This stack is not published.', 409);
  await db.prepare("UPDATE creator_stacks SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?").bind(stackId, workspaceId).run();
  return readStack(db, workspaceId, stackId);
}

export async function setArchived(db, workspaceId, stackId, archived) {
  const current = await readStack(db, workspaceId, stackId);
  const status = archived ? 'archived' : 'draft';
  if (current.status === status) throw new StackError('CONFLICT', archived ? 'This stack is already archived.' : 'This stack is not archived.', 409);
  await db.prepare('UPDATE creator_stacks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?').bind(status, stackId, workspaceId).run();
  return readStack(db, workspaceId, stackId);
}

export async function duplicateStack(db, workspaceId, stackId) {
  const current = await readStack(db, workspaceId, stackId);
  const name = (current.name + ' copy').slice(0, LIMITS.stackName);
  let slug = slugify(name);
  if (await db.prepare('SELECT id FROM creator_stacks WHERE slug = ?').bind(slug).first()) slug = slug + '-' + crypto.randomUUID().slice(0, 4);
  const id = crypto.randomUUID();
  const document = { ...current.draft, name, instances: current.draft.instances.map(instance => ({ ...instance, id: crypto.randomUUID() })) };
  await db.prepare('INSERT INTO creator_stacks (id, workspace_id, slug, name, draft_json) VALUES (?, ?, ?, ?, ?)')
    .bind(id, workspaceId, slug, document.name, JSON.stringify(document)).run();
  return readStack(db, workspaceId, id);
}

export async function deleteStack(db, workspaceId, stackId) {
  const current = await readStack(db, workspaceId, stackId);
  await db.prepare('DELETE FROM creator_stacks WHERE id = ? AND workspace_id = ?').bind(stackId, workspaceId).run();
  return { id: current.id, name: current.name };
}

// Public read: only a published revision is ever returned, and only for the
// exact slug. Draft, archived and missing stacks are indistinguishable.
export async function publicStack(db, slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const row = await db.prepare(
    "SELECT id, slug, name, published_json, published_revision, published_at, workspace_id FROM creator_stacks WHERE slug = ? AND status = 'published' AND published_json IS NOT NULL",
  ).bind(slug).first();
  if (!row) return null;
  const document = parse(row.published_json);
  if (!document) return null;
  return { id: row.id, slug: row.slug, name: row.name, revision: row.published_revision, publishedAt: row.published_at, document };
}
