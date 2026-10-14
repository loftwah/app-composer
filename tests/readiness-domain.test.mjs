import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {diagnoseDomain} from '../lib/get-ready/domain.mjs';import {inspectDomainReport,validateDomainReport} from '../lib/get-ready/domain-report.mjs';import {readinessJSON} from '../lib/get-ready/check.mjs';
const account='a'.repeat(32),zone='b'.repeat(32),domain='example.test',digest='A'.repeat(64),ds='1234 13 2 '+digest;
function fixture({status='active',paused=false,type='full',ns=['one.ns.cloudflare.com','two.ns.cloudflare.com'],observed=ns,dnssec='disabled',published=[],dnsStatus=0,apiStatus=200,multi=false}={}){
 const calls=[];return {calls,request:async(url,options)=>{calls.push({url,options});assert.equal(options.redirect,'error');assert.equal(options.method,undefined);const u=new URL(url);
  if(u.hostname==='api.cloudflare.com'){assert.equal(options.headers.Authorization,'Bearer fictional-token');if(apiStatus!==200)return new Response('private provider body',{status:apiStatus});return Response.json({success:true,...(u.pathname==='/client/v4/zones'?{result:[{id:zone,name:domain,account:{id:account},status,paused,type,name_servers:ns}],result_info:{total_count:1}}:{result:{status:dnssec,ds:dnssec==='disabled'?null:domain+'. 3600 IN DS '+ds,dnssec_multi_signer:multi}})});}
  assert.equal(u.origin,'https://cloudflare-dns.com');assert.equal(options.headers.Authorization,undefined);const n=u.searchParams.get('type')==='NS'?2:43;return Response.json({Status:dnsStatus,TC:false,Question:[{name:domain+'.',type:n}],Answer:(n===2?observed:published).map(data=>({name:domain+'.',type:n,data})),Authority:[{name:'test.',type:6,data:'ns.test. hostmaster.test. 1 3600 600 86400 3600'}]});
 }};
}
const env={CLOUDFLARE_API_TOKEN:'fictional-token'};
test('domain diagnosis uses exact account, read-only fixed providers and no forwarded credential; HTTPS is not inferred',async()=>{
 const f=fixture(),r=await diagnoseDomain({account,domain},env,f),v=inspectDomainReport(r);assert.equal(v.dnsReady,true);assert.equal(f.calls.length,4);assert.equal(v.nameserversMatch,true);assert.deepEqual(v.next,[]);assert(!JSON.stringify(r).includes(account));assert(!JSON.stringify(r).includes('fictional-token'));assert.equal(r.https,undefined);
 const signed=await diagnoseDomain({account,domain},env,fixture({dnssec:'active',published:[ds]}));assert.equal(inspectDomainReport(signed).dnsReady,true);
});
test('pending delegation, old DS, missing matching DS and transitional signing remain actionable without destructive instructions',async()=>{
 for(const [input,id] of [[{status:'pending',observed:['old.example.test']},'zone-pending'],[{published:[ds]},'old-ds'],[{dnssec:'active'},'ds-mismatch'],[{dnssec:'pending',published:[ds]},'dnssec-pending'],[{status:'moved'},'zone-inactive'],[{status:'deactivated'},'zone-inactive'],[{paused:true},'zone-paused'],[{type:'partial'},'zone-unsupported']]){const v=inspectDomainReport(await diagnoseDomain({account,domain},env,fixture(input)));assert.equal(v.dnsReady,false);assert(v.next.some(n=>n.id===id));}
 const v=inspectDomainReport(await diagnoseDomain({account,domain},env,fixture({published:[ds]})));assert(v.next.find(n=>n.id==='old-ds').text.includes('Do not remove working security records'));
});
test('denied account access and resolver SERVFAIL never become false success or an invented sign-in',async()=>{
 const f=fixture({apiStatus:403}),r=await diagnoseDomain({account,domain},env,f);assert.equal(r.zone.issue,'permission');assert.equal(r.nameservers.lookup,'answered');assert.equal(inspectDomainReport(r).dnsReady,false);assert.equal(f.calls.length,3);
 const unavailable=await diagnoseDomain({account,domain},env,fixture({dnsStatus:2}));assert.equal(unavailable.nameservers.issue,'unavailable');assert.equal(unavailable.dnssec.lookupIssue,'unavailable');assert.equal(inspectDomainReport(unavailable).dnsReady,false);
 const multi=await diagnoseDomain({account,domain},env,fixture({multi:true}));assert.equal(multi.dnssec.state,'unavailable');assert.equal(inspectDomainReport(multi).dnsReady,false);
});
test('wrong account/domain, malformed or oversized provider data and credential-shaped reports are refused',async()=>{
 let calls=0;const request=async()=>{calls++;throw Error();};for(const input of [{account,domain:'https://example.test'},{account,domain:'127.0.0.1'},{account,domain:'example.test',token:'secret'},{account:'wrong',domain}])await assert.rejects(diagnoseDomain(input,env,{request}));await assert.rejects(diagnoseDomain({account,domain},{...env,CLOUDFLARE_ACCOUNT_ID:'c'.repeat(32)},{request}));assert.equal(calls,0);
 const f=fixture();const wrong=await diagnoseDomain({account:'c'.repeat(32),domain},env,f);assert.equal(wrong.zone.issue,'response');assert.equal(inspectDomainReport(wrong).dnsReady,false);
 const huge=await diagnoseDomain({account,domain},env,{request:async()=>new Response(' '.repeat(70000))});assert.equal(huge.zone.issue,'response');assert.equal(huge.nameservers.issue,'response');
 const r=await diagnoseDomain({account,domain},env,fixture());assert.throws(()=>validateDomainReport({...r,token:'private'}));assert.throws(()=>validateDomainReport({...r,nameservers:{...r.nameservers,observed:['<script>']}}));assert.equal(inspectDomainReport(r,Date.parse(r.checkedAt)+3600001).stale,true);assert.equal(inspectDomainReport(r,Date.parse(r.checkedAt)+3600001).dnsReady,false);
});
test('diagnostic CLI rejects combined mutations before opening a workspace; zone API denials are scoped',async()=>{
 try{execFileSync(process.execPath,['lib/get-ready/cli.mjs','--inspect-domain',domain,'--account',account,'--deploy-owned-reference'],{env:{PATH:''},encoding:'utf8',stdio:'pipe'});assert.fail();}catch(e){assert.equal(e.status,1);assert.match(e.stderr,/No DNS, account or workspace was changed/);assert(!e.stderr.includes('ENOENT'));}
 for(const [url,code] of [['https://api.cloudflare.com/client/v4/zones?name=example.test','permission'],['https://api.cloudflare.com/client/v4/zones/'+zone+'/dnssec','permission'],['https://example.test/client/v4/zones','response'],['https://api.cloudflare.com/client/v4/zones/untrusted','response']])await assert.rejects(readinessJSON(url,{},async()=>new Response('',{status:403})),e=>e.code===code);
});

test('DS NXDOMAIN or records for another owner cannot masquerade as checked absence',async()=>{
 for(const changed of ['nxdomain','foreign','missing-soa']){const f=fixture(),request=async(url,options)=>{const r=await f.request(url,options);if(new URL(url).searchParams.get('type')!=='DS')return r;const j=await r.json();if(changed==='nxdomain')j.Status=3;else if(changed==='missing-soa')delete j.Authority;else j.Answer=[{name:'another.test.',type:43,data:ds}];return Response.json(j);};const r=await diagnoseDomain({account,domain},env,{request});assert.equal(r.dnssec.lookup,'unavailable');assert.equal(inspectDomainReport(r).dnsReady,false);}
});
