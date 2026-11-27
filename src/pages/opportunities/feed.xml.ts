import type { APIRoute } from 'astro';
import { opportunities, opportunityPath, opportunityStatus, statuses } from '../../lib/opportunities';
import { publicPageCanonical } from '../../lib/public-pages.mjs';

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const xml = (text: string) => text.replace(/[&<>"']/g, match => entities[match]);

export const GET: APIRoute = () => {
  const now = Date.now();
  const home = publicPageCanonical('/opportunities').href;
  const items = opportunities().map(item => {
    const url = publicPageCanonical(opportunityPath(item.id)).href;
    const date = new Date(item.updatedOn + 'T00:00:00+11:00').toUTCString();
    const status = statuses[opportunityStatus(item, now)];
    return `<item><title>${xml(item.title)}</title><link>${xml(url)}</link><guid>${xml(url)}</guid><pubDate>${date}</pubDate><description>${xml(`${status} · ${item.location}. ${item.summary}`)}</description></item>`;
  }).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Australian AI opportunities</title><link>${xml(home)}</link><description>Verified opportunities and status changes.</description>${items}</channel></rss>\n`, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
