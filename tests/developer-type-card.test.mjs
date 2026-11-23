import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  personaCardFormats, personaCardLayout, resultSizes,
} from '../src/browser/share-experience-image.ts';
import {
  developerTypeCardCopy, developerTypeCardCredit,
} from '../src/lib/developer-type-card.ts';
import {
  cloudflarePersonaIds, cloudflarePersonaOutcomeFromHash,
} from '../src/lib/cloudflare-persona.ts';

// The #1071 downloadable Developer Type card: one trusted outcome, three
// print formats and no private run data. The played journey, exact PNG
// dimensions/bytes and visual QA are inspected in the browser by the parent
// release; these checks cover the renderer's own bounds and printable copy.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the card offers exactly square, portrait and Story at the established sizes', () => {
  assert.deepEqual([...personaCardFormats], ['square', 'portrait', 'story']);
  const expected = {
    square: [1080, 1080],
    portrait: [1080, 1350],
    story: [1080, 1920],
  };
  for (const format of personaCardFormats) {
    const layout = personaCardLayout(format);
    assert.deepEqual([layout.width, layout.height], expected[format], `${format} is its exact canvas`);
    assert.deepEqual([layout.width, layout.height], resultSizes[format], `${format} reuses the shared sizes`);
  }
  assert.ok(!personaCardFormats.includes('wide'), 'the link-preview size is not offered');
});

test('format bounds keep type inside the margin and, for Story, inside its chrome', () => {
  for (const format of personaCardFormats) {
    const layout = personaCardLayout(format);
    assert.ok(layout.margin >= 64, `${format} keeps a readable margin`);
    assert.equal(layout.innerWidth, layout.width - layout.margin * 2);
    assert.equal(layout.contentTop, layout.margin + layout.safeTop);
    assert.ok(layout.contentTop >= layout.margin);
    assert.ok(layout.contentBottom > layout.contentTop + 400, `${format} has room for the outcome`);
    assert.ok(layout.footer > layout.contentBottom, `${format} leaves a credit strip`);
    assert.ok(layout.footer + 42 <= layout.height - layout.safeBottom, `${format} sign-off clears its safe bottom`);
    assert.ok(
      layout.displaySize > layout.serviceSize
      && layout.serviceSize > layout.bodySize
      && layout.bodySize > layout.noteSize
      && layout.noteSize > layout.creditSize,
      `${format} keeps an obvious type hierarchy`,
    );
  }

  const square = personaCardLayout('square');
  assert.equal(square.safeTop, 0);
  assert.equal(square.safeBottom, 0);

  const portrait = personaCardLayout('portrait');
  assert.equal(portrait.safeTop, 0);
  assert.equal(portrait.safeBottom, 0);

  const story = personaCardLayout('story');
  assert.equal(story.safeTop, Math.round(1920 * .13));
  assert.equal(story.safeBottom, Math.round(1920 * .17));
  assert.ok(story.contentTop >= story.safeTop, 'Story content starts below the profile row');
  assert.ok(story.contentBottom <= story.height - story.safeBottom, 'Story content ends above the reply bar');
});

test('every built-in outcome prints only its public label copy', () => {
  for (const id of cloudflarePersonaIds) {
    const copy = developerTypeCardCopy(id);
    assert.deepEqual(Object.keys(copy).sort(), ['archetype', 'reason', 'service', 'tendency']);
    assert.ok(copy.archetype.startsWith('The '), `${id} has an archetype`);
    assert.ok(copy.service.length > 0, `${id} names a service`);
    const text = Object.values(copy).join(' ');
    assert.ok(!/https?:|#result|developers\.cloudflare\.com/i.test(text), `${id} carries no address`);
  }
  assert.match(developerTypeCardCopy('workers').service, /Workers®/);
  assert.match(developerTypeCardCopy('durable-objects').service, /Durable Objects™/);
  assert.match(developerTypeCardCopy('workers-ai').service, /Workers AI®/);
  assert.ok(!/https?:|developers\.cloudflare\.com|#result/i.test(developerTypeCardCredit));
});

test('a trusted outcome link and the authored outcome print the same card copy', () => {
  for (const id of cloudflarePersonaIds) {
    const fromLink = cloudflarePersonaOutcomeFromHash(`#result=${id}`);
    assert.equal(fromLink, id, `${id} is the only outcome a shared link names`);
    assert.deepEqual(developerTypeCardCopy(fromLink), developerTypeCardCopy(id));
  }
});

test('the renderer never receives an answer, score, session or quiz link', () => {
  const source = read('src/browser/share-experience-image.ts');
  const start = source.indexOf('export async function renderPersonaCard');
  assert.ok(start > 0, 'the persona renderer exists');
  const renderer = source.slice(start);
  for (const forbidden of ['answers', 'score', 'session', 'resultPath', '#result', 'href']) {
    assert.ok(!renderer.includes(forbidden), `the card renderer does not print ${forbidden}`);
  }
  // composer.loftwah.com is the one address every card signs off with.
  assert.ok(source.includes('composer.loftwah.com'));
});

test('the export panel previews the same card it saves', () => {
  const component = read('src/components/share-experiences/ShareExperience.astro');
  assert.match(component, /data-persona-preview/);
  assert.match(component, /isCloudflare \? "Prepare card"/);
  assert.match(component, /data-download[^>]*isCloudflare/);
});

test('a prepared card copies the exact preview Blob beside a retained Save PNG fallback', () => {
  const source = read('src/browser/share-experiences.ts');
  assert.match(source, /const imageClipboard = typeof navigator\.clipboard\?\.write === "function" && typeof ClipboardItem === "function"/);
  assert.match(source, /if \(copyPng && !imageClipboard\) copyPng\.hidden = true/);

  const start = source.indexOf('if (personaOutcome) {');
  assert.ok(start > 0, 'the persona card export exists');
  const block = source.slice(start, source.indexOf('if (cardDownloads) {', start));
  assert.match(block, /Save \$\{cardFormat\} PNG/, 'the visible Save PNG link stays');
  assert.match(block, /copyButton\.textContent = "Copy PNG"/);
  assert.match(block, /if \(imageClipboard\)/, 'the same image clipboard capability gates the button');
  assert.match(block, /new ClipboardItem\(\{ "image\/png": blob \}\)/, 'the prepared PNG Blob is copied');
  assert.match(block, /navigator\.clipboard\.write/);
  assert.equal((block.match(/renderPersonaCard\(/g) ?? []).length, 1, 'only the preview Blob is rendered');
  const handler = block.slice(block.indexOf('copyButton.addEventListener'));
  assert.doesNotMatch(handler, /renderPersonaCard\(/, 'copying never renders a fresh image');
  assert.match(block, /version !== personaVersion/, 'a cleared or changed card cannot be copied');
  assert.match(block, /Card image copied/, 'success wording uses the card status');
  assert.match(block, /Use Save PNG/, 'fallback wording keeps the visible Save link');
});
