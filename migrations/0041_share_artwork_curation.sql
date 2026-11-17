CREATE TABLE composer_share_artwork_curation (
  asset_id TEXT PRIMARY KEY,
  featured INTEGER NOT NULL CHECK(featured IN (0, 1)),
  tags TEXT NOT NULL
) WITHOUT ROWID;
