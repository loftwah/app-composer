import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {announce,messageBody,redact,validateAnnouncement} from '../scripts/delivery-channel.mjs';

const announcement={
 title:'Monorepo source locator',
 summary:'A composition can now pin a mini-app subdirectory at an exact commit.',
 commit:'3e86a5c',
 production:'bbe9e224',
 deployed:false,
 issues:[{number:408,state:'slice',note:'Authoring path only; promotion still gated'}],
 checks:['36 focused tests passed','lint passed'],
 evidence:'https://github.com/loftwah/app-composer/blob/main/docs/evidence/x/README.md',
 next:'Plugin Trust watch depth',
};

test('an announcement keeps the required shape and rejects unknown or unsafe states',()=>{
 const plan=validateAnnouncement(announcement);
 assert.equal(plan.deployed,false);
 assert.equal(plan.issues.length,1);
 for(const patch of [{title:''},{issues:[{number:1,state:'done'}]},{issues:[{number:'408',state:'closed'}]},{checks:'not a list'},{extra:true}]){
  assert.throws(()=>validateAnnouncement({...announcement,...patch}),/Announcement/,JSON.stringify(patch));
 }
});

test('webhook URLs are redacted and the post stays within the Discord bound',()=>{
 const hook='https://discord.com/api/webhooks/123456789/abcdefghijklmnop';
 assert.equal(redact('see '+hook+' now'),'see [webhook redacted] now');
 const {body}=messageBody({...announcement,summary:'A link '+hook+' must not leak',checks:Array.from({length:10},()=> 'x'.repeat(160))});
 assert.doesNotMatch(body,/discord\.com\/api\/webhooks/);
 assert.equal(body.length<=1900,true);
 assert.match(body,/Reached main/);
 assert.match(messageBody({...announcement,deployed:true}).body,/Shipped to production/);
});

test('a dry run formats without a webhook or network and reports configuration honestly',async()=>{
 const workspace=mkdtempSync(join(tmpdir(),'composer-announce-'));
 try{
  let calls=0;
  const result=await announce({value:announcement,workspace,send:false,fetchImpl:()=>{calls++;throw new Error('network');}});
  assert.equal(result.sent,false);
  assert.equal(result.webhookConfigured,false);
  assert.equal(calls,0);
  assert.match(result.body,/#408 — slice/);
  const configured=mkdtempSync(join(tmpdir(),'composer-announce-env-'));
  try{
   writeFileSync(join(configured,'.env'),'WOODHOUSE_DISCORD_CHANNEL=https://discord.com/api/webhooks/1/'+'a'.repeat(20)+'\n');
   const ready=await announce({value:announcement,workspace:configured,send:false});
   assert.equal(ready.webhookConfigured,true);
   await assert.rejects(()=>announce({value:announcement,workspace,send:true}),/not configured/);
  }finally{rmSync(configured,{recursive:true,force:true});}
 }finally{rmSync(workspace,{recursive:true,force:true});}
});

test('a real send never includes the webhook in the payload and retries one rate limit',async()=>{
 const hook='https://discord.com/api/webhooks/987654321/'+'b'.repeat(20);
 const workspace=mkdtempSync(join(tmpdir(),'composer-announce-send-'));
 writeFileSync(join(workspace,'.env'),'WOODHOUSE_DISCORD_CHANNEL='+hook+'\n');
 const payloads=[];
 const responses=[{ok:false,status:429,json:async()=>({retry_after:0.01})},{ok:true,status:204}];
 try{
 const result=await announce({value:{...announcement,summary:'No secret here'},workspace,send:true,fetchImpl:async(url,options)=>{
  assert.equal(url,hook);
  payloads.push(options.body);
  return responses.shift();
 }});
 assert.equal(result.sent,true);
 assert.equal(payloads.length,2);
 for(const payload of payloads)assert.doesNotMatch(payload,new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 await assert.rejects(()=>announce({value:announcement,workspace,send:true,fetchImpl:async()=>({ok:false,status:500})}),/status 500/);
 }finally{rmSync(workspace,{recursive:true,force:true});}
});
