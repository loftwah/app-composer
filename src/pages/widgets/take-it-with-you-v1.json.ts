import type { APIRoute } from 'astro';
import { filmRecipeJson, recipeFilename } from '../../lib/studio-film-starter.ts';

export const GET: APIRoute = () =>
  new Response(filmRecipeJson, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${recipeFilename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
