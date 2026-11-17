import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the opening names App Composer, offers one first action and links to the project architecture', () => {
  const home = readFileSync(new URL('../src/components/ProductHome.astro', import.meta.url), 'utf8');
  const opening = home.indexOf('class="home-opening"');
  const steps = home.indexOf('id="make-something"');
  const proof = home.indexOf('id="example"');
  const workshop = home.indexOf('class="studio-hero"');
  assert.ok(opening >= 0 && opening < proof && proof < steps && steps < workshop);
  const first = home.slice(opening, proof);
  assert.match(first, /App Composer is open source/);
  assert.match(first, /href="\/learn">Build your first app/);
  assert.match(first, /href="#example">Follow a real project/);
  assert.match(home.slice(steps, workshop), /Get Ready is the setup step/);
  assert.match(first, /href="\/architecture#project-workspace"/);
  const architecture = readFileSync(new URL('../src/pages/architecture.astro', import.meta.url), 'utf8');
  assert.match(architecture, /id="project-workspace"[\s\S]*?href="\/release"/);
  assert.doesNotMatch(first, /href="\/ready"[^>]*>Get started/);
});

test('the opening explains what App Composer connects and how to act', () => {
  const home = readFileSync(new URL('../src/components/ProductHome.astro', import.meta.url), 'utf8');
  const opening = home.indexOf('class="home-opening"');
  const proof = home.indexOf('id="example"');
  const first = home.slice(opening, proof);
  const lede = first.match(/<h1[\s\S]*?<\/h1>\s*<p>([\s\S]*?)<\/p>/);
  assert.ok(lede, 'the opening has one paragraph after the heading');
  assert.match(lede[1], /connects your AI agent, reusable apps, creative tools/);
  assert.match(lede[1], /build, test and publish/);
  assert.match(lede[1], /own accounts, where you can keep improving it/);
  // One button plus one in-page proof link; the trial app is explained in the
  // setup note rather than offered as a third peer action.
  const actions = first.slice(
    first.indexOf('class="home-opening-actions"'),
    first.indexOf('class="home-opening-note"'),
  );
  assert.equal(actions.match(/<a\b/g)?.length, 2, 'the action row has two links');
  assert.doesNotMatch(actions, /<a class="studio-text-link" href="\/demo"/);
  assert.match(first, /href="\/demo">try a demo/);
});

test('the real example shows the owned app and its later change before the fictional workshop', () => {
  const home = readFileSync(new URL('../src/components/ProductHome.astro', import.meta.url), 'utf8');
  const proof = home.indexOf('id="example"');
  const workshop = home.indexOf('class="studio-hero"');
  const example = home.slice(proof, workshop);
  assert.match(example, /one Init brief into two connected/);
  assert.match(example, /href="\/creator-hub#brief"/);
  assert.match(example, /href="\/creator-hub#live"/);
  assert.match(example, /featured two links on the same site/);
  assert.match(example, /href="\/projects\?example=creative-handoff#creative-handoff"/);
  const projects = readFileSync(new URL('../src/pages/projects.astro', import.meta.url), 'utf8');
  assert.match(projects, /searchParams.get\("example"\) === "creative-handoff"[\s\S]*?id="creative-handoff"/);
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
