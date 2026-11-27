import type { APIRoute } from 'astro';
import type { D1Database, RateLimit } from '@cloudflare/workers-types';
import { env } from 'cloudflare:workers';
import { readBoundedJsonBody } from '../../lib/benchmark-body.ts';
import { advanceSpin, createSpin, readSpin } from '../../lib/spin-session.ts';
import { spinIdPattern, spinSecretPattern } from '../../lib/spin-protocol.mjs';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers });
const messages = { tooLarge: 'This wheel is too large.', missing: 'Send wheel details.', unreadable: 'Could not read the request.', invalid: 'Invalid wheel data.' };

export const ALL: APIRoute = async ({ request, url }) => {
  const { DB, USAGE_LIMIT } = env as unknown as { DB?: D1Database; USAGE_LIMIT?: RateLimit };
  if (!DB) return fail(503, 'Spin is temporarily unavailable.');
  const now = Date.now();
  const id = url.searchParams.get('id');
  if (id !== null && !spinIdPattern.test(id)) return fail(400, 'Choose a valid session link.');
  try {
    if (USAGE_LIMIT) {
      const allowed = await USAGE_LIMIT.limit({ key: 'spin:' + (request.headers.get('CF-Connecting-IP') ?? 'local') });
      if (!allowed.success) return fail(429, 'Too many requests. Try again in a minute.');
    }
    if (request.method === 'GET') {
      if (!id) return fail(400, 'Open a session link.');
      const session = await readSpin(DB, id, now);
      return session ? Response.json({ session }, { headers }) : fail(404, 'This session is unavailable or has expired.');
    }
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, POST' } });
    if (request.headers.get('Origin') !== url.origin) return fail(403, 'Use the controls on App Composer Spin.');
    const body = await readBoundedJsonBody(request, 4096, messages);
    if (!body.ok) return fail(body.status, body.error);
    if (!id) {
      const result = await createSpin(DB, body.value, now);
      return result ? Response.json(result, { status: 201, headers }) :
        fail(400, 'Use a question, 2–12 distinct entries, and an odd best-of length from 1 to 21.');
    }
    const input = body.value as { owner?: string; revision?: number; action?: string } | null;
    if (!input || typeof input.owner !== 'string' || !spinSecretPattern.test(input.owner) ||
        typeof input.revision !== 'number' || !Number.isSafeInteger(input.revision) || input.revision < 0 ||
        (input.action !== 'spin' && input.action !== 'abandon')) return fail(400, 'Invalid session operation.');
    const result = await advanceSpin(DB, id, input.owner, input.revision, input.action === 'abandon', now);
    return result.status === 200 ? Response.json({ session: result.session }, { headers }) :
      fail(result.status, result.status === 403 ? 'Only the creator’s browser can change this session.' : 'This session is unavailable or has expired.');
  } catch {
    return fail(503, 'Spin could not save or read the session. Reopen its link before retrying.');
  }
};
