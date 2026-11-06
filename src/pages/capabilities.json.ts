import type { APIRoute } from 'astro';
import {
  appCapabilities,
  capabilitiesReviewed,
  capabilitiesVersion,
} from '../lib/app-capabilities';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        contract: capabilitiesVersion,
        reviewed: capabilitiesReviewed,
        note: 'Verified capability descriptions only. They grant no permission, execute no code and contain no credentials.',
        apps: appCapabilities,
      },
      null,
      2,
    ),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
