import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the owner-selected campaign leads into Studio, the app library, Linkarooie and Share', () => {
  const home = readSource('../src/components/ProductHome.astro');
  const opening = home.slice(home.indexOf('<section class="home-opening'), home.indexOf('<section class="home-miniapps'));
  assert.ok(opening.includes('/brand/campaign/build-it-keep-it-running.png'));
  for (const href of ['/media-studio/studio', '/apps', '/showcase/', '/share']) assert.ok(opening.includes('href="' + href + '"'));
  assert.doesNotMatch(opening, /PostcardDesk|guestbook|fighter|orbital/i);
  assert.ok(home.includes('href="/projects">Other projects'));
  assert.ok(home.includes('id="make-something"') && home.includes('id="example"'));
  assert.ok(readSource('../src/pages/demo/postcards/edit.astro').includes('<PostcardDesk />'));
});

test('the workshop and captioned commercial remain reachable through Demos', () => {
  const demo = readSource('../src/pages/demo.astro');
  assert.match(demo, /href="\/demo\/workshop"/);
  assert.match(demo, /id="commercial"[\s\S]*?<track kind="captions"[\s\S]*?Read the transcript/);
  const workshop = readSource('../src/pages/demo/workshop.astro');
  assert.match(workshop, /id="workshop-heading"[\s\S]*?data-studio-static/);
  assert.match(readSource('../src/pages/media-studio/direct.astro'), /href: "\/demo#commercial"/);
});

test('the shared header leads with Learn, keeps setup under More and preserves mobile and app navigation', () => {
  const base = readFileSync(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
  const nav = base.slice(base.indexOf('<nav class="site-navigation"'), base.indexOf('</nav>'));
  const peers = [...nav.matchAll(/class="nav-direct" href="([^"]+)">([^<]+)<\/a>/g)].map((m) => `${m[2]}:${m[1]}`);
  assert.deepEqual(peers, ['Learn:/learn', 'Demos:/demo', 'Media Studio:/media-studio'], 'Learn leads the desktop peers');
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
  assert.match(nav, /<p class="site-menu-heading">Explore<\/p>[\s\S]*?<a href="\/projects">Other projects<\/a>/);
  assert.match(nav, /<div class="site-menu-resources">[\s\S]*?<a href="\/docs">Documentation<\/a>/);
});
