-- Public client-reported resource interactions, separate from server-published
-- mini-app counts. No identities, entered fields, URLs or individual receipts.
CREATE TABLE composer_resource_usage (
 day TEXT NOT NULL,
 resource TEXT NOT NULL CHECK(resource IN ('change','incident','pipeline','hook','kit')),
 action TEXT NOT NULL CHECK(action IN ('choice','copy','download','example_open')),
 n INTEGER NOT NULL CHECK(n BETWEEN 1 AND 1000),
 PRIMARY KEY(day,resource,action)
) WITHOUT ROWID;
