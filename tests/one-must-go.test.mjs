import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiences,
} from '../src/lib/share-experiences.ts';
import {
  oneMustGoBlankPath, oneMustGoBuiltinIds, oneMustGoBuiltinRounds,
  oneMustGoChoiceCount, oneMustGoChoiceLimit, oneMustGoOutcome, oneMustGoQueryKey,
  oneMustGoRemainingLine, oneMustGoRoundFromQuery, oneMustGoRoundNote, oneMustGoRoundPath,
  oneMustGoStarter, oneMustGoStarterChoices, oneMustGoTitle,
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

test('two authored built-in rounds offer friendly Workshop subjects', () => {
  assert.deepEqual([...oneMustGoBuiltinIds], ['weekend', 'web-tools']);
  assert.deepEqual(Object.keys(oneMustGoBuiltinRounds), ['weekend', 'web-tools']);
  const labels = [];
  for (const id of oneMustGoBuiltinIds) {
    const round = oneMustGoBuiltinRounds[id];
    assert.equal(round.id, id);
    assert.equal(round.source, 'builtin');
    assert.equal(round.choices.length, oneMustGoChoiceCount);
    assert.equal(new Set(round.choices.map((choice) => choice.toLowerCase())).size, oneMustGoChoiceCount);
    for (const choice of round.choices) {
      assert.match(choice, /\S/);
      assert.ok(choice.length <= oneMustGoChoiceLimit);
    }
    labels.push(round.label);
  }
  assert.deepEqual(labels, ['Weekend plans', 'Web tools']);
  assert.notDeepEqual(
    [...oneMustGoBuiltinRounds.weekend.choices],
    [...oneMustGoStarterChoices],
    'the original poster round stays the default',
  );
});

test('a challenge link carries one allowlisted built-in id and opens it unplayed', () => {
  assert.equal(oneMustGoQueryKey, 'round');
  assert.equal(oneMustGoBlankPath, '/share/experiences/one-must-go');
  assert.equal(oneMustGoRoundPath(oneMustGoStarter), oneMustGoBlankPath);
  assert.equal(oneMustGoRoundPath(oneMustGoBuiltinRounds.weekend), `${oneMustGoBlankPath}?round=weekend`);
  assert.equal(oneMustGoRoundPath(oneMustGoBuiltinRounds['web-tools']), `${oneMustGoBlankPath}?round=web-tools`);
  assert.equal(
    oneMustGoRoundPath(readOneMustGoChoices(['One', 'Two', 'Three', 'Four']).round),
    null,
    'a private authored round never becomes a link',
  );
  for (const [id, round] of Object.entries(oneMustGoBuiltinRounds)) {
    const path = oneMustGoRoundPath(round);
    const url = new URL(path, 'https://composer.loftwah.com');
    assert.equal(url.pathname, '/share/experiences/one-must-go');
    assert.equal(url.hash, '');
    assert.equal(url.search, `?round=${id}`);
    assert.equal(oneMustGoRoundFromQuery(url.search), round, 'the link round-trips');
    assert.doesNotMatch(
      path.slice(oneMustGoBlankPath.length),
      /result|byline|answer|choice|draft|&|#/i,
    );
  }
  assert.equal(oneMustGoRoundFromQuery(''), oneMustGoStarter);
  assert.equal(oneMustGoRoundFromQuery('?round=weekend'), oneMustGoBuiltinRounds.weekend);
  assert.equal(oneMustGoRoundFromQuery('?round=web-tools'), oneMustGoBuiltinRounds['web-tools']);
  for (const bad of [
    '?round=poster', '?round=starter', '?round=unknown', '?round=Weekend',
    '?round=weekend&round=weekend', '?round=weekend&pack=food', '?pack=food&round=weekend',
    '?other=weekend', '?ROUND=weekend', '?round=', '?round=%77eekend', '?round=weekend ',
    '?round=weekend#result=1', '?round=weekend&', '??round=weekend',
  ]) {
    assert.equal(oneMustGoRoundFromQuery(bad), oneMustGoStarter, `${bad} falls back to the poster round`);
  }
});

test('the stage note names the round without inventing a title', () => {
  assert.equal(oneMustGoRoundNote(oneMustGoStarter), 'Poster round');
  assert.equal(oneMustGoRoundNote(oneMustGoBuiltinRounds.weekend), 'Weekend plans round');
  assert.equal(oneMustGoRoundNote(oneMustGoBuiltinRounds['web-tools']), 'Web tools round');
  assert.equal(
    oneMustGoRoundNote({ choices: ['One', 'Two', 'Three', 'Four'], source: 'custom' }),
    'Your round, kept in this tab',
  );
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

test('the browser round shares only an answer-free built-in challenge link', () => {
  const controller = read('src/browser/share-experiences.ts');
  assert.match(
    controller,
    /game === "one-must-go" \? mountOneMustGo\(root, update, oneMustGoRoundFromQuery\(location\.search\)\)/,
  );
  assert.match(controller, /linksAllowed: \(\) => false/, 'no generic result link is ever produced');
  const privateSnapshot = controller.match(/const shared = ([^\n]+)\n\s*\?\s*\{ snapshot: null[^}]*invalid: false \}\s*:\s*sharedResult\(game\)/);
  assert.ok(privateSnapshot, 'private games skip the generic snapshot reader');
  assert.match(privateSnapshot[1], /game === "one-must-go"/);
  assert.match(controller, /game !== "twenty-one-questions" && game !== "tier-list" && game !== "one-must-go"/);
  assert.doesNotMatch(controller, /draftKey\("one-must-go"\)/, 'no draft storage exists for a round');

  const start = controller.indexOf('function mountOneMustGo');
  const end = controller.indexOf('\n}\n', start);
  assert.ok(start > 0 && end > start);
  const block = controller.slice(start, end);
  assert.match(block, /function showRound\(next: OneMustGoRound\)/, 'every stage switch goes through one reset');
  assert.match(block, /clearResult\(\);/);
  assert.match(block, /copyAttempt \+= 1;/);
  assert.match(block, /starter\.hidden = round\.source !== "custom"/);
  assert.match(block, /oneMustGoRoundPath\(round\)/);
  assert.match(block, /if \(!path\) return;/, 'a private authored round has no challenge link');
  assert.match(block, /await navigator\.clipboard\.writeText\(href\)/);
  assert.match(block, /if \(attempt !== copyAttempt\) return;/, 'a late clipboard result cannot describe a moved round');
  assert.match(
    block,
    /copyManual\.value = href;[\s\S]*?copyManual\.hidden = false;[\s\S]*?copyManual\.focus\(\);[\s\S]*?copyManual\.select\(\);/,
  );
  const showStart = block.indexOf('function showRound');
  const showEnd = block.indexOf('function paintRound', showStart);
  assert.ok(showStart > 0 && showEnd > showStart);
  assert.doesNotMatch(
    block.slice(showStart, showEnd),
    /input\.value\s*=|inputs\.forEach/,
    'switching rounds leaves typed custom choices in place',
  );
  for (const forbidden of ['vote', 'percentage', 'localStorage', 'sessionStorage', 'fetch(', 'resultLink']) {
    assert.equal(block.toLowerCase().includes(forbidden.toLowerCase()), false, `the round does not use ${forbidden}`);
  }
});

test('a copied built-in link server-renders the exact authored round without JS', () => {
  const page = read('src/pages/share/experiences/[game].astro');
  assert.match(
    page,
    /const mustGoRound = game === "one-must-go" \? oneMustGoRoundFromQuery\(Astro\.url\.search\) : oneMustGoStarter;/,
  );
  assert.match(page, /\{mustGoRound\}/);
  const markup = read('src/components/share-experiences/ShareExperience.astro');
  assert.match(markup, /mustGoRound = oneMustGoStarter/);
  assert.match(markup, /\{oneMustGoRoundNote\(mustGoRound\)\}/);
  assert.match(markup, /\{mustGoRound\.choices\.map/);
  assert.match(markup, /data-omg-round="poster"/);
  assert.match(markup, /mustGoBuiltins\.map/);
  assert.match(markup, /data-omg-copy disabled/);
  assert.match(markup, /readonly aria-label="Challenge link to copy" data-omg-copy-manual/);
  assert.match(markup, /data-omg-copy-status/);
});

test('the stage starts every JS-only control disabled until the round mounts', () => {
  const markup = read('src/components/share-experiences/ShareExperience.astro');
  const start = markup.indexOf('class="omg-stage"');
  const end = markup.indexOf('\n  </section>}', start);
  assert.ok(start > 0 && end > start, 'the elimination stage exists');
  const block = markup.slice(start, end);
  assert.match(block, /data-omg-form/);
  assert.match(block, /data-omg-choice=\{index\} disabled/);
  assert.match(block, /data-omg-input disabled/);
  assert.match(block, /data-omg-again disabled/);
  assert.match(block, /data-omg-round="poster"[\s\S]*?disabled/);
  assert.match(block, /aria-pressed=\{mustGoActiveId === entry\.id \? "true" : "false"\}/);
  assert.match(block, /data-omg-copy disabled/);
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
