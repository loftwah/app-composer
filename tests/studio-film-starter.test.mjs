import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GET } from '../src/pages/widgets/take-it-with-you-v1.html.ts';
import {
  captionText,
  captionTrackUrl,
  filmTitle,
  posterUrl,
  starterFilename,
  starterHtml,
  starterPath,
  videoSha256,
  videoUrl,
  watchUrl,
} from '../src/lib/studio-film-starter.ts';

const captionDataPrefix = 'data:text/vtt;charset=utf-8,';

test('the embedded captions are the exact committed Studio-approved VTT', async () => {
  const committed = await readFile('public/brand/campaign/take-it-with-you-20261118.vtt', 'utf8');
  assert.equal(captionText, committed, 'the inline caption bytes match the committed track');
  assert.equal(Buffer.byteLength(captionText), 229);
  assert.ok(captionTrackUrl.startsWith(captionDataPrefix));
  assert.equal(
    decodeURIComponent(captionTrackUrl.slice(captionDataPrefix.length)),
    committed,
    'the data: track decodes back to the same exact bytes',
  );
  assert.equal((captionText.match(/\d{2}:\d{2}\.\d{3} --> /g) ?? []).length, 4, 'four cues are embedded');
});

test('the public film route serves the exact starter as a byte-preserving attachment', async () => {
  const response = await GET({ url: new URL(`https://composer.loftwah.com${starterPath}`), params: {} });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.equal(response.headers.get('content-disposition'), `attachment; filename="${starterFilename}"`);
  assert.equal(response.headers.get('cache-control'), 'no-store, no-transform');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await response.text(), starterHtml);
});

test('the downloaded page is self-contained, captioned and script-free', () => {
  assert.match(starterHtml, /^<!doctype html>/);
  assert.match(starterHtml, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(starterHtml, /<video controls playsinline preload="none" width="1280" height="720" poster="/);
  assert.match(starterHtml, /video \{ display: block; width: 100%; height: auto;/);
  assert.ok(starterHtml.includes(`<source src="${videoUrl}" type="video/mp4">`));
  assert.ok(starterHtml.includes(`poster="${posterUrl}"`));
  assert.ok(starterHtml.includes(`<track kind="captions" src="${captionTrackUrl}" srclang="en" label="English captions" default>`));
  assert.ok(starterHtml.includes(`href="${watchUrl}"`), 'a native Watch link credits the source');
  assert.ok(starterHtml.includes(videoSha256), 'the exact revision travels with the credit');
  assert.ok(starterHtml.includes('ElevenCreative from App Composer and Woodhouse references'));
  assert.doesNotMatch(starterHtml, /<script\b/i, 'no script of any kind');
  assert.doesNotMatch(starterHtml, /\bautoplay\b/i, 'nothing autoplays');
  assert.doesNotMatch(starterHtml, /\bcrossorigin\b/i, 'the proven cross-origin combination is unchanged');
  assert.doesNotMatch(starterHtml, /composer\.loftwah\.com/, 'no Composer runtime dependency in the download');
  assert.equal(filmTitle, 'Take it with you');
});

test('the widget page adds the film section without loading it or disturbing the three cards', async () => {
  const page = await readFile('src/pages/widgets.astro', 'utf8');
  for (const id of ['loftwahfm-station', 'bubbles-listening-card', 'top-tracks-share-card', 'take-it-with-you-film']) {
    assert.ok(page.includes(`id="${id}"`), `${id} stays on the page`);
  }
  assert.ok(page.includes('<li><a href="#take-it-with-you-film">Take it with you film</a></li>'), 'one native jump link');
  assert.ok(page.includes(`href={watchUrl}>Watch on Media Studio</a>`), 'Watch action');
  assert.ok(page.includes(`href={filmStarterPath} download={filmStarterFilename}`), 'starter download action');
  assert.ok(!page.includes('<video'), 'the Composer page embeds no video');
  assert.ok(!page.includes('poster='), 'the Composer page loads no poster');
  assert.ok(!page.includes('<img'), 'the Composer page loads no external image');
});
