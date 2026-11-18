import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const readSource = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the opening leads with owned software and a real Studio project', () => {
  const home = readSource('../src/components/ProductHome.astro');
  const first = home.slice(home.indexOf('class="home-opening"'), home.indexOf('class="home-portfolio'));
  assert.match(first, /App Composer brings your AI agent, reusable apps and creative tools together/);
  assert.match(first, /publish in your own accounts/);
  assert.match(first, /href="\/learn">Build your first app/);
  assert.match(first, /href="\/demo">Try the sandbox/);
  assert.match(first, /href="\/media-studio#fighter-after-hours"/);
  assert.match(first, /fighter-before-the-bell/);
  assert.doesNotMatch(home, /guestbook-20261111|foilbury-launch-palette|data-studio-stage/);

  const studio = readSource('../src/pages/media-studio.astro');
  assert.match(studio, /id="fighter-after-hours"[\s\S]*?fighter-after-hours-20261115\.mp4/);
});

test('portfolio projects lead into the supported build journey', () => {
  const home = readSource('../src/components/ProductHome.astro');
  assert.ok(home.indexOf('class="home-portfolio') < home.indexOf('id="make-something"'));
  assert.match(home, /id: "foilbury"/);
  assert.match(home, /id: "shoalshot"/);
  assert.match(home, /Loftwah portfolio/);
  assert.match(home, /href="\/architecture#project-workspace"/);
  assert.match(home, /id="example"[\s\S]*?href="\/creator-hub"/);
  assert.match(home, /href: "\/creator-hub#follow-up"/);
  assert.match(home, /href="\/agent"/);

  const architecture = readSource('../src/pages/architecture.astro');
  assert.match(architecture, /id="project-workspace"[\s\S]*?href="\/release"/);
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
