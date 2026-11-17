-- The export draft has no publishing authority or effect on the parent revision.
-- Keep the legacy variants JSON readable by the previous Worker on rollback.
ALTER TABLE creator_share_calendar_items
  ADD COLUMN x_export_caption TEXT CHECK (x_export_caption IS NULL OR asset_kind='portfolio');
