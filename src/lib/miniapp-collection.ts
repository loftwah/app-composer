import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { membership, requireCapability, StackError } from "./stacks.mjs";
import { listStackResources, readResourceContent } from "./stack-resources.ts";
import { resourceConnection, type ResourceRuntime } from "./resource-client.ts";
import {
  collectionId as id,
  collectionRevision as revision,
  collectionSource,
  collectionSelection,
  collectionInvitationSetting,
  collectionInvitationState,
  type CollectionSelection,
  type CollectionSource,
} from "./miniapp-collection-contract.ts";

const origin = "https://composer.loftwah.com",
  target = origin + "/showcase";
const app = z.literal("showcase");
const selection = collectionSelection.shape;
const selected = {
  ...selection,
  expectedRevision: z.coerce.number().pipe(revision),
};
const commands = z.discriminatedUnion("action", [
  z
    .object({
      app,
      action: z.literal("collection-sources"),
      workspace: id.optional(),
    })
    .strict(),
  z
    .object({ app, action: z.literal("collection-items"), ...selected })
    .strict(),
  z
    .object({
      app,
      action: z.literal("feature-resource"),
      ...selected,
      item: id,
    })
    .strict(),
  z
    .object({
      app,
      action: z.literal("collection-check"),
      workspace: id,
      resource: id,
      configuration: z.coerce.number().pipe(revision),
      item: id,
    })
    .strict(),
  z
    .object({ app, action: z.literal("collection-invitation"), ...selected })
    .strict(),
  z
    .object({
      app,
      action: z.literal("collection-invitation-set"),
      ...selected,
      operation: z.enum(["enable", "disable"]),
      expected: collectionInvitationSetting.nullable(),
    })
    .strict(),
]);
interface Runtime extends ResourceRuntime {
  DB?: D1Database;
  SHOWCASE?: { fetch(request: Request): Promise<Response> };
  SHOWCASE_OWNER_TOKEN?: unknown;
}
interface Context {
  user?: { id: string; role: number };
  input: unknown;
}
interface StackRow {
  id: string;
  name: string;
  revision: number;
  status: string;
  draft_json: string;
}
const draft = z.object({
  instances: z.array(
    z.object({
      id,
      app: z.string(),
      label: z.string(),
      binding: z.object({
        mode: z.enum(["own", "shared"]),
        shareOf: id.nullable(),
      }),
    }),
  ),
});
const unavailable = (message: string) =>
  new StackError("UNAVAILABLE", message, 503);
const conflict = () =>
  new StackError(
    "CONFLICT",
    "The saved stack or workspace access changed. Refresh its saved visitor book before collecting.",
    409,
  );
async function json(response: Response, limit = 2097152): Promise<unknown> {
  const value = await response.text();
  if (new TextEncoder().encode(value).byteLength > limit)
    throw Error("Bounded app response exceeded");
  return JSON.parse(value) as unknown;
}
function showcase(runtime: Runtime, pins: Record<string, string>) {
  const service = runtime.SHOWCASE,
    token = runtime.SHOWCASE_OWNER_TOKEN,
    source = pins.showcase;
  if (
    !service ||
    typeof service.fetch !== "function" ||
    typeof token !== "string" ||
    !token ||
    token.length > 4096 ||
    !/^[a-f0-9]{40}$/.test(source ?? "")
  )
    throw unavailable(
      "Linkarooie needs its reviewed server-side owner connection.",
    );
  const send = (path: string, write?: unknown) =>
    service.fetch(
      new Request(target + path, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers:
          write === undefined
            ? {
                Authorization: "Bearer " + token,
                "X-Composer-Verification": "1",
              }
            : {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
                "X-Composer-Source": source,
                "X-Composer-Target": target,
              },
        ...(write === undefined
          ? {}
          : { method: "POST", body: JSON.stringify(write) }),
      }),
    );
  return {
    send,
    async verify() {
      const response = await send("/build.json");
      const build = z
        .object({ app, revision: z.literal(source), dataVersion: z.literal(1) })
        .safeParse(await json(response, 8192));
      if (!response.ok || !build.success)
        throw new StackError(
          "SOURCE",
          "Linkarooie differs from its reviewed composition source.",
          409,
        );
      const manifest = await send("/app.manifest.json");
      const decoded = z
        .object({
          id: app,
          providerSources: z.object({
            version: z.literal(1),
            provider: z.literal("guestbook"),
            kinds: z
              .array(z.string())
              .refine((kinds) => kinds.includes("guestbook.resource")),
          }),
        })
        .safeParse(await json(manifest, 65536));
      if (!manifest.ok || !decoded.success)
        throw new StackError(
          "UNSUPPORTED",
          "This reviewed Linkarooie release does not support scoped visitor books yet.",
          409,
        );
    },
  };
}
async function workspace(db: D1Database, user: string, space: string) {
  requireCapability(await membership(db, space, user), "save");
}
async function selectedStack(
  db: D1Database,
  user: string,
  selected: CollectionSelection,
) {
  await workspace(db, user, selected.workspace);
  const row = await db
    .prepare(
      "SELECT id,name,revision,status,draft_json FROM creator_stacks WHERE id=? AND workspace_id=?",
    )
    .bind(selected.stack, selected.workspace)
    .first<StackRow>();
  if (!row)
    throw new StackError(
      "NOT_FOUND",
      "Choose a saved stack in this workspace.",
      404,
    );
  if (row.revision !== selected.expectedRevision || row.status === "archived")
    throw conflict();
  const document = draft.parse(JSON.parse(row.draft_json));
  const instance = document.instances.find(
    (entry) => entry.id === selected.instance && entry.app === "guestbook",
  );
  const owner =
    instance?.binding.mode === "shared"
      ? document.instances.find(
          (entry) =>
            entry.id === instance.binding.shareOf &&
            entry.app === "guestbook" &&
            entry.binding.mode === "own",
        )
      : instance;
  if (!instance || !owner)
    throw new StackError(
      "NOT_FOUND",
      "This instance is not a saved visitor book in this stack.",
      404,
    );
  const bindings = await listStackResources(db, selected.workspace, row.id);
  const binding = bindings.find((entry) => entry.instance === owner.id);
  if (!binding || binding.state !== "ready" || !binding.configuration)
    throw conflict();
  const source: CollectionSource = {
    kind: "guestbook.resource",
    version: 1,
    resource: binding.resource,
    configuration: binding.configuration.revision,
  };
  const guard = async () => {
    await workspace(db, user, selected.workspace);
    const unchanged = await db
      .prepare(
        "SELECT id FROM creator_stacks WHERE id=? AND workspace_id=? AND revision=? AND draft_json=? AND status!='archived'",
      )
      .bind(row.id, selected.workspace, row.revision, row.draft_json)
      .first();
    if (!unchanged) throw conflict();
    const current = await listStackResources(db, selected.workspace, row.id);
    const exact = current.find((entry) => entry.instance === owner.id);
    if (
      !exact ||
      exact.resource !== source.resource ||
      exact.configuration?.revision !== source.configuration ||
      exact.state !== "ready"
    )
      throw conflict();
  };
  return { source, guard };
}
const savedCard = z.object({
  id,
  status: z.enum(["draft", "published", "hidden"]),
});
const storedCard = savedCard.extend({
  provider: z.string().nullable().optional(),
  item_id: z.string().nullable().optional(),
  source_resource: z.string().nullable().optional(),
  source_configuration: z.number().nullable().optional(),
});
const invitationReply = z
  .object({
    contract: z.literal(1),
    configured: z.boolean(),
    source: collectionSource.optional(),
    invitation: collectionInvitationState.optional(),
    state: z.literal("none").optional(),
  })
  .strict();
const invitationFailure = z.object({ error: z.string().min(1).max(500) });
const invitationState = (
  value: z.infer<typeof invitationReply>,
): z.infer<typeof collectionInvitationState> =>
  value.invitation ?? (value.state === "none" ? { state: "none" } : { state: "unavailable" });
const invitationMessages: Record<string, string> = {
  open: "Linkarooie now links this Guestbook's real form while it accepts postcards. Every note still waits for Guestbook review.",
  paused:
    "The Guestbook is paused. Linkarooie links it without showing a send action until it reopens.",
  closed:
    "The Guestbook is closed. Linkarooie explains that without showing a send action.",
  full: "The Guestbook's review queue is full. Linkarooie explains that without showing a send action.",
  unavailable:
    "Linkarooie cannot reach this Guestbook right now, so it shows no send action.",
  none: "No Guestbook is linked for contributions.",
};
const invitationMessage = (state: string, configured: boolean) =>
  !configured
    ? "Linkarooie no longer shows a contribution action. Approved featured notes and all authored links are unchanged."
    : (invitationMessages[state] ??
      "Linkarooie could not confirm the contribution state. Refresh the saved book.");

// Existing role-50 / plugins:manage, origin and method checks run before this
// helper. Selections grant no authority and never supply a service URL or token.
export async function manageMiniappCollection(
  ctx: Context,
  runtime: Runtime,
  pins: Record<string, string>,
) {
  const parsed = commands.safeParse(ctx.input);
  if (!parsed.success || !ctx.user?.id)
    return {
      ok: false,
      code: "INVALID",
      message: "Choose a supported saved visitor book and current revision.",
    };
  const command = parsed.data,
    db = runtime.DB,
    user = ctx.user.id;
  if (!db)
    return {
      ok: false,
      code: "UNAVAILABLE",
      message: "Workspace storage is disconnected.",
    };
  let dispatched = false;
  let receipt:
    { workspace: string; source: CollectionSource; item: string } | undefined;
  try {
    const connection = showcase(runtime, pins);
    if (command.action === "collection-sources") {
      const rows = await db
        .prepare(
          "SELECT w.id,w.name,m.role FROM creator_members m JOIN creator_workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND m.role IN ('owner','editor') ORDER BY w.name,w.id LIMIT 32",
        )
        .bind(user)
        .all<{ id: string; name: string; role: "owner" | "editor" }>();
      if (command.workspace) await workspace(db, user, command.workspace);
      try {
        await connection.verify();
      } catch (error) {
        if (!(error instanceof StackError) || error.code !== "UNSUPPORTED")
          throw error;
        return {
          ok: true,
          supported: false,
          message: error.message,
          workspace: command.workspace ?? null,
          workspaces: rows.results,
          sources: [],
        };
      }
      const sources = [];
      if (command.workspace) {
        const appScope = resourceConnection(runtime, command.workspace);
        const owned = await db
          .prepare(
            "SELECT id FROM creator_app_resources WHERE workspace_id=? AND app='guestbook' AND account_id=? AND environment=? AND target=? AND state='ready'",
          )
          .bind(
            command.workspace,
            appScope.account,
            appScope.environment,
            appScope.target,
          )
          .all<{ id: string }>();
        const ownedIds = new Set(owned.results.map((row) => row.id));
        const stacks = await db
          .prepare(
            "SELECT id,name,revision,status,draft_json FROM creator_stacks WHERE workspace_id=? AND status!='archived' ORDER BY updated_at DESC,id LIMIT 50",
          )
          .bind(command.workspace)
          .all<StackRow>();
        for (const stack of stacks.results) {
          const document = draft.parse(JSON.parse(stack.draft_json));
          const bindings = await listStackResources(
            db,
            command.workspace,
            stack.id,
          );
          for (const instance of document.instances.filter(
            (entry) => entry.app === "guestbook",
          )) {
            const owner =
              instance.binding.mode === "shared"
                ? document.instances.find(
                    (entry) =>
                      entry.id === instance.binding.shareOf &&
                      entry.binding.mode === "own",
                  )
                : instance;
            const binding = bindings.find(
              (entry) => entry.instance === owner?.id,
            );
            if (
              !binding ||
              !ownedIds.has(binding.resource) ||
              binding.state !== "ready" ||
              !binding.configuration
            )
              continue;
            sources.push({
              workspace: command.workspace,
              stack: stack.id,
              instance: instance.id,
              expectedRevision: stack.revision,
              stackName: stack.name,
              label: instance.label,
              shared: binding.shared || instance.binding.mode === "shared",
              source: {
                kind: "guestbook.resource",
                version: 1,
                resource: binding.resource,
                configuration: binding.configuration.revision,
              },
            });
          }
        }
        await workspace(db, user, command.workspace);
      }
      return {
        ok: true,
        supported: true,
        message:
          "Choose a saved visitor book. Only currently approved public contributions can be collected.",
        workspace: command.workspace ?? null,
        workspaces: rows.results,
        sources,
      };
    }
    await workspace(db, user, command.workspace);
    if (command.action === "collection-check") {
      const resource = resourceConnection(runtime, command.workspace);
      const owned = async () => {
        await workspace(db, user, command.workspace);
        const found = await db
          .prepare(
            "SELECT id FROM creator_app_resources WHERE id=? AND workspace_id=? AND app='guestbook' AND account_id=? AND environment=? AND target=?",
          )
          .bind(
            command.resource,
            command.workspace,
            resource.account,
            resource.environment,
            resource.target,
          )
          .first();
        if (!found)
          throw new StackError(
            "FORBIDDEN",
            "This reference is not owned by the selected workspace and app target.",
            403,
          );
      };
      await owned();
      await resource.status(command.resource);
      await connection.verify();
      const response = await connection.send("/api/export");
      const exported = z
        .object({
          dataVersion: z.literal(1),
          cards: z.array(storedCard).max(64),
        })
        .safeParse(await json(response));
      if (!response.ok || !exported.success)
        throw unavailable(
          "The saved collection could not be verified. Its result remains unknown.",
        );
      await owned();
      const card = exported.data.cards.find(
        (card) =>
          card.provider === "guestbook" &&
          card.item_id === command.item &&
          card.source_resource === command.resource &&
          card.source_configuration === command.configuration,
      );
      const source = {
        kind: "guestbook.resource",
        version: 1,
        resource: command.resource,
        configuration: command.configuration,
      };
      return {
        ok: true,
        workspace: command.workspace,
        source,
        item: command.item,
        outcome: card ? "unchanged" : "unknown",
        ...(card ? { card: savedCard.parse(card) } : {}),
        message: card
          ? "The exact saved source reference is confirmed. Source visibility still controls its public content."
          : "No exact saved reference could be confirmed. It may have been removed after collection; the result remains unknown. Do not repeat this collection request.",
      };
    }
    const selection: CollectionSelection = {
      workspace: command.workspace,
      stack: command.stack,
      instance: command.instance,
      expectedRevision: command.expectedRevision,
    };
    const selected = await selectedStack(db, user, selection);
    const book = await readResourceContent(
      db,
      user,
      command.workspace,
      {
        stack: command.stack,
        instance: command.instance,
        expectedRevision: command.expectedRevision,
      },
      runtime,
    );
    await connection.verify();
    await selected.guard();
    if (book.resource !== selected.source.resource) throw conflict();
    if (
      command.action === "collection-invitation" ||
      command.action === "collection-invitation-set"
    ) {
      let response: Response;
      try {
        if (command.action === "collection-invitation") {
          // Reading the owner-only invitation status grants no public authority;
          // it only reflects the Guestbook's current state through Linkarooie.
          response = await connection.send("/api/invitation");
        } else {
          if (command.operation === "enable" && (!book.visible || book.pending))
            throw new StackError(
              "CONFLICT",
              "Publish this visitor book before inviting contributions. Nothing was changed.",
              409,
            );
          await selected.guard();
          response = await connection.send("/api/invitation", {
            action: command.operation,
            expected: command.expected,
            ...(command.operation === "enable" ? { source: selected.source } : {}),
          });
        }
      } catch (error) {
        if (error instanceof StackError) throw error;
        throw unavailable(
          "The invitation change could not be confirmed. Refresh this saved book before trying again.",
        );
      }
      const value = await json(response, 8192);
      const confirmed = invitationReply.safeParse(value);
      if (!response.ok || !confirmed.success) {
        const reason = invitationFailure.safeParse(value);
        throw new StackError(
          response.status === 409 ? "CONFLICT" : "UNAVAILABLE",
          reason.success
            ? reason.data.error
            : "Linkarooie returned an incompatible invitation result. Refresh this saved book.",
          response.status === 409 ? 409 : 503,
        );
      }
      const invitation = invitationState(confirmed.data);
      return {
        ok: true,
        selection,
        source: selected.source,
        linked: confirmed.data.source ?? null,
        configured: confirmed.data.configured,
        invitation,
        outcome: command.action === "collection-invitation" ? "unchanged" : "applied",
        message: invitationMessage(invitation.state, confirmed.data.configured),
      };
    }
    const approved =
      book.visible && !book.pending
        ? book.items.filter((item) => item.status === "approved")
        : [];
    if (command.action === "collection-items")
      return {
        ok: true,
        selection,
        source: selected.source,
        title: book.title,
        visible: book.visible,
        pending: book.pending,
        items: approved
          .slice(0, 200)
          .map(({ id, caption, author }) => ({ id, caption, author })),
      };
    if (!approved.some((item) => item.id === command.item))
      throw new StackError(
        "CONFLICT",
        "Choose a currently approved public contribution in this saved visitor book.",
        409,
      );
    receipt = {
      workspace: command.workspace,
      source: selected.source,
      item: command.item,
    };
    // This is the final local authority check before remote dispatch. An already
    // dispatched app request cannot be cancelled by later membership revocation.
    await selected.guard();
    dispatched = true;
    const response = await connection.send("/api/cards", {
      item: command.item,
      source: selected.source,
      status: "published",
    });
    const value = await json(response, 8192);
    const confirmed = savedCard
      .extend({
        outcome: z.enum(["applied", "unchanged"]),
        source: collectionSource,
      })
      .safeParse(value);
    if (
      response.ok &&
      confirmed.success &&
      JSON.stringify(confirmed.data.source) ===
        JSON.stringify(selected.source) &&
      confirmed.data.status === "published"
    )
      return {
        ok: true,
        ...receipt,
        outcome: confirmed.data.outcome,
        card: savedCard.parse(confirmed.data),
        message:
          "The exact source contribution is saved in Linkarooie. Guestbook retains its visibility and media authority.",
      };
    const refused = z
      .object({ outcome: z.literal("refused"), source: collectionSource })
      .safeParse(value);
    if (
      (response.status >= 400 && response.status < 500) ||
      (!response.ok &&
        refused.success &&
        JSON.stringify(refused.data.source) === JSON.stringify(selected.source))
    )
      return {
        ok: true,
        ...receipt,
        outcome: "refused",
        message:
          "Linkarooie refused this collection request. Refresh the saved book and its approved contributions before another attempt.",
      };
    return {
      ok: true,
      ...receipt,
      outcome: "unknown",
      message:
        "This contribution may already be collected. Check its exact saved reference before continuing.",
    };
  } catch (error) {
    if (dispatched && receipt)
      return {
        ok: true,
        ...receipt,
        outcome: "unknown",
        message:
          "The collection response could not be confirmed. Check its exact saved reference before continuing.",
      };
    return {
      ok: false,
      code: error instanceof StackError ? error.code : "UNAVAILABLE",
      message:
        error instanceof StackError
          ? error.message
          : "The selected apps could not be verified. No collection request was sent.",
    };
  }
}
