// Shared check boundary: CLI and independent consumers use the same recovery states.
// Provider bodies, subprocess output and exception messages never enter a receipt.
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

export async function runReadinessCheck(state, {id, label, action, verify}, save) {
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
          : action,
      issue: {code, recovery: failure.recovery, retryable: failure.retryable === true},
    };
  }
  state.checks[id] = outcome;
  // A failed receipt write is not a failed provider check; let it stop execution.
  await save(state);
  return outcome;
}
