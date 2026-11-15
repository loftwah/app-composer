import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildingQuickStart,
  creatorHubQuickStart,
  firstAppQuickStart,
  launchKitQuickStart,
  mediaStudioQuickStart,
  paperworkQuickStart,
} from '../src/lib/tutorial-quick-start.mjs';
import { copyTutorialPrompt } from '../src/lib/tutorial-copy.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const placeholder = /\b(?:TODO|TBD|FIXME|XXX)\b|lorem ipsum|\{\{[^}]*\}\}|<(?:your|insert)[^>]*>|\[(?:your|insert|todo)\b/i;

// The routes documented in docs/tutorial-quick-starts.md as covered tutorials.
const covered = [
  'src/pages/building.astro',
  'src/pages/creator-hub.astro',
  'src/pages/launch-kit.astro',
  'src/pages/learn.astro',
  'src/pages/media-studio.astro',
  'src/pages/media-studio/tutorial.astro',
  'src/pages/paperwork.astro',
];

const guides = {
  firstAppQuickStart,
  mediaStudioQuickStart,
  buildingQuickStart,
  creatorHubQuickStart,
  paperworkQuickStart,
  launchKitQuickStart,
};

test('every tutorial copy surface keeps its quick start and copies the exact visible prompt', async () => {
  // A tutorial cannot quietly gain or lose the shared quick start: the rendered
  // routes and the documented inventory have to match exactly.
  const pagesRoot = fileURLToPath(new URL('../src/pages', import.meta.url));
  const rendered = readdirSync(pagesRoot, { recursive: true })
    .filter((entry) => entry.endsWith('.astro'))
    .map((entry) => `src/pages/${entry}`)
    .filter((path) => read(path).includes('TutorialQuickStart'));
  assert.deepEqual(rendered.sort(), [...covered].sort(), 'the documented tutorial inventory matches the pages that render the quick start');

  // Every real prompt is complete, placeholder-free and copied byte-for-byte.
  for (const [name, guide] of Object.entries(guides)) {
    for (const prompt of guide.prompts) {
      assert.ok(prompt.text.trim().length >= 500, `${name}/${prompt.id} is complete enough to paste into an agent`);
      assert.doesNotMatch(prompt.text, placeholder, `${name}/${prompt.id} contains no placeholder token`);
      let written = null;
      assert.equal(await copyTutorialPrompt(prompt.text, async (value) => { written = value; }), 'copied');
      assert.equal(written, prompt.text, `${name}/${prompt.id} copies exactly the panel text`);
      assert.equal(await copyTutorialPrompt(prompt.text, async () => { throw new Error('NotAllowedError'); }), 'manual');
      assert.equal(await copyTutorialPrompt(prompt.text, undefined), 'manual');
    }
  }

  // Both tutorial copy surfaces keep the same promised fallback when the
  // Clipboard API is denied: select the visible text, focus it, announce it.
  for (const [name, source] of [
    ['TutorialQuickStart', read('src/components/TutorialQuickStart.astro')],
    ['learn tutorial client', read('src/lib/tutorial-client.ts')],
  ]) {
    assert.match(source, /copyTutorialPrompt\(/, `${name} uses the tested copy outcomes`);
    assert.match(source, /selectNodeContents\(/, `${name} selects the visible text on denial`);
    assert.match(source, /focus\(\{\s*preventScroll:\s*true\s*\}\)/, `${name} moves focus to the selected text`);
    assert.match(source, /dataset\.state/, `${name} records the announced outcome`);
  }

  const learn = read('src/pages/learn.astro');
  assert.equal(learn.split('<TutorialQuickStart').length - 1, 1, '/learn renders one shared quick start');
  assert.match(learn, /role="status" data-copy-status=/, '/learn keeps a visible, announced copy status');
  const lessonRequests = [...learn.matchAll(/data-copy-prompt="([a-z-]+)"/g)].map((match) => match[1]);
  assert.ok(lessonRequests.length >= 7, '/learn keeps its lesson-level requests below the quick start');
  for (const id of lessonRequests) {
    assert.ok(learn.includes(`data-agent-prompt="${id}"`), `/learn lesson request ${id} has visible text to copy`);
    assert.ok(learn.includes(`data-copy-status="${id}"`), `/learn lesson request ${id} has its own status message`);
  }
});
