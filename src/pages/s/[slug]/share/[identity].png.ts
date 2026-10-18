import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';
import { publicStack } from '../../../../lib/stacks.mjs';
import { isStackImageIdentity, stackShareDetails } from '../../../../lib/stack-sharing.ts';
import { renderStackShareImage } from '../../../../lib/stack-share-image.ts';

export const GET: APIRoute = async ({params, request}) => {
  const headers = new Headers({'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  const missing = (): Response => new Response('No published stack image exists at this address.', {status: 404, headers});
  const unavailable = (): Response => new Response('The published stack image is temporarily unavailable.', {status: 503, headers});
  if (!/^[a-z0-9-]{1,60}$/.test(params.slug ?? '') || !isStackImageIdentity(params.identity ?? '')) return missing();
  const runtime = env as unknown as {DB?: D1Database};
  if (!runtime.DB || typeof runtime.DB.prepare !== 'function') return unavailable();
  try {
    // Recheck current public visibility even for a previously valid image URL.
    // Archive, unpublish, deletion and a new publication revoke old responses.
    const stack = await publicStack(runtime.DB, params.slug ?? '');
    if (!stack) return missing();
    const share = await stackShareDetails(stack);
    if (share.imageIdentity !== params.identity) return missing();
    headers.set('Content-Type', 'image/png');
    if (request.method === 'HEAD') return new Response(null, {headers});
    return new Response(await renderStackShareImage(stack, share), {headers});
  } catch {
    headers.delete('Content-Type');
    return unavailable();
  }
};

export const HEAD = GET;
