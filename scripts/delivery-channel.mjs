// Posts one concise delivery update to the project's existing Discord channel.
// The webhook is a secret: it is read from WOODHOUSE_DISCORD_CHANNEL (process
// environment or the ignored .env) and is never printed, echoed in a payload or
// committed. The channel is a human-facing ledger of what reached main and
// production; issue receipts and docs/evidence remain authoritative.
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const limit=1900;
const webhookPattern=/https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/g;

function envValue(name,workspace=process.cwd()){
 if(process.env[name]?.trim())return process.env[name].trim();
 const file=resolve(workspace,'.env');
 if(!existsSync(file))return '';
 for(const line of readFileSync(file,'utf8').split('\n')){
  const match=new RegExp('^'+name+'=(.*)$').exec(line.trim());
  if(match)return match[1].trim().replace(/^["']|["']$/g,'');
 }
 return '';
}

export function redact(value){
 return String(value??'').replace(webhookPattern,'[webhook redacted]');
}

export function validateAnnouncement(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Announcement: expected an object');
 const allowed=['title','summary','commit','production','deployed','issues','checks','evidence','next','ownerActions'];
 for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error('Announcement: unexpected field "'+key+'"');
 const text=(key,max)=>{const raw=value[key];if(raw===undefined||raw===null)return '';if(typeof raw!=='string')throw new Error('Announcement: '+key+' must be a string');const clean=redact(raw).replace(/\s+/g,' ').trim();if(clean.length>max)throw new Error('Announcement: '+key+' is longer than '+max+' characters');return clean;};
 const title=text('title',120),summary=text('summary',600),commit=text('commit',40),production=text('production',60),evidence=text('evidence',300),next=text('next',300),ownerActions=text('ownerActions',300);
 if(!title)throw new Error('Announcement: title is required');
 const issues=Array.isArray(value.issues)?value.issues:value.issues===undefined?[]:null;
 if(!issues)throw new Error('Announcement: issues must be an array');
 const cleanIssues=issues.slice(0,12).map(issue=>{
  if(!Number.isInteger(issue?.number)||issue.number<1)throw new Error('Announcement: every issue needs a number');
  if(typeof issue.state!=='string'||!['closed','slice','status','still-open','blocked'].includes(issue.state))throw new Error('Announcement: issue state must be closed, slice, status, still-open or blocked');
  const note=redact(String(issue.note??'')).replace(/\s+/g,' ').trim().slice(0,180);
  return {number:issue.number,state:issue.state,note};
 });
 const checks=value.checks===undefined?[]:Array.isArray(value.checks)?value.checks.slice(0,10).map(check=>redact(String(check)).replace(/\s+/g,' ').trim().slice(0,160)):null;
 if(!checks)throw new Error('Announcement: checks must be an array');
 const deployed=value.deployed===true;
 return {title,summary,commit,production,deployed,issues:cleanIssues,checks,evidence,next,ownerActions};
}

export function messageBody(value){
 const a=validateAnnouncement(value);
 const state=a.deployed?1:0;
 const header=a.deployed?'**Shipped to production — '+a.title+'**':'**Reached main — '+a.title+'**';
 const lines=[header];
 if(a.summary)lines.push('',a.summary);
 if(a.commit)lines.push('','Source `'+a.commit+'`'+(a.production?' · production `'+a.production+'`':''));
 if(a.issues.length){
  lines.push('','**Issues**');
  for(const issue of a.issues)lines.push('• #'+issue.number+' — '+issue.state+(issue.note?' · '+issue.note:''));
 }
 if(a.checks.length){lines.push('','**Checks**');for(const check of a.checks)lines.push('• '+check);}
 if(a.evidence)lines.push('','**Evidence** · '+a.evidence);
 if(a.ownerActions)lines.push('','**Owner action needed** · '+a.ownerActions);
 if(a.next)lines.push('','**Next** · '+a.next);
 let body=lines.join('\n');
 if(body.length>limit)body=body.slice(0,limit-1)+'…';
 return {body,embed:{title:a.title.slice(0,256),description:body.slice(0,4096),color:a.deployed?0x2ecc71:0x3498db,timestamp:new Date().toISOString()}};
}

export async function announce({value,workspace=process.cwd(),send=false,fetchImpl=fetch}={}){
 const {body,embed}=messageBody(value);
 if(!send)return {sent:false,body,webhookConfigured:Boolean(envValue('WOODHOUSE_DISCORD_CHANNEL',workspace))};
 const hook=envValue('WOODHOUSE_DISCORD_CHANNEL',workspace);
 if(!hook)throw new Error('WOODHOUSE_DISCORD_CHANNEL is not configured; add it to the ignored .env or the process environment');
 if(!/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(hook))throw new Error('WOODHOUSE_DISCORD_CHANNEL is not a Discord webhook URL');
 const payload={embeds:[embed],allowed_mentions:{parse:[]}};
 for(let attempt=0;attempt<2;attempt++){
  const response=await fetchImpl(hook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
  if(response.ok)return {sent:true,status:response.status,body};
  if(response.status===429&&attempt===0){
   const retry=Math.min(Number((await response.json().catch(()=>({}))).retry_after??1)*1000,5000);
   await new Promise(resolve=>setTimeout(resolve,Number.isFinite(retry)&&retry>0?retry:1000));
   continue;
  }
  throw new Error('Discord delivery failed with status '+response.status);
 }
 throw new Error('Discord delivery did not complete');
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const args=process.argv.slice(2);
 const fileAt=args.indexOf('--file');
 if(fileAt<0)throw new Error('Usage: node scripts/delivery-channel.mjs --file <announcement.json> [--send]');
 const value=JSON.parse(readFileSync(args[fileAt+1],'utf8'));
 const result=await announce({value,send:args.includes('--send')});
 console.log(JSON.stringify(result.sent?{sent:true,status:result.status}:{sent:false,body:result.body,webhookConfigured:result.webhookConfigured},null,2));
}
