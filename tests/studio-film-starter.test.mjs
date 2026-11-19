import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { GET } from '../src/pages/widgets/take-it-with-you-v1.html.ts';
import { GET as getRecipe } from '../src/pages/widgets/take-it-with-you-v1.json.ts';
import {
  captionText,
  captionTrackUrl,
  filmCaptionSrc,
  filmEmbedFragment,
  filmRecipe,
  filmRecipeJson,
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
  const template = page.match(/<template data-film-template>([\s\S]*?)<\/template>/)?.[1];
  assert.ok(template, 'the film lives in one inert template');
  assert.ok(template.includes('<video'), 'the template holds the video element');
  assert.ok(template.includes('poster={posterUrl}'), 'the pinned poster is used');
  assert.ok(template.includes('src={videoUrl}'), 'the pinned video is used');
  assert.ok(template.includes('src={filmCaptionSrc}'), 'the same-origin caption track is used');
  assert.ok(page.includes('data-load-film'), 'an opt-in load control exists');
  assert.ok(page.includes('data-close-film'), 'an unload control exists');
  const rendered = page.replace(/<template data-film-template>[\s\S]*?<\/template>/, '');
  assert.ok(!rendered.includes('<video'), 'no live video is rendered before activation');
  assert.ok(!rendered.includes('poster='), 'no poster is rendered before activation');
  assert.ok(!rendered.includes('<img'), 'no external image is rendered');
});

test('the paste-ready fragment is the exact published video and credit, shown as text with no media fetch', async () => {
  assert.equal(createHash('sha256').update(starterHtml).digest('hex'), '288efff3a357748288619116dcd300a26d101dc394f7f51c6f2b3c0d99bbf465');
  assert.match(filmEmbedFragment, /max-width:100%/);
  assert.ok(filmEmbedFragment.includes(`<source src="${videoUrl}" type="video/mp4">`));
  assert.ok(filmEmbedFragment.includes(`poster="${posterUrl}"`));
  assert.ok(filmEmbedFragment.includes(`<track kind="captions" src="${captionTrackUrl}" srclang="en" label="English captions" default>`));
  assert.ok(filmEmbedFragment.includes(`href="${watchUrl}"`), 'the fragment credits the source');
  assert.match(filmEmbedFragment, /preload="none"/);
  assert.doesNotMatch(filmEmbedFragment, /\bautoplay\b/i);
  assert.doesNotMatch(filmEmbedFragment, /<script\b/i, 'the fragment is script-free');

  const page = await readFile('src/pages/widgets.astro', 'utf8');
  assert.ok(page.includes('<details class="react-version">\n        <summary>Show the HTML fragment</summary>'), 'a compact native disclosure');
  assert.ok(page.includes('<code data-film-embed>{filmEmbedFragment}</code>'), 'Astro escapes the fragment to text, not a live element');
  assert.ok(page.includes('<pre class="widget-code film-code" tabindex="0">'), 'the code block keeps the existing keyboard focus');
  assert.ok(page.includes('data-copy-film'), 'the copy control reuses the existing copy() helper and fallback');
  assert.ok(page.includes('void copy(filmEmbedText,'), 'copy uses the shared clipboard/fallback function');
  assert.ok(page.includes('<template data-film-template>'), 'the pasted fragment is only demoed inside an inert template');
});

test('the preview captions are the committed English VTT served from this origin', async () => {
  const committed = await readFile('public/brand/campaign/take-it-with-you-20261118.vtt', 'utf8');
  assert.equal(filmCaptionSrc, '/brand/campaign/take-it-with-you-20261118.vtt');
  assert.equal(captionText, committed, 'the preview track and the inlined starter captions are the same cues');
  assert.ok(!filmCaptionSrc.startsWith('data:'), 'the live preview needs no data: media source');
});

test('the native film recipe carries the exact published source and install fragment', async () => {
  const response = await getRecipe();
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="take-it-with-you-v1.json"');
  const body = await response.text();
  assert.equal(body, filmRecipeJson);
  const recipe = JSON.parse(body);
  assert.equal(recipe.schema, 'app-composer/widget-film');
  assert.equal(recipe.version, 1);
  assert.equal(recipe.installation.embedHtml, filmEmbedFragment);
  assert.deepEqual(recipe.source.video, { url: videoUrl, mime: 'video/mp4', sha256: videoSha256 });
  assert.deepEqual(recipe.installation.contentSecurityPolicy, {
    'img-src': [posterUrl], 'media-src': [videoUrl, 'data:'],
  });
  assert.equal(filmRecipe.source.captions.sha256, createHash('sha256').update(captionText).digest('hex'));
});
