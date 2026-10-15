import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {portfolioWindow,portfolioSummary} from '../lib/usage/portfolio.mjs';
test('portfolio windows reject arbitrary queries and do not silently reinterpret unsupported history',()=>{
 for(const query of ['days=365','days=7x','days=7&days=30','days=7&user=private'])assert.throws(()=>portfolioWindow(new URLSearchParams(query)));
 for(const days of [7,30,90])assert.equal(portfolioWindow(new URLSearchParams('days='+days)).days,days);
});
test('real SQLite aggregates retain lower-bound definitions and omit unavailable history',async()=>{
 const fixture=`import sqlite3,json,sys\np=json.load(sys.stdin)\ndb=sqlite3.connect(':memory:')\ndb.executescript(p['schema'])\ndb.executemany('INSERT INTO composer_usage VALUES(?,?,?,?,?)',[('2026-10-14','hello','app_open','standalone',1000),('2026-10-14','hello','app_open','composed',3),('2026-10-15','guestbook','item_open','standalone',2),('2026-10-15','linkcheck','inspection_completed','standalone',4)])\ndb.row_factory=sqlite3.Row\nprint(json.dumps([dict(r) for r in db.execute(p['sql'],p['params'])]))`;
 const db={prepare(sql){return {bind(...params){return {async all(){return {success:true,results:JSON.parse(execFileSync('python3',['-c',fixture],{input:JSON.stringify({schema:readFileSync('migrations/0002_usage.sql','utf8'),sql,params}),encoding:'utf8'}))}}}}}}};
 const report=await portfolioSummary(db,90,new Date('2026-10-15T12:00:00Z'),'a'.repeat(40));
 assert.equal(report.coverage.quality,'partial');assert.equal(report.period.days,90);
 assert.equal(report.coverage.startedAt,'2026-10-13T00:00:00.000Z');
 assert.deepEqual(report.metrics.slice(0,4).map(m=>m.value),[1003,6,2,4]);
 assert(report.metrics.slice(0,4).every(m=>m.quality==='bounded'&&m.daily.length===3&&m.daily[0].date==='2026-10-13'));
 assert.equal(report.metrics[0].daily[2].value,0);assert.equal(report.source.revision,'a'.repeat(40));
 const retained=await portfolioSummary({prepare(){return {bind(){return {async all(){return {success:true,results:[]}}}}}}},90,new Date('2026-12-01T12:00:00Z'));
 assert.equal(retained.coverage.startedAt,'2026-10-28T00:00:00.000Z');assert.equal(retained.metrics[0].daily.length,35);
 await assert.rejects(portfolioSummary({prepare(){throw Error('private detail')}},7));
});

test('custom UTC windows validate real dates, inclusive bounds and exact query shape',()=>{
 const now=new Date('2026-10-15T00:00:00Z'),parse=query=>portfolioWindow(new URLSearchParams(query),now);
 assert.deepEqual(parse('from=2026-10-14&to=2026-10-14'),{from:'2026-10-14',to:'2026-10-14',days:1,complete:true});
 assert.deepEqual(parse('from=2026-10-15&to=2026-10-15'),{from:'2026-10-15',to:'2026-10-15',days:1,complete:false});
 assert.equal(parse('from=2026-07-18&to=2026-10-15').days,90);
 assert.equal(parse('from=2024-02-28&to=2024-03-01').days,3);
 for(const query of ['from=2026-10-14','to=2026-10-14','from=&to=','from=2026-02-29&to=2026-03-01','from=2026-02-30&to=2026-03-01','from=2026-1-01&to=2026-01-02','from=2026-10-14T00:00:00Z&to=2026-10-15','from=2026-10-16&to=2026-10-16','from=2026-10-15&to=2026-10-14','from=2026-07-17&to=2026-10-15','days=7&from=2026-10-14&to=2026-10-15','from=2026-10-14&from=2026-10-13&to=2026-10-15','from=2026-10-14&to=2026-10-15&to=2026-10-14','from=2026-10-14&to=2026-10-15&user=private'])assert.throws(()=>parse(query),query);
 assert.equal(parse('').days,7);
});
test('historical custom ranges query retained SQLite rows and stop at the requested day',async()=>{
 const fixture=`import sqlite3,json,sys\np=json.load(sys.stdin)\ndb=sqlite3.connect(':memory:')\ndb.executescript(p['schema'])\ndb.executemany('INSERT INTO composer_usage VALUES(?,?,?,?,?)',[('2026-10-13','hello','app_open','standalone',1000),('2026-10-13','hello','app_open','composed',3),('2026-10-14','guestbook','item_open','standalone',2),('2026-10-15','linkcheck','inspection_completed','standalone',4)])\ndb.row_factory=sqlite3.Row\nprint(json.dumps([dict(r) for r in db.execute(p['sql'],p['params'])]))`;
 const db={prepare(sql){return {bind(...params){return {async all(){return {success:true,results:JSON.parse(execFileSync('python3',['-c',fixture],{input:JSON.stringify({schema:readFileSync('migrations/0002_usage.sql','utf8'),sql,params}),encoding:'utf8'}))}}}}}}};
 const now=new Date('2026-10-15T12:00:00Z');
 const report=await portfolioSummary(db,{from:'2026-10-12',to:'2026-10-14'},now);
 assert.deepEqual(report.period,{from:'2026-10-12',to:'2026-10-14',days:3,complete:true});
 assert.equal(report.coverage.quality,'partial');assert.equal(report.coverage.comparableFrom,null);
 assert.deepEqual(report.metrics.slice(0,4).map(m=>m.value),[1003,2,2,0]);
 assert(report.metrics.slice(0,4).every(m=>m.daily.length===2&&m.daily[0].date==='2026-10-13'&&m.daily[1].date==='2026-10-14'));
 const empty=await portfolioSummary(db,{from:'2026-10-14',to:'2026-10-14'},now);
 assert.equal(empty.coverage.quality,'bounded');assert.equal(empty.metrics[0].value,0);assert.deepEqual(empty.metrics[0].daily,[{date:'2026-10-14',value:0}]);
 const noRead={prepare(){throw Error('Unavailable history must not query old rows');}};
 for(const [window,time] of [[{from:'2026-10-01',to:'2026-10-12'},now],[{from:'2026-10-13',to:'2026-10-27'},new Date('2026-12-01T12:00:00Z')]]){
  const unavailable=await portfolioSummary(noRead,window,time);
  assert.equal(unavailable.coverage.quality,'unavailable');assert.equal(unavailable.period.complete,true);
  assert(unavailable.metrics.every(m=>m.value===null&&m.quality==='unavailable'&&m.daily.length===0));
 }
 const boundary=await portfolioSummary(db,{from:'2026-10-27',to:'2026-10-28'},new Date('2026-12-01T12:00:00Z'));
 assert.equal(boundary.coverage.quality,'partial');assert.deepEqual(boundary.metrics[0].daily,[{date:'2026-10-28',value:0}]);
});

test('public analytics metadata satisfies the portable plain-text consumer boundary',async()=>{
 const db={prepare(){return{bind(){return{async all(){return{success:true,results:[]}}}}}}};
 const report=await portfolioSummary(db,7,new Date('2026-10-15T12:00:00Z'));
 const plain=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[<>\u0000-\u001f]/.test(value);
 for(const metric of report.metrics){assert(plain(metric.label,100),metric.key+' label');assert(plain(metric.definition,1600),metric.key+' definition');}
 for(const limitation of report.coverage.limitations)assert(plain(limitation,600));
});

test('receipt coverage starts at the first retained committed signal, never invented historical zeros',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const sqlite=new DatabaseSync(':memory:');try{
  sqlite.exec(readFileSync('migrations/0002_usage.sql','utf8'));sqlite.exec(readFileSync('migrations/0003_postcard_receipts.sql','utf8'));
  const db={prepare(sql){return{bind(...params){return{async all(){return{success:true,results:sqlite.prepare(sql).all(...params)}}}}}}};const now=new Date('2026-10-18T12:00:00Z');
  const metric=async window=>(await portfolioSummary(db,window,now)).metrics.find(m=>m.key==='guest_postcards_received');
  assert.deepEqual(await metric({from:'2026-10-13',to:'2026-10-18'}).then(m=>[m.value,m.quality,m.daily]),[null,'unavailable',[]]);
  sqlite.prepare('INSERT INTO composer_usage VALUES(?,?,?,?,?)').run('2026-10-16','guestbook','postcard_received','standalone',2);sqlite.prepare('INSERT INTO composer_usage VALUES(?,?,?,?,?)').run('2026-10-16','guestbook','postcard_received','composed',1);
  assert.deepEqual(await metric({from:'2026-10-13',to:'2026-10-15'}).then(m=>[m.value,m.quality,m.daily]),[null,'unavailable',[]]);
  const first=await metric({from:'2026-10-13',to:'2026-10-18'});assert.equal(first.value,3);assert.equal(first.quality,'partial');assert.deepEqual(first.daily,[{date:'2026-10-16',value:3},{date:'2026-10-17',value:0},{date:'2026-10-18',value:0}]);
  const later=await metric({from:'2026-10-17',to:'2026-10-18'});assert.equal(later.value,0);assert.equal(later.quality,'bounded');
  const report=await portfolioSummary(db,7,now);assert.equal(report.metrics.find(m=>m.key==='actions').value,0);assert.equal(report.metrics.find(m=>m.key==='guest_postcards_received').value,3);
 }finally{sqlite.close();}
});
