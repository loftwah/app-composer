import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  experienceArt, experienceOg, experiencePath, experiences,
} from '../src/lib/share-experiences.ts';
import {
  normaliseTechTournamentBracket, techTournamentComplete, techTournamentCurrent,
  techTournamentEntries, techTournamentMatchLabel, techTournamentMatches,
  techTournamentOutcome, techTournamentParticipants, techTournamentPick,
  techTournamentPickCount, techTournamentPickCountMade, techTournamentPlaceholder,
  techTournamentStart, techTournamentTitle, techTournamentUndo, techTournamentWinner,
} from '../src/lib/tech-tournament.ts';
import { techTournamentAltText } from '../src/lib/experience-alt-text.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

// #1074 Internet World Cup: the owned tech-tournament poster and its Terminal
// versus GUI opening match, seven local picks and one winner card. The
// signed-out phone/desktop journey is checked in a browser; these checks cover
// the bounded bracket, its undo, the printed card and the privacy wiring.

function play(sides) {
  let bracket = techTournamentStart();
  sides.forEach((side, index) => { bracket = techTournamentPick(bracket, index, side); });
  return bracket;
}

test('the registry entry reuses the owned poster without a new asset', () => {
  const experience = experiences['tech-tournament'];
  assert.equal(experience.title, 'Internet World Cup');
  assert.equal(experience.slug, 'tech-tournament');
  assert.equal(experience.theme, 'tournament');
  assert.match(experience.description, /eight familiar computer tools/i);
  assert.match(experience.description, /seven quick head-to-head picks/i);
  assert.match(experience.description, /local champion/i);
  assert.doesNotMatch(experience.description, /score|ranking|leaderboard|public result|vote/i);
  assert.equal(experiencePath('tech-tournament'), '/share/experiences/tech-tournament');
  for (const path of [experienceArt('tech-tournament'), experienceOg('tech-tournament')]) {
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${path} exists`);
  }
  assert.match(experienceOg('tech-tournament'), /tech-tournament-v1\.jpg$/);
  assert.equal(existsSync(new URL('../public/campaign/internet-workshop-20261122/tech-tournament-og-v1.jpg', import.meta.url)), false);
  const webp = experienceArt('tech-tournament').replace('.jpg', '-480.webp');
  assert.ok(existsSync(new URL(`../public${webp}`, import.meta.url)), 'the 480w stage art exists');
});

test('the owned campaign record and queue point at the real playable route', () => {
  const record = json('src/lib/internet-workshop-20261122.json')
    .find((entry) => entry.id === 'composer-internet-31-tech-tournament');
  const queue = json('public/campaign/internet-workshop-20261122/queue-drafts.json').placements
    .find((entry) => entry.assetId === 'composer-internet-31-tech-tournament');
  assert.equal(record.projectUrl, 'https://composer.loftwah.com/share/experiences/tech-tournament');
  assert.match(record.description, /^Playable\./);
  assert.ok(record.tags.includes('playable'));
  assert.doesNotMatch(record.caption, /2 am/);
  assert.equal(queue.link, 'https://composer.loftwah.com/share/experiences/tech-tournament');
  assert.equal(queue.status, 'Playable');
  assert.equal(queue.artworkUrl, 'https://composer.loftwah.com/share/artwork/composer-internet-31-tech-tournament');
  const guide = read('public/campaign/internet-workshop-20261122/posting-guide.md');
  assert.match(guide, /\[Internet World Cup\]\(https:\/\/composer\.loftwah\.com\/share\/experiences\/tech-tournament\)/);
  assert.match(guide, /Discord · Playable · 1200 × 630/);
});

test('eight distinct familiar tools meet in seven fixed head-to-head matches', () => {
  assert.equal(techTournamentEntries.length, 8);
  assert.equal(new Set(techTournamentEntries.map((entry) => entry.name)).size, 8);
  assert.equal(new Set(techTournamentEntries.map((entry) => entry.pair)).size, 8);
  assert.deepEqual(techTournamentEntries.slice(0, 2).map((entry) => entry.name), ['Terminal', 'GUI']);
  assert.equal(techTournamentPickCount, 7);
  assert.equal(techTournamentMatches.length, 7);
  assert.equal(techTournamentMatches.filter((match) => match.round === 'quarter-final').length, 4);
  assert.equal(techTournamentMatches.filter((match) => match.round === 'semi-final').length, 2);
  assert.equal(techTournamentMatches.filter((match) => match.round === 'final').length, 1);
  assert.equal(techTournamentMatches[0].entrants.join(','), '0,1');
  assert.equal(techTournamentMatchLabel(0), 'Quarter-final 1');
  assert.equal(techTournamentMatchLabel(4), 'Semi-final 1');
  assert.equal(techTournamentMatchLabel(6), 'Final');
  assert.equal(techTournamentPlaceholder(0, 0), 'Terminal');
  assert.equal(techTournamentPlaceholder(4, 0), 'Winner of Quarter-final 1');
  assert.equal(techTournamentPlaceholder(6, 1), 'Winner of Semi-final 2');
  for (const entry of techTournamentEntries) {
    assert.match(entry.pair, /^the /);
    assert.doesNotMatch(entry.pair, /https?:|™|®/);
  }
});

test('the bracket starts empty and only the current match can be played', () => {
  const start = techTournamentStart();
  assert.equal(start.length, techTournamentPickCount);
  assert.ok(start.every((side) => side === null));
  assert.equal(techTournamentCurrent(start), 0);
  assert.equal(techTournamentPickCountMade(start), 0);
  assert.equal(techTournamentComplete(start), false);
  const opening = techTournamentParticipants(start, 0);
  assert.deepEqual(opening.map((entry) => entry.name), ['Terminal', 'GUI']);
  assert.equal(techTournamentParticipants(start, 4), null, 'a semi-final waits for two winners');

  assert.deepEqual(techTournamentPick(start, 4, 0), start, 'a future match is ignored');
  assert.deepEqual(techTournamentPick(start, 0, 2), start, 'only the two authored sides count');
  assert.deepEqual(techTournamentPick(start, 0, '0'), start, 'a crafted string is not a side');
  assert.deepEqual(techTournamentPick(start, -1, 0), start);
  assert.deepEqual(techTournamentPick(start, 0, -1), start);

  const after = techTournamentPick(start, 0, 1);
  assert.deepEqual(after, [1, null, null, null, null, null, null]);
  assert.equal(techTournamentCurrent(after), 1);
  assert.equal(techTournamentWinner(after, 0).name, 'GUI');
  assert.equal(techTournamentWinner(start, 0), null);
});

test('seven ordered picks produce one exact champion and runner-up', () => {
  const bracket = play([0, 1, 0, 1, 0, 1, 0]);
  assert.deepEqual(bracket, [0, 1, 0, 1, 0, 1, 0]);
  assert.equal(techTournamentPickCountMade(bracket), 7);
  assert.equal(techTournamentCurrent(bracket), null);
  assert.equal(techTournamentComplete(bracket), true);
  assert.equal(techTournamentWinner(bracket, 6).name, 'Terminal');
  const outcome = techTournamentOutcome(bracket);
  assert.equal(outcome.winner.name, 'Terminal');
  assert.equal(outcome.winner.pair, 'the blinking cursor');
  assert.equal(outcome.runnerUp.name, 'Search');
  assert.equal(outcome.runnerUp.pair, 'the empty box');
});

test('undo walks back one or more picks through the same bounded state', () => {
  const complete = play([0, 1, 0, 1, 0, 1, 0]);
  const undoneFinal = techTournamentUndo(complete);
  assert.deepEqual(undoneFinal, [0, 1, 0, 1, 0, 1, null]);
  assert.equal(techTournamentCurrent(undoneFinal), 6);
  assert.equal(techTournamentComplete(undoneFinal), false);
  assert.equal(techTournamentOutcome(undoneFinal), null);

  let bracket = complete;
  for (let count = 0; count < 7; count += 1) bracket = techTournamentUndo(bracket);
  assert.deepEqual(bracket, techTournamentStart());
  assert.equal(techTournamentCurrent(bracket), 0);
  assert.deepEqual(techTournamentUndo(bracket), bracket, 'an empty bracket has nothing to undo');

  const changed = techTournamentPick(undoneFinal, 6, 1);
  assert.equal(techTournamentOutcome(changed).winner.name, 'Search');
  assert.equal(techTournamentOutcome(changed).runnerUp.name, 'Terminal');
});

test('crafted bracket payloads cannot print arbitrary winners', () => {
  const normalised = normaliseTechTournamentBracket(['Terminal', 5, {}, null, 0, 1, 0, 1]);
  assert.deepEqual(normalised, [null, null, null, null, 0, 1, 0]);
  assert.equal(techTournamentComplete(normalised), false);
  assert.equal(techTournamentOutcome(normalised), null);
  assert.equal(techTournamentOutcome('Terminal'), null);
  assert.equal(techTournamentOutcome(null), null);
});

test('the card description names only the champion, runner-up and paired names', () => {
  const bracket = play([0, 1, 0, 1, 0, 1, 0]);
  assert.equal(
    techTournamentAltText({ tournamentPicks: bracket }),
    'Internet World Cup winner card. Terminal, the blinking cursor, is your champion after 7 local picks. Search, the empty box, is the runner-up.',
  );
  assert.match(
    techTournamentAltText({ tournamentPicks: bracket, byline: '  Mara   Quinn ' }),
    /^Internet World Cup winner card\. By Mara Quinn\./,
  );
  assert.equal(techTournamentAltText({ tournamentPicks: bracket.slice(0, 6) }), '');
  assert.equal(techTournamentAltText({ tournamentPicks: ['Terminal'] }), '');
  assert.doesNotMatch(techTournamentAltText({ tournamentPicks: bracket }), /score|rank|https?:|#result/);
  assert.equal(techTournamentTitle, 'Internet World Cup');
});

test('the stage guards every JS-only control until the bracket mounts', () => {
  const markup = read('src/components/share-experiences/ShareExperience.astro');
  const start = markup.indexOf('class="tt-stage"');
  const block = markup.slice(start, markup.indexOf('{isThis &&', start));
  assert.ok(start > 0 && block.length > 0, 'the tournament stage exists');
  assert.match(block, /data-tt-progress/);
  assert.match(block, /data-tt-bracket/);
  assert.match(block, /data-tt-pick=\{`\$\{match\.id\}:\$\{side\}`\} disabled/);
  assert.match(block, /data-tt-name=\{`\$\{match\.id\}:\$\{side\}`\}/);
  assert.match(block, /data-tt-pair=\{`\$\{match\.id\}:\$\{side\}`\}/);
  assert.match(block, /data-tt-undo disabled/);
  assert.match(block, /data-tt-reset disabled/);
  assert.match(block, /href=\{experiencePath\("tech-tournament"\)\} data-tt-fresh/);
  assert.match(block, /section hidden class="tt-result" data-tt-result/);
  assert.match(block, /data-tt-winner/);
  assert.match(block, /data-tt-runner/);
  assert.match(block, /data-tt-again disabled/);
  assert.match(block, /data-tt-copy disabled/);
  assert.match(block, /readonly aria-label="Blank bracket link" data-tt-copy-manual/);
  assert.match(block, /data-tt-copy-status/);
  assert.equal((block.match(/>Copy blank bracket link<\/button>/g) ?? []).length, 1);
  assert.match(block, /stays? in this tab/i);
  assert.match(block, /No account, vote, score or stored result/);
  assert.match(markup, /isTournament \? \["Fanzine orange", "Newsprint", "Floodlight"\]/);
  const formatGames = markup.match(/\{([^{}]+) \? <label>Format<select data-format>/);
  assert.match(formatGames?.[1] ?? "", /\bisTournament\b/);
  assert.match(markup, /The card prints your exact champion, the runner-up and their paired names/);
  assert.match(markup, /exact champion, the runner-up, their paired names and any byline/);
  assert.match(markup, /data-download disabled=\{isDoor[^}]*isTournament/);
  assert.match(markup, /data-copy hidden=\{isTwentyOne[^}]*isTournament/);
});

test('the browser controller keeps the bracket local and never builds a link', () => {
  const controller = read('src/browser/share-experiences.ts');
  assert.match(controller, /game === "tech-tournament" \? mountTechTournament\(root, update\)/);
  assert.match(controller, /const shared = game === "red-flag-court" \|\| game === "twenty-one-questions"[^;]*game === "tech-tournament"/);
  assert.match(controller, /status\.textContent = "Pick a winner in all seven matches to download your winner card\."/);
  const nativeShare = controller.match(/if \(typeof navigator\.share === "function"([^\n]+)\) \{/);
  assert.match(nativeShare?.[1] ?? "", /&& game !== "tech-tournament"/);
  assert.match(controller, /game === "tech-tournament" \? techTournamentAltText\(snapshot\)/);

  const start = controller.indexOf('function mountTechTournament');
  const end = controller.indexOf('function mountBingo', start);
  assert.ok(start > 0 && end > start);
  const block = controller.slice(start, end);
  assert.match(block, /let ready = false;/);
  assert.match(block, /paint\(\);\s+copy\.disabled = false;\s+ready = true;\s+return \{/);
  assert.match(block, /const refresh = \(\) => \{ if \(ready\) update\(\); \};/);
  assert.match(block, /picks = techTournamentUndo\(picks\)/);
  assert.match(block, /linksAllowed: \(\) => false/);
  assert.match(block, /tournamentPicks: \[\.\.\.picks\]/);
  for (const forbidden of ['localStorage', 'sessionStorage', 'fetch(', 'resultLink', 'draftKey', 'sendBeacon', 'score', 'ranking']) {
    assert.equal(block.includes(forbidden), false, `the bracket does not use ${forbidden}`);
  }
});

test('the bracket invite copies only the canonical blank route and retires stale replies', () => {
  const controller = read('src/browser/share-experiences.ts');
  const start = controller.indexOf('function mountTechTournament');
  const end = controller.indexOf('function mountBingo', start);
  assert.ok(start > 0 && end > start);
  const block = controller.slice(start, end);
  const copyStart = block.indexOf('copy.addEventListener("click"');
  const copyEnd = block.indexOf('\n  });', copyStart);
  assert.ok(copyStart > 0 && copyEnd > copyStart);
  const handler = block.slice(copyStart, copyEnd);

  assert.match(handler, /const href = new URL\(experiencePath\("tech-tournament"\), location\.origin\)\.href;/);
  assert.doesNotMatch(handler, /location\.(?:href|search|hash)|byline|tournamentPicks|picks\s*=|restart\(/,
    'the invite never reads or changes this tab’s bracket or address');
  assert.match(handler, /copyManual\.value = href;\n\s+copyManual\.hidden = false;\n\s+copyManual\.focus\(\);\n\s+copyManual\.select\(\);/);
  assert.match(block, /function paint\([^)]*\) \{\n\s+clearCopyOffer\(\);/,
    'a bracket change retires the previous clipboard offer');
  assert.match(block, /paint\(\);\n\s+copy\.disabled = false;\n\s+ready = true;/,
    'the copy action stays disabled until the controller mounts');
});

test('the winner card draws the owned trophy crop and the exact outcome', () => {
  const image = read('src/browser/share-experience-image.ts');
  assert.match(image, /"tech-tournament": \[\["#171310", "#fbeee2", "#f07022"\]/);
  assert.match(image, /result\.game === "tech-tournament"\) return renderTechTournament/);
  assert.match(image, /const outcome = techTournamentOutcome\(result\.tournamentPicks\)/);
  assert.match(image, /drawFit\(ctx, outcome\.winner\.name/);
  assert.match(image, /drawFit\(ctx, outcome\.winner\.pair/);
  assert.match(image, /drawFit\(ctx, outcome\.runnerUp\.name/);
  assert.match(image, /drawFit\(ctx, outcome\.runnerUp\.pair/);
  assert.match(image, /const art = await picture\(result\.background\)/);
  assert.match(image, /drawImage\(art, sourceX, sourceY, sourceW, sourceH/);
  assert.match(image, /layout: ResultFormat = format === "wide" \? "wide" : "portrait"/);
  assert.match(image, /tournamentPicks\?: \(TechTournamentPick \| null\)\[\];/);
  assert.equal(image.includes('https://composer.loftwah.com'), false, 'the card makes no request');
});
