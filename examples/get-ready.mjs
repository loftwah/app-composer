// Minimal independent Node consumer; no EmDash, composition or Woodhouse imports.
import {runLocalReadiness,referenceTarget,inspectReadiness} from '../lib/get-ready/index.mjs';
const [workspace,account,worker,origin,repo,operation]=process.argv.slice(2);
if(!workspace||!account||!worker||!origin||!repo||(operation&&operation!=='deploy-reference'))throw new Error('Supply workspace, account ID, Worker name, HTTPS origin and GitHub owner/repo. Optional: deploy-reference.');
const session=await runLocalReadiness({workspace,account,worker,target:referenceTarget(origin,repo),operation:operation??null});
console.log(JSON.stringify(inspectReadiness(session),null,2));
if(session.state!=='verified')process.exitCode=1;
