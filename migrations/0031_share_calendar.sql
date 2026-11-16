-- Owner-only share calendar (#604, first slice). Every item points at an exact
-- published stack revision so its source and share card can be rechecked. A
-- row records local preparation only: `scheduled` is a date the owner chose and
-- `shared` means the owner copied, downloaded or exported the item. No network
-- post, provider identifier, token or delivery claim is stored here.
CREATE TABLE IF NOT EXISTS creator_share_calendar_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  stack_id TEXT NOT NULL REFERENCES creator_stacks(id) ON DELETE CASCADE,
  stack_revision INTEGER NOT NULL CHECK(stack_revision > 0),
  channel TEXT NOT NULL CHECK(channel IN ('instagram','facebook','linkedin','bluesky','other')),
  caption TEXT NOT NULL CHECK(length(caption) BETWEEN 1 AND 2200),
  link TEXT NOT NULL DEFAULT '' CHECK(length(link) <= 2048),
  scheduled_at TEXT,
  state TEXT NOT NULL CHECK(state IN ('draft','scheduled','shared')) DEFAULT 'draft',
  shared_at TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(
    (state = 'draft' AND scheduled_at IS NULL AND shared_at IS NULL) OR
    (state = 'scheduled' AND scheduled_at IS NOT NULL AND shared_at IS NULL) OR
    (state = 'shared' AND shared_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS creator_share_calendar_schedule
  ON creator_share_calendar_items(workspace_id, scheduled_at);
CREATE INDEX IF NOT EXISTS creator_share_calendar_source
  ON creator_share_calendar_items(workspace_id, stack_id, state);
