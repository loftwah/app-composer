// Shared check boundary: CLI and independent consumers use the same recovery states.
// Provider bodies, subprocess output and exception messages never enter a receipt.
import {execFileSync} from 'node:child_process';
const failures = {
  authentication: {state: 'action_required', recovery: 'human-authentication'},
  permission: {state: 'action_required', recovery: 'human-permission'},
  configuration: {state: 'action_required', recovery: 'agent-setup'},
  unavailable: {state: 'failed', recovery: 'agent-retry', retryable: true},
  response: {state: 'failed', recovery: 'agent-repair'},
  source: {state: 'failed', recovery: 'agent-repair'},
  unexpected: {state: 'failed', recovery: 'agent-repair'},
};

export class ReadinessFailure extends Error {
  constructor(code) {
    if (!Object.hasOwn(failures, code)) throw new TypeError('Unknown readiness failure code');
    super('Readiness check did not pass');
    this.code = code;
  }
}

const toolGuidance=Object.freeze({
  git:{label:'Git',source:'https://git-scm.com/install/'},
  gh:{label:'GitHub CLI',source:'https://github.com/cli/cli#installation'},
  pnpm:{label:'pnpm',source:'https://pnpm.io/installation'},
  agent:{label:'Codex workspace',source:null},
});
function validatedTools(tools){
 if(!Array.isArray(tools)||!tools.length||tools.length>4)throw new TypeError('Invalid tool diagnostics');
 const seen=new Set();
 return tools.map(item=>{
  if(!item||Object.keys(item).length!==2||!Object.hasOwn(toolGuidance,item.tool)||seen.has(item.tool)||!(item.tool==='agent'?item.state==='inactive':['missing','broken'].includes(item.state)))throw new TypeError('Invalid tool diagnostic');
  seen.add(item.tool);return {tool:item.tool,state:item.state};
 });
}
export class ReadinessToolFailure extends ReadinessFailure{
 constructor(tools){
  const checked=validatedTools(tools);super(checked.some(item=>item.state==='broken')?'response':'configuration');this.tools=checked;
 }
}
function toolRecovery(tools){
 return validatedTools(tools).map(item=>{
  const {label,source}=toolGuidance[item.tool];
  if(item.state==='inactive')return 'Resume this task in an authorised Codex workspace; an installed CLI alone does not verify an active agent.';
  return `${label} ${item.state==='missing'?'is missing':'did not return a usable version'}. The agent should ${item.state==='missing'?'install':'inspect and repair'} it using the official instructions: ${source}`;
 }).join(' ');
}

export function runReadinessCommand(command, args, options, execute = execFileSync) {
  const githubAPI = command === 'gh' && args[0] === 'api';
  const whoami = (command === 'pnpm' && args.slice(0, 3).join(' ') === 'exec wrangler whoami' && args.includes('--json'))
    || (command === process.execPath && args[0]?.endsWith('/wrangler/bin/wrangler.js') && args.slice(1).filter(arg=>arg!=='--env-file=/dev/null').join(' ') === 'whoami --json');
  const argv = githubAPI ? [...args, '--include'] : args;
  let output;
  try {
    output = execute(command, argv, options).trim();
  } catch (error) {
    if (error.code === 'ENOENT') {
      if(['git','gh','pnpm'].includes(command))throw new ReadinessToolFailure([{tool:command,state:'missing'}]);
      throw new ReadinessFailure('configuration');
    }
    // gh documents exit 4 as authentication required. HTTP headers distinguish
    // expired credentials, missing permission and rate limits without error bodies.
    if (githubAPI && error.status === 4) throw new ReadinessFailure('authentication');
    if (githubAPI) {
      const headers = String(error.stdout || '').split(/\r?\n\r?\n/, 1)[0];
      const status = /^HTTP\/[\d.]+ (\d{3})\b/.exec(headers)?.[1];
      if (status === '401') throw new ReadinessFailure('authentication');
      if (status === '429' || Number(status) >= 500 || (status === '403' && /^(?:x-ratelimit-remaining:\s*0\s*$|retry-after:)/im.test(headers))) throw new ReadinessFailure('unavailable');
      if (status === '403') throw new ReadinessFailure('permission');
    }
    if (whoami) {
      for (const stream of [error.stdout, error.stderr]) {
        try {
          if (JSON.parse(String(stream || '').trim()).loggedIn === false) throw new ReadinessFailure('authentication');
        } catch (failure) {
          if (failure instanceof ReadinessFailure) throw failure;
        }
      }
    }
    throw new ReadinessFailure('unexpected');
  }
  if (githubAPI && /^HTTP\/[\d.]+ \d{3}\b/.test(output)) {
    const separator = /\r?\n\r?\n/.exec(output);
    if (!separator) throw new ReadinessFailure('response');
    return output.slice(separator.index + separator[0].length).trim();
  }
  if (whoami) {
    let identity;
    try { identity = JSON.parse(output); } catch { throw new ReadinessFailure('response'); }
    if (identity?.loggedIn === false) throw new ReadinessFailure('authentication');
    if (identity?.loggedIn !== true || !Array.isArray(identity.accounts)) throw new ReadinessFailure('response');
  }
  return output;
}

export async function readinessJSON(url, options = {}, request = fetch) {
  let response;
  try {
    response = await request(url, {...options, redirect: 'error', signal: AbortSignal.timeout(10000)});
  } catch {
    throw new ReadinessFailure('unavailable');
  }
  if ([401, 403].includes(response.status)) {
    const endpoint = new URL(url);
    // A public site's WAF or login denial is not proof of missing API permission.
    const accountAPI = endpoint.origin === 'https://api.cloudflare.com' && (endpoint.pathname.startsWith('/client/v4/accounts/')||/^\/client\/v4\/zones(?:\/[a-f0-9]{32}\/dnssec)?$/.test(endpoint.pathname));
    throw new ReadinessFailure(accountAPI ? response.status === 401 ? 'authentication' : 'permission' : 'response');
  }
  if (response.status === 429 || response.status >= 500) throw new ReadinessFailure('unavailable');
  if (!response.ok) throw new ReadinessFailure('response');
  try {
    return await response.json();
  } catch {
    throw new ReadinessFailure('response');
  }
}

export async function runReadinessCheck(state, {id, label, action, authenticationAction, permissionAction, setupAction, verify}, save) {
  state.checks[id] = {label, state: 'verifying', action: null};
  await save(state);
  let outcome;
  try {
    const evidence = await verify();
    outcome = {label, state: 'verified', provenance: 'agent-executed', verifiedAt: new Date().toISOString(), evidence};
  } catch (error) {
    let tools=null;
    if(error instanceof ReadinessToolFailure){try{tools=validatedTools(error.tools);}catch{}}
    const code = tools ? tools.some(item=>item.state==='broken')?'response':'configuration' : error instanceof ReadinessToolFailure ? 'unexpected' : error instanceof ReadinessFailure ? error.code : 'unexpected';
    const failure = failures[code];
    outcome = {
      label, state: failure.state,
      action: tools ? toolRecovery(tools) : failure.recovery === 'agent-retry'
        ? 'The service could not be checked. The agent should retry this doctor later; no human action is established.'
        : failure.recovery === 'agent-repair'
          ? 'The agent should inspect and repair this check, then rerun the doctor. No human action is established.'
          : failure.recovery === 'agent-setup' ? setupAction || action
            : failure.recovery === 'human-authentication' ? authenticationAction || action
              : permissionAction || action,
      issue: {code, recovery: failure.recovery, retryable: failure.retryable === true,...(tools?{tools:tools.map(item=>({...item,...toolGuidance[item.tool]}))}:{})},
    };
  }
  state.checks[id] = outcome;
  // A failed receipt write is not a failed provider check; let it stop execution.
  await save(state);
  return outcome;
}
