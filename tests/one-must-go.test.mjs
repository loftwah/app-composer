import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiences,
} from '../src/lib/share-experiences.ts';
import {
  oneMustGoChoiceCount, oneMustGoChoiceLimit, oneMustGoOutcome,
  oneMustGoRemainingLine, oneMustGoStarter, oneMustGoStarterChoices, oneMustGoTitle,
  readOneMustGoChoices,
} from '../src/lib/one-must-go.ts';
import { resultColumns } from '../src/browser/share-experience-image.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// #1074 early slice: one elimination round matching the owned one-must-go
// poster, plus a private four-choice round. No votes, percentages, result link
// or stored draft. The signed-out phone/desktop journey and PNG are exercised
// in a browser; these checks cover the pure round and the wiring boundaries.

test('the registry entry reuses the owned poster without a new asset', () => {
  const experience = experiences['one-must-go'];
  assert.equal(experience.title, 'One Must Go');
  assert.equal(experience.slug, 'one-must-go');
  assert.equal(experience.theme, 'noir');
  assert.match(experience.description, /Eliminate one/i);
  assert.match(experience.description, /stays in this tab/i);
  assert.doesNotMatch(experience.description, /vote|percentage|leaderboard/i);
  for (const path of [experienceArt('one-must-go'), experienceOg('one-must-go')]) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${path} exists`);
  }
  assert.equal(experienceOg('one-must-go'), experienceArt('one-must-go'), 'the 1200 × 630 poster is its own social card');
  const webp = experienceArt('one-must-go').replace('.jpg', '-480.webp');
  assert.ok(existsSync(new URL(`../public${webp}`, import.meta.url)), 'the 480w stage art exists');
});

test('the starter is exactly the poster round, in order, with four distinct choices', () => {
  assert.equal(oneMustGoTitle, 'One must go.');
  assert.equal(oneMustGoChoiceCount, 4);
  assert.deepEqual([...oneMustGoStarterChoices], ['Music', 'Games', 'Code', 'The Web']);
  assert.deepEqual([...oneMustGoStarter.choices], ['Music', 'Games', 'Code', 'The Web']);
  assert.equal(oneMustGoStarter.source, 'starter');
  assert.equal(new Set(oneMustGoStarter.choices).size, oneMustGoChoiceCount);
  for (const choice of oneMustGoStarterChoices) {
    assert.match(choice, /\S/);
    assert.ok(choice.length <= oneMustGoChoiceLimit);
  }
});

test('an authored round is exactly four cleaned, nonempty, distinct choices', () => {
  const readRound = readOneMustGoChoices(['  Music  festival ', 'Games', 'Code', 'The Web']);
  assert.equal(readRound.ok, true);
  assert.deepEqual([...readRound.round.choices], ['Music festival', 'Games', 'Code', 'The Web']);
  assert.equal(readRound.round.source, 'custom');

  const short = readOneMustGoChoices(['Music', 'Games', 'Code']);
  assert.equal(short.ok, false);
  assert.match(short.message, /exactly 4 choices/i);

  const blank = readOneMustGoChoices(['Music', 'Games', '   ', 'The Web']);
  assert.equal(blank.ok, false);
  assert.match(blank.message, /Fill in all four/i);

  const repeated = readOneMustGoChoices(['Music', 'music', 'Code', 'The Web']);
  assert.equal(repeated.ok, false);
  assert.match(repeated.message, /own name/i);

  const repeatedAfterCleaning = readOneMustGoChoices(['The  Web', 'Games', 'Code', 'The Web']);
  assert.equal(repeatedAfterCleaning.ok, false, 'whitespace cleaning cannot create an ambiguous pair');

  const long = readOneMustGoChoices(['x'.repeat(oneMustGoChoiceLimit + 20), 'Games', 'Code', 'The Web']);
  assert.equal(long.ok, true);
  assert.equal(long.round.choices[0].length, oneMustGoChoiceLimit);
});

test('one elimination leaves the other three in their original stage order', () => {
  const first = oneMustGoOutcome(oneMustGoStarter, 2);
  assert.deepEqual(first, { gone: 'Code', remaining: ['Music', 'Games', 'The Web'] });
  const last = oneMustGoOutcome(oneMustGoStarter, 3);
  assert.deepEqual(last, { gone: 'The Web', remaining: ['Music', 'Games', 'Code'] });
  assert.equal(oneMustGoOutcome(oneMustGoStarter, -1), null);
  assert.equal(oneMustGoOutcome(oneMustGoStarter, 4), null);
  assert.equal(oneMustGoOutcome(oneMustGoStarter, 1.5), null);
  assert.equal(oneMustGoOutcome(oneMustGoStarter, 0).remaining.length, oneMustGoChoiceCount - 1);
});

test('the survivor sentence names three choices in readable order', () => {
  assert.equal(oneMustGoRemainingLine(['Music', 'Games', 'The Web']), 'Music, Games and The Web');
  assert.equal(oneMustGoRemainingLine(['Music', 'Games']), 'Music and Games');
  assert.equal(oneMustGoRemainingLine(['Music']), 'Music');
  assert.equal(oneMustGoRemainingLine([]), '');
});

test('the browser round never becomes a link, draft, vote or public write', () => {
  const controller = read('src/browser/share-experiences.ts');
  assert.match(controller, /game === "one-must-go" \? mountOneMustGo/);
  assert.match(controller, /linksAllowed: \(\) => false/);
  assert.match(controller, /game === "tier-list" \|\| game === "one-must-go"\s*\?/);
  assert.match(controller, /game !== "twenty-one-questions" && game !== "tier-list" && game !== "one-must-go"/);
  assert.doesNotMatch(controller, /draftKey\("one-must-go"\)/, 'no draft storage exists for a round');

  const start = controller.indexOf('function mountOneMustGo');
  const block = controller.slice(start, controller.indexOf('function mountBingo', start));
  assert.ok(start > 0 && block.length > 0);
  for (const forbidden of ['vote', 'percentage', 'localStorage', 'sessionStorage', 'fetch(', 'resultLink']) {
    assert.equal(block.toLowerCase().includes(forbidden.toLowerCase()), false, `the round does not use ${forbidden}`);
  }
});

test('the stage starts every JS-only control disabled until the round mounts', () => {
  const markup = read('src/components/share-experiences/ShareExperience.astro');
  const start = markup.indexOf('class="omg-stage"');
  const block = markup.slice(start, markup.indexOf('{isThis &&', start));
  assert.ok(start > 0 && block.includes('data-omg-form'), 'the elimination stage exists');
  assert.match(block, /data-omg-choice=\{index\} disabled/);
  assert.match(block, /data-omg-input disabled/);
  assert.match(block, /data-omg-again disabled/);
  assert.match(block, /data-omg-starter disabled hidden/);
  assert.match(block, /<button type="submit" disabled>Play my round<\/button>/);
  assert.match(block, /oneMustGoChoiceCount/);
  assert.match(block, /Still on the stage/);
  assert.doesNotMatch(block, /vote|percentage/i);
  assert.match(markup, /isMustGo \? \["Noir orange", "Stamp orange", "Paper and ink"\]/);
});

test('the shared PNG draws four choices as a 2 × 2 with the eliminated one crossed out', () => {
  assert.equal(resultColumns('one-must-go', 4), 2);
  const image = read('src/browser/share-experience-image.ts');
  assert.match(image, /"one-must-go": \[\["#171310"/);
  assert.match(image, /result\.game === "tech-bingo" \|\| result\.game === "one-must-go"/);
  assert.match(image, /result\.game === "tech-bingo" && index === 12/);
});
