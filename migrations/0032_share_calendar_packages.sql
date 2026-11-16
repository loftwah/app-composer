-- Per-channel approval packages (#604, second slice). Additive only: an item
-- keeps its existing main caption as the default destination, and an optional
-- exact destination name for a reviewer. `variants` holds additional channel
-- drafts as a small validated JSON array. Nothing here connects an account,
-- stores a credential or claims that a post was delivered.
ALTER TABLE creator_share_calendar_items
  ADD COLUMN destination TEXT NOT NULL DEFAULT ''
  CHECK(length(destination) <= 120);
ALTER TABLE creator_share_calendar_items
  ADD COLUMN variants TEXT NOT NULL DEFAULT '[]'
  CHECK(json_valid(variants) AND length(variants) <= 65536);
CREATE INDEX IF NOT EXISTS creator_share_calendar_destination
  ON creator_share_calendar_items(workspace_id, destination);
