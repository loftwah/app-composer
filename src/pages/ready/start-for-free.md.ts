import type { APIRoute } from 'astro';
import markdown from '../../editorial/ready/start-for-free.md?raw';

export const GET: APIRoute = () =>
  new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
