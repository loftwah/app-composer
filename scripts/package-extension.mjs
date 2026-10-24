// The optional Chrome extension ships as a committed unpacked archive.
//
// It is built here so the archive, the checked-in extension folder and the
// visible icon can never drift apart: the previous release shipped a blank
// ivory icon inside the ZIP because the archive was assembled by hand. The
// guard below refuses an icon that is not a real, visibly drawn PNG.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';

const repository=join(dirname(fileURLToPath(import.meta.url)),'..');
const folder=join(repository,'extension');
const entries=['manifest.json','background.js','workspace.js','spec.mjs','README.md','icon.png'];

// A deterministic, dependency-free ZIP writer (stored/deflated, fixed mtime).
function crc32(bytes){
 let c=0xffffffff;
 for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}
 return (c^0xffffffff)>>>0;
}
export function zip(files){
 const chunks=[],central=[];
 let offset=0;
 const dosTime=0, dosDate=(2026-1980)<<9|10<<5|17; // 2026-10-17, fixed for determinism
 for(const [name,bytes] of files){
  const nameBytes=Buffer.from(name,'utf8');
  const compressed=deflateRawSync(bytes,{level:9});
  const method=compressed.length<bytes.length?8:0;
  const body=method===8?compressed:bytes;
  const crc=crc32(bytes);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(method,8);
  local.writeUInt16LE(dosTime,10);local.writeUInt16LE(dosDate,12);local.writeUInt32LE(crc,14);
  local.writeUInt32LE(body.length,18);local.writeUInt32LE(bytes.length,22);
  local.writeUInt16LE(nameBytes.length,26);local.writeUInt16LE(0,28);
  chunks.push(local,nameBytes,body);
  const centralEntry=Buffer.alloc(46);
  centralEntry.writeUInt32LE(0x02014b50,0);centralEntry.writeUInt16LE(20,4);centralEntry.writeUInt16LE(20,6);centralEntry.writeUInt16LE(0,8);
  centralEntry.writeUInt16LE(method,10);centralEntry.writeUInt16LE(dosTime,12);centralEntry.writeUInt16LE(dosDate,14);
  centralEntry.writeUInt32LE(crc,16);centralEntry.writeUInt32LE(body.length,20);centralEntry.writeUInt32LE(bytes.length,24);
  centralEntry.writeUInt16LE(nameBytes.length,28);centralEntry.writeUInt32LE(offset,42);
  central.push(centralEntry,nameBytes);
  offset+=local.length+nameBytes.length+body.length;
 }
 const centralStart=offset;
 for(const part of central)offset+=part.length;
 const end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
 end.writeUInt32LE(offset-centralStart,12);end.writeUInt32LE(centralStart,16);
 return Buffer.concat([...chunks,...central,end]);
}

// Minimal PNG reader: dimensions and colour type, enough to refuse a blank tile.
function pngHeader(bytes){
 if(bytes.length<33||bytes.readUInt32BE(0)!==0x89504e47||bytes.readUInt32BE(4)!==0x0d0a1a0a)throw Error('icon.png is not a PNG');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),bitDepth=bytes[24],colourType=bytes[25];
 if(!width||!height)throw Error('icon.png has no dimensions');
 if(bitDepth!==8||![2,6].includes(colourType))throw Error('icon.png must be an 8-bit RGB/RGBA PNG');
 return {width,height};
}

export function packageExtension(){
 const manifest=JSON.parse(readFileSync(join(folder,'manifest.json'),'utf8'));
 if(manifest.manifest_version!==3)throw Error('the extension manifest must stay Manifest V3');
 const icon=readFileSync(join(folder,'icon.png'));
 const {width,height}=pngHeader(icon);
 const declared=manifest.icons?.['128'];
 if(declared!=='icon.png')throw Error('the manifest must declare icon.png');
 if(width!==128||height!==128)throw Error('extension/icon.png must be 128x128, found '+width+'x'+height);
 const files=[];
 for(const name of entries)files.push([name,readFileSync(join(folder,name))]);
 const archive=zip(files);
 const sha256=createHash('sha256').update(archive).digest('hex');
 const bytes=archive.length;
 writeFileSync(join(repository,'public/downloads/cloudflare-extension.zip'),archive);
 const metadata={name:'cloudflare-extension',version:manifest.version,files:entries,bytes,sha256,built:'2026-10-17'};
 writeFileSync(join(repository,'public/downloads/cloudflare-extension.json'),JSON.stringify(metadata,null,2)+'\n');
 return metadata;
}

if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const metadata=packageExtension();
 console.log('Packaged '+metadata.name+' '+metadata.version+' ('+metadata.bytes+' bytes), sha256 '+metadata.sha256);
}
