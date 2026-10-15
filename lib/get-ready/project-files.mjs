// Internal bounded reader shared by inspection and explicit preparation.
import {openSync,closeSync,lstatSync,fstatSync,readSync,constants} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function identity(stat){return [stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs,stat.nlink].join(':');}
export function selectedFile(root,name,limit=65536,{allowHardlinks=false}={}){
 const path=resolve(root,name),parents=[];let fd;
 try{
  const parts=relative(root,path).split(sep);if(parts.some(p=>p==='..'))return {state:'refused'};
  for(let i=0;i<parts.length;i++){const parent=resolve(root,...parts.slice(0,i)),stat=lstatSync(parent);if(!stat.isDirectory()||stat.isSymbolicLink())return {state:'refused'};parents.push([parent,stat.dev,stat.ino]);}
  const before=lstatSync(path);if(!before.isFile()||before.isSymbolicLink()||(!allowHardlinks&&before.nlink!==1))return {state:'refused'};if(before.size>limit)return {state:'oversize'};
  fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const opened=fstatSync(fd);if(identity(before)!==identity(opened))return {state:'changed'};
  const bytes=Buffer.alloc(limit+1);let length=0;while(length<bytes.length){const count=readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;}if(length>limit)return {state:'oversize'};
  if(identity(opened)!==identity(fstatSync(fd))||identity(opened)!==identity(lstatSync(path))||parents.some(([parent,dev,ino])=>{const s=lstatSync(parent);return !s.isDirectory()||s.isSymbolicLink()||s.dev!==dev||s.ino!==ino;}))return {state:'changed'};
  const data=bytes.subarray(0,length);return {state:'present',sha256:hash(data),data};
 }catch(error){return {state:error.code==='ENOENT'?'absent':error.code==='EACCES'||error.code==='EPERM'?'denied':'refused'};}finally{if(fd!==undefined)closeSync(fd);}
}
