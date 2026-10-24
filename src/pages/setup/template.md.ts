import type { APIRoute } from 'astro';
import { renderProjectSetupGuide, setupGuideVersion } from '../../lib/project-setup';

export const GET: APIRoute = () => new Response(renderProjectSetupGuide(), {
  headers: {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'X-Setup-Guide-Version': setupGuideVersion,
    'X-Content-Type-Options': 'nosniff',
  },
});
