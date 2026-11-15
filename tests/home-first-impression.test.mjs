import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the opening names App Composer, offers one first action and explains Get Ready as setup', () => {
  const home = readFileSync(new URL('../src/components/ProductHome.astro', import.meta.url), 'utf8');
  const opening = home.indexOf('class="home-opening"');
  const steps = home.indexOf('id="make-something"');
  const proof = home.indexOf('id="example"');
  const workshop = home.indexOf('class="studio-hero"');
  assert.ok(opening >= 0 && opening < steps && steps < proof && proof < workshop);
  const first = home.slice(opening, steps);
  assert.match(first, /home-opening-eyebrow">App Composer/);
  assert.match(first, /Build an app[\s\S]*you own/);
  assert.match(first, /href="\/learn">Build your first app/);
  assert.match(first, /href="#example">See a real example/);
  assert.match(first, /Get Ready is the setup step/);
  assert.doesNotMatch(first, /href="\/ready"[^>]*>Get started/);
});

test('the real example shows the owned app and its later change before the fictional workshop', () => {
  const home = readFileSync(new URL('../src/components/ProductHome.astro', import.meta.url), 'utf8');
  const proof = home.indexOf('id="example"');
  const workshop = home.indexOf('class="studio-hero"');
  const example = home.slice(proof, workshop);
  assert.match(example, /Mara’s Creator Hub is two live apps/);
  assert.match(example, /changed the existing profile/);
  assert.match(example, /href="\/creator-hub#follow-up"/);
  assert.match(example, /fictional owner/);
  assert.match(home, /id="workshop-heading"[\s\S]*fictional workshop/);
});
