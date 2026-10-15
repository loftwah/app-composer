-- Extend the existing aggregate counter, preserving every legacy row.
-- Apply through D1 migrations to the verified Composer database before release.
-- No app-owned Guestbook records/media or new database/resource are involved.
CREATE TABLE composer_usage_next (
 day TEXT NOT NULL,
 app TEXT NOT NULL CHECK(app IN ('hello','guestbook','showcase','linkcheck','state')),
 event TEXT NOT NULL CHECK(event IN ('app_open','item_open','inspection_completed','postcard_received')),
 surface TEXT NOT NULL CHECK(surface IN ('standalone','composed')),
 n INTEGER NOT NULL CHECK(n BETWEEN 1 AND 1000),
 CHECK(event != 'postcard_received' OR app = 'guestbook'),
 PRIMARY KEY(day,app,event,surface)
) WITHOUT ROWID;
INSERT INTO composer_usage_next(day,app,event,surface,n) SELECT day,app,event,surface,n FROM composer_usage;
-- This assertion runs inside the same D1 migration transaction as the copy.
-- Concurrent counter writes cannot occur between the copy and this comparison.
CREATE TABLE composer_usage_transfer_check (matches INTEGER NOT NULL CHECK(matches = 1));
INSERT INTO composer_usage_transfer_check(matches)
SELECT NOT EXISTS (SELECT * FROM composer_usage EXCEPT SELECT * FROM composer_usage_next)
   AND NOT EXISTS (SELECT * FROM composer_usage_next EXCEPT SELECT * FROM composer_usage);
DROP TABLE composer_usage_transfer_check;
DROP TABLE composer_usage;
ALTER TABLE composer_usage_next RENAME TO composer_usage;
