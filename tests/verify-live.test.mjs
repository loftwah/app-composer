import test from 'node:test';import assert from 'node:assert/strict';import {verifyLive} from '../scripts/verify-live.mjs';
test('verification waits for root and mounted pins before accepting propagation',async()=>{
 const original=globalThis.fetch;let roots=0,apps=0;
 globalThis.fetch=async(url)=>{if(url.includes('/build.json?')&&!url.includes('/guestbook/')){roots++;return Response.json({commit:roots===1?'old':'new'});}apps++;return Response.json({app:'guestbook',revision:apps===1?'old':'new-app',dataVersion:1});};
 try{await verifyLive('new',{apps:[{id:'guestbook',commit:'new-app',manifest:{dataVersion:1}}]});assert.equal(roots,3);assert.equal(apps,2);}finally{globalThis.fetch=original;}
});
