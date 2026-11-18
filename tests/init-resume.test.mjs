import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSpec } from '../src/lib/spec.mjs';
import { selectedSources } from '../src/lib/app-settings.mjs';
import { INIT_DRAFT_KEY, savedInitDraftTitle } from '../src/lib/init-resume.mjs';

const saved = (title = 'Fictional Resume Check') => JSON.stringify(validateSpec({
  version: 2,
  preset: 'composition',
  sources: selectedSources(['guestbook', 'showcase']),
  config: { title, intro: 'Only synthetic fixtures', theme: 'daylight', layout: 'grid' },
  privacy: 'review-first',
  cards: [],
  deployment: { mode: 'preview', hostname: '' },
  decisions: {},
}));

test('a real saved Init draft produces a readable resume title', () => {
  assert.equal(INIT_DRAFT_KEY, 'composer:init:v1');
  assert.equal(savedInitDraftTitle(saved()), 'Fictional Resume Check');
  // The same key and validator Init uses: a spec that Init can load is resumable.
  assert.equal(savedInitDraftTitle(saved('Another fictional brief')), 'Another fictional brief');
});

test('no resume title is produced for an absent, malformed or unusable draft', () => {
  for (const raw of [null, undefined, '', 'not json', '{}', '{"config":{"title":"x"}}', JSON.stringify({ version: 99, config: { title: 'x' } })]) {
    assert.equal(savedInitDraftTitle(raw), null, String(raw));
  }
  // A valid draft with no readable title cannot promise a named continuation.
  const untitled = JSON.parse(saved());
  delete untitled.config.title;
  assert.equal(savedInitDraftTitle(JSON.stringify(untitled)), null);
});

test('Learn exposes only a same-origin resume link gated by the saved draft', () => {
  const page = readFileSync(new URL('../src/pages/learn.astro', import.meta.url), 'utf8');
  assert.match(page, /data-init-resume hidden/);
  assert.match(page, /<a href="\/init" data-init-resume-link>/);
  assert.match(page, /localStorage\.getItem\(INIT_DRAFT_KEY\)/);
  assert.match(page, /savedInitDraftTitle\(/);
  // The title stays on this origin: no cross-origin destination is authored.
  assert.doesNotMatch(page, /data-init-resume[\s\S]{0,300}https?:\/\//);
  // No synthetic progress or second project list is introduced.
  assert.doesNotMatch(page, /data-init-resume[\s\S]{0,300}<progress/);
});
