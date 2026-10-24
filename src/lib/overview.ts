import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { isCreatorRole } from "./creator-access.ts";
import {
  resolveWorkspace,
  membership,
  requireCapability,
  StackError,
} from "./stacks.mjs";
import {
  overviewSnapshot,
  overviewSources,
  type OverviewSnapshot,
} from "./overview-contract.ts";
import { APP_ID, ENVIRONMENT_ID, WORKSPACE_ID } from "./admin-scope.ts";
import { readResourceInventory } from "./resource-inventory.ts";
import { appSettings } from "./app-settings.mjs";
const origin = "https://composer.loftwah.com";
const scope = {
  workspace: z.string().regex(WORKSPACE_ID).optional(),
  environment: z.string().regex(ENVIRONMENT_ID).optional(),
  app: z.string().regex(APP_ID).optional(),
};
const select = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), ...scope }).strict(),
  z
    .object({
      action: z.literal("recheck"),
      source: z.enum(overviewSources),
      ...scope,
    })
    .strict(),
]);
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
}
type Source = OverviewSnapshot["sources"][number];
type SourceId = Source["id"];
type Item = OverviewSnapshot["items"][number];
interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string;
}
const LABELS: Record<SourceId, string> = {
  platform: "Internal platform",
  workflows: "Workflows",
  resources: "App resources",
  notifications: "Owner notifications",
};
function timestamp(input: string) {
  const text = input.includes("T") ? input : input.replace(" ", "T") + "Z";
  const time = Date.parse(text);
  if (!Number.isFinite(time)) throw Error("Invalid stored observation date");
  return new Date(time).toISOString();
}
function group(
  rows: BaseRow[],
  source: Item["source"],
  key: (row: BaseRow) => string,
  describe: (
    row: BaseRow,
  ) => Pick<Item, "title" | "summary" | "action" | "href">,
  app: (row: BaseRow) => string | null = () => null,
): Item[] {
  const items = new Map<string, Item>();
  for (const row of rows) {
    const groupKey = key(row),
      created = timestamp(row.created_at),
      updated = timestamp(row.updated_at);
    const prior = items.get(groupKey);
    if (prior) {
      prior.count++;
      prior.firstObserved =
        prior.firstObserved < created ? prior.firstObserved : created;
      prior.lastObserved =
        prior.lastObserved > updated ? prior.lastObserved : updated;
    } else
      items.set(groupKey, {
        id: source + ":" + groupKey,
        source,
        app: app(row),
        ...describe(row),
        count: 1,
        firstObserved: created,
        lastObserved: updated,
      });
  }
  return [...items.values()];
}
export async function manageOverview(ctx: Context, runtime: Runtime) {
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
        "Overview is disconnected in this environment.",
      );
    if (
      ctx.request.method !== "GET" ||
      (ctx.request.headers.has("Origin") &&
        ctx.request.headers.get("Origin") !== origin)
    )
      throw new StackError(
        "FORBIDDEN",
        "Open this read-only overview from Composer administration.",
        403,
      );
    const url = new URL(ctx.request.url);
    for (const key of url.searchParams.keys())
      if (url.searchParams.getAll(key).length !== 1)
        throw new StackError("INVALID", "Choose each overview filter once.");
    const input = select.parse(ctx.input),
      db = runtime.DB,
      user = ctx.user;
    const workspace = await resolveWorkspace(db, user, input.workspace ?? null);
    requireCapability(workspace.role, "read");
    const target = z
      .object({
        account: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
        environment: z.string().regex(ENVIRONMENT_ID),
      })
      .parse({
        account: runtime.RESOURCE_ACCOUNT_ID,
        environment: runtime.RESOURCE_ENVIRONMENT,
      });
    // Only scopes this workspace actually records for the configured account
    // are offered. A client-supplied value must match one of them.
    const spaces = await db
      .prepare(
        "SELECT w.id,w.name,m.role FROM creator_members m JOIN creator_workspaces w ON w.id=m.workspace_id WHERE m.user_id=? ORDER BY CASE WHEN w.id=(SELECT workspace_id FROM creator_personal_workspaces WHERE user_id=?) THEN 0 ELSE 1 END,w.created_at,w.id LIMIT 32",
      )
      .bind(user.id, user.id)
      .all<{ id: string; name: string; role: string }>();
    const workspaces = spaces.results
      .filter(
        (row) =>
          WORKSPACE_ID.test(row.id) &&
          row.name.length > 0 &&
          row.name.length <= 120 &&
          (row.role === "owner" || row.role === "editor" || row.role === "viewer"),
      )
      .map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role as "owner" | "editor" | "viewer",
      }));
    if (!workspaces.some((row) => row.id === workspace.id))
      workspaces.unshift({
        id: workspace.id,
        name: workspace.name,
        role: workspace.role,
      });
    const recorded = await db
      .prepare(
        "SELECT DISTINCT environment FROM creator_app_resources WHERE workspace_id=? AND account_id=? ORDER BY environment LIMIT 8",
      )
      .bind(workspace.id, target.account)
      .all<{ environment: string }>();
    const environments = [
      target.environment,
      ...recorded.results
        .map((row) => row.environment)
        .filter(
          (value) => value !== target.environment && ENVIRONMENT_ID.test(value),
        ),
    ].slice(0, 8);
    if (input.environment && !environments.includes(input.environment))
      throw new StackError(
        "INVALID",
        "That environment is not recorded for this workspace. Choose one of the environments this workspace uses.",
        400,
      );
    const environment = input.environment ?? target.environment;
    const appRows = await db
      .prepare(
        "SELECT app, COUNT(*) AS resources FROM creator_app_resources WHERE workspace_id=? AND account_id=? AND environment=? GROUP BY app ORDER BY app LIMIT 20",
      )
      .bind(workspace.id, target.account, environment)
      .all<{ app: string; resources: number }>();
    const apps = appRows.results
      .filter((row) => APP_ID.test(row.app))
      .map((row) => ({ id: row.app, resources: Number(row.resources) }));
    if (input.app && !apps.some((app) => app.id === input.app))
      throw new StackError(
        "INVALID",
        "That app has no recorded resource in this workspace and environment. Choose another scope or open App resources.",
        400,
      );
    const selectedApp = input.app ?? null;
    if (
      input.action === "recheck" &&
      input.source === "notifications" &&
      workspace.role === "viewer"
    )
      throw new StackError(
        "FORBIDDEN",
        "Private Inbox signals require current owner or editor access. Ask the workspace owner.",
        403,
      );
    const link = (page: string, fragment: string, resource?: string) =>
      "/_emdash/admin/plugins/composer-stacks/" +
      page +
      "?" +
      new URLSearchParams({
        workspace: workspace.id,
        ...(resource ? { resource } : {}),
      }) +
      "#" +
      fragment;
    const sources: Source[] = [],
      items: Item[] = [];
    async function collect(
      id: SourceId,
      read: () => Promise<Item[]>,
    ): Promise<void> {
      const label = LABELS[id];
      try {
        const found = await read();
        const n = found.reduce((total, item) => total + item.count, 0);
        sources.push({
          id,
          label,
          status: "checked",
          count: n,
          atLimit: n >= (id === "notifications" ? 100 : 50),
          note:
            id === "notifications"
              ? "Only the latest 30 notification records shown per visitor book, up to 100 matching records in total. Older problems may remain. Provider health and the live application are not checked."
              : id === "resources"
                ? "Composer's own stored resource records for this account, in every recorded environment. It counts the resources App resources shows as needing attention, unknown, stale or unbound. No Cloudflare read, tag change or billing check happens here."
                : "Only problems among the latest 50 records shown in the owning screen. Older retained problems may remain. Provider health and the live application are not checked.",
        });
        items.push(...found);
      } catch {
        sources.push({
          id,
          label,
          status: "unavailable",
          count: null,
          atLimit: false,
          note: "These records could not be checked. Open the owning screen or retry; unavailable is not zero.",
        });
      }
    }
    await collect("platform", async () => {
      const malformed = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM creator_platform_requests WHERE workspace_id=? AND id IN (SELECT id FROM creator_platform_requests WHERE workspace_id=? ORDER BY created_at DESC,id LIMIT 50) AND status='needs-attention' AND (CASE WHEN json_valid(plan_json) THEN COALESCE(json_type(plan_json,'$.target.account'),'missing') ELSE 'invalid' END != 'text' OR CASE WHEN json_valid(plan_json) THEN COALESCE(json_type(plan_json,'$.target.environment'),'missing') ELSE 'invalid' END != 'text')",
        )
        .bind(workspace.id, workspace.id)
        .first<{ n: number }>();
      if (malformed?.n)
        throw Error("A retained platform target cannot be assessed.");
      const rows = await db
        .prepare(
          "SELECT id,plan_json,created_at,updated_at FROM creator_platform_requests WHERE workspace_id=? AND status='needs-attention' AND CASE WHEN json_valid(plan_json) THEN json_extract(plan_json,'$.target.account') ELSE NULL END=? AND CASE WHEN json_valid(plan_json) THEN json_extract(plan_json,'$.target.environment') ELSE NULL END=? AND id IN (SELECT id FROM creator_platform_requests WHERE workspace_id=? ORDER BY created_at DESC,id LIMIT 50) ORDER BY updated_at DESC,id LIMIT 50",
        )
        .bind(workspace.id, target.account, environment, workspace.id)
        .all<BaseRow & { plan_json: string }>();
      const matched = rows.results.filter((row) => {
        const plan = z
          .object({
            target: z.object({ account: z.string(), environment: z.string() }),
          })
          .parse(JSON.parse(row.plan_json));
        return (
          plan.target.account === target.account &&
          plan.target.environment === environment
        );
      });
      return group(
        matched,
        "platform",
        (row) => row.id,
        (row) => ({
          title: "A platform request needs attention",
          summary:
            "Inspect the saved reason and use the request’s supported reconciliation or recovery action.",
          action: "Open request",
          href: link("platform", "platform-request-" + row.id),
        }),
      );
    });
    await collect("workflows", async () => {
      const rows = await db
        .prepare(
          "SELECT id,recipe,source_id,created_at,updated_at FROM creator_workflow_runs WHERE workspace_id=? AND account_id=? AND environment=? AND synthetic=0 AND state='needs-attention' AND id IN (SELECT id FROM creator_workflow_runs WHERE workspace_id=? AND account_id=? AND environment=? ORDER BY created_at DESC,id DESC LIMIT 50) ORDER BY updated_at DESC,id LIMIT 50",
        )
        .bind(
          workspace.id,
          target.account,
          environment,
          workspace.id,
          target.account,
          environment,
        )
        .all<BaseRow & { recipe: string; source_id: string }>();
      return group(
        rows.results,
        "workflows",
        (row) => {
          const value = row as BaseRow & { recipe: string; source_id: string };
          return value.recipe + ":" + value.source_id;
        },
        (row) => ({
          title: "A workflow needs attention",
          summary:
            "One or more runs for this source failed. Open the retained steps and use only the recipe’s supported retry.",
          action: "Open workflow run",
          href: link("workflows", "workflow-run-" + row.id),
        }),
      );
    });
    await collect("resources", async () => {
      // One shared read with the App resources screen, so the two surfaces
      // cannot report different problem counts for this workspace.
      const inventory = await readResourceInventory(db, {
        workspace,
        account: target.account,
        environment: target.environment,
        installedSource: z
          .string()
          .regex(/^[a-f0-9]{40}$/)
          .nullable()
          .parse(appSettings.guestbook?.source?.commit ?? null),
        now: Date.now(),
      });
      return inventory.resources
        .filter((resource) => resource.status !== "in-step")
        .map((resource) => {
          const attention = resource.findings.filter(
            (finding) => finding.severity === "attention",
          );
          const unknown = resource.findings.filter(
            (finding) => finding.severity === "unknown",
          );
          const lead = attention[0] ?? unknown[0] ?? resource.findings[0];
          return {
            id: "resources:" + resource.id,
            source: "resources" as const,
            app: resource.app,
            title:
              lead?.title ??
              (resource.status === "unbound"
                ? "A recorded app resource is not used by a saved stack"
                : "A recorded app resource needs a look"),
            summary:
              lead?.detail ??
              "Open App resources to compare the recorded state with its saved stack.",
            action: "Open App resources",
            href: link("resources", "ri-resource-" + resource.id),
            count: 1,
            firstObserved: resource.recordedAt,
            lastObserved:
              resource.lastConfirmedOperation?.at ?? resource.recordedAt,
          };
        });
    });
    if (workspace.role === "viewer")
      sources.push({
        id: "notifications",
        label: LABELS.notifications,
        status: "restricted",
        count: null,
        atLimit: false,
        note: "Private Inbox signals require current owner or editor access.",
      });
    else
      await collect("notifications", async () => {
        const rows = await db
          .prepare(
            "SELECT n.id,n.resource_id,r.app AS app,n.created_at,n.updated_at FROM creator_enquiry_notification_outbox n JOIN creator_app_resources r ON r.id=n.resource_id AND r.workspace_id=n.workspace_id WHERE n.workspace_id=? AND n.account_id=? AND n.environment=? AND n.state IN ('blocked','failed','uncertain','sending') AND r.app=? AND r.account_id=n.account_id AND r.environment=n.environment AND r.target=n.target AND r.state='ready' AND n.id IN (SELECT id FROM creator_enquiry_notification_outbox WHERE workspace_id=n.workspace_id AND resource_id=n.resource_id ORDER BY created_at DESC,id LIMIT 30) ORDER BY n.updated_at DESC,n.id LIMIT 100",
          )
          .bind(
            workspace.id,
            target.account,
            environment,
            selectedApp ?? "guestbook",
          )
          .all<BaseRow & { resource_id: string; app: string }>();
        return group(
          rows.results,
          "notifications",
          (row) => (row as BaseRow & { resource_id: string }).resource_id,
          (row) => ({
            title: "A visitor book’s notifications need attention",
            summary:
              "Check the connection or held send outcome in Inbox. Uncertain messages must be reconciled before repetition.",
            action: "Open Inbox notification",
            href: link(
              "enquiries",
              "notification-" + row.id,
              (row as BaseRow & { resource_id: string }).resource_id,
            ),
          }),
          (row) => (row as BaseRow & { app: string }).app,
        );
      });
    const currentRole = await membership(db, workspace.id, user.id);
    requireCapability(currentRole, "read");
    if (currentRole === "viewer" && workspace.role !== "viewer")
      throw new StackError(
        "FORBIDDEN",
        "Private overview access changed. Refresh the selected workspace.",
        403,
      );
    const checkedAt = new Date().toISOString();
    if (input.action === "recheck") {
      const requested = sources.find((source) => source.id === input.source);
      if (!requested || requested.status !== "checked")
        return {
          ok: false as const,
          code:
            requested?.status === "restricted" ? "FORBIDDEN" : "UNAVAILABLE",
          source: input.source,
          message:
            LABELS[input.source] +
            " could not be rechecked. It remains " +
            (requested?.status === "restricted" ? "restricted" : "unavailable") +
            ", which is not zero. Retry or open its owning screen.",
        };
    }
    const snapshot = overviewSnapshot.parse({
      ok: true,
      version: "composer.overview/1",
      workspace: { ...workspace, role: currentRole },
      target: { account: target.account, environment },
      selection: { app: selectedApp },
      available: { workspaces, environments, apps },
      checkedAt,
      sources,
      items: items.sort((a, b) => b.lastObserved.localeCompare(a.lastObserved)),
    });
    if (input.action === "recheck")
      snapshot.rechecked = { source: input.source, at: checkedAt };
    return snapshot;
  } catch (error) {
    return {
      ok: false as const,
      code: error instanceof StackError ? error.code : "UNAVAILABLE",
      message:
        error instanceof StackError
          ? error.message
          : "Overview could not confirm this selected workspace and target. Refresh or open its owning screens.",
    };
  }
}
