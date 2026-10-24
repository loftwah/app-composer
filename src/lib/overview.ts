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
  type OverviewSnapshot,
} from "./overview-contract.ts";
const origin = "https://composer.loftwah.com";
const select = z
  .object({
    action: z.literal("list"),
    workspace: z
      .string()
      .regex(/^[a-z0-9-]{6,64}$/)
      .optional(),
  })
  .strict();
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
type Item = OverviewSnapshot["items"][number];
interface BaseRow {
  id: string;
  created_at: string;
  updated_at: string;
}
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
        environment: z.string().regex(/^[a-z0-9-]{1,40}$/),
      })
      .parse({
        account: runtime.RESOURCE_ACCOUNT_ID,
        environment: runtime.RESOURCE_ENVIRONMENT,
      });
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
      id: Source["id"],
      label: string,
      read: () => Promise<Item[]>,
      count?: () => number,
    ) {
      try {
        const found = await read();
        const n = count
          ? count()
          : found.reduce((n, item) => n + item.count, 0);
        sources.push({
          id,
          label,
          status: "checked",
          count: n,
          atLimit: n >= (id === "notifications" ? 100 : 50),
          note:
            id === "notifications"
              ? "Only the latest 30 notification records shown per visitor book, up to 100 matching records in total. Older problems may remain. Provider health and the live application are not checked."
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
    await collect("platform", "Internal platform", async () => {
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
        .bind(workspace.id, target.account, target.environment, workspace.id)
        .all<BaseRow & { plan_json: string }>();
      const matched = rows.results.filter((row) => {
        const plan = z
          .object({
            target: z.object({ account: z.string(), environment: z.string() }),
          })
          .parse(JSON.parse(row.plan_json));
        return (
          plan.target.account === target.account &&
          plan.target.environment === target.environment
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
    await collect("workflows", "Workflows", async () => {
      const rows = await db
        .prepare(
          "SELECT id,recipe,source_id,created_at,updated_at FROM creator_workflow_runs WHERE workspace_id=? AND account_id=? AND environment=? AND synthetic=0 AND state='needs-attention' AND id IN (SELECT id FROM creator_workflow_runs WHERE workspace_id=? AND account_id=? AND environment=? ORDER BY created_at DESC,id DESC LIMIT 50) ORDER BY updated_at DESC,id LIMIT 50",
        )
        .bind(
          workspace.id,
          target.account,
          target.environment,
          workspace.id,
          target.account,
          target.environment,
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
    if (workspace.role === "viewer")
      sources.push({
        id: "notifications",
        label: "Owner notifications",
        status: "restricted",
        count: null,
        atLimit: false,
        note: "Private Inbox signals require current owner or editor access.",
      });
    else
      await collect("notifications", "Owner notifications", async () => {
        const rows = await db
          .prepare(
            "SELECT n.id,n.resource_id,n.created_at,n.updated_at FROM creator_enquiry_notification_outbox n JOIN creator_app_resources r ON r.id=n.resource_id AND r.workspace_id=n.workspace_id WHERE n.workspace_id=? AND n.account_id=? AND n.environment=? AND n.state IN ('blocked','failed','uncertain','sending') AND r.app='guestbook' AND r.account_id=n.account_id AND r.environment=n.environment AND r.target=n.target AND r.state='ready' AND n.id IN (SELECT id FROM creator_enquiry_notification_outbox WHERE workspace_id=n.workspace_id AND resource_id=n.resource_id ORDER BY created_at DESC,id LIMIT 30) ORDER BY n.updated_at DESC,n.id LIMIT 100",
          )
          .bind(workspace.id, target.account, target.environment)
          .all<BaseRow & { resource_id: string }>();
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
    return overviewSnapshot.parse({
      ok: true,
      version: "composer.overview/1",
      workspace: { ...workspace, role: currentRole },
      target,
      checkedAt: new Date().toISOString(),
      sources,
      items: items.sort((a, b) => b.lastObserved.localeCompare(a.lastObserved)),
    });
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
