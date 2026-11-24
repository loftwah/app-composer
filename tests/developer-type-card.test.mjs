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

// The optional participant photo: one local picker in the published card
// controls, the same centre-cropped circle in all three formats, and no share
// path at all. The played journey, exact PNG pixels and visual QA are inspected
// in the browser by the parent release.
test('the card offers one local photo picker with a clear removal', () => {
  const component = read('src/components/share-experiences/ShareExperience.astro');
  const start = component.indexOf('{persona && <div class="persona-avatar"');
  assert.ok(start > 0, 'the photo controls sit inside the persona export panel');
  const avatarBlock = component.slice(start, component.indexOf('</div>}', start));
  assert.equal((avatarBlock.match(/data-persona-avatar-file/g) ?? []).length, 1, 'exactly one local picker');
  assert.match(avatarBlock, /type="file" accept="image\/png,image\/jpeg,image\/webp" data-persona-avatar-file/);
  assert.match(avatarBlock, /data-persona-avatar-pick>Add a photo/);
  assert.match(avatarBlock, /data-persona-avatar-remove hidden>Remove photo/, 'removal is an explicit control');
  assert.match(avatarBlock, /id="persona-avatar-note"[^>]*>Optional:/);
  assert.doesNotMatch(avatarBlock, /type="url"|inputmode="url"/, 'there is no address field');
  const download = component.indexOf('data-download', start);
  assert.ok(download > start && download < component.indexOf('</section>', start), 'the picker precedes download in the same panel');
});

test('the avatar circle uses shared layout bounds and is drawn only when chosen', () => {
  const source = read('src/browser/share-experience-image.ts');
  const start = source.indexOf('export async function renderPersonaCard');
  const renderer = source.slice(start);
  const guarded = renderer.slice(renderer.indexOf('if (options.avatar) {'), renderer.indexOf('return new Promise'));
  assert.ok(guarded.length > 0, 'the avatar drawing is one guarded block');
  assert.equal(
    (renderer.match(/options\.avatar/g) ?? []).length,
    (guarded.match(/options\.avatar/g) ?? []).length,
    'every avatar use is inside the chosen-photo guard',
  );
  assert.match(renderer, /if \(options\.avatar\) \{/);
  assert.match(renderer, /coverBox\(options\.avatar\.width, options\.avatar\.height, size, size, "cover"\)/);
  assert.match(renderer, /ctx\.arc\(centreX, centreY, size \/ 2/);
  assert.match(renderer, /ctx\.clip\(\)/);

  for (const format of personaCardFormats) {
    const layout = personaCardLayout(format);
    assert.ok(layout.avatarY >= layout.contentTop, `${format} circle stays below the rule`);
    assert.ok(
      layout.avatarY + layout.avatarSize <= layout.contentTop + 62,
      `${format} circle clears the headline that starts 62px below the rule`,
    );
    assert.equal(layout.avatarX + layout.avatarSize, layout.width - layout.margin, `${format} right-aligns inside the margin`);
    assert.ok(layout.avatarX - layout.margin > 300, `${format} circle clears the tracked label`);
    assert.ok(layout.footer > layout.contentBottom + layout.avatarSize, `${format} credit and byline stay in their strip`);
  }
});

test('one render carries the chosen photo and stale files never land', () => {
  const source = read('src/browser/share-experiences.ts');
  assert.match(source, /async function readCardPhoto\(file: File\)/);
  assert.match(source, /coverFileLimit/);
  assert.match(source, /sniffCover\(head\)/);
  assert.match(source, /coverPixelLimit/);
  assert.match(source, /URL\.createObjectURL\(file\)/);
  assert.match(source, /URL\.revokeObjectURL\(url\)/);
  assert.match(source, /if \(run !== avatarAttempt\)/, 'a slower earlier file is dropped');
  assert.match(source, /avatarAttempt \+= 1/, 'removal and result changes invalidate it');
  assert.match(source, /avatar: cardAvatar\?\.art \?\? null/, 'the one prepared render receives the photo');

  const render = source.slice(source.indexOf('if (personaOutcome) {'), source.indexOf('if (cardDownloads) {'));
  assert.equal((render.match(/renderPersonaCard\(/g) ?? []).length, 1, 'preview, Save and Copy share one PNG');
  assert.match(render, /const blob = await renderPersonaCard/);
  assert.match(render, /new ClipboardItem\(\{ "image\/png": blob \}\)/);

  const snapshot = source.slice(
    source.indexOf('const result = (): ShareExperienceResult | null =>'),
    source.indexOf('const resultLink ='),
  );
  assert.doesNotMatch(snapshot, /avatar/i, 'the photo never enters the result snapshot');
  assert.doesNotMatch(source.slice(source.indexOf('const resultLink ='), source.indexOf('const offerManualCopy =')), /avatar/i, 'the photo never enters a link');
});
