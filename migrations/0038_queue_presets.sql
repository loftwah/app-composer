-- Owner-managed recurring queue presets for the Bluesky share calendar
-- (#604 follow-up). A preset is a local template only: a category label, a
-- Melbourne weekday (1=Monday .. 7=Sunday) and a wall-clock HH:mm time. It
-- never creates a calendar item, changes a schedule, dispatches a post or
-- stores a credential. Rows are scoped to one workspace and the exact
-- configured public handle; owner authority and that handle are rechecked on
-- every call. This is purely additive: no existing table or row is touched.
--
-- At most 12 presets are kept per workspace/account. The atomic save statement
-- in share-calendar-admin.ts refuses a 13th distinct category while still
-- allowing an existing category to be updated at the cap. No provenance field
-- is exposed in the response.
CREATE TABLE IF NOT EXISTS creator_share_queue_presets (
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  account_handle TEXT NOT NULL CHECK(length(account_handle) BETWEEN 3 AND 253),
  category TEXT NOT NULL CHECK(
    length(trim(category)) BETWEEN 1 AND 48 AND category = trim(category)
  ),
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
  time TEXT NOT NULL CHECK(
    length(time) = 5 AND time GLOB '[0-2][0-9]:[0-5][0-9]'
    AND CAST(substr(time, 1, 2) AS INTEGER) BETWEEN 0 AND 23
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, account_handle, category)
);

CREATE INDEX IF NOT EXISTS creator_share_queue_presets_scope
  ON creator_share_queue_presets(workspace_id, account_handle, updated_at);
