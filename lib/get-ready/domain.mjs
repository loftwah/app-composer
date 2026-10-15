import {ReadinessFailure,readinessJSON} from './check.mjs';
import {isAbsolute,resolve} from 'node:path';
import {cloudflareToken} from './local-checks.mjs';
import {domainName,dsRecord,validateDomainReport} from './domain-report.mjs';

// Fixed providers, bounded bodies, no redirects, writes, retries or credential forwarding.
async function json(url,headers,request){
 return readinessJSON(url,{headers},async(endpoint,options)=>{
  const response=await request(endpoint,options);
  return {status:response.status,ok:response.ok,json:async()=>{
   const reader=response.body?.getReader();if(!reader)throw Error();let length=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536)throw Error();chunks.push(value);}}finally{await reader.cancel();}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }};
 });
}
const issue=error=>error instanceof ReadinessFailure&&['authentication','permission','unavailable','response'].includes(error.code)?error.code:'response';
function names(values,max){if(!Array.isArray(values)||values.length>max)throw Error();const clean=values.map(v=>domainName(typeof v==='string'?v.replace(/\.$/,''):v));if(new Set(clean).size!==clean.length)throw Error();return clean.sort();}
async function dns(domain,type,request){
 try{
  const value=await json('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(domain)+'&type='+type,{Accept:'application/dns-json'},request),number=type==='NS'?2:43;
  if(value.Status===2)throw new ReadinessFailure('unavailable');
  if(value.Status!==0||value.TC!==false||!Array.isArray(value.Question)||value.Question.length!==1||domainName(value.Question[0]?.name?.replace(/\.$/,''))!==domain||value.Question[0]?.type!==number||value.Answer!==undefined&&!Array.isArray(value.Answer)||value.Answer?.length>32)throw Error();
  const answers=(value.Answer??[]).map(a=>{if(a.type!==number||a.name?.replace(/\.$/,'').toLowerCase()!==domain)throw Error();return a.data;});
  if(!answers.length){if(!Array.isArray(value.Authority)||value.Authority.length>16||!value.Authority.some(a=>{const owner=typeof a.name==='string'?a.name.replace(/\.$/,'').toLowerCase():'';return a.type===6&&owner&&/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(owner)&&(owner===domain||domain.endsWith('.'+owner))&&typeof a.data==='string'&&a.data.length<=2048;}))throw Error();}
  return {lookup:'answered',issue:null,values:type==='NS'?names(answers,16):[...new Set(answers.map(dsRecord))].sort()};
 }catch(error){return {lookup:'unavailable',issue:issue(error),values:[]};}
}
export async function diagnoseDomain(input,env=process.env,{request=fetch,now=Date.now}={}){
 if(!input||Object.keys(input).some(key=>!['account','domain','workspace'].includes(key))||!Object.hasOwn(input,'account')||!Object.hasOwn(input,'domain')||typeof input.account!=='string'||!/^[a-f0-9]{32}$/.test(input.account))throw new ReadinessFailure('configuration');
 if(Object.hasOwn(input,'workspace')&&(typeof input.workspace!=='string'||!isAbsolute(input.workspace)||input.workspace.includes('\0')||resolve(input.workspace)!==input.workspace))throw new ReadinessFailure('configuration');
 const domain=domainName(input.domain),account=input.account;
 if(env.CLOUDFLARE_ACCOUNT_ID&&env.CLOUDFLARE_ACCOUNT_ID!==account)throw new ReadinessFailure('configuration');
 if(env.CLOUDFLARE_API_TOKEN===undefined&&!input.workspace)throw new ReadinessFailure('authentication');
 const token=cloudflareToken({workspace:input.workspace,account},env);
 const headers={Authorization:'Bearer '+token};
 const api=async path=>{const v=await json('https://api.cloudflare.com/client/v4'+path,headers,request);if(v?.success!==true)throw new ReadinessFailure('response');return v;};
 let zone={state:'unavailable',issue:'response'},assigned=[],zoneId=null,dnssec={state:'unavailable',issue:'response',expected:null};
 const zoneCheck=async()=>{try{
  const v=await api('/zones?name='+encodeURIComponent(domain)+'&account.id='+account+'&per_page=2');
  if(!Array.isArray(v.result)||v.result.length>1||v.result_info?.total_count!==v.result.length)throw Error();
  if(!v.result.length){zone={state:'missing',issue:null};return;}
  const z=v.result[0];if(z.name!==domain||z.account?.id!==account||!/^[a-f0-9]{32}$/.test(z.id)||typeof z.paused!=='boolean'||!['active','pending','initializing','moved','deleted','deactivated'].includes(z.status))throw Error();
  if(z.type!=='full'){zone={state:'unsupported',issue:null};return;}
  assigned=names(z.name_servers,8);if(!assigned.length)throw Error();zoneId=z.id;
  zone={state:z.paused?'paused':z.status==='active'?'active':['moved','deleted','deactivated'].includes(z.status)?'inactive':'pending',issue:null};
 }catch(error){zone={state:'unavailable',issue:issue(error)};assigned=[];zoneId=null;}};
 const [,ns,ds]=await Promise.all([zoneCheck(),dns(domain,'NS',request),dns(domain,'DS',request)]);
 if(zoneId){try{
  const v=(await api('/zones/'+zoneId+'/dnssec')).result;if(!v||!['active','pending','disabled','pending-disabled','error'].includes(v.status)||v.dnssec_multi_signer===true||v.dnssec_presigned===true)throw Error();
  let expected=null;if(v.ds!=null){if(typeof v.ds!=='string')throw Error();const match=new RegExp('^'+domain.replaceAll('.','\\.')+'\\.?(?:\\s+\\d+)?\\s+IN\\s+DS\\s+(.+)$','i').exec(v.ds);if(!match)throw Error();expected=dsRecord(match[1]);}
  if(['active','pending'].includes(v.status)&&!expected)throw Error();
  dnssec={state:v.status,issue:null,expected};
 }catch(error){dnssec={state:'unavailable',issue:issue(error),expected:null};}}
 return validateDomainReport({schema:'app-composer.domain-report',version:1,checkedAt:new Date(now()).toISOString(),domain,zone,nameservers:{lookup:ns.lookup,issue:ns.issue,assigned,observed:ns.values},dnssec:{...dnssec,lookup:ds.lookup,lookupIssue:ds.issue,published:ds.values}},now());
}
