// Bounded, read-only observation of the curated EmDash registry packages.
// It downloads each release artifact, verifies its SHA-256 multihash, reads the
// bundle manifest without executing it, and writes one dated snapshot. Any
// failure refuses the whole write so a partial snapshot never looks healthy.
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const aggregator='https://registry.emdashcms.com/xrpc/com.emdashcms.experimental.aggregator.';
const releaseCollection='com.emdashcms.experimental.package.release';
const maximumArtifactBytes=5*1024*1024;
const timeoutMs=20000;
const curated=[
 {name:'Freeform',did:'did:plc:tsp7az5h6qsqjzqsgz37wonx',slug:'freeform',handle:'solspace.com'},
 {name:'Stripe Checkout',did:'did:plc:wlshattmcjplayfxlgzbhxvk',slug:'emdash-stripe-checkout',handle:'ecommerceave.com'},
];
const cidPattern=/^b[a-z2-7]{20,120}$/;
const base32='abcdefghijklmnopqrstuvwxyz234567';

function fail(message){throw new Error('Plugin Trust observation: '+message);}

export function multihashDigest(checksum){
 if(typeof checksum!=='string'||!/^b[a-z2-7]+$/.test(checksum))return null;
 let bits='';
 for(const char of checksum.slice(1))bits+=base32.indexOf(char).toString(2).padStart(5,'0');
 const bytes=[];
 for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 if(bytes.length!==34||bytes[0]!==0x12||bytes[1]!==0x20)return null;
 return bytes.slice(2).map(value=>value.toString(16).padStart(2,'0')).join('');
}

async function xrpc(method,params){
 const url=new URL(aggregator+method);
 for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
 const response=await fetch(url,{redirect:'error',headers:{'User-Agent':'Mozilla/5.0 (AppComposer plugin trust observation)'},signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)fail(method+' returned '+response.status);
 const text=await response.text();
 if(text.length>2*1024*1024)fail(method+' response exceeded the bounded size');
 try{return JSON.parse(text);}catch{fail(method+' returned invalid JSON');}
}

// Minimal ustar reader: regular file headers only, bounded by the approved size.
export function readArchiveFile(bytes,target){
 const buffer=Buffer.from(bytes);
 let offset=0,found=null;
 while(offset+512<=buffer.length){
  const header=buffer.subarray(offset,offset+512);
  if(header.every(value=>value===0))break;
  const name=header.subarray(0,100).toString('utf8').replace(/\0.*$/,'');
  const sizeField=header.subarray(124,136).toString('utf8').replace(/\0.*$/,'').trim();
  const size=parseInt(sizeField,8);
  const type=String.fromCharCode(header[156]||48);
  if(!Number.isFinite(size)||size<0)fail('archive has an invalid member size');
  const start=offset+512;
  if(start+size>buffer.length)fail('archive member exceeds the bounded bytes');
  if(name===target&&type==='0'){
   if(found!==null)fail('archive contains duplicate '+target);
   found=Buffer.from(buffer.subarray(start,start+size));
  }
  offset=start+Math.ceil(size/512)*512;
 }
 if(found===null)fail('archive does not contain '+target);
 return found;
}

export function inspectBundle(bytes,slug,version){
 const digest=createHash('sha256').update(bytes).digest('hex');
 let unpacked;
 try{unpacked=gunzipSync(bytes);}catch{fail('bundle is not a gzip archive');}
 let manifest;
 try{manifest=JSON.parse(readArchiveFile(unpacked,'manifest.json').toString('utf8'));}catch(error){fail(error instanceof Error?error.message:'bundle manifest is unavailable');}
 if(manifest?.id!==slug||manifest?.version!==version)fail('bundle manifest identity differs from the release');
 const capabilities=Array.isArray(manifest.capabilities)?manifest.capabilities.filter(value=>typeof value==='string'&&/^[a-z][a-z0-9:-]{0,100}$/.test(value)):[];
 const allowedHosts=Array.isArray(manifest.allowedHosts)?manifest.allowedHosts.filter(value=>typeof value==='string'&&/^[a-zA-Z0-9.*:-]{1,200}$/.test(value)):[];
 if(manifest.capabilities&&capabilities.length!==manifest.capabilities.length)fail('bundle declares an unsupported capability');
 if(manifest.allowedHosts&&allowedHosts.length!==manifest.allowedHosts.length)fail('bundle declares an unsupported host');
 return {digest,capabilities,allowedHosts};
}

function cacheUrl(release,blobCid){
 const endpoint=release.artifactCaches?.[0]?.serviceEndpoint;
 if(typeof endpoint!=='string')fail('release has no artifact cache');
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)fail('artifact cache endpoint is not a clean https origin');
 if(!cidPattern.test(release.cid)||!cidPattern.test(blobCid))fail('release or blob CID is invalid');
 const segments=['r',release.did,releaseCollection,release.package+':'+release.version,release.cid,blobCid];
 if(segments.some(segment=>typeof segment!=='string'||!/^[A-Za-z0-9._:-]+$/.test(segment)))fail('artifact path is unsafe');
 return new URL(segments.join('/'),endpoint);
}

async function observe(entry,now){
 const pkg=await xrpc('resolvePackage',{handle:entry.handle,slug:entry.slug});
 if(pkg.did!==entry.did||pkg.slug!==entry.slug)fail('resolved package identity differs for '+entry.slug);
 const release=await xrpc('getLatestRelease',{did:entry.did,package:entry.slug});
 if(release.did!==entry.did||release.package!==entry.slug)fail('latest release identity differs for '+entry.slug);
 const artifact=release.release?.artifacts?.package;
 if(!artifact?.checksum||!artifact?.blob?.ref)fail('release has no package artifact');
 const blobCid=artifact.blob.ref.$link;
 const expected=multihashDigest(artifact.checksum);
 if(!expected)fail('release checksum is not a SHA-256 multihash');
 const url=cacheUrl(release,blobCid);
 const response=await fetch(url,{redirect:'error',headers:{'User-Agent':'Mozilla/5.0 (AppComposer plugin trust observation)'},signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)fail('artifact download returned '+response.status);
 const declared=artifact.size??artifact.blob.size;
 if(Number.isFinite(declared)&&declared>maximumArtifactBytes)fail('artifact exceeds the approved size');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length>maximumArtifactBytes)fail('artifact exceeded the approved size');
 if(Number.isFinite(declared)&&bytes.length!==declared)fail('artifact size differs from the declared size');
 const bundle=inspectBundle(bytes,entry.slug,release.version);
 if(bundle.digest!==expected)fail('artifact digest does not match the release checksum');
 const profile=pkg.profile??{};
 const extension=release.release?.extensions?.['com.emdashcms.experimental.package.releaseExtension']??{};
 return {
  name:entry.name,
  did:entry.did,
  slug:entry.slug,
  handle:pkg.handle??entry.handle,
  profileCid:pkg.cid,
  profileUri:pkg.uri,
  releaseCid:release.cid,
  releaseUri:release.uri,
  version:release.version,
  indexedAt:release.indexedAt,
  checksum:artifact.checksum,
  requires:release.release?.requires?.['env:emdash']??null,
  historyComplete:pkg.releaseHistoryComplete===true,
  license:typeof profile.license==='string'?profile.license:null,
  repository:typeof release.release?.repo==='string'?release.release.repo:null,
  securityContact:Array.isArray(profile.security)&&profile.security.length>0,
  requireProvenance:Boolean(extension.provenance),
  profileLabels:Array.isArray(pkg.labels)?pkg.labels:[],
  labels:Array.isArray(release.labels)?release.labels:[],
  refreshFailed:false,
  inspection:{observedAt:now,did:entry.did,slug:entry.slug,version:release.version,releaseCid:release.cid,sha256:bundle.digest,capabilities:bundle.capabilities,allowedHosts:bundle.allowedHosts},
 };
}

export async function observeRegistry({now=new Date()}={}){
 const observedAt=now.toISOString();
 const packages=[];
 for(const entry of curated)packages.push(await observe(entry,observedAt));
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 const host={emdash:pkg.dependencies?.emdash,cloudflare:pkg.dependencies?.['@emdash-cms/cloudflare'],astro:pkg.dependencies?.astro};
 for(const [key,value] of Object.entries(host))if(typeof value!=='string'||!/^\d+\.\d+\.\d+$/.test(value))fail('host '+key+' version is not pinned in package.json');
 return {schemaVersion:1,policy:'2026-10-25.1',observedAt,host,packages};
}

const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const args=process.argv.slice(2);
 const outputAt=args.indexOf('--write');
 const snapshot=await observeRegistry();
 const text=JSON.stringify(snapshot,null,2)+'\n';
 if(outputAt>=0){
  const target=args[outputAt+1];
  if(!target)fail('--write needs a target path');
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,text);
  console.log(JSON.stringify({state:'observed',observedAt:snapshot.observedAt,host:snapshot.host,written:target,packages:snapshot.packages.map(item=>({slug:item.slug,version:item.version,sha256:item.inspection.sha256,capabilities:item.inspection.capabilities,hosts:item.inspection.allowedHosts}))},null,2));
 }else{
  process.stdout.write(text);
 }
}
