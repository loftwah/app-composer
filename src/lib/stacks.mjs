// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
import { appSettings, validateAppSettingValue, } from "./app-settings.mjs";
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const positiveInteger = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
const isRole = (value) => value === "owner" || value === "editor" || value === "viewer";
const unavailable = () => new StackError("UNAVAILABLE", "Stored stack data could not be read safely. Refresh before trying again.", 503);
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
export const THEMES = ["daylight", "midnight"];
export const STATUSES = ["draft", "published", "archived"];
export const BINDING_MODES = ["own", "shared"];
// The reviewed apps a stack may reference. Keep in step with src/lib/apps.ts.
// `purpose` is the public sentence used by the editor, the public page and
// sharing; it describes what the software does, not how it is built.
export const STACK_APPS = {
    guestbook: {
        name: "Here / there",
        route: "/guestbook",
        standalone: "https://guestbook.loftwah.com",
        purpose: "Collect visitor photos and messages, with approval before publication.",
    },
    showcase: {
        name: "Linkarooie",
        route: "/showcase",
        standalone: "https://showcase.loftwah.com",
        purpose: "Your links, projects and favourite finds in one place.",
    },
    linkcheck: {
        name: "Link Check",
        route: "https://share.loftwah.com",
        standalone: "https://share.loftwah.com",
        purpose: "Check a link’s status, redirects and sharing preview.",
    },
    hello: {
        name: "Hello World",
        route: "https://ready.loftwah.com",
        standalone: "https://ready.loftwah.com",
        purpose: "Deploy your first app and confirm it is live.",
    },
    state: {
        name: "Carry / forward",
        route: "https://ai.loftwah.com",
        standalone: "https://ai.loftwah.com",
        purpose: "Carry your context between AI tools.",
    },
};
// Least privilege for the first invited-creator slice. Owner adds workspace and
// destructive actions; editor works on content; viewer reads and exports.
// `rollback` changes only which stored publication is public, so an editor may
// do it, but it never restores app content or media.
export const CAPABILITIES = {
    owner: [
        "read",
        "export",
        "create",
        "save",
        "publish",
        "unpublish",
        "archive",
        "restore",
        "duplicate",
        "rollback",
        "delete",
    ],
    editor: [
        "read",
        "export",
        "create",
        "save",
        "publish",
        "unpublish",
        "archive",
        "restore",
        "duplicate",
        "rollback",
    ],
    viewer: ["read", "export"],
};
export class StackError extends Error {
    code;
    status;
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
export function capabilityFor(role, action) {
    const allowed = typeof role === "string" && Object.hasOwn(CAPABILITIES, role)
        ? CAPABILITIES[role]
        : null;
    return Boolean(allowed && allowed.includes(action));
}
export function requireCapability(role, action) {
    if (!capabilityFor(role, action))
        throw new StackError("FORBIDDEN", "This role cannot " + action + " in this workspace.", 403);
}
const platformActors = new WeakMap();
export function trustedPlatformActor(userId, requestId, leaseToken) {
    if (![userId, requestId, leaseToken].every((value) => typeof value === "string" && value.length > 0))
        throw new StackError("FORBIDDEN", "A current platform execution is required.", 403);
    const actor = Object.freeze({});
    platformActors.set(actor, { userId, requestId, leaseToken });
    return actor;
}
function platformActor(actor) {
    return actor !== null && typeof actor === "object"
        ? platformActors.get(actor)
        : undefined;
}
// Resource staging shares the same unforgeable in-process execution identity.
export function platformExecutionIdentity(actor) {
    const execution = platformActor(actor);
    return execution ? Object.freeze({ ...execution }) : undefined;
}
function actorId(actor) {
    return platformActor(actor)?.userId ?? actor;
}
// Native requests supply the authenticated actor. Trusted server-side tools
// and existing fixtures may omit it; no browser field selects this authority.
function writeMembership(workspaceId, actor, action) {
    if (actor === null)
        return { sql: "", values: [] };
    const execution = platformActor(actor);
    const member = actorId(actor);
    if (typeof member !== "string" ||
        !member ||
        (execution && action !== "publish"))
        throw new StackError("FORBIDDEN", "A current workspace member is required.", 403);
    const roles = Object.keys(CAPABILITIES).filter((role) => capabilityFor(role, action));
    const membershipSQL = ` AND EXISTS(SELECT 1 FROM creator_members WHERE workspace_id=? AND user_id=? AND role IN (${roles.map(() => "?").join(",")}))`;
    if (execution)
        return {
            sql: membershipSQL +
                ` AND EXISTS(SELECT 1 FROM creator_platform_requests r
        JOIN creator_platform_profiles p ON p.workspace_id=r.workspace_id
        WHERE r.id=? AND r.workspace_id=? AND r.stack_id=creator_stacks.id
        AND r.lease_token=? AND r.status IN ('running','verifying')
        AND r.lease_until>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
        AND r.policy_revision=p.revision AND json_extract(p.profile_json,'$.enabled')=1)`,
            values: [
                workspaceId,
                member,
                ...roles,
                execution.requestId,
                workspaceId,
                execution.leaseToken,
            ],
        };
    return {
        // Managed mode remains an authority boundary when policy is paused. The
        // predicate belongs to the write, closing races after the HTTP preflight.
        sql: membershipSQL +
            " AND NOT EXISTS(SELECT 1 FROM creator_platform_profiles WHERE workspace_id=?)",
        values: [workspaceId, member, ...roles, workspaceId],
    };
}
async function acknowledgedWrite(db, workspaceId, actor, action, row, message) {
    if (!row && actor !== null)
        requireCapability(await membership(db, workspaceId, actorId(actor)), action);
    return acknowledgedStack(row, message);
}
const isText = (value, max) => typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= max &&
    !/[\u0000-\u001f\u007f]/.test(value);
const isOptionalText = (value, max) => value === undefined ||
    value === null ||
    (typeof value === "string" &&
        value.trim().length <= max &&
        !/[\u0000-\u001f\u007f]/.test(value));
const isId = (value) => typeof value === "string" && /^[a-z0-9-]{6,64}$/.test(value);
// Declared, validated app capability. Composer reads the composition contract's
// declared configuration and capabilities; it never invents a control an app
// has not published, and it never stores credentials in a stack document.
export function declaredConfig(appId) {
    const model = Object.hasOwn(appSettings, appId)
        ? appSettings[appId]
        : undefined;
    if (!model)
        return null;
    return model.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        default: field.default ?? "",
        maxLength: field.maxLength ?? null,
        options: field.choices?.length
            ? field.choices.map((choice) => choice.value)
            : null,
    }));
}
export function appCapabilities(appId) {
    return Object.hasOwn(appSettings, appId)
        ? [...appSettings[appId].capabilities]
        : [];
}
// A stack may only carry configuration an app has declared for itself, and the
// values are validated with the same rules the operator apply path uses.
function normaliseInstanceConfig(app, config, label) {
    if (config === undefined || config === null)
        return {};
    if (typeof config !== "object" || Array.isArray(config))
        throw new StackError("INVALID", "Check the settings stored on this instance.");
    // An empty group is not a claim about the app; it is simply nothing set here.
    if (!Object.keys(config).length)
        return {};
    const declared = declaredConfig(app);
    if (!declared)
        throw new StackError("INVALID", "Only " + label + "’s declared settings can be stored on this instance.");
    const clean = {};
    for (const [key, value] of Object.entries(config)) {
        const field = declared.find((entry) => entry.key === key);
        if (!field)
            throw new StackError("INVALID", "“" + key + "” is not a setting " + label + " declares.");
        if (value === "" || value === null || value === undefined)
            continue;
        try {
            clean[key] = validateAppSettingValue(modelField(app, field), value, label);
        }
        catch (error) {
            throw new StackError("INVALID", error instanceof Error ? error.message : "Check the instance settings.");
        }
    }
    return clean;
}
const modelField = (app, field) => {
    const model = appSettings[app];
    const declared = model.fields.find((entry) => entry.key === field.key);
    if (!declared)
        throw new StackError("INVALID", "Choose a declared setting.");
    return declared;
};
export function slugify(name) {
    const slug = String(name)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, LIMITS.slug)
        .replace(/-+$/g, "");
    if (!slug)
        throw new StackError("INVALID", "Choose a name with at least one letter or number.");
    return slug;
}
// Validate and normalise a whole stack document. Unknown apps, duplicate
// instance ids, unsupported fields, out-of-range values and undeclared settings
// are refused before anything is written.
export function normaliseStack(input) {
    if (!record(input))
        throw new StackError("INVALID", "Choose a stack document.");
    if (input.version !== STACK_VERSION)
        throw new StackError("INVALID", "This stack document version is not supported.");
    if (!isText(input.name, LIMITS.stackName))
        throw new StackError("INVALID", "Name the stack in up to " + LIMITS.stackName + " characters.");
    if (!isOptionalText(input.description, LIMITS.description))
        throw new StackError("INVALID", "Keep the description under " + LIMITS.description + " characters.");
    const theme = input.theme ?? "midnight";
    if (typeof theme !== "string" || !THEMES.includes(theme))
        throw new StackError("INVALID", "Choose a supported theme.");
    if (!Array.isArray(input.instances) ||
        input.instances.length > LIMITS.instances)
        throw new StackError("INVALID", "A stack holds up to " + LIMITS.instances + " app instances.");
    const seen = new Set();
    const instances = input.instances.map((instance) => {
        if (!record(instance))
            throw new StackError("INVALID", "Check every app instance.");
        if (!isId(instance.id))
            throw new StackError("INVALID", "Every instance needs a stable identifier.");
        if (seen.has(instance.id))
            throw new StackError("INVALID", "Two instances cannot share an identifier.");
        seen.add(instance.id);
        const appId = instance.app;
        if (typeof appId !== "string" || !Object.hasOwn(STACK_APPS, appId))
            throw new StackError("INVALID", "Choose a reviewed app for every instance.");
        const app = STACK_APPS[appId];
        if (!app)
            throw new StackError("INVALID", "Choose a reviewed app for every instance.");
        if (!isText(instance.label, LIMITS.instanceLabel))
            throw new StackError("INVALID", "Give every instance a short label.");
        if (!isOptionalText(instance.caption, LIMITS.instanceCaption))
            throw new StackError("INVALID", "Keep instance captions under " +
                LIMITS.instanceCaption +
                " characters.");
        if (instance.visible !== undefined &&
            typeof instance.visible !== "boolean")
            throw new StackError("INVALID", "Visibility must be on or off.");
        const bindingInput = instance.binding ?? {};
        if (!record(bindingInput))
            throw new StackError("INVALID", "Check how every instance is bound.");
        const mode = bindingInput.mode ?? "own";
        if (mode !== "own" && mode !== "shared")
            throw new StackError("INVALID", "Choose how the instance is bound.");
        const shareOf = mode === "shared" ? bindingInput.shareOf : null;
        if (mode === "shared" && !isId(shareOf))
            throw new StackError("INVALID", "A shared instance must name the instance it reuses.");
        if (mode === "shared" &&
            instance.config &&
            (!record(instance.config) || Object.keys(instance.config).length)) {
            throw new StackError("INVALID", "A shared instance inherits its settings; it cannot also store its own.");
        }
        const config = mode === "shared"
            ? {}
            : normaliseInstanceConfig(appId, instance.config, app.name);
        return {
            id: instance.id,
            app: appId,
            label: instance.label.trim(),
            caption: typeof instance.caption === "string" ? instance.caption.trim() : "",
            visible: instance.visible !== false,
            binding: {
                mode,
                shareOf: typeof shareOf === "string" ? shareOf : null,
            },
            config,
        };
    });
    // A shared instance must point at another instance of the same app, and the
    // referenced instance must be the independently configured one. This is what
    // makes "reused" and "independent" mean something for app content, which the
    // app itself owns as one set of records.
    instances.forEach((instance) => {
        if (instance.binding.mode !== "shared")
            return;
        const source = instances.find((entry) => entry.id === instance.binding.shareOf);
        if (!source || source.id === instance.id)
            throw new StackError("INVALID", "A shared instance must reuse another instance in this stack.");
        if (source.app !== instance.app)
            throw new StackError("INVALID", "A shared instance must reuse an instance of the same app.");
        if (source.binding.mode === "shared")
            throw new StackError("INVALID", "Reuse the independently configured instance, not another shared one.");
    });
    // Composer can only apply one configuration per app-owned resource. A second
    // independently configured instance of the same app would silently overwrite
    // the first, so it is refused rather than reported as applied.
    const ownByApp = new Set();
    instances.forEach((instance) => {
        if (instance.binding.mode !== "own")
            return;
        // Guestbook's resource contract provisions each owned instance separately.
        // Other apps keep their current single-resource limit until they expose
        // the same reviewed app-owned boundary.
        if (instance.app === "guestbook")
            return;
        if (ownByApp.has(instance.app))
            throw new StackError("INVALID", "This stack already configures " +
                STACK_APPS[instance.app].name +
                " independently. Reuse that instance instead so the two cannot disagree.");
        ownByApp.add(instance.app);
    });
    return {
        version: STACK_VERSION,
        name: input.name.trim(),
        description: typeof input.description === "string" ? input.description.trim() : "",
        theme,
        instances,
    };
}
export function emptyStack(name) {
    return {
        version: STACK_VERSION,
        name: name.trim(),
        description: "",
        theme: "midnight",
        instances: [],
    };
}
// The declared, validated settings an instance may carry, and the plan a safe
// activation would use. Credentials never appear here; only declared values and
// the exact pinned source they belong to.
export function instanceConfiguration(stack, instanceId) {
    const instance = normaliseStack(stack).instances.find((entry) => entry.id === instanceId);
    if (!instance)
        throw new StackError("NOT_FOUND", "That instance is not in this stack.", 404);
    const source = Object.hasOwn(appSettings, instance.app)
        ? appSettings[instance.app]
        : undefined;
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
// Portable configuration export and import. The export is deliberately narrow:
// it is the stack document plus the declared instance configuration, and it says
// so. Importing creates a new draft in the caller's workspace — never a
// publication, never an overwrite — so a restore cannot silently change what the
// public already sees, and it cannot pretend app records or media came with it.
export function exportStack(stack) {
    const document = normaliseStack(stack.draft);
    return {
        format: "app-composer.stack/v1",
        stack: stack.slug,
        revision: stack.revision,
        document,
        configuration: document.instances.map((instance) => ({
            instance: instance.id,
            app: instance.app,
            mode: instance.binding.mode,
            shareOf: instance.binding.shareOf,
            settings: instance.config,
        })),
        covers: {
            composition: true,
            instanceConfiguration: true,
            publicationHistory: false,
            appRecords: false,
            appMedia: false,
            credentials: false,
        },
    };
}
export function describeImport(payload) {
    if (!record(payload))
        throw new StackError("INVALID", "Choose an exported stack file.");
    if (payload.format !== "app-composer.stack/v1")
        throw new StackError("INVALID", "This file was not exported by App Composer stack sharing.");
    const document = normaliseStack(payload.document);
    const shared = document.instances.filter((instance) => instance.binding.mode === "shared").length;
    return {
        name: document.name,
        instances: document.instances.length,
        shared,
        configured: document.instances.filter((instance) => Object.keys(instance.config).length).length,
        apps: [
            ...new Set(document.instances.map((instance) => STACK_APPS[instance.app].name)),
        ],
        covers: {
            composition: true,
            instanceConfiguration: true,
            publicationHistory: false,
            appRecords: false,
            appMedia: false,
            credentials: false,
        },
    };
}
export async function importStack(db, workspaceId, payload, { name, actor = null } = {}) {
    const access = writeMembership(workspaceId, actor, "create");
    const summary = describeImport(payload);
    // The validated import document remains data, never execution authority.
    if (!record(payload))
        throw new StackError("INVALID", "Choose an exported stack file.");
    const chosen = typeof name === "string" && name.trim()
        ? name.trim().slice(0, LIMITS.stackName)
        : summary.name;
    if (!isText(chosen, LIMITS.stackName))
        throw new StackError("INVALID", "Name the imported stack in up to " + LIMITS.stackName + " characters.");
    let slug = slugify(chosen);
    if (await db
        .prepare("SELECT id FROM creator_stacks WHERE slug = ?")
        .bind(slug)
        .first())
        slug = (slug + "-" + crypto.randomUUID().slice(0, 4)).slice(0, LIMITS.slug);
    const document = freshInstanceIdentities({
        ...normaliseStack(payload.document),
        name: chosen,
    });
    const id = crypto.randomUUID();
    // Imported stacks arrive as drafts: nothing becomes public until the creator
    // publishes, and no publication history is invented.
    const row = await db
        .prepare(`INSERT INTO creator_stacks (id, workspace_id, slug, name, draft_json)
    SELECT ?,?,?,?,? WHERE 1${access.sql} RETURNING *`)
        .bind(id, workspaceId, slug, document.name, JSON.stringify(document), ...access.values)
        .first();
    return acknowledgedWrite(db, workspaceId, actor, "create", row, "Workspace access changed before this stack was created. Refresh its access.");
}
// The workspace bootstrap: an authenticated creator gets one personal
// workspace, created once and reused. Membership is the only source of
// authority for every later call.
//
// A creator who already belongs to a workspace (an invitation) keeps that
// workspace as the one they land in. D1 batch() makes the parent, personal
// selection and membership one transaction, with the FK parent written first.
// Conditions are checked inside that transaction, so concurrent first visits
// cannot leave a losing candidate workspace behind. Existing partial personal
// selections can be completed on retry. Further memberships remain possible.
export async function workspaceForUser(db, user) {
    if (!record(user) || typeof user.id !== "string" || !user.id)
        throw new StackError("FORBIDDEN", "Sign in to use creator stacks.", 403);
    const existing = await db
        .prepare(`SELECT w.id, w.name, m.role FROM creator_members m JOIN creator_workspaces w ON w.id = m.workspace_id WHERE m.user_id = ?
      ORDER BY CASE WHEN w.id=(SELECT workspace_id FROM creator_personal_workspaces WHERE user_id=?) THEN 0 ELSE 1 END,m.created_at,w.id LIMIT 1`)
        .bind(user.id, user.id)
        .first();
    if (existing)
        return workspaceRow(existing);
    const name = (typeof user.name === "string" &&
        user.name.trim().slice(0, LIMITS.workspaceName)) ||
        "My workspace";
    const candidate = crypto.randomUUID();
    const results = await db.batch([
        db
            .prepare(`INSERT OR IGNORE INTO creator_workspaces (id, name)
      SELECT COALESCE((SELECT workspace_id FROM creator_personal_workspaces WHERE user_id = ?), ?), ?
      WHERE NOT EXISTS (SELECT 1 FROM creator_members WHERE user_id = ?)`)
            .bind(user.id, candidate, name, user.id),
        db
            .prepare(`INSERT OR IGNORE INTO creator_personal_workspaces (user_id, workspace_id)
      SELECT ?, ? WHERE EXISTS (SELECT 1 FROM creator_workspaces WHERE id = ?)
      AND NOT EXISTS (SELECT 1 FROM creator_members WHERE user_id = ?)`)
            .bind(user.id, candidate, candidate, user.id),
        db
            .prepare(`INSERT OR IGNORE INTO creator_members (workspace_id, user_id, role)
      SELECT workspace_id, ?, 'owner' FROM creator_personal_workspaces WHERE user_id = ?
      AND NOT EXISTS (SELECT 1 FROM creator_members WHERE user_id = ?)`)
            .bind(user.id, user.id, user.id),
        db
            .prepare(`SELECT w.id, w.name, m.role FROM creator_members m JOIN creator_workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = ? ORDER BY CASE WHEN w.id=(SELECT workspace_id FROM creator_personal_workspaces WHERE user_id=?) THEN 0 ELSE 1 END,m.created_at,w.id LIMIT 1`)
            .bind(user.id, user.id),
    ]);
    const row = results[3]?.results?.[0];
    if (!row)
        throw new StackError("UNAVAILABLE", "The workspace could not be opened. Try again.", 503);
    return workspaceRow(row);
}
export async function membership(db, workspaceId, userId) {
    if (typeof userId !== "string" || !userId)
        throw new StackError("FORBIDDEN", "A current workspace member is required.", 403);
    const row = await db
        .prepare("SELECT role FROM creator_members WHERE workspace_id = ? AND user_id = ?")
        .bind(workspaceId, userId)
        .first();
    if (row && !isRole(row.role))
        throw unavailable();
    return row && isRole(row.role) ? row.role : null;
}
// Resolve the workspace the caller asked for. A client-supplied id is only a
// selector: without matching membership it is refused, never silently replaced.
export async function resolveWorkspace(db, user, requestedId) {
    const own = await workspaceForUser(db, user);
    if (!requestedId)
        return own;
    if (typeof requestedId !== "string" || !isId(requestedId))
        throw new StackError("INVALID", "Choose a valid workspace.");
    const role = await membership(db, requestedId, user.id);
    if (!role)
        throw new StackError("FORBIDDEN", "This workspace is not yours.", 403);
    const row = await db
        .prepare("SELECT id, name FROM creator_workspaces WHERE id = ?")
        .bind(requestedId)
        .first();
    if (!row)
        throw new StackError("NOT_FOUND", "That workspace no longer exists.", 404);
    return workspaceRow({ ...row, role });
}
const parse = (value) => {
    if (typeof value !== "string")
        return null;
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
};
const lostRace = (message) => new StackError("CONFLICT", message, 409);
const requireRevision = (expected, current, message) => {
    if (!positiveInteger(expected))
        throw new StackError("INVALID", "Choose the saved revision before changing this stack.");
    if (expected !== current.revision)
        throw lostRace(message);
};
function workspaceRow(row) {
    if (!isId(row.id) ||
        typeof row.name !== "string" ||
        !row.name.length ||
        row.name.length > LIMITS.workspaceName ||
        !isRole(row.role))
        throw unavailable();
    return { id: row.id, name: row.name, role: row.role };
}
// Persisted JSON is external data too. Check its declared document and preserve
// validated app-owned publication references; never fall back to a private draft.
function storedDraft(value) {
    try {
        return normaliseStack(parse(value));
    }
    catch {
        throw unavailable();
    }
}
function storedPublication(value) {
    try {
        return publicationDocument(parse(value));
    }
    catch {
        throw unavailable();
    }
}
function isResource(value) {
    return (record(value) &&
        isId(value.id) &&
        positiveInteger(value.configurationRevision) &&
        typeof value.digest === "string" &&
        /^[a-f0-9]{64}$/.test(value.digest) &&
        typeof value.source === "string" &&
        /^[a-f0-9]{40}$/.test(value.source) &&
        value.path ===
            `/guestbook/r/${value.id}/c/${value.configurationRevision}/` &&
        typeof value.shared === "boolean");
}
function isPublicationDocument(value) {
    // Reuse declaration/range/relationship checks without returning the normalised
    // object. Only the native editor's decoded copy upgrades legacy defaults.
    normaliseStack(value);
    if (!record(value) ||
        !Array.isArray(value.instances) ||
        typeof value.theme !== "string" ||
        (value.description !== undefined && typeof value.description !== "string"))
        return false;
    const originals = value.instances;
    for (const original of originals) {
        if (!record(original) ||
            (original.caption !== undefined &&
                typeof original.caption !== "string") ||
            (original.config !== undefined &&
                (!record(original.config) ||
                    Object.values(original.config).some((item) => typeof item !== "string"))) ||
            (original.binding !== undefined &&
                (!record(original.binding) ||
                    (original.binding.mode !== undefined &&
                        original.binding.mode !== "own" &&
                        original.binding.mode !== "shared") ||
                    (original.binding.shareOf !== undefined &&
                        original.binding.shareOf !== null &&
                        typeof original.binding.shareOf !== "string"))) ||
            (original.resource !== undefined &&
                (original.app !== "guestbook" || !isResource(original.resource))))
            return false;
    }
    return true;
}
function publicationDocument(value) {
    if (!isPublicationDocument(value))
        throw new StackError("INVALID", "Check the published stack document and resource references.");
    return value;
}
// RETURNING acknowledges this exact changed row, never a later competing read.
const acknowledgedStack = (row, message) => {
    if (!row)
        throw lostRace(message);
    return toStack(row);
};
const toStack = (row) => {
    if (!isId(row.id) ||
        typeof row.slug !== "string" ||
        !/^[a-z0-9-]{1,60}$/.test(row.slug) ||
        !isText(row.name, LIMITS.stackName) ||
        (row.status !== "draft" &&
            row.status !== "published" &&
            row.status !== "archived") ||
        !positiveInteger(row.revision) ||
        (row.published_revision != null &&
            !positiveInteger(row.published_revision)) ||
        typeof row.updated_at !== "string" ||
        (row.published_at != null && typeof row.published_at !== "string"))
        throw unavailable();
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        revision: row.revision,
        publishedRevision: row.published_revision ?? null,
        updatedAt: row.updated_at,
        publishedAt: row.published_at ?? null,
        draft: storedDraft(row.draft_json),
        published: row.published_json == null ? null : storedPublication(row.published_json),
    };
};
// A public field may only come from the immutable publication snapshot. The
// mutable columns on the stack row describe the private draft, so the published
// document itself is the single source for name, description, theme, labels,
// configuration references and sharing metadata.
const publishedView = (row) => {
    if (!isId(row.id) ||
        typeof row.slug !== "string" ||
        !/^[a-z0-9-]{1,60}$/.test(row.slug) ||
        !positiveInteger(row.revision) ||
        typeof row.published_at !== "string")
        return null;
    let document;
    try {
        document = storedPublication(row.document_json);
    }
    catch {
        return null;
    }
    return {
        id: row.id,
        slug: row.slug,
        revision: row.revision,
        publishedAt: row.published_at,
        name: document.name,
        description: document.description ?? "",
        theme: document.theme,
        document,
    };
};
export async function listStacks(db, workspaceId) {
    const { results } = await db
        .prepare("SELECT id, slug, name, status, revision, published_revision, updated_at, published_at, draft_json, published_json FROM creator_stacks WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 50")
        .bind(workspaceId)
        .all();
    return (results ?? []).map(toStack);
}
export async function readStack(db, workspaceId, stackId) {
    if (!isId(stackId))
        throw new StackError("INVALID", "Choose a valid stack.");
    const row = await db
        .prepare("SELECT * FROM creator_stacks WHERE id = ? AND workspace_id = ?")
        .bind(stackId, workspaceId)
        .first();
    if (!row)
        throw new StackError("NOT_FOUND", "That stack is not in this workspace.", 404);
    return toStack(row);
}
export async function createStack(db, workspaceId, name, actor = null) {
    const access = writeMembership(workspaceId, actor, "create");
    if (!isText(name, LIMITS.stackName))
        throw new StackError("INVALID", "Name the stack in up to " + LIMITS.stackName + " characters.");
    const slug = slugify(name);
    const existing = await db
        .prepare("SELECT id FROM creator_stacks WHERE slug = ?")
        .bind(slug)
        .first();
    if (existing)
        throw new StackError("CONFLICT", "Another stack already uses that share address. Choose a different name.", 409);
    const id = crypto.randomUUID();
    const document = emptyStack(name);
    const row = await db
        .prepare(`INSERT INTO creator_stacks (id, workspace_id, slug, name, draft_json)
    SELECT ?,?,?,?,? WHERE 1${access.sql} RETURNING *`)
        .bind(id, workspaceId, slug, document.name, JSON.stringify(document), ...access.values)
        .first();
    return acknowledgedWrite(db, workspaceId, actor, "create", row, "Workspace access changed before this stack was created. Refresh its access.");
}
export async function saveStack(db, workspaceId, stackId, document, expectedRevision, actor = null) {
    const access = writeMembership(workspaceId, actor, "save");
    const current = await readStack(db, workspaceId, stackId);
    if (current.status === "archived")
        throw new StackError("CONFLICT", "Restore this stack before editing it.", 409);
    requireRevision(expectedRevision, current, "This stack changed in another window. Your work is still here; reopen the stack to compare.");
    const next = normaliseStack(document);
    const payload = JSON.stringify(next);
    const row = await db
        .prepare(`UPDATE creator_stacks SET draft_json = ?, name = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ? AND status = ?${access.sql} RETURNING *`)
        .bind(payload, next.name, stackId, workspaceId, current.revision, current.status, ...access.values)
        .first();
    return acknowledgedWrite(db, workspaceId, actor, "save", row, "Another window saved first. Your unsaved work is still here; reopen the stack to compare.");
}
export async function publishStack(db, workspaceId, stackId, expectedRevision, publishedDocument = null, actor = null) {
    const access = writeMembership(workspaceId, actor, "publish");
    const current = await readStack(db, workspaceId, stackId);
    if (current.status === "archived")
        throw new StackError("CONFLICT", "Restore this stack before publishing it.", 409);
    requireRevision(expectedRevision, current, "This stack changed in another window. Reopen it before publishing.");
    if (!current.draft.instances.length)
        throw new StackError("INVALID", "Add at least one app instance before publishing.");
    const selected = publishedDocument ?? current.draft;
    publicationDocument(selected); // Validate before creating an immutable release; preserve exact selected bytes.
    const payload = JSON.stringify(selected);
    // D1 batches are transactions: readers see the previous publication until
    // both history creation and activation commit, and either failure rolls back
    // both writes. Never activate a publication with different stored bytes.
    const results = await db.batch([
        db
            .prepare(`INSERT OR IGNORE INTO creator_stack_publications (stack_id, revision, document_json)
      SELECT id, revision, ? FROM creator_stacks
      WHERE id = ? AND workspace_id = ? AND revision = ? AND status = ?${access.sql}`)
            .bind(payload, stackId, workspaceId, current.revision, current.status, ...access.values),
        db
            .prepare(`UPDATE creator_stacks SET status = 'published', published_json = ?,
      published_revision = revision, revision = revision + 1,
      published_at = (SELECT published_at FROM creator_stack_publications WHERE stack_id = ? AND revision = ?),
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ? AND status = ?
      AND EXISTS (SELECT 1 FROM creator_stack_publications WHERE stack_id = ? AND revision = ? AND document_json = ?)
      ${access.sql} RETURNING *`)
            .bind(payload, stackId, current.revision, stackId, workspaceId, current.revision, current.status, stackId, current.revision, payload, ...access.values),
    ]);
    return acknowledgedWrite(db, workspaceId, actor, "publish", results[1]?.results?.[0], "Another window changed this stack before it published. Reopen it and publish the revision you want.");
}
// Immutable publication history, newest first. The published snapshot alone is
// not a history: this list names every revision that was actually activated.
export async function listPublications(db, workspaceId, stackId) {
    await readStack(db, workspaceId, stackId);
    const { results } = await db
        .prepare("SELECT p.revision, p.published_at, p.document_json FROM creator_stack_publications p JOIN creator_stacks s ON s.id = p.stack_id WHERE p.stack_id = ? AND s.workspace_id = ? ORDER BY p.revision DESC LIMIT 50")
        .bind(stackId, workspaceId)
        .all();
    return (results ?? []).map((row) => {
        if (!positiveInteger(row.revision) || typeof row.published_at !== "string")
            throw unavailable();
        return {
            revision: row.revision,
            publishedAt: row.published_at,
            document: storedPublication(row.document_json),
        };
    });
}
// Rollback, split into the two things it can actually mean. Republishing a
// stored revision swaps the public page back to that exact publication and
// leaves the current draft untouched; restoring one into the draft brings that
// configuration forward as a new editable revision. Neither restores app
// records, media or deletions, because Composer never owned them.
export async function republishRevision(db, workspaceId, stackId, revision, expectedRevision, actor = null) {
    const access = writeMembership(workspaceId, actor, "rollback");
    const current = await readStack(db, workspaceId, stackId);
    if (current.status === "archived")
        throw new StackError("CONFLICT", "Restore this stack before publishing it.", 409);
    requireRevision(expectedRevision, current, "This stack changed in another window. Reopen it before rolling the public page back.");
    const release = await publicationRow(db, workspaceId, stackId, revision);
    if (!release)
        throw new StackError("NOT_FOUND", "That published revision is not in this stack’s history.", 404);
    const row = await db
        .prepare(`UPDATE creator_stacks SET status = 'published', published_json = ?, published_revision = ?, revision = revision + 1, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ? AND status = ?${access.sql} RETURNING *`)
        .bind(release.document_json, revision, stackId, workspaceId, current.revision, current.status, ...access.values)
        .first();
    return acknowledgedWrite(db, workspaceId, actor, "rollback", row, "Another window changed this stack. Reopen it before rolling the public page back.");
}
export async function restoreRevisionToDraft(db, workspaceId, stackId, revision, expectedRevision, actor = null) {
    const access = writeMembership(workspaceId, actor, "rollback");
    const current = await readStack(db, workspaceId, stackId);
    if (current.status === "archived")
        throw new StackError("CONFLICT", "Restore this stack before editing it.", 409);
    requireRevision(expectedRevision, current, "This stack changed in another window. Reopen it before restoring configuration.");
    const release = await publicationRow(db, workspaceId, stackId, revision);
    if (!release)
        throw new StackError("NOT_FOUND", "That published revision is not in this stack’s history.", 404);
    const document = normaliseStack(parse(release.document_json));
    const row = await db
        .prepare(`UPDATE creator_stacks SET draft_json = ?, name = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ? AND status = ?${access.sql} RETURNING *`)
        .bind(JSON.stringify(document), document.name, stackId, workspaceId, current.revision, current.status, ...access.values)
        .first();
    return acknowledgedWrite(db, workspaceId, actor, "rollback", row, "Another window changed this stack. Reopen it before restoring configuration.");
}
async function publicationRow(db, workspaceId, stackId, revision) {
    if (!positiveInteger(revision))
        throw new StackError("INVALID", "Choose a published revision.");
    const row = await db
        .prepare("SELECT p.revision, p.document_json FROM creator_stack_publications p JOIN creator_stacks s ON s.id = p.stack_id WHERE p.stack_id = ? AND s.workspace_id = ? AND p.revision = ?")
        .bind(stackId, workspaceId, revision)
        .first();
    if (row)
        storedPublication(row.document_json);
    return row;
}
export async function unpublishStack(db, workspaceId, stackId, expectedRevision, actor = null) {
    const access = writeMembership(workspaceId, actor, "unpublish");
    const current = await readStack(db, workspaceId, stackId);
    if (current.status !== "published")
        throw new StackError("CONFLICT", "This stack is not published.", 409);
    requireRevision(expectedRevision, current, "This stack changed in another window. Reopen it before unpublishing.");
    const row = await db
        .prepare(`UPDATE creator_stacks SET status = 'draft', revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ? AND status = 'published'${access.sql} RETURNING *`)
        .bind(stackId, workspaceId, current.revision, ...access.values)
        .first();
    return acknowledgedWrite(db, workspaceId, actor, "unpublish", row, "Another window changed this stack before it unpublished. Reopen it.");
}
export async function setArchived(db, workspaceId, stackId, archived, expectedRevision, actor = null) {
    const access = writeMembership(workspaceId, actor, archived ? "archive" : "restore");
    const current = await readStack(db, workspaceId, stackId);
    const status = archived ? "archived" : "draft";
    if (archived ? current.status === "archived" : current.status !== "archived")
        throw new StackError("CONFLICT", archived
            ? "This stack is already archived."
            : "This stack is not archived.", 409);
    requireRevision(expectedRevision, current, "This stack changed in another window. Reopen it first.");
    // Archiving keeps the publication recorded but stops serving it; restoring
    // returns the stack to draft so the owner chooses when it is public again.
    const row = await db
        .prepare(`UPDATE creator_stacks SET status = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ? AND revision = ? AND status = ?${access.sql} RETURNING *`)
        .bind(status, stackId, workspaceId, current.revision, current.status, ...access.values)
        .first();
    return acknowledgedWrite(db, workspaceId, actor, archived ? "archive" : "restore", row, "Another window changed this stack before it moved. Reopen it first.");
}
export async function duplicateStack(db, workspaceId, stackId, expectedRevision, actor = null) {
    const access = writeMembership(workspaceId, actor, "duplicate");
    const current = await readStack(db, workspaceId, stackId);
    requireRevision(expectedRevision, current, "This stack changed in another window. Reopen it before duplicating.");
    const name = (current.name + " copy").slice(0, LIMITS.stackName);
    let slug = slugify(name);
    if (await db
        .prepare("SELECT id FROM creator_stacks WHERE slug = ?")
        .bind(slug)
        .first())
        slug = slug + "-" + crypto.randomUUID().slice(0, 4);
    const id = crypto.randomUUID();
    // Fresh identities, but the reuse relationships are preserved so a duplicated
    // stack keeps the same shared-versus-independent structure.
    const document = freshInstanceIdentities({ ...current.draft, name });
    normaliseStack(document);
    const row = await db
        .prepare(`INSERT INTO creator_stacks (id, workspace_id, slug, name, draft_json)
    SELECT ?, ?, ?, ?, ? FROM creator_stacks WHERE id = ? AND workspace_id = ? AND revision = ? AND status = ?${access.sql} RETURNING *`)
        .bind(id, workspaceId, slug, document.name, JSON.stringify(document), stackId, workspaceId, current.revision, current.status, ...access.values)
        .first();
    return acknowledgedWrite(db, workspaceId, actor, "duplicate", row, "Another window changed this stack before it duplicated. Reopen it first.");
}
function freshInstanceIdentities(document) {
    const remap = new Map(document.instances.map((instance) => [instance.id, crypto.randomUUID()]));
    return {
        ...document,
        instances: document.instances.map((instance) => ({
            ...instance,
            id: remap.get(instance.id) ?? instance.id,
            binding: {
                mode: instance.binding?.mode ?? "own",
                shareOf: instance.binding?.shareOf
                    ? (remap.get(instance.binding.shareOf) ?? null)
                    : null,
            },
        })),
    };
}
export async function deleteStack(db, workspaceId, stackId, expectedRevision, actor = null) {
    const access = writeMembership(workspaceId, actor, "delete");
    const current = await readStack(db, workspaceId, stackId);
    requireRevision(expectedRevision, current, "This stack changed in another window. Reopen it before deleting.");
    const row = await db
        .prepare(`DELETE FROM creator_stacks WHERE id = ? AND workspace_id = ? AND revision = ? AND status = ?${access.sql} RETURNING *`)
        .bind(stackId, workspaceId, current.revision, current.status, ...access.values)
        .first();
    if (!row && actor !== null)
        requireCapability(await membership(db, workspaceId, actorId(actor)), "delete");
    if (!row)
        throw lostRace("Another window changed this stack before it was deleted. Reopen it first.");
    // Removing the configuration also removes its publication history; the
    // response says so, because app records, media and app-owned configuration
    // are not part of this and were never deleted.
    return {
        id: current.id,
        name: current.name,
        slug: current.slug,
        removedPublications: true,
    };
}
// Public read: only an exact published revision of an exact slug is ever
// returned, and every field comes from that immutable publication snapshot.
// Draft, archived and missing stacks are indistinguishable.
export async function publicStack(db, slug) {
    if (typeof slug !== "string" || !/^[a-z0-9-]{1,60}$/.test(slug))
        return null;
    const row = await db
        .prepare("SELECT s.id, s.slug, p.revision, p.published_at, p.document_json FROM creator_stacks s JOIN creator_stack_publications p ON p.stack_id = s.id AND p.revision = s.published_revision WHERE s.slug = ? AND s.status = 'published' AND s.published_json IS NOT NULL")
        .bind(slug)
        .first();
    if (!row)
        return null;
    return publishedView(row);
}
