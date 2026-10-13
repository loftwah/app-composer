// Minimal independent Node consumer; no EmDash, composition or Woodhouse imports.
import {runLocalReadiness,referenceTarget,inspectReadiness} from '../lib/get-ready/index.mjs';
const [workspace,account,worker,origin,repo,operation,destination]=process.argv.slice(2);
if(!workspace||!account||!worker||!origin||!repo||(operation&&!['clone-reference','deploy-reference','install-reference-tools'].includes(operation)))throw new Error('Supply workspace, account ID, Worker name, HTTPS origin and GitHub owner/repo. Optional: clone-reference ABSOLUTE_DESTINATION, install-reference-tools or deploy-reference.');
const session=await runLocalReadiness({workspace,account,worker,target:referenceTarget(origin,repo),operation:operation??null,destination:destination??null});
console.log(JSON.stringify(inspectReadiness(session),null,2));
if(session.state!=='verified')process.exitCode=1;
