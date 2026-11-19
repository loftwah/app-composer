import type { APIRoute } from 'astro';
import { zip } from '../../../lib/launch-kit/archive.mjs';
import {
  agentTask,
  installKitFilename,
  recipeFilename,
  starterFilename,
  stationAgentTaskFilename,
  starterHtml,
  widgetRecipeJson,
} from '../../lib/widget-recipe.ts';

// Signed-out install kit for the portable Night Signal station player. Only the
// exact native text artifacts already served individually from /widgets are
// bundled: no media bytes, network calls, credentials or dependencies.
const encoder = new TextEncoder();

const readMe = `Night Signal station player - install kit
These are the exact native files served from composer.loftwah.com/widgets.

- ${recipeFilename} - machine-readable widget recipe
- ${starterFilename} - standalone HTML starter
- ${stationAgentTaskFilename} - task for a coding agent

Serve the HTML over HTTP or HTTPS (localhost is fine); opening it as a file
URL may block the embedded frame. The player iframe loads from fm.loftwah.com,
an external provider. No account, API key, script or bundled media is needed.
Keep the Content-Security-Policy in the starter: it allows only that frame source.
`;

export const GET: APIRoute = () => {
  const files = new Map<string, Uint8Array>();
  files.set(recipeFilename, encoder.encode(widgetRecipeJson));
  files.set(starterFilename, encoder.encode(starterHtml));
  files.set(stationAgentTaskFilename, encoder.encode(agentTask));
  files.set('read-me.txt', encoder.encode(readMe));
  return new Response(zip(files), {
    headers: {
      'Content-Type': 'application/zip',
      // Preserve the archive bytes through any edge transformation.
      'Content-Disposition': `attachment; filename="${installKitFilename}"`,
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
