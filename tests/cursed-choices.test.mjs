import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiencePath, experiences,
} from '../src/lib/share-experiences.ts';
import {
  cursedChoiceCard, cursedChoiceCount, cursedChoiceFromQuery, cursedChoiceInvitePath,
  cursedChoiceMade, cursedChoicePrompt, cursedChoiceQueryKey, cursedChoices,
  cursedChoicesAltText, cursedChoiceStart, readCursedChoice,
} from '../src/lib/cursed-choices.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// #1074 cursed-choices slice: the owned split library/modems poster, ten
// original either-or curses with one humorous consequence each, one private
// side per prompt, and one local portrait or wide card for the current curse.
// The signed-out phone/desktop journey is checked in a browser; these checks
// cover the docket, the printed card, the protected route and the privacy
// wiring.

test('the registry entry reuses the owned split poster without a new asset', () => {
  const experience = experiences['cursed-choices'];
  assert.equal(experience.title, 'Cursed Choices');
  assert.equal(experience.slug, 'cursed-choices');
  assert.equal(experience.theme, 'gameshow');
  assert.match(experience.description, /ten either-or curses/i);
  assert.match(experience.description, /stay in this tab/i);
  assert.doesNotMatch(experience.description, /vote|ranking|leaderboard|public result|score/i);
  assert.equal(experiencePath('cursed-choices'), '/share/experiences/cursed-choices');
  for (const path of [experienceArt('cursed-choices'), experienceOg('cursed-choices')]) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${path} exists`);
  }
  assert.equal(
    experienceOg('cursed-choices'), experienceArt('cursed-choices'),
    'the 1200 × 630 poster is its own social card',
  );
  const webp = experienceArt('cursed-choices').replace('.jpg', '-480.webp');
  assert.ok(existsSync(new URL(`../public${webp}`, import.meta.url)), 'the 480w stage art exists');
});

test('the existing campaign record and queue point at the real playable route', () => {
  const record = json('src/lib/internet-workshop-20261122.json')
    .find((entry) => entry.id === 'composer-internet-15-cursed-choices');
  const queue = json('public/campaign/internet-workshop-20261122/queue-drafts.json').placements
    .find((entry) => entry.assetId === 'composer-internet-15-cursed-choices');
  assert.equal(record.projectUrl, 'https://composer.loftwah.com/share/experiences/cursed-choices');
  assert.match(record.description, /^Playable\./);
  assert.ok(record.tags.includes('playable'));
  assert.doesNotMatch(record.caption, /Explain what you’d build/);
  assert.equal(queue.link, 'https://composer.loftwah.com/share/experiences/cursed-choices');
  assert.equal(queue.status, 'Playable');
  assert.equal(queue.artworkUrl, 'https://composer.loftwah.com/share/artwork/composer-internet-15-cursed-choices');
  const guide = read('public/campaign/internet-workshop-20261122/posting-guide.md');
  assert.match(guide, /\[Pick your curse\]\(https:\/\/composer\.loftwah\.com\/share\/experiences\/cursed-choices\)/);
  assert.match(guide, /X · Playable · 1200 × 630/);
});

test('the poster dilemma opens ten distinct either-or curses with consequences', () => {
  assert.equal(cursedChoiceCount, 10);
  assert.equal(cursedChoices.length, cursedChoiceCount);
  assert.equal(
    cursedChoices[0].prompt,
    'Unlimited tokens without internet, or unlimited internet without AI.',
  );
  assert.deepEqual(
    [...cursedChoices[0].choices],
    ['Unlimited tokens, no internet', 'Unlimited internet, no AI'],
  );
  assert.equal(new Set(cursedChoices.map((entry) => entry.prompt)).size, cursedChoiceCount);
  assert.equal(new Set(cursedChoices.map((entry) => entry.tab)).size, cursedChoiceCount);
  for (const entry of cursedChoices) {
    assert.match(entry.prompt, /\bor\b/, 'every prompt is an either-or');
    assert.match(entry.prompt, /\.$/);
    assert.ok(entry.prompt.length >= 40 && entry.prompt.length <= 140, entry.prompt);
    assert.match(entry.tab, /\S/);
    assert.ok(entry.tab.length <= 20, entry.tab);
    assert.equal(entry.choices.length, 2);
    assert.equal(entry.consequences.length, 2);
    assert.equal(new Set(entry.choices).size, 2);
    for (const choice of entry.choices) {
      assert.match(choice, /\S/);
      assert.ok(choice.length <= 60, choice);
    }
    for (const consequence of entry.consequences) {
      assert.match(consequence, /\.$/);
      assert.ok(consequence.length >= 50 && consequence.length <= 180, consequence);
    }
  }
  const text = cursedChoices.map((entry) => ({
    prompt: entry.prompt, ...Object.fromEntries(entry.consequences.map((line, index) => [`c${index}`, line])),
  }));
  const flat = JSON.stringify(text);
  assert.doesNotMatch(flat, /real person|celebrity|surveillance|ranked|leaderboard|public vote/i);
});

test('a side starts empty, changes per prompt and never leaves its prompt', () => {
  const picks = cursedChoiceStart();
  assert.equal(picks.length, cursedChoiceCount);
  assert.ok(picks.every((pick) => pick === null));
  assert.equal(cursedChoiceMade(picks), 0);
  picks[0] = 0;
  picks[4] = 1;
  assert.equal(cursedChoiceMade(picks), 2);
  assert.equal(picks[0], 0);
  assert.equal(picks[4], 1);
  assert.equal(picks[1], null, 'a pick never spreads to another prompt');
  assert.equal(readCursedChoice(0), 0);
  assert.equal(readCursedChoice(1), 1);
  assert.equal(readCursedChoice('0'), null, 'only the two exact authored sides count');
  assert.equal(readCursedChoice('1'), null);
  assert.equal(readCursedChoice(2), null);
  assert.equal(readCursedChoice(true), null);
  assert.equal(readCursedChoice(undefined), null);
  assert.equal(cursedChoicePrompt(0).tab, 'Library / modems');
  assert.equal(cursedChoicePrompt(9).tab, 'Comments');
  assert.equal(cursedChoicePrompt(10), null);
  assert.equal(cursedChoicePrompt('0'), null);
});

test('a challenge link carries only one validated ordinal and reopens that curse unplayed', () => {
  assert.equal(cursedChoiceQueryKey, 'curse');
  assert.equal(cursedChoiceInvitePath(0), '/share/experiences/cursed-choices');
  assert.equal(cursedChoiceInvitePath(1), '/share/experiences/cursed-choices?curse=2');
  assert.equal(cursedChoiceInvitePath(9), '/share/experiences/cursed-choices?curse=10');
  assert.equal(cursedChoiceInvitePath('2'), '/share/experiences/cursed-choices', 'a string is not an ordinal');
  assert.equal(cursedChoiceInvitePath(10), '/share/experiences/cursed-choices');
  assert.equal(cursedChoiceInvitePath(null), '/share/experiences/cursed-choices');
  for (let index = 0; index < cursedChoiceCount; index += 1) {
    const path = cursedChoiceInvitePath(index);
    const url = new URL(path, 'https://composer.loftwah.com');
    assert.equal(url.pathname, '/share/experiences/cursed-choices');
    assert.equal(url.hash, '');
    assert.ok(url.search === '' || url.search === `?curse=${index + 1}`);
    assert.equal(cursedChoiceFromQuery(url.search), index, 'the invite round-trips');
    assert.doesNotMatch(path.slice('/share/experiences/cursed-choices'.length), /result|byline|answer|choice|side|draft|&|#/i);
  }
  assert.equal(cursedChoiceFromQuery(''), 0);
  assert.equal(cursedChoiceFromQuery('?curse=1'), 0, 'the first curse is the bare route');
  assert.equal(cursedChoiceFromQuery('?curse=4'), 3);
  assert.equal(cursedChoiceFromQuery('?curse=10'), 9);
  for (const bad of [
    '', '?curse=0', '?curse=11', '?curse=-1', '?curse=01', '?curse=+4',
    '?curse=4.0', '?curse=%34', '?curse=4 ', '?curse=4&curse=4',
    '?curse=4&pack=food', '?pack=food&curse=4', '?other=4', '?CURSE=4', '?curse=',
  ]) {
    assert.equal(cursedChoiceFromQuery(bad), 0, `${bad} falls back to curse one`);
  }
});

test('the printed card keeps the exact prompt, chosen constraint and consequence', () => {
  assert.deepEqual(cursedChoiceCard(0, 0), {
    number: 1,
    tab: 'Library / modems',
    prompt: 'Unlimited tokens without internet, or unlimited internet without AI.',
    choice: 0,
    choiceLabel: 'Unlimited tokens, no internet',
    consequence: 'The library never closes. Your best work is a margin note in a book that was due back in 1998.',
  });
  const modem = cursedChoiceCard(0, 1);
  assert.equal(modem.choiceLabel, 'Unlimited internet, no AI');
  assert.equal(modem.consequence, 'Every page loads at once. Your best idea waits in a voice memo you will never transcribe.');
  const later = cursedChoiceCard(8, 1);
  assert.equal(later.number, 9);
  assert.equal(later.tab, 'Clock');
  assert.equal(later.choiceLabel, 'Five minutes honest');
  assert.equal(cursedChoiceCard(0, null), null);
  assert.equal(cursedChoiceCard(0, 2), null);
  assert.equal(cursedChoiceCard(0, '0'), null, 'a crafted string never prints a side');
  assert.equal(cursedChoiceCard(10, 0), null);
  assert.equal(cursedChoiceCard(-1, 0), null);
});

test('the card description names only the current curse and its side', () => {
  assert.equal(
    cursedChoicesAltText({ cursePrompt: 0, curseChoice: 0 }),
    'Cursed Choices, a game-show curse card. Curse 1 of 10: Unlimited tokens without internet, or unlimited internet without AI. '
    + 'Your curse is Unlimited tokens, no internet. '
    + 'What it costs: The library never closes. Your best work is a margin note in a book that was due back in 1998.',
  );
  assert.match(
    cursedChoicesAltText({ cursePrompt: 0, curseChoice: 1, byline: '  Curse   Clerk  ' }),
    /^Cursed Choices, a game-show curse card\. By Curse Clerk\. Curse 1 of 10:/,
  );
  assert.doesNotMatch(cursedChoicesAltText({ cursePrompt: 0, curseChoice: 0 }), /https?:|#result|vote|score/i);
  assert.equal(cursedChoicesAltText({ cursePrompt: 0, curseChoice: null }), '');
  assert.equal(cursedChoicesAltText({ cursePrompt: 12, curseChoice: 0 }), '');
});

test('the browser docket keeps choices private and shares only an answer-free curse invite', () => {
  const controller = read('src/browser/share-experiences.ts');
  assert.match(controller, /game === "cursed-choices" \? mountCursedChoices\(root, update, cursedChoiceFromQuery\(location\.search\)\)/);
  assert.match(controller, /const shared = game === "red-flag-court"[^;]*game === "cursed-choices"/);
  assert.match(controller, /status\.textContent = "Pick a side for the current curse to download your card\."/);
  assert.match(controller, /game !== "cursed-choices"/);
  assert.match(controller, /game === "cursed-choices" \? cursedChoicesAltText\(snapshot\)/);

  const start = controller.indexOf('function mountCursedChoices');
  const end = controller.indexOf('function mountBingo', start);
  assert.ok(start > 0 && end > start);
  const block = controller.slice(start, end);
  assert.match(block, /let ready = false;/);
  assert.match(block, /const refresh = \(\) => \{ if \(ready\) update\(\); \};/);
  assert.match(block, /picks\[current\] = side;/);
  assert.match(block, /picks\[current\] = null;/);
  assert.match(block, /linksAllowed: \(\) => false/);
  assert.match(block, /cursePrompt: current, curseChoice: pick/);
  assert.match(block, /control\.disabled = false/, 'the guarded controls release only after this mount');
  assert.match(block, /new URL\(cursedChoiceInvitePath\(current\), location\.origin\)\.href/);
  assert.match(block, /await navigator\.clipboard\.writeText\(href\)/);
  assert.match(block, /copyManual\.value = href;[\s\S]*?copyManual\.hidden = false;[\s\S]*?copyManual\.focus\(\);[\s\S]*?copyManual\.select\(\);/);
  assert.match(block, /if \(attempt !== copyAttempt\) return;/, 'a late clipboard result cannot describe a moved curse');
  for (const forbidden of ['localStorage', 'sessionStorage', 'fetch(', 'resultLink', 'draftKey', 'sendBeacon']) {
    assert.equal(block.includes(forbidden), false, `the docket does not use ${forbidden}`);
  }
});

test('the stage starts every JS-only control disabled until the docket mounts', () => {
  const markup = read('src/components/share-experiences/ShareExperience.astro');
  const start = markup.indexOf('class="cc-stage"');
  const block = markup.slice(start, markup.indexOf('{isThis &&', start));
  assert.ok(start > 0 && block.length > 0, 'the curse stage exists');
  assert.match(block, /data-cc-folio/);
  assert.match(block, /Curse \{String\(activeIndex \+ 1\)\.padStart\(2, "0"\)\}/);
  assert.match(block, /data-cc-heading/);
  assert.match(block, /data-cc-prompt=\{index\}/);
  assert.match(block, /aria-pressed=\{index === activeIndex \? "true" : "false"\}/);
  assert.match(block, /aria-controls="cc-curse"/);
  assert.match(block, /data-cc-prompt=\{index\}[\s\S]*?disabled>/);
  assert.match(block, /data-cc-choice=\{index\} aria-pressed="false" disabled/);
  assert.match(block, /data-cc-choice-text=\{index\}/);
  assert.match(block, /section hidden class="cc-reveal" data-cc-reveal/);
  assert.match(block, /data-cc-consequence/);
  assert.match(block, /data-cc-prev disabled/);
  assert.match(block, /data-cc-next disabled/);
  assert.match(block, /data-cc-clear disabled/);
  assert.match(block, /href=\{experiencePath\("cursed-choices"\)\} data-cc-fresh/);
  assert.match(block, /data-cc-copy disabled/);
  assert.match(block, /readonly aria-label="Challenge link to copy" data-cc-copy-manual/);
  assert.match(block, /data-cc-copy-status/);
  assert.match(block, /\{activeCurse\.prompt\}/);
  assert.match(block, /\{activeCurse\.choices\.map/);
  assert.match(block, /stay in this tab/i);
  assert.match(markup, /isCurse \? \["Game show gold", "Library green", "Modem magenta"\]/);
  assert.match(markup, /\{isCourt \|\| isTournament \|\| isCurse \? <label>Format<select data-format>/);
  assert.match(markup, /<option value="wide">Landscape · 1200 × 630<\/option>/);
  assert.match(markup, /The card prints the current curse, its exact prompt, the constraint you picked and its consequence/);
  assert.match(markup, /data-download disabled=\{isDoor[^}]*isCurse/);
  assert.match(markup, /data-copy hidden=\{isTwentyOne[^}]*isCurse/);
});

test('the protected route serves only registered games and restores no result state', () => {
  const page = read('src/pages/share/experiences/[game].astro');
  assert.match(page, /const id = Astro\.params\.game \?\? "";/);
  assert.match(page, /if \(!Object\.hasOwn\(experiences, id\)\) return new Response\("Experience not found", \{ status: 404 \}\);/);
  assert.match(page, /<ShareExperience \{game\} experience=\{experience\} art=\{experienceArt\(game\)\} \{curseIndex\} \{mustGoRound\} \/>/);
  assert.match(page, /const curseIndex = game === "cursed-choices" \? cursedChoiceFromQuery\(Astro\.url\.search\) : 0;/);
  const controller = read('src/browser/share-experiences.ts');
  const guard = controller.match(/const shared = ([^;]+)\n\s*\?\s*\{ snapshot: null[^}]*invalid: false \}\s*:\s*sharedResult\(game\)/);
  assert.ok(guard, 'private games skip the generic snapshot reader');
  assert.match(guard[1], /game === "cursed-choices"/, 'a crafted #result hash restores nothing');
  assert.match(controller, /restore\(\) \{\n\s*\/\/ A curse never travels in a result link/);
});

test('the local card draws the exact prompt, chosen side and consequence', () => {
  const image = read('src/browser/share-experience-image.ts');
  assert.match(image, /"cursed-choices": \[\["#f4e6cf", "#2a1417", "#a8761f"\]/);
  assert.match(image, /result\.game === "cursed-choices"\) return renderCursedChoices/);
  assert.match(image, /const card = cursedChoiceCard\(result\.cursePrompt, result\.curseChoice\)/);
  assert.match(image, /drawFit\(ctx, card\.prompt/);
  assert.match(image, /drawFit\(ctx, card\.choiceLabel\.toUpperCase\(\)/);
  assert.match(image, /drawFit\(ctx, card\.consequence/);
  assert.match(image, /fill: "#1f5a34"/);
  assert.match(image, /fill: "#6d1c3f"/);
  assert.match(image, /layout: ResultFormat = format === "wide" \? "wide" : "portrait"/);
  assert.match(image, /cursePrompt\?: number;/);
  assert.match(image, /curseChoice\?: CursedChoice;/);
  assert.equal(image.includes('https://composer.loftwah.com'), false, 'the card makes no request');
});
