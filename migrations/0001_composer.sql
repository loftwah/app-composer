CREATE TABLE IF NOT EXISTS composer_sources (id TEXT PRIMARY KEY,repository TEXT NOT NULL,commit_sha TEXT NOT NULL,manifest_json TEXT NOT NULL,reviewed TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS composer_releases (id TEXT PRIMARY KEY,state TEXT NOT NULL CHECK(state IN ('staged','rejected','active','superseded')),manifest_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
