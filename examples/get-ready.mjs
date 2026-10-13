// Minimal independent Node consumer; no EmDash, composition or Woodhouse imports.
import {runLocalReadiness,referenceTarget,inspectReadiness} from '../lib/get-ready/index.mjs';
const [workspace,account,worker,origin,repo,operation,selection,...extra]=process.argv.slice(2);
if(!workspace||extra.length||(operation&&!['clone-reference','own-reference','deploy-reference','install-reference-tools'].includes(operation)))throw new Error('Supply workspace, account ID, Worker name, HTTPS origin and GitHub owner/repo; use - for unselected targets. Optional: clone-reference ABSOLUTE_DESTINATION, own-reference OWNER/NAME, install-reference-tools or deploy-reference.');
const chosen=value=>value&&value!=='-'?value:null;
if(!!chosen(origin)!==!!chosen(repo))throw new Error('Select both reference origin and repository, or neither.');
if(selection&&!['clone-reference','own-reference'].includes(operation))throw new Error('Only clone/ownership accepts a selection.');
const session=await runLocalReadiness({workspace,account:chosen(account),worker:chosen(worker),target:chosen(origin)?referenceTarget(origin,repo):null,operation:operation??null,destination:operation==='clone-reference'?selection??null:null,repository:operation==='own-reference'?selection??null:null});
console.log(JSON.stringify(inspectReadiness(session),null,2));
if(session.state!=='verified')process.exitCode=1;
