import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverResend} from '../src/lib/resend-delivery.mjs';
const runtime={RESEND_API_KEY:'fictional-key',RESEND_FROM_ADDRESS:'composer@example.com',RESEND_ALLOWED_RECIPIENTS:'owner@example.com'};
const message={to:'owner@example.com',subject:'Synthetic transport test',text:'Fictional test message.',cc:['owner@example.com'],replyTo:'reply@example.com'};
test('email transport preserves recipients and reply address without following redirects',async()=>{
 let actual;
 await deliverResend(message,runtime,async(url,options)=>{actual={url,options};return new Response('{}');});
 assert.equal(actual.url,'https://api.resend.com/emails');assert.equal(actual.options.redirect,'error');
 assert.equal(actual.options.headers.Authorization,'Bearer fictional-key');
 const body=JSON.parse(actual.options.body);assert.deepEqual(body.cc,message.cc);assert.equal(body.reply_to,message.replyTo);
 assert.match(actual.options.headers['Idempotency-Key'],/^composer-/);
});
test('unconfigured, uninvited and plus-alias recipients never reach provider',async()=>{
 let calls=0;const send=async()=>{calls++;return new Response('{}');};
 await assert.rejects(deliverResend(message,{},send),/not configured/);
 for(const override of [{to:'stranger@example.com'},{to:'owner+tag@example.com'},{cc:['stranger@example.com']}]) await assert.rejects(deliverResend({...message,...override},runtime,send),/not invited/);
 assert.equal(calls,0);
});
test('provider errors expose status only',async()=>{
 await assert.rejects(deliverResend(message,runtime,async()=>new Response('private provider payload',{status:429})),{message:'Composer email delivery failed (429).'});
});
