import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { fileURLToPath } from "node:url";

// These source-level contracts complement rendered desktop and phone checks.
// They protect the reading-column alignment, uncropped comparisons and theme tokens.

const readPage = (name) =>
  fs.readFileSync(
    fileURLToPath(new URL(`../src/pages/${name}`, import.meta.url)),
    "utf8",
  );

const styleBlock = (name) => {
  const match = readPage(name).match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(match, `${name} has no style block`);
  return match[1];
};

const declarations = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`),
  );
  assert.ok(match, `missing rule: ${selector}`);
  return match[1].replace(/\s+/g, "");
};

const compact = (value) => value.replace(/\s+/g, "");

test("article figures and lead image follow the reading column", () => {
  const css = styleBlock("media-studio.astro");
  for (const selector of [".art-hero-copy", ".art-hero-figure", ".contents", ".prose"]) {
    assert.match(declarations(css, selector), /max-width:74ch/, `${selector} should share the reading measure`);
  }
  assert.match(declarations(css, ".art-hero"), /grid-template-columns:minmax\(0,1fr\)minmax\(0,1fr\)/);
  assert.match(declarations(css, ".art-hero-figure"), /width:100%/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.art-hero\{grid-template-columns:minmax\(0,1fr\)/);
  const figure = declarations(css, ".figure");
  assert.match(figure, /width:100%/);
  assert.doesNotMatch(figure, /translateX|margin-left:50%/);
  const films = declarations(css, ".films");
  assert.match(films, /width:100%/);
  assert.doesNotMatch(films, /translateX|margin-left:50%/);
});

test("the before/after pair keeps both real aspect ratios and a shared caption baseline", () => {
  const css = styleBlock("media-studio.astro");
  assert.match(declarations(css, ".figure.pair"), /display:grid/);

  const image = declarations(css, ".figure.pair img");
  assert.match(image, /height:auto/);
  assert.doesNotMatch(image, /height:100%/);
  assert.doesNotMatch(image, /object-fit:cover/);

  assert.match(declarations(css, ".figure.pair>div"), /display:flex/);
  assert.match(declarations(css, ".figure.pair figcaption"), /margin-top:auto/);
});

test("article and tutorial bind their short token names to real theme tokens", () => {
  for (const [name, selector] of [
    ["media-studio.astro", ".art"],
    ["media-studio/tutorial.astro", ".tut"],
  ]) {
    const rule = compact(declarations(styleBlock(name), selector));
    assert.match(
      rule,
      /--muted:var\(--color-muted,/,
      `${selector} must resolve --muted`,
    );
    assert.match(
      rule,
      /--line:var\(--color-border,/,
      `${selector} must resolve --line`,
    );
    assert.match(
      rule,
      /--accent:var\(--color-accent,/,
      `${selector} must resolve --accent`,
    );
  }
});

test("the portrait video and caption stay centred and fit phone widths", () => {
  const page = readPage("media-studio.astro");
  const css = styleBlock("media-studio.astro");
  assert.match(page, /<figure class="figure portrait">\s*<video[^>]*width="720" height="1280"/);
  const portrait = declarations(css, ".figure.portrait");
  assert.match(portrait, /width:min\(100%,360px\)/);
  assert.match(portrait, /margin:28pxauto32px/);
  assert.match(portrait, /transform:none/);
  const video = declarations(css, ".figure.portrait video");
  assert.match(video, /display:block/);
  assert.match(video, /width:100%/);
  assert.match(video, /height:auto/);
  assert.match(declarations(css, ".art"), /max-width:1180px/);
  assert.match(declarations(css, ".art"), /padding:24px24px96px/);
  assert.match(css, /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\.art\{padding:16px 16px 64px\}/);
  for (const available of [288, 310, 358, 746, 1100]) {
    assert.ok(Math.min(available, 360) <= available, `portrait overflows ${available}px`);
  }
});
