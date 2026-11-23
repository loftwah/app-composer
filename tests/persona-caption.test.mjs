import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { personaCaption } from '../src/lib/persona-quiz.ts';
import {
  developerTypePersona, languageTypePersona,
} from '../src/lib/persona-packs.ts';
import { cloudflarePersonaIds } from '../src/lib/cloudflare-persona.ts';
import { languagePersonaIds } from '../src/lib/language-persona.ts';

// #1067/#1071: one short, plain-text caption in each public persona result
// panel. It carries the exact trusted result name and a link to take the quiz.

const origin = 'https://composer.loftwah.com';
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const cases = [
  { pack: developerTypePersona, ids: cloudflarePersonaIds },
  { pack: languageTypePersona, ids: languagePersonaIds },
];

test('a caption is the exact public result name and a direct quiz link on its own line', () => {
  for (const { pack, ids } of cases) {
    for (const id of ids) {
      const outcome = pack.outcome(id);
      const href = new URL(pack.path, origin).href;
      const caption = personaCaption(outcome, href);
      const lines = caption.split('\n');
      assert.equal(lines.length, 2, `${pack.game}/${id} is a two-line caption`);
      assert.equal(lines[0], `${outcome.archetype} — ${outcome.subject}`,
        `${pack.game}/${id} prints the exact public name and subject from the pack`);
      assert.equal(lines[1], `${origin}${pack.path}`);
      assert.doesNotMatch(href, /[#?]/);
    }
  }
});

test('a caption cannot carry answers, remix text, byline, storage or tracking', () => {
  for (const { pack } of cases) {
    const id = pack.questions[0].options[0].primary.id;
    const outcome = pack.outcome(id);
    const href = new URL(pack.path, origin).href;
    const caption = personaCaption(outcome, href);
    // Composed only from the trusted outcome and its validated path, so the
    // exact equality above is the proof that nothing else can enter it.
    assert.equal(caption, `${outcome.archetype} — ${outcome.subject}\n${href}`);
    for (const forbidden of ['utm_', 'My ', 'remix', 'localStorage', 'sessionStorage', 'fetch(', 'byline']) {
      assert.ok(!caption.includes(forbidden), `no ${forbidden} in a ${pack.game} caption`);
    }
  }
});

test('the public result panel adds one Copy caption action beside Copy result link', () => {
  const stage = source('src/components/share-experiences/ShareExperience.astro');
  const panelStart = stage.indexOf('data-persona-link-panel');
  const panelEnd = stage.indexOf('</section>', panelStart);
  assert.ok(panelStart > 0 && panelEnd > panelStart, 'the persona result panel exists');
  const panel = stage.slice(panelStart, panelEnd);
  assert.ok(panel.includes('data-persona-copy'), 'Copy result link is preserved');
  assert.ok(panel.includes('data-persona-caption-copy'), 'Copy caption is added alongside it');
  assert.match(panel, /data-persona-caption-copy[^>]*>Copy caption</);
  assert.match(panel, /<textarea hidden readonly[^>]+data-persona-caption-manual/);
  assert.match(panel, /data-persona-caption-status/);
  assert.match(panel, /Paste the caption and quiz link beside your image/);
  // Copy PNG stays its own control in the export panel, independent of both.
  assert.match(stage, /data-copy-png disabled/);
});

test('the caption copies trusted text, is inert for a draft and has a selectable fallback', () => {
  const controller = source('src/browser/share-experiences.ts');
  const start = controller.indexOf('function mountPersona');
  const end = controller.indexOf('function mountBingo', start);
  assert.ok(start > 0 && end > start, 'the persona controller exists');
  const persona = controller.slice(start, end);
  assert.match(persona, /captionCopy\.addEventListener\("click", async \(\) => \{\n\s+if \(!shown \|\| draft\) return;/,
    'a private remix can never copy or synthesise a caption');
  assert.match(persona, /const href = new URL\(pack\.path, location\.origin\)\.href;\s+const caption = personaCaption\(outcome, href\)/);
  assert.match(persona, /await navigator\.clipboard\.writeText\(caption\)/);
  assert.match(persona, /captionManual\.hidden = false;\n\s+captionManual\.focus\(\);\n\s+captionManual\.select\(\);/,
    'denied or absent clipboard leaves a usable select/copy field');
  assert.match(persona, /clearCaption\(\)/);
  assert.match(persona, /if \(shown !== id \|\| draft\) return;/, 'an old clipboard response cannot replace a newer result');
  // The existing result-link action stays separate and equally draft-gated.
  assert.match(persona, /if \(!shown \|\| draft\) return;\n\s+const href = new URL\(pack\.resultPath\(shown\)/);
});

test('the caption block has a quiet, phone-safe style hook', () => {
  const css = source('src/styles/share-experiences.css');
  assert.match(css, /\.persona-caption \{/);
  assert.match(css, /\.persona-caption \.experience-note \{ flex-basis: 100%/);
});
