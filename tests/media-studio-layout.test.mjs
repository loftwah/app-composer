import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { fileURLToPath } from 'node:url';

// The Media Studio article and tutorial are the two long-form pages where wide
// captures break out of the prose measure. Both defects this file guards were
// only visible on wide desktop viewports: a leftover `translateX(-50%)` pushed
// the narrow figure half its own width to the left, and a shared `height:100%`
// with `object-fit:cover` cropped the before/after pair to a different zoom.
// The pages also used private token names that never resolved, so captions and
// hairlines fell back to dark-theme values and disappeared in light mode.

const readPage = (name) =>
  fs.readFileSync(fileURLToPath(new URL(`../src/pages/${name}`, import.meta.url)), 'utf8');

const styleBlock = (name) => {
  const match = readPage(name).match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(match, `${name} has no style block`);
  return match[1];
};

const declarations = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing rule: ${selector}`);
  return match[1].replace(/\s+/g, '');
};

const compact = (value) => value.replace(/\s+/g, '');

test('the wide article capture keeps its breakout and the narrow variant opts out of it', () => {
  const css = styleBlock('media-studio.astro');
  const wide = declarations(css, '.figure');
  assert.match(wide, /width:min\(1040px,calc\(100vw-48px\)\)/);
  assert.match(wide, /margin-left:50%/);
  assert.match(wide, /transform:translateX\(-50%\)/);

  // Without the reset the transform shifts a centred narrow figure by half its
  // width, which hung it off the left edge of the page.
  const narrow = declarations(css, '.figure.narrow');
  assert.match(narrow, /transform:none/);
  assert.match(narrow, /margin-left:auto/);
  assert.match(narrow, /margin-right:auto/);
  assert.match(narrow, /max-width:760px/);
  assert.doesNotMatch(narrow, /translateX/);
});

test('the before/after pair keeps both real aspect ratios and a shared caption baseline', () => {
  const css = styleBlock('media-studio.astro');
  assert.match(declarations(css, '.figure.pair'), /display:grid/);

  const image = declarations(css, '.figure.pair img');
  assert.match(image, /height:auto/);
  assert.doesNotMatch(image, /height:100%/);
  assert.doesNotMatch(image, /object-fit:cover/);

  assert.match(declarations(css, '.figure.pair>div'), /display:flex/);
  assert.match(declarations(css, '.figure.pair figcaption'), /margin-top:auto/);
});

test('article and tutorial bind their short token names to real theme tokens', () => {
  for (const [name, selector] of [
    ['media-studio.astro', '.art'],
    ['media-studio/tutorial.astro', '.tut'],
  ]) {
    const rule = compact(declarations(styleBlock(name), selector));
    assert.match(rule, /--muted:var\(--color-muted,/, `${selector} must resolve --muted`);
    assert.match(rule, /--line:var\(--color-border,/, `${selector} must resolve --line`);
    assert.match(rule, /--accent:var\(--color-accent,/, `${selector} must resolve --accent`);
  }
});

test('the article keeps its figures inside the viewport at MacBook Pro widths', () => {
  // A cheap source-level guard for the arithmetic, not a replacement for the
  // rendered check: at >=1101px the breakout is capped by the viewport and at
  // or below the breakpoint every figure falls back to the full prose width.
  const css = styleBlock('media-studio.astro');
  const wide = declarations(css, '.figure');
  const cap = wide.match(/width:min\((\d+)px,calc\(100vw-(\d+)px\)\)/);
  assert.ok(cap, 'wide figure must cap against the viewport');
  const [, fixed, gutter] = cap.map(Number);
  assert.ok(fixed > 0 && gutter >= 0);
  for (const viewport of [1101, 1280, 1440, 1512, 1728, 2560]) {
    assert.ok(Math.min(fixed, viewport - gutter) <= viewport, `figure overflows at ${viewport}px`);
  }
  const breakpoint = css.match(/@media\s*\(max-width:\s*(\d+)px\)\s*\{[\s\S]*?\.figure\{[^}]*width:100%/);
  assert.ok(breakpoint, 'the narrow-viewport reset must collapse figures to the prose width');
  assert.equal(Number(breakpoint[1]), 1100);
});
