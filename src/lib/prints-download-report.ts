import type { D1Database } from '@cloudflare/workers-types';
import { boundedPortfolioJson } from './portfolio-report';
import { fieldKitDailyCap, printsPackageDownloads } from './prints-downloads.mjs';

export const printsReleases = 'https://github.com/loftwah/prints-desktop/releases';

export async function readPrintsPackages(token?: string) {
  const endpoint = 'https://api.github.com/repos/loftwah/prints-desktop/releases?per_page=20';
  const key = new Request('https://prints.loftwah.com/internal-cache/package-downloads-v1');
  const cache = await globalThis.caches?.open('prints-downloads').catch(() => undefined);
  try {
    const saved = await cache?.match(key);
    if (saved) return await saved.json() as NonNullable<ReturnType<typeof printsPackageDownloads>>;
  } catch {
    // The cache is optional. The public release API remains the source.
  }
  try {
    const headers = new Headers({
      Accept: 'application/vnd.github+json',
      'User-Agent': 'App-Composer-Portfolio',
    });
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(endpoint, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) console.warn('Prints release counts unavailable', response.status);
    const rows = printsPackageDownloads(await boundedPortfolioJson(response, 512_000));
    if (rows?.length) {
      await cache?.put(key, Response.json(rows, {
        headers: { 'Cache-Control': 'public, max-age=900' },
      })).catch(() => {});
    }
    return rows;
  } catch {
    return null;
  }
}

export async function readFieldKitDownloads(db: D1Database, now = new Date()) {
  const through = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 6);
  const from = start.toISOString().slice(0, 10);
  try {
    const row = await db.prepare(`SELECT COALESCE(SUM(n),0) AS total,
       COALESCE(MAX(n),0) = ?3 AS capped
       FROM prints_field_kit_daily WHERE day BETWEEN ?1 AND ?2`)
      .bind(from, through, fieldKitDailyCap).first<{ total: number; capped: number }>();
    return row && { total: row.total, capped: row.capped === 1, from, through };
  } catch {
    return null;
  }
}
