import type { APIRoute } from 'astro';
import { filmRecipeV2Json, recipeV2Filename } from '../../lib/studio-film-starter.ts';

export const GET: APIRoute = () =>
  new Response(filmRecipeV2Json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${recipeV2Filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
