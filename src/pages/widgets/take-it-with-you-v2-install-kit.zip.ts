import type { APIRoute } from 'astro';
import { zip } from '../../../lib/launch-kit/archive.mjs';
import {
  filmAgentTask,
  filmAgentTaskFilename,
  filmComponentSource,
  filmRecipeV2Json,
  installKitFilename,
  reactComponentFilename,
  reactComponentKitFilename,
  recipeV2Filename,
  starterFilename,
  starterHtml,
} from '../../lib/studio-film-starter.ts';

// Signed-out install kit for the portable Take it with you film. Only the exact
// native text artifacts already served individually from /widgets are bundled:
// no media bytes, network calls, credentials or dependencies.
const encoder = new TextEncoder();

const readMe = `Take it with you film - install kit
These are the exact native files served from composer.loftwah.com/widgets.

- ${recipeV2Filename} - version 2 film recipe
- ${starterFilename} - script-free HTML starter
- ${filmAgentTaskFilename} - task for a coding agent
- ${reactComponentKitFilename} - React + TypeScript component

Serve the HTML over HTTP or HTTPS (localhost is fine). The video and poster
load from media.loftwah.com, an external provider; English captions are inline
in the files, so playback needs no caption request. The HTML needs no account
or build step. Keep the Content-Security-Policy in the starter. To use the
recipe’s React import as written, rename the component to ${reactComponentFilename}.
`;

export const GET: APIRoute = () => {
  const files = new Map<string, Uint8Array>();
  files.set(recipeV2Filename, encoder.encode(filmRecipeV2Json));
  files.set(starterFilename, encoder.encode(starterHtml));
  files.set(filmAgentTaskFilename, encoder.encode(filmAgentTask));
  files.set(reactComponentKitFilename, encoder.encode(filmComponentSource));
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
