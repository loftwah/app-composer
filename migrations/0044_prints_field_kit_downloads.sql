-- UTC totals of successful full responses for the public Prints field kit.
CREATE TABLE prints_field_kit_daily (
  day TEXT PRIMARY KEY,
  n INTEGER NOT NULL CHECK (n BETWEEN 1 AND 1000)
) WITHOUT ROWID;
