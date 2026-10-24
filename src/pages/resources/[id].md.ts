import type { APIRoute } from 'astro';
import { resourceById, renderResource } from '../../lib/resource-library';

export const GET: APIRoute = ({ params }) => {
  if (!params.id || !resourceById(params.id)) return new Response('Resource not found', { status: 404 });
  return new Response(renderResource(params.id), { headers: {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Disposition': `attachment; filename="composer-${params.id}.md"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
};
