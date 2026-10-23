// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
// MIT. Checked native administration and domain source.
import { guardPlatformLifecycle } from "./platform-guard.ts";
import { StackError, resolveWorkspace, membership, requireCapability, listStacks, readStack, createStack, saveStack, publishStack, unpublishStack, setArchived, duplicateStack, deleteStack, listPublications, republishRevision, restoreRevisionToDraft, instanceConfiguration, exportStack, importStack, describeImport, } from "./stacks.mjs";
import { isCreatorRole } from "./creator-access.ts";
import { activationSummary } from "./stack-activation.mjs";
import { applyStackResources, reconcileStackResources, reuseStackResource, listStackResources, availableWorkspaceResources, resourcePublication, } from "./stack-resources.ts";
import { readResourceContent, readResourceMedia, manageResourceContent, } from "./stack-resources.ts";
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const database = (value) => record(value) && typeof value.prepare === "function";
// Route logic for the creator-stacks plugin. The host authenticates and
// authorises the caller before dispatch; this second boundary rechecks the
// creator role, the exact origin and the workspace membership, then applies the
// capability matrix. A workspace or owner id from the request body is only a
// selector and can never widen authority.
const origin = "https://composer.loftwah.com";
const fail = (code, message) => ({ ok: false, code, message });
const identifier = (value) => typeof value === "string" && /^[a-z0-9-]{6,64}$/.test(value);
export async function manageStacks(ctx, runtime) {
    if (!ctx.user || !isCreatorRole(ctx.user.role))
        return fail("FORBIDDEN", "A signed-in Composer creator is required.");
    if (!record(runtime) || runtime.PUBLIC_ORIGIN !== origin)
        return fail("UNAVAILABLE", "Creator stacks are disconnected in this environment.");
    const request = ctx.request;
    const command = record(ctx.input) ? ctx.input : {};
    if (request.headers.get("Origin") && request.headers.get("Origin") !== origin)
        return fail("FORBIDDEN", "Open this action from Composer administration.");
    const reading = request.method === "GET";
    if (!reading &&
        (request.headers.get("Origin") !== origin ||
            request.headers.get("X-EmDash-Request") !== "1"))
        return fail("FORBIDDEN", "Refresh Composer administration before saving.");
    const db = runtime.DB;
    if (!database(db))
        return fail("UNAVAILABLE", "Creator stacks need the workspace database.");
    try {
        const workspace = await resolveWorkspace(db, ctx.user, command.workspace ?? null);
        const action = typeof command.action === "string" ? command.action : "";
        if (reading) {
            requireCapability(workspace.role, "read");
            if (action === "resourceContent" || action === "resourceMedia") {
                requireCapability(workspace.role, "save");
                const selection = {
                    stack: command.stack,
                    instance: command.instance,
                    expectedRevision: /^\d{1,16}$/.test(String(command.expectedRevision))
                        ? Number(command.expectedRevision)
                        : null,
                };
                return action === "resourceContent"
                    ? {
                        ok: true,
                        workspace,
                        book: await readResourceContent(db, ctx.user.id, workspace.id, selection, runtime),
                    }
                    : {
                        ok: true,
                        workspace,
                        media: await readResourceMedia(db, ctx.user.id, workspace.id, selection, command.item, runtime),
                    };
            }
            if (action === "list")
                return {
                    ok: true,
                    workspace,
                    stacks: await listStacks(db, workspace.id),
                };
            if (action === "resources") {
                const saved = await readStack(db, workspace.id, command.stack);
                return {
                    ok: true,
                    workspace,
                    resources: await listStackResources(db, workspace.id, saved.id),
                    availableResources: await availableWorkspaceResources(db, workspace.id),
                };
            }
            if (action === "open")
                return {
                    ok: true,
                    workspace,
                    stack: await readStack(db, workspace.id, command.stack),
                };
            if (action === "export") {
                const stack = await readStack(db, workspace.id, command.stack);
                return { ok: true, workspace, stack, export: exportStack(stack) };
            }
            if (action === "publications") {
                if (!identifier(command.stack))
                    return fail("INVALID", "Choose a valid stack.");
                return {
                    ok: true,
                    workspace,
                    publications: await listPublications(db, workspace.id, command.stack),
                };
            }
            if (action === "configuration") {
                if (!identifier(command.stack))
                    return fail("INVALID", "Choose a valid stack.");
                const stack = await readStack(db, workspace.id, command.stack);
                const summary = activationSummary(stack.draft);
                return {
                    ok: true,
                    workspace,
                    configuration: summary,
                    instances: summary.entries.map((entry) => instanceConfiguration(stack.draft, entry.instanceId)),
                };
            }
            return fail("INVALID", "Choose a supported stacks action.");
        }
        await guardPlatformLifecycle(db, workspace.id, action);
        if (action === "create") {
            requireCapability(workspace.role, "create");
            return {
                ok: true,
                workspace,
                stack: await createStack(db, workspace.id, command.name, ctx.user.id),
            };
        }
        if (action === "import") {
            requireCapability(workspace.role, "create");
            // Validated and summarised before the write, and the summary comes from
            // the validated document rather than from the file's own claims.
            const summary = describeImport(command.payload);
            const stack = await importStack(db, workspace.id, command.payload, {
                name: command.name,
                actor: ctx.user.id,
            });
            return { ok: true, workspace, stack, imported: summary };
        }
        if (action === "save") {
            requireCapability(workspace.role, "save");
            if (!identifier(command.stack))
                return fail("INVALID", "Choose a valid stack.");
            const document = command.document;
            if (record(document) &&
                typeof command.name === "string" &&
                command.name.trim())
                document.name = command.name;
            return {
                ok: true,
                workspace,
                stack: await saveStack(db, workspace.id, command.stack, document, command.expectedRevision, ctx.user.id),
            };
        }
        if (action === "publish") {
            requireCapability(workspace.role, "publish");
            if (!identifier(command.stack))
                return fail("INVALID", "Choose a valid stack.");
            const current = await readStack(db, workspace.id, command.stack);
            const document = await resourcePublication(db, workspace.id, command.stack, current.draft, runtime);
            requireCapability(await membership(db, workspace.id, ctx.user.id), "publish");
            return {
                ok: true,
                workspace,
                stack: await publishStack(db, workspace.id, command.stack, command.expectedRevision, document, ctx.user.id),
            };
        }
        if (action === "applyResources" ||
            action === "reconcileResources" ||
            action === "reuseResource") {
            requireCapability(workspace.role, "save");
            if (!identifier(command.stack) ||
                typeof command.expectedRevision !== "number" ||
                !Number.isSafeInteger(command.expectedRevision) ||
                command.expectedRevision < 1)
                throw new StackError("INVALID", "Choose the stack and its current saved revision.");
            const result = action === "applyResources"
                ? await applyStackResources(db, ctx.user.id, workspace.id, command.stack, command.expectedRevision, runtime)
                : action === "reconcileResources"
                    ? await reconcileStackResources(db, ctx.user.id, workspace.id, command.stack, command.expectedRevision, runtime)
                    : await reuseStackResource(db, ctx.user.id, workspace.id, command.stack, command.expectedRevision, typeof command.instance === "string" ? command.instance : "", typeof command.resource === "string" ? command.resource : "", runtime);
            return { ok: true, workspace, ...result };
        }
        if (action === "moderateResource" ||
            action === "reconcileResourceContent" ||
            action === "retryResourceContent") {
            requireCapability(workspace.role, "save");
            const selection = {
                stack: command.stack,
                instance: command.instance,
                expectedRevision: command.expectedRevision,
            };
            const mutation = action === "reconcileResourceContent"
                ? "reconcile"
                : action === "retryResourceContent"
                    ? "retry"
                    : command.change;
            return {
                ok: true,
                workspace,
                ...(await manageResourceContent(db, ctx.user.id, workspace.id, selection, mutation, runtime, { suppress: request.headers.get("X-Composer-Verification") === "1" })),
            };
        }
        if (action === "unpublish") {
            requireCapability(workspace.role, "unpublish");
            if (!identifier(command.stack))
                return fail("INVALID", "Choose a valid stack.");
            return {
                ok: true,
                workspace,
                stack: await unpublishStack(db, workspace.id, command.stack, command.expectedRevision, ctx.user.id),
            };
        }
        if (action === "archive" || action === "restore") {
            requireCapability(workspace.role, action === "archive" ? "archive" : "restore");
            if (!identifier(command.stack))
                return fail("INVALID", "Choose a valid stack.");
            return {
                ok: true,
                workspace,
                stack: await setArchived(db, workspace.id, command.stack, action === "archive", command.expectedRevision, ctx.user.id),
            };
        }
        if (action === "republish" || action === "restoreRevision") {
            requireCapability(workspace.role, "rollback");
            if (!identifier(command.stack))
                return fail("INVALID", "Choose a valid stack.");
            const revision = Number(command.revision);
            const stack = action === "republish"
                ? await republishRevision(db, workspace.id, command.stack, revision, command.expectedRevision, ctx.user.id)
                : await restoreRevisionToDraft(db, workspace.id, command.stack, revision, command.expectedRevision, ctx.user.id);
            return { ok: true, workspace, stack };
        }
        if (action === "duplicate") {
            requireCapability(workspace.role, "duplicate");
            if (!identifier(command.stack))
                return fail("INVALID", "Choose a valid stack.");
            return {
                ok: true,
                workspace,
                stack: await duplicateStack(db, workspace.id, command.stack, command.expectedRevision, ctx.user.id),
            };
        }
        if (action === "delete") {
            requireCapability(workspace.role, "delete");
            if (!identifier(command.stack))
                return fail("INVALID", "Choose a valid stack.");
            return {
                ok: true,
                workspace,
                deleted: await deleteStack(db, workspace.id, command.stack, command.expectedRevision, ctx.user.id),
            };
        }
        return fail("INVALID", "Choose a supported stacks action.");
    }
    catch (error) {
        if (error instanceof StackError)
            return fail(error.code, error.message);
        return fail("UNAVAILABLE", "The workspace database could not complete this action. Refresh before retrying.");
    }
}
