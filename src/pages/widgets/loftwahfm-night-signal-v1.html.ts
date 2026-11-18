import type { APIRoute } from 'astro';
import { starterFilename, starterHtml } from '../../lib/widget-recipe.ts';

export const GET: APIRoute = () =>
  new Response(starterHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${starterFilename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
