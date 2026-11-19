import type { APIRoute } from 'astro';
import { agentTask, stationAgentTaskFilename } from '../../lib/widget-recipe.ts';

export const GET: APIRoute = () =>
  new Response(agentTask, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stationAgentTaskFilename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
