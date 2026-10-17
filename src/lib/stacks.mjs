// Creator workspaces and saved stacks (#113/#114).
//
// A stack is a named, saved composition of mini-app instances. It stores
// presentation and route configuration only: app-owned records, media and
// credentials stay in the app that owns them. Every operation resolves the
// caller's workspace from server-side membership; a client-supplied workspace
// or owner id is never trusted on its own.
import { appSettings, validateAppSettingValue } from './app-settings.mjs';
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
export const BINDING_MODES = ['own', 'shared'];
// The reviewed apps a stack may reference. Keep in step with src/lib/apps.ts.
// `purpose` is the public sentence used by the editor, the public page and
// sharing; it describes what the software does, not how it is built.
export const STACK_APPS = {
  guestbook: { name: 'Here / there', route: '/guestbook', standalone: 'https://guestbook.loftwah.com', purpose: 'Collect visitor photos and messages, with approval before publication.' },
  showcase: { name: 'Linkarooie', route: '/showcase', standalone: 'https://showcase.loftwah.com', purpose: 'Your links, projects and favourite finds in one place.' },
  linkcheck: { name: 'Link Check', route: 'https://share.loftwah.com', standalone: 'https://share.loftwah.com', purpose: 'Check a link’s status, redirects and sharing preview.' },
  hello: { name: 'Hello World', route: 'https://ready.loftwah.com', standalone: 'https://ready.loftwah.com', purpose: 'Deploy your first app and confirm it is live.' },
  state: { name: 'Carry / forward', route: 'https://ai.loftwah.com', standalone: 'https://ai.loftwah.com', purpose: 'Carry your context between AI tools.' },
};
// Least privilege for the first invited-creator slice. Owner adds workspace and
// destructive actions; editor works on content; viewer reads and exports.
// `rollback` changes only which stored publication is public, so an editor may
// do it, but it never restores app content or media.
export const CAPABILITIES = {
  owner: ['read', 'export', 'create', 'save', 'publish', 'unpublish', 'archive', 'restore', 'duplicate', 'rollback', 'delete'],
  editor: ['read', 'export', 'create', 'save', 'publish', 'unpublish', 'archive', 'restore', 'duplicate', 'rollback'],
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

// Declared, validated app capability. Composer reads the composition contract's
// declared configuration and capabilities; it never invents a control an app
// has not published, and it never stores credentials in a stack document.
export function declaredConfig(appId) {
  const model = appSettings[appId];
  if (!model) return null;
  return model.fields.map(field => ({
    key: field.key,
    label: field.label,
    type: field.type,
    default: field.default ?? '',
    maxLength: field.maxLength ?? null,
    options: field.choices?.length ? field.choices.map(choice => choice.value) : null,
  }));
}
export function appCapabilities(appId) {
  return [...(appSettings[appId]?.capabilities ?? [])];
}
// A stack may only carry configuration an app has declared for itself, and the
// values are validated with the same rules the operator apply path uses.
function normaliseInstanceConfig(app, config, shareOf, label) {
  if (config === undefined || config === null) return {};
  if (typeof config !== 'object' || Array.isArray(config)) throw new StackError('INVALID', 'Check the settings stored on this instance.');
  // An empty group is not a claim about the app; it is simply nothing set here.
  if (!Object.keys(config).length) return {};
  const declared = declaredConfig(app);
  if (!declared) throw new StackError('INVALID', 'Only ' + label + '’s declared settings can be stored on this instance.');
  const clean = {};
  for (const [key, value] of Object.entries(config)) {
    const field = declared.find(entry => entry.key === key);
    if (!field) throw new StackError('INVALID', '“' + key + '” is not a setting ' + label + ' declares.');
    if (value === '' || value === null || value === undefined) continue;
    try {
      clean[key] = validateAppSettingValue(modelField(app, field), value, label);
    } catch (error) {
      throw new StackError('INVALID', error instanceof Error ? error.message : 'Check the instance settings.');
    }
  }
  return clean;
}
const modelField = (app, field) => {
  const model = appSettings[app];
  return model.fields.find(entry => entry.key === field.key) ?? field;
};

export function slugify(name) {
  const slug = String(name).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITS.slug).replace(/-+$/g, '');
  if (!slug) throw new StackError('INVALID', 'Choose a name with at least one letter or number.');
  return slug;
}

// Validate and normalise a whole stack document. Unknown apps, duplicate
// instance ids, unsupported fields, out-of-range values and undeclared settings
// are refused before anything is written.
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
    const bindingInput = instance.binding ?? {};
    if (bindingInput && (typeof bindingInput !== 'object' || Array.isArray(bindingInput))) throw new StackError('INVALID', 'Check how every instance is bound.');
    const mode = bindingInput.mode ?? 'own';
    if (!BINDING_MODES.includes(mode)) throw new StackError('INVALID', 'Choose how the instance is bound.');
    const shareOf = mode === 'shared' ? bindingInput.shareOf : null;
    if (mode === 'shared' && !isId(shareOf)) throw new StackError('INVALID', 'A shared instance must name the instance it reuses.');
    if (mode === 'shared' && instance.config && Object.keys(instance.config).length) {
      throw new StackError('INVALID', 'A shared instance inherits its settings; it cannot also store its own.');
    }
    const config = mode === 'shared' ? {} : normaliseInstanceConfig(instance.app, instance.config, shareOf, app.name);
    return {
      id: instance.id,
      app: instance.app,
      label: instance.label.trim(),
      caption: typeof instance.caption === 'string' ? instance.caption.trim() : '',
      visible: instance.visible !== false,
      binding: { mode, shareOf: shareOf ?? null },
      config,
    };
  });
  // A shared instance must point at another instance of the same app, and the
  // referenced instance must be the independently configured one. This is what
  // makes "reused" and "independent" mean something for app content, which the
  // app itself owns as one set of records.
  instances.forEach(instance => {
    if (instance.binding.mode !== 'shared') return;
    const source = instances.find(entry => entry.id === instance.binding.shareOf);
    if (!source || source.id === instance.id) throw new StackError('INVALID', 'A shared instance must reuse another instance in this stack.');
    if (source.app !== instance.app) throw new StackError('INVALID', 'A shared instance must reuse an instance of the same app.');
    if (source.binding.mode === 'shared') throw new StackError('INVALID', 'Reuse the independently configured instance, not another shared one.');
  });
  // Composer can only apply one configuration per app-owned resource. A second
  // independently configured instance of the same app would silently overwrite
  // the first, so it is refused rather than reported as applied.
  const ownByApp = new Set();
  instances.forEach(instance => {
    if (instance.binding.mode !== 'own') return;
    if (ownByApp.has(instance.app)) throw new StackError('INVALID', 'This stack already configures ' + STACK_APPS[instance.app].name + ' independently. Reuse that instance instead so the two cannot disagree.');
    ownByApp.add(instance.app);
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

// The declared, validated settings an instance may carry, and the plan a safe
// activation would use. Credentials never appear here; only declared values and
// the exact pinned source they belong to.
export function instanceConfiguration(stack, instanceId) {
  const instance = normaliseStack(stack).instances.find(entry => entry.id === instanceId);
  if (!instance) throw new StackError('NOT_FOUND', 'That instance is not in this stack.', 404);
  const source = appSettings[instance.app];
  return {
    app: instance.app,
    name: STACK_APPS[instance.app].name,
    mode: instance.binding.mode,
    shareOf: instance.binding.shareOf,
    declared: declaredConfig(instance.app) ?? [],
    capabilities: appCapabilities(instance.app),
    config: instance.config,
    source: source ? { ...source.source } : null,
  };
}

// The workspace bootstrap: an authenticated creator gets one personal
// workspace, created once and reused. Membership is the only source of
// authority for every later call.
//
// A creator who already belongs to a workspace (an invitation) keeps that
// workspace as the one they land in. Otherwise the bootstrap is atomic: the
// chosen workspace is recorded in `creator_personal_workspaces` under a
// primary-key invariant and every following write is an insert-or-ignore, so
// two simultaneous first calls converge on the same workspace and the loser
// still completes it. Further memberships remain possible through the
// membership model; only the initial choice needs to be race-free.
export async function workspaceForUser(db, user) {
  if (!user || typeof user.id !== 'string' || !user.id) throw new StackError('FORBIDDEN', 'Sign in to use creator stacks.', 403);
  const existing = await db.prepare(
    'SELECT w.id, w.name, m.role FROM creator_members m JOIN creator_workspaces w ON w.id = m.workspace_id WHERE m.user_id = ? ORDER BY m.created_at, w.id LIMIT 1',
  ).bind(user.id).first();
  if (existing) return { id: existing.id, name: existing.name, role: existing.role };
  const name = (typeof user.name === 'string' && user.name.trim().slice(0, LIMITS.workspaceName)) || 'My workspace';
  const candidate = crypto.randomUUID();
  await db.prepare('INSERT OR IGNORE INTO creator_personal_workspaces (user_id, workspace_id) VALUES (?, ?)').bind(user.id, candidate).run();
  const settled = await db.prepare('SELECT workspace_id FROM creator_personal_workspaces WHERE user_id = ?').bind(user.id).first();
  if (!settled) throw new StackError('UNAVAILABLE', 'The workspace could not be opened. Try again.', 503);
  const id = settled.workspace_id;
  await db.prepare('INSERT OR IGNORE INTO creator_workspaces (id, name) VALUES (?, ?)').bind(id, name).run();
  await db.prepare('INSERT OR IGNORE INTO creator_members (workspace_id, user_id, role) VALUES (?, ?, ?)').bind(id, user.id, 'owner').run();
  const row = await db.prepare('SELECT w.id, w.name, m.role FROM creator_members m JOIN creator_workspaces w ON w.id = m.workspace_id WHERE w.id = ? AND m.user_id = ?').bind(id, user.id).first();
  if (!row) throw new StackError('UNAVAILABLE', 'The workspace could not be opened. Try again.', 503);
  return { id: row.id, name: row.name, role: row.role };
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
// A guarded write that affects no row means another request won the race. The
// count is authoritative when the binding reports it; every mutation also
// re-reads and checks the exact revision it intended to write, so a missing
// count can never be mistaken for success.
const changedRows = result => {
  const changes = result && result.meta && result.meta.changes;
  return typeof changes === 'number' ? changes : null;
};
const lostRace = message => new StackError('CONFLICT', message, 409);
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
// A public field may only come from the immutable publication snapshot. The
// mutable columns on the stack row describe the private draft, so the published
// document itself is the single source for name, description, theme, labels,
// configuration references and sharing metadata.
const publishedView = row => {
  const document = parse(row.document_json);
  if (!document) return null;
  return {
    id: row.id,
    slug: row.slug,
    revision: row.revision,
    publishedAt: row.published_at,
    name: document.name,
    description: document.description ?? '',
    theme: document.theme,
    document,
  };
};

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
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw lostRace('This stack changed in another window. Your work is still here; reopen the stack to compare.');
  const next = normaliseStack(document);
  const payload = JSON.stringify(next);
  const result = await db.prepare('UPDATE creator_stacks SET draft_json = ?, name = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ?')
    .bind(payload, next.name, stackId, workspaceId, current.revision).run();
  if (changedRows(result) === 0) throw lostRace('Another window saved first. Your unsaved work is still here; reopen the stack to compare.');
  const updated = await readStack(db, workspaceId, stackId);
  // The revision and the exact document must both be the ones this call wrote.
  if (updated.revision !== current.revision + 1 || JSON.stringify(updated.draft) !== payload) {
    throw lostRace('Another window saved first. Your unsaved work is still here; reopen the stack to compare.');
  }
  return updated;
}

export async function publishStack(db, workspaceId, stackId, expectedRevision) {
  const current = await readStack(db, workspaceId, stackId);
  if (current.status === 'archived') throw new StackError('CONFLICT', 'Restore this stack before publishing it.', 409);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw lostRace('This stack changed in another window. Reopen it before publishing.');
  if (!current.draft.instances.length) throw new StackError('INVALID', 'Add at least one app instance before publishing.');
  const payload = JSON.stringify(current.draft);
  const result = await db.prepare(
    "UPDATE creator_stacks SET status = 'published', published_json = draft_json, published_revision = revision, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ? AND status != 'archived'",
  ).bind(stackId, workspaceId, current.revision).run();
  if (changedRows(result) === 0) throw lostRace('Another window changed this stack before it published. Reopen it and publish the revision you want.');
  // Record the immutable publication. The insert is idempotent, and the read
  // below must find exactly this revision and document, so a failed insert or a
  // concurrent writer cannot present as a successful publication.
  await db.prepare('INSERT OR IGNORE INTO creator_stack_publications (stack_id, revision, document_json) VALUES (?, ?, ?)')
    .bind(stackId, current.revision, payload).run();
  const activated = await db.prepare('SELECT p.revision, p.document_json FROM creator_stacks s JOIN creator_stack_publications p ON p.stack_id = s.id WHERE s.id = ? AND s.published_revision = p.revision').bind(stackId).first();
  const updated = await readStack(db, workspaceId, stackId);
  if (!activated || activated.revision !== current.revision || JSON.stringify(parse(activated.document_json)) !== payload) {
    throw lostRace('Another window changed this stack before it published. Reopen it and publish the revision you want.');
  }
  if (updated.publishedRevision !== current.revision) {
    throw lostRace('Another window changed this stack before it published. Reopen it and publish the revision you want.');
  }
  return updated;
}

// Immutable publication history, newest first. The published snapshot alone is
// not a history: this list names every revision that was actually activated.
export async function listPublications(db, workspaceId, stackId) {
  await readStack(db, workspaceId, stackId);
  const { results } = await db.prepare(
    'SELECT p.revision, p.published_at, p.document_json FROM creator_stack_publications p JOIN creator_stacks s ON s.id = p.stack_id WHERE p.stack_id = ? AND s.workspace_id = ? ORDER BY p.revision DESC LIMIT 50',
  ).bind(stackId, workspaceId).all();
  return (results ?? []).map(row => ({ revision: row.revision, publishedAt: row.published_at, document: parse(row.document_json) }));
}

// Rollback, split into the two things it can actually mean. Republishing a
// stored revision swaps the public page back to that exact publication and
// leaves the current draft untouched; restoring one into the draft brings that
// configuration forward as a new editable revision. Neither restores app
// records, media or deletions, because Composer never owned them.
export async function republishRevision(db, workspaceId, stackId, revision, expectedRevision) {
  const current = await readStack(db, workspaceId, stackId);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw lostRace('This stack changed in another window. Reopen it before rolling the public page back.');
  const release = await publicationRow(db, workspaceId, stackId, revision);
  if (!release) throw new StackError('NOT_FOUND', 'That published revision is not in this stack’s history.', 404);
  const result = await db.prepare(
    "UPDATE creator_stacks SET status = 'published', published_json = ?, published_revision = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ?",
  ).bind(release.document_json, revision, stackId, workspaceId, current.revision).run();
  if (changedRows(result) === 0) throw lostRace('Another window changed this stack. Reopen it before rolling the public page back.');
  const updated = await readStack(db, workspaceId, stackId);
  if (updated.publishedRevision !== revision) throw lostRace('Another window changed this stack. Reopen it before rolling the public page back.');
  return updated;
}
export async function restoreRevisionToDraft(db, workspaceId, stackId, revision, expectedRevision) {
  const current = await readStack(db, workspaceId, stackId);
  if (current.status === 'archived') throw new StackError('CONFLICT', 'Restore this stack before editing it.', 409);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw lostRace('This stack changed in another window. Reopen it before restoring configuration.');
  const release = await publicationRow(db, workspaceId, stackId, revision);
  if (!release) throw new StackError('NOT_FOUND', 'That published revision is not in this stack’s history.', 404);
  const document = normaliseStack(parse(release.document_json));
  const result = await db.prepare('UPDATE creator_stacks SET draft_json = ?, name = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ?')
    .bind(JSON.stringify(document), document.name, stackId, workspaceId, current.revision).run();
  if (changedRows(result) === 0) throw lostRace('Another window changed this stack. Reopen it before restoring configuration.');
  const updated = await readStack(db, workspaceId, stackId);
  if (updated.revision !== current.revision + 1 || JSON.stringify(updated.draft) !== JSON.stringify(document)) {
    throw lostRace('Another window changed this stack. Reopen it before restoring configuration.');
  }
  return updated;
}
async function publicationRow(db, workspaceId, stackId, revision) {
  if (!Number.isInteger(revision) || revision < 1) throw new StackError('INVALID', 'Choose a published revision.');
  return db.prepare(
    'SELECT p.revision, p.document_json FROM creator_stack_publications p JOIN creator_stacks s ON s.id = p.stack_id WHERE p.stack_id = ? AND s.workspace_id = ? AND p.revision = ?',
  ).bind(stackId, workspaceId, revision).first();
}

export async function unpublishStack(db, workspaceId, stackId, expectedRevision) {
  const current = await readStack(db, workspaceId, stackId);
  if (current.status !== 'published') throw new StackError('CONFLICT', 'This stack is not published.', 409);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw lostRace('This stack changed in another window. Reopen it before unpublishing.');
  const result = await db.prepare("UPDATE creator_stacks SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ? AND status = 'published'")
    .bind(stackId, workspaceId, current.revision).run();
  if (changedRows(result) === 0) throw lostRace('Another window changed this stack before it unpublished. Reopen it.');
  return readStack(db, workspaceId, stackId);
}

export async function setArchived(db, workspaceId, stackId, archived, expectedRevision) {
  const current = await readStack(db, workspaceId, stackId);
  const status = archived ? 'archived' : 'draft';
  if (current.status === status) throw new StackError('CONFLICT', archived ? 'This stack is already archived.' : 'This stack is not archived.', 409);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw lostRace('This stack changed in another window. Reopen it first.');
  // Archiving keeps the publication recorded but stops serving it; restoring
  // returns the stack to draft so the owner chooses when it is public again.
  const result = await db.prepare('UPDATE creator_stacks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ?')
    .bind(status, stackId, workspaceId, current.revision).run();
  if (changedRows(result) === 0) throw lostRace('Another window changed this stack before it moved. Reopen it first.');
  const updated = await readStack(db, workspaceId, stackId);
  if (updated.status !== status) throw lostRace('Another window changed this stack before it moved. Reopen it first.');
  return updated;
}

export async function duplicateStack(db, workspaceId, stackId, expectedRevision) {
  const current = await readStack(db, workspaceId, stackId);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw lostRace('This stack changed in another window. Reopen it before duplicating.');
  const name = (current.name + ' copy').slice(0, LIMITS.stackName);
  let slug = slugify(name);
  if (await db.prepare('SELECT id FROM creator_stacks WHERE slug = ?').bind(slug).first()) slug = slug + '-' + crypto.randomUUID().slice(0, 4);
  const id = crypto.randomUUID();
  // Fresh identities, but the reuse relationships are preserved so a duplicated
  // stack keeps the same shared-versus-independent structure.
  const remap = new Map(current.draft.instances.map(instance => [instance.id, crypto.randomUUID()]));
  const document = {
    ...current.draft,
    name,
    instances: current.draft.instances.map(instance => ({
      ...instance,
      id: remap.get(instance.id),
      binding: { mode: instance.binding?.mode ?? 'own', shareOf: instance.binding?.shareOf ? remap.get(instance.binding.shareOf) ?? null : null },
    })),
  };
  normaliseStack(document);
  await db.prepare('INSERT INTO creator_stacks (id, workspace_id, slug, name, draft_json) VALUES (?, ?, ?, ?, ?)')
    .bind(id, workspaceId, slug, document.name, JSON.stringify(document)).run();
  return readStack(db, workspaceId, id);
}

export async function deleteStack(db, workspaceId, stackId, expectedRevision) {
  const current = await readStack(db, workspaceId, stackId);
  if (expectedRevision !== undefined && expectedRevision !== current.revision) throw lostRace('This stack changed in another window. Reopen it before deleting.');
  const result = await db.prepare('DELETE FROM creator_stacks WHERE id = ? AND workspace_id = ? AND revision = ?').bind(stackId, workspaceId, current.revision).run();
  if (changedRows(result) === 0) throw lostRace('Another window changed this stack before it was deleted. Reopen it first.');
  // Removing the configuration also removes its publication history; the
  // response says so, because app records, media and app-owned configuration
  // are not part of this and were never deleted.
  return { id: current.id, name: current.name, slug: current.slug, removedPublications: true };
}

// Public read: only an exact published revision of an exact slug is ever
// returned, and every field comes from that immutable publication snapshot.
// Draft, archived and missing stacks are indistinguishable.
export async function publicStack(db, slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const row = await db.prepare(
    "SELECT s.id, s.slug, p.revision, p.published_at, p.document_json FROM creator_stacks s JOIN creator_stack_publications p ON p.stack_id = s.id AND p.revision = s.published_revision WHERE s.slug = ? AND s.status = 'published' AND s.published_json IS NOT NULL",
  ).bind(slug).first();
  if (!row) return null;
  return publishedView(row);
}
