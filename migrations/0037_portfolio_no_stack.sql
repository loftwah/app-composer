-- Approved real Woodhouse portfolio posts without a Composer stack (#604 follow-up).
--
-- A share-calendar item currently must point at an exact published stack
-- revision. A real portfolio post has no stack: its image, alt text and link
-- are resolved by Bluesky and pinned by an explicit asset descriptor. SQLite
-- cannot widen the existing NOT NULL stack FK in place, and the stack FK and
-- both child FKs are ON DELETE CASCADE, so deleting a parent row during a
-- rebuild would remove its approvals and deliveries even with
-- PRAGMA defer_foreign_keys. Rebuild all three tables under _next names, copy
-- parent first and children second/third, prove every prior column survived,
-- drop old children before the old parent, then rename. foreign_keys is never
-- disabled by this migration.
--
-- Exact compatibility contract for the rename:
--   * Every prior column and constraint of all three tables is preserved byte
--     for byte. Only the calendar item gains columns: stack_id and
--     stack_revision become nullable, and asset_kind + bluesky_asset are added.
--   * All pre-existing rows are copied as asset_kind='stack' with a NULL
--     bluesky_asset; their channel is unchanged and may still be any of the
--     original five values.
--   * FKs keep their exact targets and ON DELETE CASCADE actions. Indexes keep
--     their exact names, columns and order (recreated after the rename).
--   * A bidirectional EXCEPT guard below proves row-for-row, column-for-column
--     equality of every prior column before anything is dropped.

CREATE TABLE creator_share_calendar_items_next (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  stack_id TEXT REFERENCES creator_stacks(id) ON DELETE CASCADE,
  stack_revision INTEGER CHECK(stack_revision > 0),
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
  destination TEXT NOT NULL DEFAULT '' CHECK(length(destination) <= 120),
  variants TEXT NOT NULL DEFAULT '[]'
    CHECK(json_valid(variants) AND length(variants) <= 65536),
  asset_kind TEXT NOT NULL DEFAULT 'stack' CHECK(asset_kind IN ('stack','portfolio')),
  bluesky_asset TEXT CHECK(bluesky_asset IS NULL OR (json_valid(bluesky_asset) AND length(bluesky_asset) BETWEEN 1 AND 65536)),
  CHECK(
    (state = 'draft' AND scheduled_at IS NULL AND shared_at IS NULL) OR
    (state = 'scheduled' AND scheduled_at IS NOT NULL AND shared_at IS NULL) OR
    (state = 'shared' AND shared_at IS NOT NULL)
  ),
  -- Reject a half-stack reference: stack_id and stack_revision are both set or
  -- both NULL, never one without the other.
  CHECK((stack_id IS NULL) = (stack_revision IS NULL)),
  -- A stack item pins a stack; a portfolio (real catalogue) item pins none.
  CHECK(asset_kind <> 'stack' OR (stack_id IS NOT NULL AND stack_revision IS NOT NULL)),
  CHECK(asset_kind <> 'portfolio' OR (stack_id IS NULL AND stack_revision IS NULL)),
  -- Reject catalogue/portfolio without descriptor: an exact server-resolved
  -- descriptor is mandatory when there is no stack to resolve an asset from.
  CHECK(asset_kind <> 'portfolio' OR bluesky_asset IS NOT NULL),
  -- Reject non-Bluesky portfolios: only Bluesky resolves this descriptor;
  -- other channels keep using a published stack.
  CHECK(asset_kind <> 'portfolio' OR channel = 'bluesky')
);

CREATE TABLE creator_share_approvals_next (
  item_id TEXT PRIMARY KEY REFERENCES creator_share_calendar_items_next(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel = 'bluesky'),
  state TEXT NOT NULL CHECK(state IN ('approved','cancelled','revoked')),
  account_handle TEXT NOT NULL CHECK(length(account_handle) BETWEEN 3 AND 253),
  account_did TEXT NOT NULL CHECK(length(account_did) BETWEEN 8 AND 256),
  draft_revision INTEGER NOT NULL CHECK(draft_revision > 0),
  approval_revision INTEGER NOT NULL CHECK(approval_revision > 0),
  text_hash TEXT NOT NULL CHECK(length(text_hash) = 64),
  media_hash TEXT NOT NULL CHECK(length(media_hash) = 64),
  media_revision TEXT NOT NULL CHECK(length(media_revision) BETWEEN 1 AND 2048),
  link TEXT NOT NULL CHECK(length(link) BETWEEN 1 AND 2048),
  scheduled_at TEXT NOT NULL,
  binding_hash TEXT NOT NULL CHECK(length(binding_hash) = 64),
  approved_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  cancelled_at TEXT,
  revoked_at TEXT,
  revocation_reason TEXT NOT NULL DEFAULT '' CHECK(length(revocation_reason) <= 280),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(
    (state = 'approved' AND cancelled_at IS NULL AND revoked_at IS NULL) OR
    (state = 'cancelled' AND cancelled_at IS NOT NULL AND revoked_at IS NULL) OR
    (state = 'revoked' AND revoked_at IS NOT NULL)
  )
);

CREATE TABLE creator_share_deliveries_next (
  idempotency_key TEXT PRIMARY KEY CHECK(length(idempotency_key) BETWEEN 20 AND 200),
  item_id TEXT NOT NULL REFERENCES creator_share_calendar_items_next(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES creator_workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel = 'bluesky'),
  approval_revision INTEGER NOT NULL CHECK(approval_revision > 0),
  account_handle TEXT NOT NULL CHECK(length(account_handle) BETWEEN 3 AND 253),
  account_did TEXT NOT NULL CHECK(length(account_did) BETWEEN 8 AND 256),
  binding_hash TEXT NOT NULL CHECK(length(binding_hash) = 64),
  text_hash TEXT NOT NULL CHECK(length(text_hash) = 64),
  rkey TEXT NOT NULL CHECK(length(rkey) BETWEEN 1 AND 512),
  state TEXT NOT NULL CHECK(state IN (
    'approved','sending','published','failed','unknown','cancelled','needs_auth'
  )),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK(attempt BETWEEN 0 AND 10),
  provider_uri TEXT CHECK(provider_uri IS NULL OR length(provider_uri) <= 1024),
  provider_cid TEXT CHECK(provider_cid IS NULL OR length(provider_cid) <= 256),
  permalink TEXT CHECK(permalink IS NULL OR length(permalink) <= 1024),
  error_code TEXT NOT NULL DEFAULT '' CHECK(length(error_code) <= 80),
  error_message TEXT NOT NULL DEFAULT '' CHECK(length(error_message) <= 280),
  claimed_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(item_id, approval_revision),
  CHECK(state <> 'sending' OR claimed_at IS NOT NULL),
  CHECK(state <> 'published' OR (
    provider_uri IS NOT NULL AND provider_cid IS NOT NULL AND
    permalink IS NOT NULL AND published_at IS NOT NULL
  )),
  CHECK(state NOT IN ('failed','needs_auth','unknown') OR error_code <> '')
);

-- Populate the next parent first; children reference rows that now exist.
INSERT INTO creator_share_calendar_items_next
  (id, workspace_id, stack_id, stack_revision, channel, caption, link,
   scheduled_at, state, shared_at, created_by, updated_by, revision,
   created_at, updated_at, destination, variants, asset_kind, bluesky_asset)
SELECT
  id, workspace_id, stack_id, stack_revision, channel, caption, link,
  scheduled_at, state, shared_at, created_by, updated_by, revision,
  created_at, updated_at, destination, variants, 'stack', NULL
FROM creator_share_calendar_items;

INSERT INTO creator_share_approvals_next
  (item_id, workspace_id, channel, state, account_handle, account_did,
   draft_revision, approval_revision, text_hash, media_hash, media_revision,
   link, scheduled_at, binding_hash, approved_at, expires_at, cancelled_at,
   revoked_at, revocation_reason, created_by, updated_by, created_at, updated_at)
SELECT
  item_id, workspace_id, channel, state, account_handle, account_did,
  draft_revision, approval_revision, text_hash, media_hash, media_revision,
  link, scheduled_at, binding_hash, approved_at, expires_at, cancelled_at,
  revoked_at, revocation_reason, created_by, updated_by, created_at, updated_at
FROM creator_share_approvals;

INSERT INTO creator_share_deliveries_next
  (idempotency_key, item_id, workspace_id, channel, approval_revision,
   account_handle, account_did, binding_hash, text_hash, rkey, state, attempt,
   provider_uri, provider_cid, permalink, error_code, error_message,
   claimed_at, published_at, created_at, updated_at)
SELECT
  idempotency_key, item_id, workspace_id, channel, approval_revision,
  account_handle, account_did, binding_hash, text_hash, rkey, state, attempt,
  provider_uri, provider_cid, permalink, error_code, error_message,
  claimed_at, published_at, created_at, updated_at
FROM creator_share_deliveries;

-- Prove exact bidirectional equivalence of every prior column for each table
-- before dropping anything. The CHECK turns any mismatch into a hard failure,
-- so a partial or lossy copy can never reach the DROP statements below.
CREATE TEMP TABLE _0037_copy_guard (result TEXT NOT NULL CHECK(result = ''));
INSERT INTO _0037_copy_guard (result)
SELECT CASE WHEN
    EXISTS (
      SELECT id, workspace_id, stack_id, stack_revision, channel, caption, link,
             scheduled_at, state, shared_at, created_by, updated_by, revision,
             created_at, updated_at, destination, variants
      FROM creator_share_calendar_items
      EXCEPT
      SELECT id, workspace_id, stack_id, stack_revision, channel, caption, link,
             scheduled_at, state, shared_at, created_by, updated_by, revision,
             created_at, updated_at, destination, variants
      FROM creator_share_calendar_items_next
    )
    OR EXISTS (
      SELECT id, workspace_id, stack_id, stack_revision, channel, caption, link,
             scheduled_at, state, shared_at, created_by, updated_by, revision,
             created_at, updated_at, destination, variants
      FROM creator_share_calendar_items_next
      EXCEPT
      SELECT id, workspace_id, stack_id, stack_revision, channel, caption, link,
             scheduled_at, state, shared_at, created_by, updated_by, revision,
             created_at, updated_at, destination, variants
      FROM creator_share_calendar_items
    )
    OR EXISTS (
      SELECT item_id, workspace_id, channel, state, account_handle, account_did,
             draft_revision, approval_revision, text_hash, media_hash,
             media_revision, link, scheduled_at, binding_hash, approved_at,
             expires_at, cancelled_at, revoked_at, revocation_reason,
             created_by, updated_by, created_at, updated_at
      FROM creator_share_approvals
      EXCEPT
      SELECT item_id, workspace_id, channel, state, account_handle, account_did,
             draft_revision, approval_revision, text_hash, media_hash,
             media_revision, link, scheduled_at, binding_hash, approved_at,
             expires_at, cancelled_at, revoked_at, revocation_reason,
             created_by, updated_by, created_at, updated_at
      FROM creator_share_approvals_next
    )
    OR EXISTS (
      SELECT item_id, workspace_id, channel, state, account_handle, account_did,
             draft_revision, approval_revision, text_hash, media_hash,
             media_revision, link, scheduled_at, binding_hash, approved_at,
             expires_at, cancelled_at, revoked_at, revocation_reason,
             created_by, updated_by, created_at, updated_at
      FROM creator_share_approvals_next
      EXCEPT
      SELECT item_id, workspace_id, channel, state, account_handle, account_did,
             draft_revision, approval_revision, text_hash, media_hash,
             media_revision, link, scheduled_at, binding_hash, approved_at,
             expires_at, cancelled_at, revoked_at, revocation_reason,
             created_by, updated_by, created_at, updated_at
      FROM creator_share_approvals
    )
    OR EXISTS (
      SELECT idempotency_key, item_id, workspace_id, channel, approval_revision,
             account_handle, account_did, binding_hash, text_hash, rkey, state,
             attempt, provider_uri, provider_cid, permalink, error_code,
             error_message, claimed_at, published_at, created_at, updated_at
      FROM creator_share_deliveries
      EXCEPT
      SELECT idempotency_key, item_id, workspace_id, channel, approval_revision,
             account_handle, account_did, binding_hash, text_hash, rkey, state,
             attempt, provider_uri, provider_cid, permalink, error_code,
             error_message, claimed_at, published_at, created_at, updated_at
      FROM creator_share_deliveries_next
    )
    OR EXISTS (
      SELECT idempotency_key, item_id, workspace_id, channel, approval_revision,
             account_handle, account_did, binding_hash, text_hash, rkey, state,
             attempt, provider_uri, provider_cid, permalink, error_code,
             error_message, claimed_at, published_at, created_at, updated_at
      FROM creator_share_deliveries_next
      EXCEPT
      SELECT idempotency_key, item_id, workspace_id, channel, approval_revision,
             account_handle, account_did, binding_hash, text_hash, rkey, state,
             attempt, provider_uri, provider_cid, permalink, error_code,
             error_message, claimed_at, published_at, created_at, updated_at
      FROM creator_share_deliveries
    )
  THEN 'copy mismatch' ELSE '' END;
DROP TABLE _0037_copy_guard;

-- Remove old children first, old parent last. Dropping the old parent cannot
-- cascade into the new children: they reference creator_share_calendar_items_next.
DROP TABLE creator_share_approvals;
DROP TABLE creator_share_deliveries;
DROP TABLE creator_share_calendar_items;

-- Rename parent first so SQLite rewrites both child FKs to the final name.
ALTER TABLE creator_share_calendar_items_next RENAME TO creator_share_calendar_items;
ALTER TABLE creator_share_approvals_next RENAME TO creator_share_approvals;
ALTER TABLE creator_share_deliveries_next RENAME TO creator_share_deliveries;

-- Recreate the exact original indexes on the final table names.
CREATE INDEX IF NOT EXISTS creator_share_calendar_schedule
  ON creator_share_calendar_items(workspace_id, scheduled_at);
CREATE INDEX IF NOT EXISTS creator_share_calendar_source
  ON creator_share_calendar_items(workspace_id, stack_id, state);
CREATE INDEX IF NOT EXISTS creator_share_calendar_destination
  ON creator_share_calendar_items(workspace_id, destination);
CREATE INDEX IF NOT EXISTS creator_share_approvals_workspace
  ON creator_share_approvals(workspace_id, state);
CREATE INDEX IF NOT EXISTS creator_share_deliveries_item
  ON creator_share_deliveries(workspace_id, item_id, approval_revision);
CREATE INDEX IF NOT EXISTS creator_share_deliveries_state
  ON creator_share_deliveries(workspace_id, state);
