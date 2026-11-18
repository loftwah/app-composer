import type { APIRoute } from 'astro';
import { recipeFilename, widgetRecipeJson } from '../../lib/widget-recipe.ts';

export const GET: APIRoute = () =>
  new Response(widgetRecipeJson, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${recipeFilename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
