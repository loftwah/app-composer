import type { APIRoute } from 'astro';
import { widgetRecipeIndexJson } from '../../lib/widget-recipe-index.ts';

export const GET: APIRoute = () =>
  new Response(widgetRecipeIndexJson, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
