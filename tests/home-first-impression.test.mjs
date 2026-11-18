import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Composer and its connected mini apps lead the homepage', () => {
  const home = readSource('../src/components/ProductHome.astro');
  const opening = readSource('../src/components/PostcardDesk.astro');
  assert.ok(home.indexOf('<PostcardDesk />') < home.indexOf('class="home-miniapps'));
  assert.ok(opening.includes('href="/demo/connected-apps">Keep building'));
  assert.ok(opening.includes('href="/demo/postcards">Open my page'));
  assert.ok(opening.includes('<PostcardPrint priority'));
  assert.ok(home.includes('href="/learn">Build your first app'));
  const sections = ['class="home-miniapps', 'class="home-creative', 'id="make-something"', 'href="/projects">Other projects'];
  const positions = sections.map(section => home.indexOf(section));
  assert.ok(positions.every((value, index) => value >= 0 && (!index || value > positions[index - 1])));
  assert.ok(home.includes('app.id === "guestbook" || app.id === "showcase"'));
  assert.ok(home.includes('href="/media-studio"') && home.includes('href="/share"'));
  assert.doesNotMatch(home, /fighter|foilbury|shoalshot/i);
  assert.match(home, /id="example"[\s\S]*?href="\/creator-hub"/);
  assert.match(home, /href="\/architecture#project-workspace"/);
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
