import type { D1Database } from "@cloudflare/workers-types";
import { StackError } from "./stacks.mjs";

// Existing HTTP lifecycle endpoints must not bypass an enabled platform policy.
// Content moderation/export keep their separately checked app/role contracts.
export async function guardPlatformLifecycle(
  db: D1Database,
  workspace: string,
  action: string,
) {
  if (
    ![
      "create",
      "import",
      "save",
      "publish",
      "duplicate",
      "rollback",
      "republish",
      "restoreDraft",
      "unpublish",
      "archive",
      "restore",
      "delete",
      "restoreRevision",
      "applyResources",
      "reuseResource",
      "reconcileResources",
    ].includes(action)
  )
    return;
  const profile = await db
    .prepare(
      "SELECT profile_json FROM creator_platform_profiles WHERE workspace_id=?",
    )
    .bind(workspace)
    .first<{ profile_json: string }>();
  if (profile)
    throw new StackError(
      "FORBIDDEN",
      "This workspace uses governed application requests. Open Internal platform to validate its exact recipe and standing policy.",
      403,
    );
}
