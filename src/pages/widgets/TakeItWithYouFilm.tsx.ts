import type { APIRoute } from 'astro';
import { filmComponentSource, reactComponentFilename } from '../../lib/studio-film-starter.ts';

export const GET: APIRoute = () =>
  new Response(filmComponentSource, {
    headers: {
      // Preserve the downloadable source bytes through edge HTML transformations.
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${reactComponentFilename}"`,
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
