import { dailyLimit, events } from './index.mjs';

// #62 owns these public counters; private creator analytics remain with #116.
export const collectionStarted = '2026-10-13';
const utcDay = value => typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function portfolioWindow(params, now=new Date()) {
 if([...params.keys()].some(key=>!['days','from','to'].includes(key))||['days','from','to'].some(key=>params.getAll(key).length>1))throw new Error('invalid_parameters');
 const today=now.toISOString().slice(0,10);
 if(params.has('from')||params.has('to')){
  const from=params.get('from'),to=params.get('to');
  if(params.has('days')||!utcDay(from)||!utcDay(to)||from>to||to>today)throw new Error('invalid_parameters');
  const days=(Date.parse(to)-Date.parse(from))/86400000+1;
  if(days<1||days>90)throw new Error('invalid_parameters');
  return {from,to,days,complete:to<today};
 }
 const value=params.get('days')??'7';
 if(!['7','30','90'].includes(value))throw new Error('invalid_parameters');
 const days=Number(value),start=new Date(today+'T00:00:00Z');
 start.setUTCDate(start.getUTCDate()-days+1);
 return {from:start.toISOString().slice(0,10),to:today,days,complete:false};
}
/** @param {any} db @param {number|{from:string,to:string}} selection @param {Date} now @param {string|null} revision */
export async function portfolioSummary(db, selection=7, now=new Date(), revision=null) {
 const period=portfolioWindow(new URLSearchParams(typeof selection==='number'?{days:String(selection)}:{from:selection.from,to:selection.to}),now);
 const {from,to}=period,retained=new Date(now.toISOString().slice(0,10)+'T00:00:00Z');
 retained.setUTCDate(retained.getUTCDate()-34);
 const availableFrom=[collectionStarted,retained.toISOString().slice(0,10)].sort().at(-1);
 const unavailable=to<availableFrom;
 const result=unavailable?{success:true,results:[]}:await db.prepare('SELECT day,app,event,SUM(n) AS n FROM composer_usage WHERE day >= ?1 AND day <= ?2 GROUP BY day,app,event ORDER BY day,app,event').bind(from>availableFrom?from:availableFrom,to).all();
 if(!result.success)throw new Error('Counts unavailable');
 const definitions=[
  ['app_opens','App opens',r=>r.event==='app_open','Successful public mini-app home-page HTML requests across standalone and composed versions. Reloads and bots may count; not people, sessions or conversions.'],
  ['actions','Recorded app actions',r=>['item_open','inspection_completed'].includes(r.event),'Guestbook contribution-page opens plus accepted completed Link Check inspections. Different action types, not unique people or a conversion funnel.'],
  ['photo_opens','Guestbook contribution opens',r=>r.app==='guestbook'&&r.event==='item_open','Successful public Guestbook contribution-page HTML requests, including repeated opens; not image downloads, submissions, publications or unique people.'],
  ['inspection_completed','Completed inspections',r=>r.app==='linkcheck'&&r.event==='inspection_completed','Link Check inspections counted by the owning app after completion; not clicks, deployment checks or unique users.'],
 ];
 const rows=result.results.filter(r=>r.day>=availableFrom&&r.day<=to&&events[r.app]?.includes(r.event)&&Number.isSafeInteger(r.n)&&r.n>=0);
 const metrics=definitions.map(([key,label,accept,definition])=>{
  const byDay=new Map();
  for(const row of rows.filter(accept))byDay.set(row.day,(byDay.get(row.day)??0)+row.n);
  const daily=[];
  for(let day=new Date((from>availableFrom?from:availableFrom)+'T00:00:00Z');day<=new Date(to+'T00:00:00Z');day.setUTCDate(day.getUTCDate()+1)){
   const date=day.toISOString().slice(0,10);daily.push({date,value:byDay.get(date)??0});
  }
  return {key,label,unit:'count',value:unavailable?null:daily.reduce((n,d)=>n+d.value,0),definition,quality:unavailable?'unavailable':'bounded',daily};
 });
 // A new measure has no fabricated zeros before its first retained observation.
 // This is an observed lower bound, not a claim that every publisher was enabled.
 const observed=unavailable?null:await db.prepare("SELECT MIN(day) AS first_day FROM composer_usage WHERE app='guestbook' AND event='postcard_received' AND day>=?1 AND day<=?2").bind(availableFrom,now.toISOString().slice(0,10)).all();
 if(observed&&!observed.success)throw new Error('Receipt coverage unavailable');
 const rawFirst=observed?.results?.[0]?.first_day;
 const firstDay=utcDay(rawFirst)&&rawFirst>=availableFrom&&rawFirst<=now.toISOString().slice(0,10)?rawFirst:null;
 const receiptUnavailable=unavailable||!firstDay||to<firstDay;
 const receiptDaily=[];
 if(!receiptUnavailable){
  const byDay=new Map();for(const row of rows.filter(r=>r.app==='guestbook'&&r.event==='postcard_received'))byDay.set(row.day,(byDay.get(row.day)??0)+row.n);
  const start=[from,firstDay,availableFrom].sort().at(-1);
  for(let day=new Date(start+'T00:00:00Z');day<=new Date(to+'T00:00:00Z');day.setUTCDate(day.getUTCDate()+1)){const date=day.toISOString().slice(0,10);receiptDaily.push({date,value:byDay.get(date)??0});}
 }
 metrics.push({key:'guest_postcards_received',label:'Guest postcards received',unit:'count',value:receiptUnavailable?null:receiptDaily.reduce((n,d)=>n+d.value,0),quality:receiptUnavailable?'unavailable':from<=firstDay?'partial':'bounded',daily:receiptDaily,definition:'New pending guest postcards counted after committed acceptance by Guestbook, across connected standalone and composed routes. Not approvals, publications, unique people or a conversion rate. Before the first retained recorded receipt, history is unavailable. The first recorded UTC day is partial; later zero means no recorded receipt, not proof that nobody submitted. Optional recording can drop events.'});
 return {
  schema:'woodhouse.portfolio-analytics/1',project:'app-composer',generatedAt:now.toISOString(),timezone:'UTC',
  period,
  coverage:{startedAt:availableFrom+'T00:00:00.000Z',comparableFrom:null,through:now.toISOString(),quality:unavailable?'unavailable':from<availableFrom?'partial':'bounded',limitations:[
   `Daily counters stop at ${dailyLimit} per app/event/surface and shared per-location rate limits may drop events.`,
   'The first recorded UTC day is 13 October 2026 and is partial; daily counts expire after 35 days. Missing earlier history is unavailable, not zero.',
   'Optional publishers can lose events during outages. Marked verification probes are excluded; reloads, unmarked automation and bots can count.',
   'No visitor identity, sessions, return rate, private creator activity or vault contents are collected. Today is partial; these are bounded recorded signals, never lifetime totals.'
  ]},metrics,source:{endpoint:'https://composer.loftwah.com/api/portfolio-analytics',revision}
 };
}
