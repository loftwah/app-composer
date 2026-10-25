// Internal directory-bound mutations shared by supported project preparation.
import {spawnSync} from 'node:child_process';
import {ReadinessFailure} from './check.mjs';
// A child process's cwd is a kernel-held directory, independent of pathname swaps.
// It checks that directory identity before exclusively creating single-component
// names. No project command, environment, credentials or downloaded code enters it.
const writeHelper=`
import {lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(0,'utf8')),here=lstatSync('.');
if(!here.isDirectory()||here.dev!==data.dev||here.ino!==data.ino)process.exit(2);
const valid=name=>typeof name==='string'&&/^[A-Za-z.][A-Za-z0-9.-]*$/.test(name)&&!['.','..'].includes(name);
const directoryName=name=>typeof name==='string'&&name.length>0&&!['.','..'].includes(name)&&!/[\\/\\\\\\x00-\\x1f\\x7f]/.test(name);
if(data.operation==='directory'){
 if(!directoryName(data.name))process.exit(2);
 try{mkdirSync(data.name,{mode:0o755});}catch(error){if(error.code!=='EEXIST'||data.exclusive)throw error;}
 const stat=lstatSync(data.name);if(!stat.isDirectory()||stat.isSymbolicLink())process.exit(2);
 process.stdout.write(JSON.stringify({dev:stat.dev,ino:stat.ino}));
}else if(data.operation==='files'){
 for(const file of data.files){if(!valid(file.name)||typeof file.text!=='string'||(file.encoding!==undefined&&file.encoding!=='base64'))process.exit(2);writeFileSync(file.name,file.text,{flag:'wx',mode:0o644,encoding:file.encoding??'utf8'});}
 process.stdout.write('{}');
}else process.exit(2);
`;
function sourceFailure(result, operation, elapsedMs) {
 const failure=new ReadinessFailure('source');
 // Local diagnostic only. Never include child stderr, paths or authored input.
 failure.sourceWrite={operation:operation.operation==='directory'?'directory':'files',
  reason:result.error?.code==='ETIMEDOUT'?'timeout':result.error?'start-failed':result.signal?'signal':result.status===2?'directory-or-input-refused':'child-exit',
  status:Number.isInteger(result.status)?result.status:null,
  elapsedMs:Math.round(elapsedMs)};
 return failure;
}
export function mutate(directory,identity,operation){
 const started=performance.now();
 const result=spawnSync(process.execPath,['--input-type=module','--eval',writeHelper],{cwd:directory,env:{},input:JSON.stringify({...operation,dev:identity.dev,ino:identity.ino}),encoding:'utf8',timeout:10000,maxBuffer:4096,stdio:['pipe','pipe','pipe']});
 if(result.error||result.status!==0)throw sourceFailure(result,operation,performance.now()-started);
 try{return JSON.parse(result.stdout);}catch{const failure=sourceFailure(result,operation,performance.now()-started);failure.sourceWrite.reason='invalid-result';throw failure;}
}
export function childDirectory(parent,identity,name,exclusive=false){return mutate(parent,identity,{operation:'directory',name,exclusive});}
