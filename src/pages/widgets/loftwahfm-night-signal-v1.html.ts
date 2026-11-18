import type { APIRoute } from 'astro';
import { starterFilename, starterHtml } from '../../lib/widget-recipe.ts';

export const GET: APIRoute = () =>
  new Response(starterHtml, {
    headers: {
      // Preserve the downloadable bytes through HTML transformations at the edge.
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${starterFilename}"`,
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
