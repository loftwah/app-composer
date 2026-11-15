// Read-only "recent projects" selection for the Apps launcher.
//
// The launcher must never infer a project from a query parameter. A workspace
// is chosen only from the signed-in account's current memberships, and a
// project only from stacks in that workspace. This module returns bounded
// summaries and canonical links; it never returns drafts, configuration or
// another tenant's rows.
import type { D1Database } from "@cloudflare/workers-types";
import { capabilityFor } from "./stacks.mjs";

export interface LauncherWorkspace {
  id: string;
  name: string;
  role: string;
}

export interface LauncherStackRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  revision: number;
  published_revision: number | null;
  updated_at: string;
  published_at: string | null;
}

export interface LauncherProjectSummary {
  name: string;
  /** Current public state of the saved project. */
  state: "draft" | "published";
  /** The one useful next action, phrased for the project's actual state. */
  action: string;
  updatedAt: string;
  /** Canonical native editor route for this exact workspace and stack. */
  href: string;
  /** Immutable published page, only when the stack is currently published. */
  publishedHref: string | null;
}

export interface LauncherRecents {
  workspace: { name: string; allHref: string } | null;
  project: LauncherProjectSummary | null;
}

const workspaceId = /^[a-z0-9-]{6,64}$/;
const stackId = /^[a-z0-9-]{6,64}$/;
const stackSlug = /^[a-z0-9-]{1,40}$/;
const updated = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

/** The existing native stack editor reads `workspace` and `stack` from the
 * query. Both values come from the server-side membership/stack reads below,
 * never from launcher input. */
export function launcherProjectHref(workspace: string, stack: string) {
  return (
    "/_emdash/admin/plugins/composer-stacks/stacks?" +
    new URLSearchParams({ workspace, stack }).toString()
  );
}

export function launcherWorkspaceHref(workspace: string) {
  return (
    "/_emdash/admin/plugins/composer-stacks/stacks?" +
    new URLSearchParams({ workspace }).toString()
  );
}

function eligible(row: LauncherStackRow) {
  return (
    (row.status === "draft" || row.status === "published") &&
    stackId.test(row.id) &&
    stackSlug.test(row.slug) &&
    typeof row.name === "string" &&
    row.name.trim().length > 0 &&
    row.name.trim().length <= 80 &&
    Number.isInteger(row.revision) &&
    row.revision > 0 &&
    updated(row.updated_at)
  );
}

/** Pure selection over rows already scoped to one workspace. `rows` arrive in
 * `updated_at DESC` order; archived, malformed or stale rows are skipped
 * instead of becoming a broken or invented project. */
export function selectLauncherRecents(
  workspace: LauncherWorkspace,
  rows: readonly LauncherStackRow[],
): LauncherRecents {
  if (!workspaceId.test(workspace.id) || !workspace.name?.trim()) {
    return { workspace: null, project: null };
  }
  const row = rows.find(eligible);
  if (!row) {
    return {
      workspace: {
        name: workspace.name,
        allHref: launcherWorkspaceHref(workspace.id),
      },
      project: null,
    };
  }
  const published =
    row.status === "published" && updated(row.published_at)
      ? `/s/${row.slug}`
      : null;
  const canEdit = capabilityFor(workspace.role, "save");
  return {
    workspace: {
      name: workspace.name,
      allHref: launcherWorkspaceHref(workspace.id),
    },
    project: {
      name: row.name.trim(),
      state: row.status === "published" ? "published" : "draft",
      action: !canEdit
        ? "Open project"
        : row.status === "draft" && row.revision <= 1
          ? "Finish this project"
          : "Continue editing",
      updatedAt: row.updated_at,
      href: launcherProjectHref(workspace.id, row.id),
      publishedHref: published,
    },
  };
}

/** Read-only. Unlike `workspaceForUser`, opening the launcher never creates a
 * workspace or membership as a side effect. */
export async function loadLauncherRecents(
  db: D1Database,
  userId: string,
): Promise<LauncherRecents> {
  if (!userId) return { workspace: null, project: null };
  const workspace = await db
    .prepare(
      `SELECT w.id, w.name, m.role FROM creator_members m
       JOIN creator_workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ?
       ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END, w.created_at, w.id
       LIMIT 1`,
    )
    .bind(userId)
    .first<LauncherWorkspace>();
  if (
    !workspace ||
    !workspaceId.test(workspace.id) ||
    !capabilityFor(workspace.role, "read")
  )
    return { workspace: null, project: null };
  const { results } = await db
    .prepare(
      `SELECT id, slug, name, status, revision, published_revision, updated_at, published_at
       FROM creator_stacks
       WHERE workspace_id = ? AND status IN ('draft', 'published')
       ORDER BY updated_at DESC
       LIMIT 10`,
    )
    .bind(workspace.id)
    .all<LauncherStackRow>();
  return selectLauncherRecents(workspace, results ?? []);
}
