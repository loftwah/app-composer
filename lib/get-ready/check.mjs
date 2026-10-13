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

export function runReadinessCommand(command, args, options, execute = execFileSync) {
  const githubAPI = command === 'gh' && args[0] === 'api';
  const whoami = (command === 'pnpm' && args.slice(0, 3).join(' ') === 'exec wrangler whoami' && args.includes('--json'))
    || (command === process.execPath && args[0]?.endsWith('/wrangler/bin/wrangler.js') && args.slice(1).join(' ') === 'whoami --json');
  const argv = githubAPI ? [...args, '--include'] : args;
  let output;
  try {
    output = execute(command, argv, options).trim();
  } catch (error) {
    if (error.code === 'ENOENT') throw new ReadinessFailure('configuration');
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
    const accountAPI = endpoint.origin === 'https://api.cloudflare.com' && endpoint.pathname.startsWith('/client/v4/accounts/');
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

export async function runReadinessCheck(state, {id, label, action, setupAction, verify}, save) {
  state.checks[id] = {label, state: 'verifying', action: null};
  await save(state);
  let outcome;
  try {
    const evidence = await verify();
    outcome = {label, state: 'verified', provenance: 'agent-executed', verifiedAt: new Date().toISOString(), evidence};
  } catch (error) {
    const code = error instanceof ReadinessFailure ? error.code : 'unexpected';
    const failure = failures[code];
    outcome = {
      label, state: failure.state,
      action: failure.recovery === 'agent-retry'
        ? 'The service could not be checked. The agent should retry this doctor later; no human action is established.'
        : failure.recovery === 'agent-repair'
          ? 'The agent should inspect and repair this check, then rerun the doctor. No human action is established.'
          : failure.recovery === 'agent-setup' ? setupAction || action : action,
      issue: {code, recovery: failure.recovery, retryable: failure.retryable === true},
    };
  }
  state.checks[id] = outcome;
  // A failed receipt write is not a failed provider check; let it stop execution.
  await save(state);
  return outcome;
}
