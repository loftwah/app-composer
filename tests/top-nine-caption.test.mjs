import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { topNineBlankPath, topNineCaption } from '../src/lib/top-nine-caption.ts';

// #1067: a signed-out Top Nine board ready to export copies a short caption
// made from the heading it prints, plus one bare invite to make their own.

const origin = 'https://composer.loftwah.com';
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the caption is the cleaned heading fields plus one bare invite line', () => {
  const href = new URL(topNineBlankPath, origin).href;
  const caption = topNineCaption({
    title: '  Nine albums \n I took  everywhere  ',
    subtitle: '  Songs for a long drive  ',
    byline: '  Mina  ',
  }, origin);
  assert.equal(caption, [
    'Nine albums I took everywhere',
    'Songs for a long drive',
    'By Mina',
    `Make your own Top Nine at ${href}`,
  ].join('\n'));
  assert.equal(topNineBlankPath, '/share/experiences/top-nine');
  assert.equal(href, `${origin}/share/experiences/top-nine`);
  assert.doesNotMatch(href, /[#?]/, 'the blank-play link is the bare canonical path');
});

test('optional subtitle and byline leave no blank lines; a title is required', () => {
  const invite = `Make your own Top Nine at ${origin}/share/experiences/top-nine`;
  assert.equal(topNineCaption({ title: 'Nine things' }, origin), `Nine things\n${invite}`);
  assert.equal(topNineCaption({ title: 'Nine things', byline: 'Mina' }, origin), `Nine things\nBy Mina\n${invite}`);
  assert.equal(topNineCaption({ title: '  ', subtitle: 'ignored' }, origin), '');
});

test('no result, exhibit, draft, cover, profile or tracking value enters the caption', () => {
  const caption = topNineCaption({
    title: 'Nine albums', subtitle: 'A short line', byline: 'Mina',
    // Values the contract does not accept cannot be smuggled into the invite.
    items: ['Python', 'Rust'], profile: 'https://profile.example/mina',
    result: JSON.stringify({ title: 'Nine albums' }), draft: 'localStorage', cover: 'cover.png',
  }, `${origin}/some/path?utm_source=bad#fragment`);
  assert.equal(caption, `Nine albums\nA short line\nBy Mina\nMake your own Top Nine at ${origin}/share/experiences/top-nine`);
  for (const forbidden of ['Python', 'Rust', '/some/path', 'utm_', '#', '?', 'profile.example', 'localStorage', 'cover.png', 'result=']) {
    assert.ok(!caption.includes(forbidden), `no ${forbidden} in a Top Nine caption`);
  }
});

test('the caption builder stays pure: no DOM, storage, network or publish call', () => {
  const lib = source('src/lib/top-nine-caption.ts');
  assert.doesNotMatch(lib, /document\.|window\.|localStorage|sessionStorage|navigator\.|fetch\(|\.publish\(/);
});

test('the export panel adds one Copy caption beside the preserved Copy result link', () => {
  const stage = source('src/components/share-experiences/ShareExperience.astro');
  const actionsStart = stage.indexOf('<div class="experience-actions">', stage.indexOf('data-export-panel'));
  const actions = stage.slice(actionsStart, stage.indexOf('</div>', actionsStart));
  assert.match(actions, /data-copy[^>]*>Copy result link</, 'the explicit result link action stays');
  assert.match(actions, /data-copy-png/, 'Copy PNG stays independent');
  const start = stage.indexOf('data-nine-caption');
  const end = stage.indexOf('data-tq-downloads', start);
  assert.ok(start > actionsStart && end > start, 'one caption block follows the actions');
  const block = stage.slice(start, end);
  assert.equal([...block.matchAll(/data-nine-caption-copy/g)].length, 1, 'one labelled action');
  assert.match(block, /data-nine-caption-copy[^>]*>Copy caption</);
  assert.match(block, /<textarea hidden readonly[^>]+data-nine-caption-manual/);
  assert.match(block, /data-nine-caption-status/);
  assert.match(block, /Copies your title, optional subtitle and byline/);
});

test('the controller copies only a ready board and offers a selectable exact-text fallback', () => {
  const controller = source('src/browser/share-experiences.ts');
  const start = controller.indexOf('nineCaptionCopy?.addEventListener');
  const end = controller.indexOf('/** The same completed export snapshot', start);
  assert.ok(start > 0 && end > start, 'the caption handler exists');
  const block = controller.slice(start, end);
  assert.match(block, /if \(!snapshot \|\| game !== "top-nine" \|\| controller\.exportAllowed\?\.\(\) === false\) return;/);
  assert.match(block, /const caption = topNineCaption\(snapshot, location\.origin\)/);
  assert.match(block, /await navigator\.clipboard\.writeText\(caption\)/);
  assert.match(block, /if \(attempt !== nineCaptionAttempt\) return;/);
  assert.match(block, /nineCaptionManual\.value = caption;\n\s+nineCaptionManual\.hidden = false;\n\s+nineCaptionManual\.focus\(\);\n\s+nineCaptionManual\.select\(\);/,
    'denied clipboard leaves the exact caption selected and copyable');
  assert.doesNotMatch(block, /fetch\(|publish|resultLink\(|topNineAltText/, 'no publish, provider or result-link path is used');
});

test('a material edit retires the fallback and any in-flight caption copy', () => {
  const controller = source('src/browser/share-experiences.ts');
  const clearStart = controller.indexOf('const clearNineCaption = () => {');
  const clearEnd = controller.indexOf('};', clearStart);
  const clear = controller.slice(clearStart, clearEnd);
  assert.match(clear, /nineCaptionAttempt \+= 1;/);
  assert.match(clear, /nineCaptionManual\.hidden = true;/);
  assert.match(clear, /nineCaptionManual\.value = "";/);
  assert.match(clear, /nineCaptionStatus\.textContent = "";/);
  const updateStart = controller.indexOf('const update = () => {', controller.indexOf('export function mountShareExperience'));
  const updateEnd = controller.indexOf('const pickSkin = () =>', updateStart);
  const update = controller.slice(updateStart, updateEnd);
  assert.match(update, /if \(nineCaptionCopy\) nineCaptionCopy\.disabled = busy \|\| !canShare \|\| !exportable;/);
  assert.match(update, /clearNineCaption\(\);/, 'every board change retires the older fallback');
});
