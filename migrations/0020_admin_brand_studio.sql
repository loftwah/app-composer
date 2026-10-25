-- One native Composer admin appearance per explicitly configured account and
-- environment. Independent app assets/settings do not belong to this table.
CREATE TABLE composer_admin_brands (
  scope TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  draft_json TEXT NOT NULL,
  published_version INTEGER,
  operation_id TEXT NOT NULL
);
CREATE TABLE composer_admin_brand_versions (
  scope TEXT NOT NULL,
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('draft','publish','rollback')),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (scope,version),
  FOREIGN KEY (scope) REFERENCES composer_admin_brands(scope) ON DELETE RESTRICT
);
