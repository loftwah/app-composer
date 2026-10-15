import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {portfolioDays,portfolioSummary} from '../lib/usage/portfolio.mjs';
test('portfolio windows reject arbitrary queries and do not silently reinterpret unsupported history',()=>{
 for(const query of ['days=365','days=7x','days=7&days=30','days=7&user=private'])assert.throws(()=>portfolioDays(new URLSearchParams(query)));
 for(const days of [7,30,90])assert.equal(portfolioDays(new URLSearchParams('days='+days)),days);
});
test('real SQLite aggregates retain lower-bound definitions and omit unavailable history',async()=>{
 const fixture=`import sqlite3,json,sys\np=json.load(sys.stdin)\ndb=sqlite3.connect(':memory:')\ndb.executescript(p['schema'])\ndb.executemany('INSERT INTO composer_usage VALUES(?,?,?,?,?)',[('2026-10-14','hello','app_open','standalone',1000),('2026-10-14','hello','app_open','composed',3),('2026-10-15','guestbook','item_open','standalone',2),('2026-10-15','linkcheck','inspection_completed','standalone',4)])\ndb.row_factory=sqlite3.Row\nprint(json.dumps([dict(r) for r in db.execute(p['sql'],p['params'])]))`;
 const db={prepare(sql){return {bind(...params){return {async all(){return {success:true,results:JSON.parse(execFileSync('python3',['-c',fixture],{input:JSON.stringify({schema:readFileSync('migrations/0002_usage.sql','utf8'),sql,params}),encoding:'utf8'}))}}}}}}};
 const report=await portfolioSummary(db,90,new Date('2026-10-15T12:00:00Z'),'a'.repeat(40));
 assert.equal(report.coverage.quality,'partial');assert.equal(report.period.days,90);
 assert.equal(report.coverage.startedAt,'2026-10-14T00:00:00.000Z');
 assert.deepEqual(report.metrics.map(m=>m.value),[1003,6,2,4]);
 assert(report.metrics.every(m=>m.quality==='bounded'&&m.daily.length===2&&m.daily[0].date==='2026-10-14'));
 assert.equal(report.metrics[0].daily[1].value,0);assert.equal(report.source.revision,'a'.repeat(40));
 const retained=await portfolioSummary({prepare(){return {bind(){return {async all(){return {success:true,results:[]}}}}}}},90,new Date('2026-12-01T12:00:00Z'));
 assert.equal(retained.coverage.startedAt,'2026-10-28T00:00:00.000Z');assert.equal(retained.metrics[0].daily.length,35);
 await assert.rejects(portfolioSummary({prepare(){throw Error('private detail')}},7));
});
