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

test('the first paragraph says who it is for and the hero offers one first action', () => {
  const home = readFileSync(new URL('../src/components/ProductHome.astro', import.meta.url), 'utf8');
  const opening = home.indexOf('class="home-opening"');
  const steps = home.indexOf('id="make-something"');
  const first = home.slice(opening, steps);
  const lede = first.match(/<h1[\s\S]*?<\/h1>\s*<p>([\s\S]*?)<\/p>/);
  assert.ok(lede, 'the opening has one paragraph after the heading');
  assert.match(lede[1], /is for anyone who needs a small app/);
  assert.match(lede[1], /the AI agent you choose builds it in your Cloudflare account/i);
  assert.match(lede[1], /your source and data stay yours/);
  // One button plus one in-page proof link; the trial app is explained in the
  // setup note rather than offered as a third peer action.
  const actions = first.slice(
    first.indexOf('class="home-opening-actions"'),
    first.indexOf('class="home-opening-note"'),
  );
  assert.equal(actions.match(/<a\b/g)?.length, 2, 'the action row has two links');
  assert.doesNotMatch(actions, /<a class="studio-text-link" href="\/demo"/);
  assert.match(first, /No app idea or agent\s+is needed to start[\s\S]*href="\/demo">try a working app in your browser/);
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

test('the closing action is the same first step as the opening, not a second start', () => {
  const home = readFileSync(new URL('../src/components/ProductHome.astro', import.meta.url), 'utf8');
  const next = home.slice(home.indexOf('class="home-next"'));
  assert.match(next, /class="next-actions"[\s\S]*?href="\/learn">[\s\S]*?Build your first app/);
  assert.doesNotMatch(next, /href="\/ready"/);
  assert.match(next, /Point your existing agent here/);
});

test('the shared header leads with Learn, keeps setup under More and preserves mobile and app navigation', () => {
  const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  const nav = base.slice(base.indexOf('<nav class="site-navigation"'), base.indexOf('</nav>'));
  const peers = [...nav.matchAll(/class="nav-direct" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => `${m[2]}:${m[1]}`);
  assert.deepEqual(peers, ['Learn:/learn', 'Demos:/demo', 'Projects:/projects'], 'Learn leads the desktop peers');
  assert.equal([...nav.matchAll(/href="\/ready"/g)].length, 1, 'one setup link in the shared navigation');

  assert.match(
    nav,
    /<p class="site-menu-heading">Build &amp; manage<\/p>\s*<a href="\/ready">Get Ready<\/a>/,
    'setup stays reachable under More on desktop',
  );
  assert.match(
    nav,
    /<div class="site-menu-quick compact-only">[\s\S]*?<a href="\/learn">Learn<\/a>[\s\S]*?<a href="\/demo">Demos<\/a>[\s\S]*?<\/div>/,
    'mobile quick links keep Learn and Demos',
  );

  // Namespace, launcher and the rest of the More menu keep their existing routes.
  assert.match(base, /class="instance-brand-context"/);
  assert.match(base, /Astro\.props\.launcher !== false && <AppLauncher \/>/);
  assert.match(nav, /<p class="site-menu-heading">Explore<\/p>[\s\S]*?<a href="\/projects">Project family<\/a>/);
  assert.match(nav, /<div class="site-menu-resources">[\s\S]*?<a href="\/docs">Documentation<\/a>/);
});
