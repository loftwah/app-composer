import {resolve,dirname,basename} from 'node:path';
import {createContentProject} from '../lib/content-model/project.mjs';
import {selectedFile} from '../lib/get-ready/project-files.mjs';
const args=process.argv.slice(2),flags=new Map();
try{
 if(args.length===1&&args[0]==='--help'){console.log('Create a new local EmDash content project: pnpm init:site --model FILE --destination ABSOLUTE_ABSENT_DIRECTORY. Existing projects are never updated. This installs nothing and does not deploy.');}
 else{
  for(let i=0;i<args.length;i++){if(!['--model','--destination'].includes(args[i])||flags.has(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('Use --model FILE and --destination ABSOLUTE_ABSENT_DIRECTORY.');flags.set(args[i],args[++i]);}
  if(flags.size!==2)throw Error('Select the exported model and an absent project directory.');
  const path=resolve(flags.get('--model')),file=selectedFile(dirname(path),basename(path),65536);if(file.state!=='present')throw Error('Use an ordinary model JSON file under 64 KiB.');
  const model=JSON.parse(file.data.toString('utf8'));console.log(JSON.stringify(createContentProject({model,destination:flags.get('--destination')}),null,2));
 }
}catch{process.stderr.write('Content project creation did not finish. Use a supported model, an absent absolute destination and an existing unlinked parent. Existing/partial files are preserved; inspect them before a separate retry. No dependency installation or deployment was attempted.\n');process.exitCode=1;}
