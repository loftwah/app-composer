import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {pluginTrustSnapshot,evaluatePlugin} from '../src/lib/plugin-trust-contract.ts';
import {diffObservation,reviewItems,reviewKey,retainSnapshots,watchStatus,watchPolicy} from '../src/lib/plugin-trust-watch.ts';
import {multihashDigest,readArchiveFile,inspectBundle} from '../scripts/plugin-trust-observe.mjs';

const cid='b'+'a'.repeat(30);
const label=(uri,val,neg=false)=>({ver:1,src:'did:web:labels.emdashcms.com',uri,val,cts:'2026-10-20T14:14:34.597Z',cid,neg});
const plugin=(overrides={})=>{
 const base={
  name:'Freeform',did:'did:plc:tsp7az5h6qsqjzqsgz37wonx',slug:'freeform',handle:'solspace.com',
  profileCid:cid,profileUri:'at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.profile/freeform',
  releaseCid:cid,releaseUri:'at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.release/freeform:1.0.0',
  version:'1.0.0',indexedAt:'2026-10-20T14:14:25.959Z',checksum:cid,requires:'>=1.0.0',historyComplete:true,
  license:'MIT',repository:'https://github.com/solspace/emdash-freeform',securityContact:true,requireProvenance:true,
  labels:[label('at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.release/freeform:1.0.0','listing-passed')],
  refreshFailed:false,
  inspection:{observedAt:'2026-10-20T14:14:25.959Z',did:'did:plc:tsp7az5h6qsqjzqsgz37wonx',slug:'freeform',version:'1.0.0',releaseCid:cid,sha256:'a'.repeat(64),capabilities:['content:read'],allowedHosts:[]},
 };
 return {...base,...overrides};
};
const snapshot=(observedAt,packages)=>pluginTrustSnapshot.parse({schemaVersion:1,policy:'2026-10-25.1',observedAt,host:{emdash:'1.4.0',cloudflare:'1.4.0',astro:'7.4.7'},packages});
const previous=()=>snapshot('2026-10-25T06:09:28.960Z',[plugin()]);

test('a repeated observation reports no change and raises no review items',()=>{
 const before=previous();
 const after=snapshot('2026-11-07T10:52:48.814Z',[plugin({inspection:{...plugin().inspection,observedAt:'2026-11-07T10:52:48.814Z'}})]);
 const diffs=diffObservation(before,after);
 assert.equal(diffs.length,1);
 assert.equal(diffs[0].state,'unchanged');
 assert.deepEqual(reviewItems(before,after),[]);
});

test('a release, permission and host change produce deduplicated review items',()=>{
 const before=previous();
 const after=snapshot('2026-11-07T10:52:48.814Z',[plugin({
  version:'1.3.0',releaseCid:'b'+'b'.repeat(30),checksum:'b'+'b'.repeat(30),requires:'>=1.4.0',
  inspection:{...plugin().inspection,version:'1.3.0',releaseCid:'b'+'b'.repeat(30),sha256:'b'.repeat(64),capabilities:['content:read','content:write','network:request'],allowedHosts:['api.example.test']},
  profileLabels:[label('at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.profile/freeform','listing-overridden')],
 })]);
 const diffs=diffObservation(before,after)[0];
 assert.equal(diffs.state,'changed');
 assert.deepEqual(diffs.changes.map((change)=>change.code).sort(),['ARTIFACT_CHANGED','CAPABILITIES_ADDED','COMPATIBILITY_CHANGED','HOSTS_ADDED','PROFILE_REVIEW','RELEASE_CHANGED']);
 const items=reviewItems(before,after);
 assert.equal(items.length,6);
 assert.equal(new Set(items.map((item)=>item.key)).size,6);
 assert.ok(items.every((item)=>item.key===reviewKey({...plugin({version:'1.3.0'})},item.code)));
 // The same observation cannot raise a second item for the same condition.
 assert.deepEqual(reviewItems(before,after).map((item)=>item.key),items.map((item)=>item.key));
});

test('withdrawal and removal are blocking or review-worthy, not silent',()=>{
 const before=previous();
 const withdrawn=snapshot('2026-11-07T10:52:48.814Z',[plugin({labels:[label(plugin().releaseUri,'listing-passed'),label(plugin().releaseUri,'release-takedown')]})]);
 const blocked=reviewItems(before,withdrawn);
 assert.equal(blocked.length,1);
 assert.equal(blocked[0].key.split(':').pop(),'1.0.0');
 assert.equal(blocked[0].code,'RELEASE_WITHDRAWN');
 assert.equal(blocked[0].severity,'block');
 const removed=reviewItems(before,snapshot('2026-11-07T10:52:48.814Z',[]));
 assert.equal(removed[0].code,'PACKAGE_REMOVED');
 assert.equal(diffObservation(before,snapshot('2026-11-07T10:52:48.814Z',[]))[0].state,'removed');
});

test('profile withdrawal labels are evaluated and stay separate from release labels',()=>{
 const base=plugin({profileLabels:[label('at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.profile/freeform','listing-overridden')]});
 const current=snapshot('2026-11-07T10:52:48.814Z',[base]);
 const evaluated=evaluatePlugin(current.packages[0],current,new Date('2026-11-07T11:00:00Z'));
 assert.ok(evaluated.reasons.some((reason)=>reason.code==='PROFILE_OVERRIDDEN'&&reason.state==='AMBER'));
 const withdrawn=snapshot('2026-11-07T10:52:48.814Z',[plugin({profileLabels:[label('at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.profile/freeform','listing-suspended')]})]);
 const blocked=evaluatePlugin(withdrawn.packages[0],withdrawn,new Date('2026-11-07T11:00:00Z'));
 assert.ok(blocked.reasons.some((reason)=>reason.code==='PROFILE_WITHDRAWN'&&reason.state==='RED'));
 // A negated label is inactive.
 const negated=snapshot('2026-11-07T10:52:48.814Z',[plugin({profileLabels:[label('at://did:plc:tsp7az5h6qsqjzqsgz37wonx/com.emdashcms.experimental.package.profile/freeform','listing-overridden',true)]})]);
 assert.ok(!evaluatePlugin(negated.packages[0],negated,new Date('2026-11-07T11:00:00Z')).reasons.some((reason)=>reason.code==='PROFILE_OVERRIDDEN'));
});

test('retention is newest-first, bounded and deduplicated by observation time',()=>{
 const values=['01','02','03','04'].map((day)=>snapshot('2026-11-'+day+'T10:00:00.000Z',[plugin()]));
 assert.deepEqual(retainSnapshots([...values,values[0]],2).map((value)=>value.observedAt),['2026-11-04T10:00:00.000Z','2026-11-03T10:00:00.000Z']);
 assert.throws(()=>retainSnapshots(values,0));
 assert.throws(()=>retainSnapshots(values,31));
 const status=watchStatus([...values],new Date('2026-11-09T10:00:00.000Z'));
 assert.equal(status.stale,false);
 assert.equal(status.retained,4);
 assert.equal(status.latestAt,'2026-11-04T10:00:00.000Z');
 assert.equal(status.previousAt,'2026-11-03T10:00:00.000Z');
 assert.equal(watchStatus([snapshot('2026-09-01T10:00:00.000Z',[plugin()])],new Date('2026-11-09T10:00:00.000Z')).stale,true);
 assert.equal(watchPolicy.automatic,false);
});

function tarEntry(name,body){
 const header=Buffer.alloc(512);
 header.write(name,0,'utf8');
 header.write('0000644\0',100,'utf8');
 header.write('0000000\0',108,'utf8');
 header.write('0000000\0',116,'utf8');
 header.write((body.length.toString(8).padStart(11,'0')+'\0'),124,'utf8');
 header.write('00000000000\0',136,'utf8');
 header.write('        ',148,'utf8');
 header.write('0',156,'utf8');
 header.write('ustar\0',257,'utf8');
 header.write('00',263,'utf8');
 const padded=Buffer.alloc(Math.ceil(body.length/512)*512);
 body.copy(padded);
 return Buffer.concat([header,padded]);
}
const bundle=(manifest,target='manifest.json')=>gzipSync(Buffer.concat([tarEntry(target,Buffer.from(JSON.stringify(manifest))),Buffer.alloc(1024)]));

test('bundle inspection verifies identity and extracts only supported declarations',()=>{
 const archive=bundle({id:'freeform',version:'1.0.0',capabilities:['content:read','network:request'],allowedHosts:['api.example.test']});
 const inspected=inspectBundle(archive,'freeform','1.0.0');
 assert.deepEqual(inspected.capabilities,['content:read','network:request']);
 assert.deepEqual(inspected.allowedHosts,['api.example.test']);
 assert.match(inspected.digest,/^[a-f0-9]{64}$/);
 assert.throws(()=>inspectBundle(archive,'other','1.0.0'),/identity differs/);
 assert.throws(()=>inspectBundle(archive,'freeform','2.0.0'),/identity differs/);
 assert.throws(()=>inspectBundle(gzipSync(Buffer.concat([tarEntry('manifest.json',Buffer.from('{}')),tarEntry('manifest.json',Buffer.from('{}'))])),'freeform','1.0.0'),/duplicate/);
 assert.throws(()=>inspectBundle(Buffer.from('not gzip'),'freeform','1.0.0'),/not a gzip/);
});

test('a SHA-256 multihash decodes and rejects other shapes',()=>{
 assert.equal(multihashDigest('bciqgkanyl5ewfrix6pu6fiqwu2ar5cevjh5g2bg3mtllpa5hzp74hwi'),'6501b85f4962c517f3e9e2a216a6811e889549fa6d04db64d6b783a7cbffc3d9');
 assert.equal(multihashDigest('not-a-multihash'),null);
 assert.equal(multihashDigest(null),null);
});
