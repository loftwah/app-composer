import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import {assertReceiptCounterSchema} from '../lib/usage/schema.mjs';
test('receipt schema migration preserves every legacy aggregate and keeps event/app bounds',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec(readFileSync(new URL('../migrations/0002_usage.sql',import.meta.url),'utf8'));
 const rows=[['2026-10-15','guestbook','item_open','composed',4],['2026-10-15','hello','app_open','standalone',1000],['2026-10-15','linkcheck','inspection_completed','standalone',3]];const put=db.prepare('INSERT INTO composer_usage VALUES(?,?,?,?,?)');for(const row of rows)put.run(...row);
 const before=db.prepare('SELECT * FROM composer_usage ORDER BY day,app,event,surface').all();assert.throws(()=>assertReceiptCounterSchema(db.prepare("SELECT sql FROM sqlite_schema WHERE name='composer_usage'").get().sql),/migration before release/);db.exec(readFileSync(new URL('../migrations/0003_postcard_receipts.sql',import.meta.url),'utf8'));assert.deepEqual(db.prepare('SELECT * FROM composer_usage ORDER BY day,app,event,surface').all(),before);assert.equal(assertReceiptCounterSchema(db.prepare("SELECT sql FROM sqlite_schema WHERE name='composer_usage'").get().sql),true);assert.equal(assertReceiptCounterSchema(db.prepare("SELECT sql FROM sqlite_schema WHERE name='composer_usage'").get().sql.replaceAll(' ', '\n')),true);
 db.prepare('INSERT INTO composer_usage VALUES(?,?,?,?,?)').run('2026-10-15','guestbook','postcard_received','standalone',1);
 for(const row of [['2026-10-15','showcase','postcard_received','standalone',1],['2026-10-15','guestbook','postcard_received','private',1],['2026-10-15','state','vault_opened','standalone',1],['2026-10-15','guestbook','postcard_received','composed',1001]])assert.throws(()=>db.prepare('INSERT INTO composer_usage VALUES(?,?,?,?,?)').run(...row));
 assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_schema WHERE type='table' AND name LIKE 'composer_usage%'").get().n,1);
 }finally{db.close();}
});

test('a transaction failure after the counter swap rolls back schema and all old aggregates',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec(readFileSync(new URL('../migrations/0002_usage.sql',import.meta.url),'utf8'));db.prepare('INSERT INTO composer_usage VALUES(?,?,?,?,?)').run('2026-10-15','hello','app_open','standalone',7);const old=db.prepare("SELECT sql FROM sqlite_schema WHERE name='composer_usage'").get().sql;db.exec('BEGIN');assert.throws(()=>db.exec(readFileSync(new URL('../migrations/0003_postcard_receipts.sql',import.meta.url),'utf8')+'SELECT * FROM deliberately_missing_fixture_table;'));db.exec('ROLLBACK');assert.equal(db.prepare("SELECT sql FROM sqlite_schema WHERE name='composer_usage'").get().sql,old);assert.equal(db.prepare('SELECT n FROM composer_usage').get().n,7);
 }finally{db.close();}
});

test('transaction-local transfer assertion rejects altered copied values before dropping old data',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec(readFileSync(new URL('../migrations/0002_usage.sql',import.meta.url),'utf8'));
  db.prepare('INSERT INTO composer_usage VALUES(?,?,?,?,?)').run('2026-10-15','guestbook','item_open','composed',7);
  const before=db.prepare('SELECT * FROM composer_usage').all();
  const source=readFileSync(new URL('../migrations/0003_postcard_receipts.sql',import.meta.url),'utf8');
  const broken=source.replace('SELECT day,app,event,surface,n FROM composer_usage;', 'SELECT day,app,event,surface,n+1 FROM composer_usage;');assert.notEqual(broken,source);
  db.exec('BEGIN');assert.throws(()=>db.exec(broken),/CHECK constraint failed/);db.exec('ROLLBACK');
  assert.deepEqual(db.prepare('SELECT * FROM composer_usage').all(),before);
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_schema WHERE name LIKE 'composer_usage%' ORDER BY name").all().map(x=>x.name),['composer_usage']);
 }finally{db.close();}
});
