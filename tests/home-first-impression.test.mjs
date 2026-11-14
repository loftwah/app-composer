import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('the opening explains the product and routes to preparation before the fictional demo', () => {
  const home=readFileSync(new URL('../src/components/ProductHome.astro',import.meta.url),'utf8');
  const opening=home.indexOf('class="home-opening"');
  const steps=home.indexOf('id="make-something"');
  const workshop=home.indexOf('class="studio-hero"');
  assert.ok(opening>=0 && opening<steps && steps<workshop);
  const first=home.slice(opening,steps);
  assert.match(first,/Build an app[\s\S]*you own/);
  assert.match(first,/App Composer[\s\S]*AI agent[\s\S]*Cloudflare/);
  assert.match(first,/href="\/ready">Get started/);
  assert.match(first,/href="#make-something">See how it works/);
  assert.match(home,/id="workshop-heading"[\s\S]*fictional workshop/);
});
