// Browser-safe domain diagnostics. This is evidence to inspect, never setup authority.
export const domainReportLimit=32768;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>{throw Error('Use a current Get Ready domain report. Credentials, private receipts and unknown fields are refused.');};
export function domainName(value){
 if(typeof value!=='string'||value.length>253||value!==value.trim()||!value.includes('.')||!value.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))||/^\d+(?:\.\d+){3}$/.test(value)||/\.(?:localhost|local|internal)$/i.test(value))fail();
 return value.toLowerCase();
}
export function dsRecord(value){
 if(typeof value!=='string'||value.length>1024)fail();
 const parts=value.trim().split(/\s+/),match=/^(\d{1,5}) (\d{1,3}) (\d{1,3}) ([a-f0-9]{40,128})$/i.exec(parts.join(' '));
 if(!match||Number(match[1])>65535||Number(match[2])>255||Number(match[3])>255||match[4].length%2)fail();
 return `${Number(match[1])} ${Number(match[2])} ${Number(match[3])} ${match[4].toUpperCase()}`;
}
const issues=[null,'authentication','permission','unavailable','response'];
const strings=(values,max,validate)=>{if(!Array.isArray(values)||values.length>max)fail();const clean=values.map(validate);if(new Set(clean).size!==clean.length||clean.some((s,i)=>s!==values[i]))fail();return clean;};
export function validateDomainReport(input,now=Date.now()){
 if(!exact(input,['schema','version','checkedAt','domain','zone','nameservers','dnssec'])||input.schema!=='app-composer.domain-report'||input.version!==1||typeof input.checkedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.checkedAt)||!Number.isFinite(Date.parse(input.checkedAt))||Date.parse(input.checkedAt)>now+300000||domainName(input.domain)!==input.domain)fail();
 const z=input.zone,n=input.nameservers,d=input.dnssec;
 if(!exact(z,['state','issue'])||!['active','pending','inactive','missing','unsupported','paused','unavailable'].includes(z.state)||!issues.includes(z.issue)||(z.state==='unavailable')!==(z.issue!==null))fail();
 if(!exact(n,['lookup','issue','assigned','observed'])||!['answered','unavailable'].includes(n.lookup)||!issues.includes(n.issue)||(n.lookup==='unavailable')!==(n.issue!==null))fail();
 if(!exact(d,['state','issue','expected','lookup','lookupIssue','published'])||!['active','pending','disabled','pending-disabled','error','unavailable'].includes(d.state)||!issues.includes(d.issue)||(d.state==='unavailable')!==(d.issue!==null)||!['answered','unavailable'].includes(d.lookup)||!issues.includes(d.lookupIssue)||(d.lookup==='unavailable')!==(d.lookupIssue!==null))fail();
 const assigned=strings(n.assigned,8,domainName),observed=strings(n.observed,16,domainName),published=strings(d.published,16,dsRecord);
 if(n.lookup==='unavailable'&&observed.length||d.lookup==='unavailable'&&published.length||z.state==='unavailable'&&assigned.length||d.state==='unavailable'&&d.expected!==null)fail();
 const expected=d.expected===null?null:dsRecord(d.expected);if(expected!==d.expected)fail();
 if(new TextEncoder().encode(JSON.stringify(input)).length>domainReportLimit)fail();
 return {schema:input.schema,version:1,checkedAt:input.checkedAt,domain:input.domain,zone:{...z},nameservers:{...n,assigned,observed},dnssec:{...d,expected,published}};
}
export function inspectDomainReport(input,now=Date.now()){
 const report=validateDomainReport(input,now),stale=now-Date.parse(report.checkedAt)>3600000,next=[];
 const add=(id,text,help='/ready/guide#domain-check')=>next.push({id,text,help});
 if(stale){add('recheck','Ask your agent to recheck the domain. This dated observation is no longer current.');return {report,stale:true,dnsReady:false,nameserversMatch:false,dsMatch:false,next};}
 const {zone,nameservers:n,dnssec:d}=report;
 if(zone.state==='unavailable')add('zone-access',zone.issue==='authentication'?'Your agent needs to check its Cloudflare sign-in for the intended account. Complete only the official login it identifies.':zone.issue==='permission'?'Your agent should check the selected account and explain any missing zone-read access. You approve expanded permissions.':'The agent should retry or repair the Cloudflare zone check. No new login is established.');
 else if(zone.state==='missing')add('zone-missing','The exact domain was not found in the selected account. Have the agent check the account and domain before proposing a new zone; no zone was created.');
 else if(zone.state==='unsupported')add('zone-unsupported','This diagnosis supports full Cloudflare DNS setup. Have the agent inspect this other setup without replacing it.');
 else if(zone.state==='paused')add('zone-paused','The zone is paused. Have the agent review the existing configuration and intended change; it was not unpaused.');
 else if(zone.state==='inactive')add('zone-inactive','Cloudflare reports this zone as inactive or moved away. Have the agent check the intended provider and existing records before proposing any reactivation or nameserver change.');
 else if(zone.state==='pending')add('zone-pending','Cloudflare has not activated this zone. The agent should review the observed nameservers, DNSSEC and current website/email records before asking for any registrar change.');
 const nameserversMatch=n.lookup==='answered'&&n.assigned.length>0&&n.assigned.length===n.observed.length&&n.assigned.every(s=>n.observed.includes(s));
 if(n.lookup==='unavailable')add('dns-unavailable','The public nameserver lookup could not be completed. The agent should recheck later; this is not proof that a nameserver change is needed.');
 else if(n.assigned.length&&!nameserversMatch)add('nameservers','Observed nameservers differ from the assigned Cloudflare pair. Have the agent review existing DNS/email and DNSSEC first. Change nameservers only after your informed approval; a cached answer alone does not prove the registrar needs another change.','/ready/guide#nameserver-help');
 if(d.state==='unavailable')add('dnssec-access','The agent could not inspect Cloudflare DNSSEC settings. It should check access or retry before proposing a DNSSEC change.');
 if(d.lookup==='unavailable')add('ds-unavailable','The public DS lookup could not be completed. The agent should retry before interpreting DNSSEC or asking for a registrar change.');
 const dsMatch=d.lookup==='answered'&&d.expected!==null&&d.published.includes(d.expected);
 if(d.state==='disabled'&&d.lookup==='answered'&&d.published.length)add('old-ds','DS records are published while Cloudflare signing is disabled. Have the agent review the migration order and current DNS provider before nameserver changes. Do not remove working security records merely to pass this check.','/ready/guide#dnssec-help');
 else if(['active','pending'].includes(d.state)&&d.lookup==='answered'&&!dsMatch)add('ds-mismatch','The observed DS records do not match Cloudflare’s expected record. The agent should recheck both providers and explain the necessary registrar action; it must not overwrite security records automatically.','/ready/guide#dnssec-help');
 if(['pending','pending-disabled','error'].includes(d.state))add('dnssec-pending','Cloudflare DNSSEC is not in a settled state. Have the agent inspect it and recheck; no DNSSEC setting was changed.','/ready/guide#dnssec-help');
 const dnsReady=zone.state==='active'&&nameserversMatch&&d.lookup==='answered'&&(d.state==='disabled'&&d.published.length===0||d.state==='active'&&dsMatch);
 const priority={'old-ds':0,'ds-mismatch':1,'dnssec-pending':2};next.sort((a,b)=>(priority[a.id]??3)-(priority[b.id]??3));
 return {report,stale:false,dnsReady,nameserversMatch,dsMatch,next};
}
