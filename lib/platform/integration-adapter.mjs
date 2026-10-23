import { createHash } from 'node:crypto';

const paths = { change: '/v2/change/enqueue', incident: '/v2/enqueue' };
const required = ['operationId', 'appId', 'teamId', 'environment', 'sourceSha', 'releaseId', 'outcome', 'summary'];
const optional = ['planDigest', 'policyRevision', 'incidentId', 'action'];
const identity = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function selectedPayload(input, channel) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype) throw new TypeError('Invalid integration payload.');
  if (Object.keys(input).some(key => ![...required, ...optional].includes(key))) throw new TypeError('Unsupported integration field.');
  const selected = {};
  for (const key of required) {
    const value = input[key];
    if (typeof value !== 'string' || (key === 'summary'
      ? !value.trim() || value.length > 512 || /[\x00-\x1f\x7f]/.test(value)
      : !identity.test(value))) throw new TypeError(`Invalid integration ${key}.`);
    selected[key] = value;
  }
  if (!/^[a-f0-9]{40}$/.test(input.sourceSha)) throw new TypeError('Invalid integration sourceSha.');
  for (const key of optional) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'string' || !identity.test(input[key])) throw new TypeError(`Invalid integration ${key}.`);
    selected[key] = input[key];
  }
  if (selected.planDigest && !/^[a-f0-9]{64}$/.test(selected.planDigest)) throw new TypeError('Invalid integration planDigest.');
  if (channel === 'change' && (selected.action || selected.incidentId)) throw new TypeError('Incident fields cannot select change behaviour.');
  if (channel === 'incident' && (!selected.incidentId || !['trigger', 'acknowledge', 'resolve'].includes(selected.action))) throw new TypeError('Incident identity and explicit action are required.');
  return selected;
}

function destination(input, channel, fixture) {
  if (!input || typeof input.token !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(input.token)) throw new TypeError('A host-selected integration key is required.');
  const url = new URL(input.url);
  const loopback = url.protocol === 'http:' && url.hostname === '127.0.0.1' && fixture;
  if ((!loopback && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash || url.pathname !== paths[channel]) throw new TypeError('Invalid host-selected integration destination.');
  return Object.freeze({ url: url.href, token: input.token });
}

/** Trusted host API only. Do not expose destination configuration to imports, HTTP or model tool arguments.
 * This transports observations; it grants no release, remediation, incident or approval authority.
 * Callers must persist returned event IDs/outcomes before deciding whether an operator should reconcile.
 */
export function createIntegrationAdapter({ destinations, fetchImpl = globalThis.fetch, timeoutMs = 5000, allowLoopbackFixture = false }) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 30000 || typeof fetchImpl !== 'function') throw new TypeError('Invalid integration transport configuration.');
  if (!destinations || Object.keys(destinations).some(key => !Object.hasOwn(paths, key))) throw new TypeError('Unknown integration channel.');
  const fixed = Object.fromEntries(Object.entries(destinations).map(([channel, selected]) => [channel, destination(selected, channel, allowLoopbackFixture)]));

  async function deliver(channel, input) {
    const selected = fixed[channel];
    if (!selected) throw new TypeError('Integration channel is not configured by the host.');
    const payload = selectedPayload(input, channel);
    const eventId = `composer-${digest([channel, ...required.filter(key => key !== 'summary').map(key => payload[key]), ...optional.map(key => payload[key] ?? null)])}`;
    const dedupKey = channel === 'incident' ? `composer-${digest([payload.teamId, payload.appId, payload.environment, payload.incidentId])}` : undefined;
    const body = {
      routing_key: selected.token,
      ...(channel === 'incident' ? { event_action: payload.action, dedup_key: dedupKey } : {}),
      payload: {
        summary: payload.summary,
        source: `composer:${payload.appId}:${payload.environment}`,
        ...(channel === 'incident' ? { severity: 'error' } : {}),
        custom_details: { ...payload, eventId },
      },
    };
    const result = { eventId, channel, ...(dedupKey ? { dedupKey } : {}) };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(selected.url, {
        method: 'POST', redirect: 'error', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body), signal: controller.signal,
      });
      // Explicit client rejection is actionable; redirects, server failures and timeouts may follow receipt.
      if (response.status >= 400 && response.status < 500 && ![408, 409].includes(response.status)) {
        await response.body?.cancel();
        return { ...result, status: 'rejected', httpStatus: response.status };
      }
      if (response.status !== 202) {
        await response.body?.cancel();
        return { ...result, status: 'unknown', httpStatus: response.status };
      }
      // Read a bounded acknowledgement; never return remote text or credentials in evidence.
      const reader = response.body?.getReader();
      let length = 0;
      const chunks = [];
      if (!reader) return { ...result, status: 'unknown', httpStatus: 202 };
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 4096) { await reader.cancel(); return { ...result, status: 'unknown', httpStatus: 202 }; }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const ack = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const matched = channel === 'incident' ? ack.dedup_key === dedupKey : typeof ack.id === 'string' && ack.id.length > 0 && ack.id.length <= 255;
      return { ...result, status: ack.status === 'success' && matched ? 'accepted' : 'unknown', httpStatus: 202 };
    } catch {
      return { ...result, status: 'unknown' };
    } finally {
      clearTimeout(timer);
    }
  }
  return Object.freeze({
    deliverChange: payload => deliver('change', payload),
    deliverIncident: payload => deliver('incident', payload),
  });
}
