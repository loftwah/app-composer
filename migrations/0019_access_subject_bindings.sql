-- No accounts are linked by this migration. A reviewed, explicit binding is
-- required before the optional subject guard can be enabled.
CREATE TABLE composer_access_subject_bindings (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  idp_id TEXT NOT NULL,
  upstream_issuer TEXT NOT NULL,
  upstream_subject TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  reviewed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  PRIMARY KEY (issuer, subject),
  UNIQUE (idp_id, upstream_issuer, upstream_subject),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);
