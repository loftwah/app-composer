import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  oneMustGoAltText, tierListAltText, thisOrThatAltText, wrongAnswersAltText,
} from '../src/lib/experience-alt-text.ts';
import { startTierListBoard, tierListDefaultTitle } from '../src/lib/tier-list.ts';
import { oneMustGoStarterChoices, oneMustGoTitle } from '../src/lib/one-must-go.ts';
import { wrongAnswerPrompts } from '../src/lib/wrong-answers.ts';

// #1067: the three newly shipped local games describe the exact text their PNG
// prints. The same export-panel button and readonly, selectable fallback used
// by Top Nine and This or That serve them, so the clipboard path stays local
// and explicit and no second copy control is introduced.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const board = startTierListBoard();
const tierInput = {
  title: tierListDefaultTitle,
  items: board.flat(),
  tierSizes: board.map((row) => row.length),
};
const omgInput = { title: oneMustGoTitle, items: [...oneMustGoStarterChoices], marked: [2] };
const waInput = { prompt: wrongAnswerPrompts[0].question, answer: 'It stores everything in tiny chairs.' };

test('tier list describes the title and all four named rows in print order', () => {
  assert.equal(
    tierListAltText(tierInput),
    'My tier list. Keep close contains The pen that is always in my bag and A notebook with numbered pages. '
    + 'Worth the space contains A second screen, after a month of doubt. '
    + 'Trying it on contains A weekly review I keep restarting. '
    + 'Not for me contains Every notification, on every device.',
  );
  const empty = tierListAltText({ title: 'My list', items: ['Only one'], tierSizes: [1, 0, 0, 0] });
  assert.match(empty, /Keep close contains Only one\./);
  assert.match(empty, /Worth the space is empty\. Trying it on is empty\. Not for me is empty\.$/);
  assert.equal(tierListAltText({ ...tierInput, title: '  ' }), '', 'an empty title has no description');
  assert.equal(tierListAltText({ ...tierInput, items: [] }), '', 'an empty board has no description');
});

test('one must go names the crossed-out choice and the survivors in stage order', () => {
  assert.equal(
    oneMustGoAltText(omgInput),
    'One must go. Code is crossed out. Music, Games and The Web stay on the stage.',
  );
  assert.equal(
    oneMustGoAltText({ title: oneMustGoTitle, items: ['Dial-up', 'Cassette', 'Floppy', 'CRT'], marked: [0] }),
    'One must go. Dial-up is crossed out. Cassette, Floppy and CRT stay on the stage.',
  );
  assert.equal(oneMustGoAltText({ ...omgInput, marked: [] }), '', 'no elimination has no description');
  assert.equal(oneMustGoAltText({ ...omgInput, marked: [9] }), '', 'a bad index has no description');
  assert.equal(oneMustGoAltText({ ...omgInput, items: omgInput.items.slice(0, 3) }), '', 'a short round has no description');
});

test('wrong answers describes only the selected question and its answer', () => {
  assert.equal(
    wrongAnswersAltText(waInput),
    'Wrong answers only. What happens inside a database? The answer reads It stores everything in tiny chairs.',
  );
  assert.equal(wrongAnswersAltText({ ...waInput, answer: '   ' }), '', 'a blank plate has no description');
  assert.equal(wrongAnswersAltText({ prompt: waInput.prompt }), '', 'no answer has no description');
  assert.doesNotMatch(wrongAnswersAltText(waInput), /Where do deleted files go\?/, 'no other prompt leaks in');
});

test('this or that describes every chosen row for five, nine and eleven, with no private prompt or link', () => {
  for (const length of [5, 9, 11]) {
    const items = Array.from({ length }, (_, index) => `Chosen option ${index + 1}`);
    assert.equal(
      thisOrThatAltText({ title: 'Your this or that', byline: ' Mina ', items }),
      ['Your this or that.', 'By Mina.', ...items.map((item) => `${item}.`)].join(' '),
    );
  }
  const eleven = Array.from({ length: 11 }, (_, index) => `Chosen option ${index + 1}`);
  assert.equal(thisOrThatAltText({ title: 'Your this or that', items: eleven.slice(0, 10) }), '');
  assert.equal(thisOrThatAltText({ title: 'Your this or that', items: [...eleven, 'Twelve'] }), '');
  assert.equal(thisOrThatAltText({ title: 'Your this or that', items: [...eleven.slice(0, 10), ' '] }), '');
  assert.doesNotMatch(thisOrThatAltText({
    title: 'Your this or that', byline: 'Mina', items: eleven,
    prompt: 'Secret prompt', hrefs: ['https://example.com/private'],
  }), /Secret prompt|example\.com/);
});

test('a byline appears only when the chosen export prints one', () => {
  assert.match(tierListAltText({ ...tierInput, byline: '  Mina  ' }), /^My tier list\. By Mina\. Keep close contains/);
  assert.match(oneMustGoAltText({ ...omgInput, byline: 'Mara Quinn' }), /^One must go\. By Mara Quinn\. Code is crossed out\./);
  assert.match(wrongAnswersAltText({ ...waInput, byline: 'Mina' }), /^Wrong answers only\. By Mina\. What happens inside a database\?/);
  for (const plain of [tierListAltText(tierInput), oneMustGoAltText(omgInput), wrongAnswersAltText(waInput)]) {
    assert.doesNotMatch(plain, /By |\. By /, 'no empty byline label');
    assert.doesNotMatch(plain, /https?:|www\.|\/Users\/|\.(png|jpe?g|webp)\b|#result|Save |Copy /, 'no link, file or control detail');
  }
});

test('the export panel reuses one disabled copy control and one selectable fallback', () => {
  const astro = read('src/components/share-experiences/ShareExperience.astro');
  assert.match(astro, /data-copy-alt disabled aria-describedby=\{isNine \? "nine-alt-note" : isThis \? "tot-alt-note" : "local-alt-note"\}/);
  assert.match(astro, /\(isNine \|\| isThis \|\| isTier \|\| isMustGo \|\| isWrong \|\| isCourt \|\| isTournament \|\| isCurse\) && <button[^>]*data-copy-alt disabled/);
  assert.match(astro, /\(isNine \|\| isThis \|\| isTier \|\| isMustGo \|\| isWrong \|\| isCourt \|\| isTournament \|\| isCurse\) && <textarea hidden readonly rows="4" aria-label="Image description text" data-manual-alt><\/textarea>/);
  assert.match(astro, /\(isTier \|\| isMustGo \|\| isWrong \|\| isCourt \|\| isTournament \|\| isCurse\) && <p class="experience-note" id="local-alt-note">/);
  assert.match(astro, /four named rows in order/);
  assert.match(astro, /the choice crossed out and the three that stay in stage order/);
  assert.match(astro, /the selected question, your answer and any byline/);
});

test('the shared clipboard text and denied-permission fallback stay intact', () => {
  const source = read('src/browser/share-experiences.ts');
  const start = source.indexOf('alt?.addEventListener("click"');
  assert.ok(start > 0, 'the export panel copy handler exists');
  const end = source.indexOf('\n  });', start);
  assert.ok(end > start, 'the copy handler boundary exists');
  const handler = source.slice(start, end);
  assert.match(handler, /game === "tier-list" \? tierListAltText\(snapshot\)/);
  assert.match(handler, /game === "one-must-go" \? oneMustGoAltText\(snapshot\)/);
  assert.match(handler, /game === "wrong-answers" \? wrongAnswersAltText\(snapshot\)/);
  assert.match(handler, /await navigator\.clipboard\.writeText\(text\)/);
  assert.match(handler, /Image description copied\. Paste it into your image’s alt text\./);
  assert.match(handler, /Clipboard access was denied\. The image description is selected below/);
  assert.match(handler, /altManual\.value = text;[\s\S]*?altManual\.hidden = false;[\s\S]*?altManual\.focus\(\);[\s\S]*?altManual\.select\(\);/);
  assert.match(handler, /altCopyAttempt/, 'a stale copy cannot update the status');
  assert.doesNotMatch(handler, /href|resultLink\(|new ClipboardItem|renderExperienceResult/, 'the text path carries no link or image');
  const updateStart = source.indexOf('const update = () => {', source.indexOf('const clearAltFallback'));
  const updateEnd = source.indexOf('\n  };', updateStart);
  assert.ok(updateStart > 0 && updateEnd > updateStart, 'the shared state update exists');
  assert.match(source.slice(updateStart, updateEnd), /clearAltFallback\(\);/, 'every state update retires the stale fallback');
  assert.match(source, /if \(alt\) byline\.addEventListener\("input", clearAltFallback\)/, 'a byline edit retires it too');
});
