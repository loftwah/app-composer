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
  if ((await platformLifecycleMode(db, workspace)) === "governed")
    throw new StackError(
      "FORBIDDEN",
      "This workspace uses governed application requests. Open Internal platform to validate its exact recipe and standing policy.",
      403,
    );
}

/** The same stored-policy boundary shown by the native creator interface. */
export async function platformLifecycleMode(
  db: D1Database,
  workspace: string,
): Promise<"creator" | "governed"> {
  const profile = await db
    .prepare(
      "SELECT profile_json FROM creator_platform_profiles WHERE workspace_id=?",
    )
    .bind(workspace)
    .first<{ profile_json: string }>();
  return profile ? "governed" : "creator";
}
