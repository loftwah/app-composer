-- Additive second request: volunteer roles and sign-ups.
-- No existing table, column or row is altered by this migration.

CREATE TABLE IF NOT EXISTS volunteer_roles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date TEXT NOT NULL CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  start_note TEXT NOT NULL,
  location TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 100),
  publication TEXT NOT NULL CHECK (publication IN ('Draft', 'Published')) DEFAULT 'Draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS volunteer_roles_public ON volunteer_roles (publication, event_date);

CREATE TABLE IF NOT EXISTS volunteer_signups (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES volunteer_roles (id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL CHECK (state IN ('Confirmed', 'Cancelled')) DEFAULT 'Confirmed',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS volunteer_signups_role ON volunteer_signups (role_id, state, created_at);
