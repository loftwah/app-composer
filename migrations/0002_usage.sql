-- Aggregate counters only. No individual events or visitor data.
CREATE TABLE IF NOT EXISTS composer_usage (
 day TEXT NOT NULL,
 app TEXT NOT NULL CHECK(app IN ('hello','guestbook','showcase','linkcheck','state')),
 event TEXT NOT NULL CHECK(event IN ('app_open','item_open','inspection_completed')),
 surface TEXT NOT NULL CHECK(surface IN ('standalone','composed')),
 n INTEGER NOT NULL CHECK(n BETWEEN 1 AND 1000),
 PRIMARY KEY(day,app,event,surface)
) WITHOUT ROWID;
