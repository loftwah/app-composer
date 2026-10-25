-- Riverton Rowing Club, fictional self-use fixture.
-- The keys mirror the exported App Composer content models in ../spec/models.
-- Forward-only. Local D1 only.

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date TEXT NOT NULL CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  start_note TEXT NOT NULL,
  location TEXT NOT NULL,
  cost TEXT NOT NULL DEFAULT '',
  publication TEXT NOT NULL CHECK (publication IN ('Draft', 'Published')) DEFAULT 'Draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS events_public ON events (publication, event_date);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notice_date TEXT NOT NULL CHECK (notice_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  publication TEXT NOT NULL CHECK (publication IN ('Draft', 'Published')) DEFAULT 'Draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS notices_public ON notices (publication, notice_date);

-- Joining enquiries. `review_state` is the owner decision, never a sale or reply.
CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  enquiry_type TEXT NOT NULL CHECK (enquiry_type IN ('Joining the club', 'An event', 'Volunteering', 'Something else')),
  message TEXT NOT NULL,
  review_state TEXT NOT NULL CHECK (review_state IN ('Pending', 'Reviewed')) DEFAULT 'Pending',
  review_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS enquiries_queue ON enquiries (review_state, created_at);
