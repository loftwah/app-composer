import type { APIRoute } from 'astro';
import { blueprint, blueprintReadiness, blueprintSpec } from '../../lib/blueprints.mjs';

// A downloadable brief only. It carries no credential, grants no permission and
// names the exact locked source revision behind each app.
export const GET: APIRoute = ({ params }) => {
  const entry = blueprint(params.id ?? '');
  if (!entry) {
    return new Response(JSON.stringify({ error: 'Unknown blueprint' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const readiness = blueprintReadiness(entry);
  return new Response(
    JSON.stringify(
      {
        blueprint: entry,
        state: readiness.state,
        sources: readiness.sources,
        specification: blueprintSpec(entry),
        note: 'A brief for your agent. Downloading it does not build, deploy or change any account.',
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
};
