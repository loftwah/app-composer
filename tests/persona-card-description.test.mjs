import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { personaCardAltText } from '../src/lib/persona-quiz.ts';
import {
  developerTypePersona, languageTypePersona,
} from '../src/lib/persona-packs.ts';
import { cloudflarePersonaIds } from '../src/lib/cloudflare-persona.ts';
import { languagePersonaIds } from '../src/lib/language-persona.ts';

// #1067: the prepared PNG card shared by both published persona quizzes offers
// a plain description of the exact text it prints. It is built only from
// trusted printable copy, so no answer, remix, address, file name or photo
// content can reach the clipboard or the preview's alt text.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const cases = [
  { pack: developerTypePersona, ids: cloudflarePersonaIds },
  { pack: languageTypePersona, ids: languagePersonaIds },
];

test('a description is the printed headline, subject and takeaway and nothing else', () => {
  for (const { pack, ids } of cases) {
    for (const id of ids) {
      const copy = pack.card(id);
      const outcome = pack.outcome(id);
      const plain = personaCardAltText(copy, '', false);
      assert.ok(plain.includes(copy.archetype), `${pack.game}/${id} carries the exact headline`);
      assert.ok(plain.includes(copy.subject), `${pack.game}/${id} carries the exact subject`);
      assert.ok(plain.includes(copy.tendency), `${pack.game}/${id} carries the exact takeaway`);
      assert.equal(plain, `${copy.archetype}. ${copy.subject}. ${copy.tendency}`);
      assert.doesNotMatch(plain, /\. By |A small portrait photo/, 'no byline or portrait note when absent');
      for (const forbidden of [outcome.href, outcome.docsText, pack.path, '#result', 'remix', 'My ', '.png', 'Save ', 'Copy ', 'localStorage', 'fetch(']) {
        assert.ok(!plain.includes(forbidden), `no ${forbidden} in a ${pack.game}/${id} description`);
      }
      // No option label (a player's answer) is ever part of printable copy.
      for (const question of pack.questions) {
        for (const option of question.options) {
          assert.ok(!plain.includes(option.label), `no answer text ${option.label}`);
        }
      }
    }
  }
});

test('byline and portrait indication appear only when present and stay neutral', () => {
  const copy = developerTypePersona.card('workers');
  const signed = personaCardAltText(copy, '  Mara   Quinn  ', true);
  assert.match(signed, /By Mara Quinn\./, 'byline is cleaned to the printed form');
  assert.match(signed, /A small portrait photo appears on the card\./);
  assert.ok(!/photo (shows|of|with|depicts)/i.test(signed), 'the note describes presence, not contents');
  const bylineOnly = personaCardAltText(copy, 'Mara Quinn', false);
  assert.doesNotMatch(bylineOnly, /portrait/i, 'no portrait note without a photo');
  const portraitOnly = personaCardAltText(copy, '', true);
  assert.doesNotMatch(portraitOnly, /By /, 'no byline line when blank');
  assert.equal(personaCardAltText({ ...copy, tendency: '' }, '', false), '', 'no empty description');
});

test('the prepared card copies its own description and keeps Save PNG and Copy PNG', () => {
  const source = read('src/browser/share-experiences.ts');
  const start = source.indexOf('if (personaOutcome) {');
  assert.ok(start > 0, 'the persona card export exists');
  const block = source.slice(start, source.indexOf('if (cardDownloads) {', start));

  assert.match(block, /const printedByline = entry\(byline\.value, 48\)/);
  assert.match(block, /const hasPortrait = cardAvatar !== null/);
  assert.match(block, /byline: printedByline/);
  assert.match(block, /personaCardAltText\(cardCopy, printedByline, hasPortrait\)/);
  assert.match(block, /preview\.alt = description/, 'the same description is the preview alt');
  assert.match(block, /copyDescription\.textContent = "Copy image description"/);
  assert.match(block, /navigator\.clipboard\.writeText\(description\)/);
  assert.match(block, /descriptionManual\.readOnly = true/);
  assert.match(block, /descriptionManual\.value = description/);
  assert.match(block, /descriptionManual\.focus\(\);\n\s+descriptionManual\.select\(\);/, 'denied clipboard leaves a select/copy field');
  assert.match(block, /version !== personaVersion/, 'a cleared or changed card cannot be copied');
  assert.match(block, /Image description copied/);
  assert.match(block, /The image description is selected below/);

  // The original export is untouched: one render, one Blob, one Save link,
  // one image clipboard button, and the description button outside that gate.
  assert.equal((block.match(/renderPersonaCard\(/g) ?? []).length, 1, 'only the preview Blob is rendered');
  assert.match(block, /new ClipboardItem\(\{ "image\/png": blob \}\)/);
  assert.match(block, /Save \$\{cardFormat\} PNG/);
  assert.match(block, /copyButton\.textContent = "Copy PNG"/);
  assert.ok(
    block.indexOf('const copyDescription') > block.indexOf('meta.append(copyButton);'),
    'the text control is not gated by image clipboard support',
  );
  const handler = block.slice(block.indexOf('copyDescription.addEventListener'));
  assert.doesNotMatch(handler, /renderPersonaCard\(/, 'copying never renders a fresh image');
  assert.doesNotMatch(handler, /href|download|resultPath|, png|avatarFile/, 'the copy carries no link, file name or photo');
});

test('the selectable fallback has a quiet, phone-safe style hook', () => {
  const css = read('src/styles/share-experiences.css');
  assert.match(css, /\.tq-card-meta textarea:not\(\[hidden\]\) \{/);
});
