import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiencePath, experiences,
} from '../src/lib/share-experiences.ts';
import {
  readRedFlagVerdict, redFlagCourtAltText, redFlagCourtCalled, redFlagCourtCard,
  redFlagCourtCase, redFlagCourtCases, redFlagCourtCount, redFlagCourtPrintTitle,
  redFlagCourtStart,
} from '../src/lib/red-flag-court.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// #1074 red-flag-court slice: the owned poster and its 47-tabs case, nine more
// original fictional habits, one private green-or-red call per case, and one
// local verdict card. The signed-out phone/desktop journey is checked in a
// browser; these checks cover the docket, the printed card and the privacy
// wiring.

test('the registry entry reuses the owned tabloid poster without a new asset', () => {
  const experience = experiences['red-flag-court'];
  assert.equal(experience.title, 'Red Flag Court');
  assert.equal(experience.slug, 'red-flag-court');
  assert.equal(experience.theme, 'tabloid');
  assert.match(experience.description, /ten small computer habits/i);
  assert.match(experience.description, /stay in this tab/i);
  assert.doesNotMatch(experience.description, /vote|ranking|leaderboard|public result|score/i);
  assert.equal(experiencePath('red-flag-court'), '/share/experiences/red-flag-court');
  for (const path of [experienceArt('red-flag-court'), experienceOg('red-flag-court')]) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${path} exists`);
  }
  assert.match(experienceOg('red-flag-court'), /red-flag-court-og-v1\.jpg$/);
  const webp = experienceArt('red-flag-court').replace('.jpg', '-480.webp');
  assert.ok(existsSync(new URL(`../public${webp}`, import.meta.url)), 'the 480w stage art exists');
});

test('the existing Court entry points at the actual route as a playable item', () => {
  const court = json('src/lib/internet-workshop-20261122.json')
    .find((entry) => entry.id === 'composer-internet-20-red-flag-court');
  const queue = json('public/campaign/internet-workshop-20261122/queue-drafts.json').placements
    .find((entry) => entry.assetId === 'composer-internet-20-red-flag-court');
  assert.equal(court.projectUrl, 'https://composer.loftwah.com/share/experiences/red-flag-court');
  assert.match(court.description, /^Playable\./);
  assert.ok(court.tags.includes('playable'));
  assert.equal(queue.link, 'https://composer.loftwah.com/share/experiences/red-flag-court');
  assert.equal(queue.status, 'Playable');
  assert.equal(queue.artworkUrl, 'https://composer.loftwah.com/share/artwork/composer-internet-20-red-flag-court');
});

test('the poster case opens a docket of ten distinct fictional habits', () => {
  assert.equal(redFlagCourtCount, 10);
  assert.equal(redFlagCourtCases.length, redFlagCourtCount);
  assert.equal(redFlagCourtCases[0].habit, 'Forty-seven browser tabs are open, and every single one is important.');
  assert.equal(redFlagCourtCases[0].tab, '47 tabs');
  assert.equal(new Set(redFlagCourtCases.map((entry) => entry.habit)).size, redFlagCourtCount);
  assert.equal(new Set(redFlagCourtCases.map((entry) => entry.tab)).size, redFlagCourtCount);
  for (const entry of redFlagCourtCases) {
    assert.match(entry.habit, /\.$/);
    assert.ok(entry.habit.length >= 40 && entry.habit.length <= 160, entry.habit);
    assert.match(entry.tab, /\S/);
    assert.ok(entry.tab.length <= 20);
  }
  const text = redFlagCourtCases.map((entry) => entry.habit).join(' ');
  assert.doesNotMatch(text, /real person|celebrity|surveillance|ranked|leaderboard|public vote/i);
});

test('a verdict starts empty, changes per case and never leaves its case', () => {
  const verdicts = redFlagCourtStart();
  assert.equal(verdicts.length, redFlagCourtCount);
  assert.ok(verdicts.every((verdict) => verdict === null));
  assert.equal(redFlagCourtCalled(verdicts), 0);
  verdicts[0] = 'green';
  verdicts[4] = 'red';
  assert.equal(redFlagCourtCalled(verdicts), 2);
  assert.equal(verdicts[0], 'green');
  assert.equal(verdicts[4], 'red');
  assert.equal(readRedFlagVerdict('green'), 'green');
  assert.equal(readRedFlagVerdict('red'), 'red');
  assert.equal(readRedFlagVerdict(' GREEN '), null, 'only the two exact authored values count');
  assert.equal(readRedFlagVerdict('maybe'), null);
  assert.equal(redFlagCourtCase(0).tab, '47 tabs');
  assert.equal(redFlagCourtCase(9).tab, 'Manual');
  assert.equal(redFlagCourtCase(10), null);
  assert.equal(redFlagCourtCase('0'), null);
});

test('the printed card keeps the exact case wording and verdict', () => {
  assert.equal(redFlagCourtPrintTitle, 'Red flag court');
  const red = redFlagCourtCard(0, 'red');
  assert.deepEqual(red, {
    number: 1,
    tab: '47 tabs',
    habit: 'Forty-seven browser tabs are open, and every single one is important.',
    verdict: 'red',
    verdictLabel: 'Red flag',
  });
  const green = redFlagCourtCard(6, 'green');
  assert.equal(green.number, 7);
  assert.equal(green.verdictLabel, 'Green flag');
  assert.equal(redFlagCourtCard(0, null), null);
  assert.equal(redFlagCourtCard(0, 'maybe'), null);
  assert.equal(redFlagCourtCard(10, 'red'), null);
  assert.equal(redFlagCourtCard(-1, 'red'), null);
});

test('the card description names only the current case and its call', () => {
  assert.equal(
    redFlagCourtAltText({ courtCase: 0, verdict: 'red' }),
    'Red flag court, a tabloid verdict card. Case 1 of 10: Forty-seven browser tabs are open, and every single one is important. The verdict is a red flag.',
  );
  assert.match(
    redFlagCourtAltText({ courtCase: 0, verdict: 'green', byline: '  Court   Clerk  ' }),
    /The verdict is a green flag\. By Court Clerk\.$/,
  );
  assert.equal(redFlagCourtAltText({ courtCase: 0, verdict: null }), '');
  assert.equal(redFlagCourtAltText({ courtCase: 12, verdict: 'red' }), '');
});

test('the browser docket keeps verdicts in memory and never builds a link', () => {
  const controller = read('src/browser/share-experiences.ts');
  assert.match(controller, /game === "red-flag-court" \? mountRedFlagCourt/);
  assert.match(controller, /const shared = game === "red-flag-court" \|\| game === "twenty-one-questions"/);
  assert.match(controller, /status\.textContent = "Call the current case red or green to download your verdict card\."/);
  assert.match(controller, /game !== "wrong-answers" && game !== "red-flag-court"/);
  assert.match(controller, /game === "red-flag-court" \? redFlagCourtAltText\(snapshot\)/);

  const start = controller.indexOf('function mountRedFlagCourt');
  const end = controller.indexOf('function mountBingo', start);
  assert.ok(start > 0 && end > start);
  const block = controller.slice(start, end);
  assert.match(block, /let ready = false;/);
  assert.match(block, /const refresh = \(\) => \{ if \(ready\) update\(\); \};/);
  assert.match(block, /verdicts\[current\] = call;/);
  assert.match(block, /linksAllowed: \(\) => false/);
  assert.match(block, /courtCase: current, verdict: call/);
  for (const forbidden of ['localStorage', 'sessionStorage', 'fetch(', 'resultLink', 'draftKey', 'sendBeacon']) {
    assert.equal(block.includes(forbidden), false, `the docket does not use ${forbidden}`);
  }
});

test('the stage starts every JS-only control disabled until the docket mounts', () => {
  const markup = read('src/components/share-experiences/ShareExperience.astro');
  const start = markup.indexOf('class="rfc-stage"');
  const block = markup.slice(start, markup.indexOf('{isThis &&', start));
  assert.ok(start > 0 && block.length > 0, 'the court stage exists');
  assert.match(block, /data-rfc-heading/);
  assert.match(block, /data-rfc-case=\{index\}/);
  assert.match(block, /aria-pressed=\{index === 0 \? "true" : "false"\}/);
  assert.match(block, /aria-controls="rfc-case"/);
  assert.match(block, /data-rfc-verdict="red" aria-pressed="false" disabled/);
  assert.match(block, /data-rfc-verdict="green" aria-pressed="false" disabled/);
  assert.match(block, /data-rfc-prev disabled/);
  assert.match(block, /data-rfc-next disabled/);
  assert.match(block, /href=\{experiencePath\("red-flag-court"\)\} data-rfc-fresh/);
  assert.match(block, /redFlagCourtCases\[0\]\.habit/);
  assert.match(block, /stay in this tab/i);
  assert.match(markup, /isCourt \? \["Court paper", "Late edition", "Newsprint"\]/);
  const formatGames = markup.match(/\{([^{}]+) \? <label>Format<select data-format>/);
  assert.match(formatGames?.[1] ?? "", /\bisCourt\b/);
  assert.match(markup, /<option value="wide">Landscape · 1200 × 630<\/option>/);
  assert.match(markup, /The card prints the current case, its exact wording, your red or green flag and any byline/);
  assert.match(markup, /data-download disabled=\{isDoor[^}]*isCourt/);
  assert.match(markup, /data-copy hidden=\{isTwentyOne[^}]*isCourt/);
});

test('the local verdict card draws the case and its red or green call', () => {
  const image = read('src/browser/share-experience-image.ts');
  assert.match(image, /"red-flag-court": \[\["#f3e4c7", "#1c1511", "#a3151f"\]/);
  assert.match(image, /result\.game === "red-flag-court"\) return renderRedFlagCourt/);
  assert.match(image, /const card = redFlagCourtCard\(result\.courtCase, result\.verdict\)/);
  assert.match(image, /drawFit\(ctx, card\.habit/);
  assert.match(image, /drawFit\(ctx, card\.verdictLabel\.toUpperCase\(\)/);
  assert.match(image, /layout: ResultFormat = format === "wide" \? "wide" : "portrait"/);
  assert.match(image, /courtCase\?: number;/);
  assert.match(image, /verdict\?: RedFlagVerdict;/);
  assert.equal(image.includes('https://composer.loftwah.com'), false, 'the card makes no request');
});
