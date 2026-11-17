import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  buildingQuickStart,
  creatorHubQuickStart,
  firstAppQuickStart,
  launchKitQuickStart,
  mediaStudioQuickStart,
  paperworkQuickStart,
  tutorialPromptKinds,
} from '../src/lib/tutorial-quick-start.mjs';
import {
  copyTutorialPrompt,
  tutorialCopyMessages,
} from '../src/lib/tutorial-copy.ts';

const pageUrl = (path) => new URL(`../${path}`, import.meta.url);

// The maintained inventory. A page with a substantial, reproducible tutorial
// belongs here; the shared component reads the same guide object in the test.
const inventory = [
  {
    page: 'src/pages/learn.astro',
    guide: 'firstAppQuickStart',
    data: firstAppQuickStart,
    body: '<div class="learn-layout"',
    tokens: ['learn', 'Get Ready', 'Hello'],
  },
  {
    page: 'src/pages/media-studio.astro',
    guide: 'mediaStudioQuickStart',
    data: mediaStudioQuickStart,
    body: '<section id="why"',
    tokens: ['composer-media-studio', 'Studio'],
  },
  {
    page: 'src/pages/media-studio/tutorial.astro',
    guide: 'mediaStudioQuickStart',
    data: mediaStudioQuickStart,
    body: '<section id="path"',
    tokens: ['composer-media-studio', 'Studio'],
  },
  {
    page: 'src/pages/building.astro',
    guide: 'buildingQuickStart',
    data: buildingQuickStart,
    body: '<div class="build-body"',
    tokens: ['/building', 'Linkarooie', 'Guestbook'],
  },
  {
    page: 'src/pages/creator-hub.astro',
    guide: 'creatorHubQuickStart',
    data: creatorHubQuickStart,
    body: '<section class="hub-section" id="brief"',
    tokens: ['creator-hub', 'Linkarooie', 'guestbook'],
  },
  {
    page: 'src/pages/paperwork.astro',
    guide: 'paperworkQuickStart',
    data: paperworkQuickStart,
    body: '<figure><a href={editor}',
    tokens: ['paperwork', 'XFA', '30 MB'],
  },
  {
    page: 'src/pages/launch-kit.astro',
    guide: 'launchKitQuickStart',
    data: launchKitQuickStart,
    body: '<section id="choose-output"',
    tokens: ['launch-kit', 'river-typography', 'manifest'],
  },
];

// Routes that look like tutorials but are evidence, admin-only or a general
// reference. The inventory document records the same reasons.
const excluded = [
  'src/pages/platform/demo.astro',
  'src/pages/studio.astro',
  'src/pages/guide.astro',
];

test('every applicable tutorial renders the one shared quick start above its long body', () => {
  const component = readFileSync(
    new URL('../src/components/TutorialQuickStart.astro', import.meta.url),
    'utf8',
  );
  for (const entry of inventory) {
    const page = readFileSync(pageUrl(entry.page), 'utf8');
    const componentAt = page.indexOf(`<TutorialQuickStart guide={${entry.guide}} />`);
    assert.ok(componentAt >= 0, `${entry.page} must render ${entry.guide} through the shared component`);
    assert.equal(page.split('<TutorialQuickStart').length - 1, 1, `${entry.page} renders one quick start`);
    assert.match(page, /import TutorialQuickStart from '[^']*components\/TutorialQuickStart\.astro'/, `${entry.page} imports the shared component`);
    assert.match(page, new RegExp(`import \\{[^}]*\\b${entry.guide}\\b[^}]*\\} from '[^']*tutorial-quick-start\\.mjs'`), `${entry.page} imports its guide data`);
    const headingAt = page.indexOf('<h1');
    const bodyAt = page.indexOf(entry.body);
    assert.ok(headingAt >= 0 && headingAt < componentAt, `${entry.page} keeps the main heading first`);
    assert.ok(bodyAt > componentAt, `${entry.page} keeps the quick start above its long body`);
    assert.ok(component.length > 0);
  }
  for (const page of excluded) {
    assert.ok(existsSync(pageUrl(page)), `${page} still exists; update the inventory if the route moved`);
  }
});

test('every guide states the built result, behaviour, named needs and working result', () => {
  for (const { page, data } of inventory) {
    assert.ok(data.summary.length >= 120, `${page} summary explains the outcome`);
    assert.ok(data.outcome.built.length >= 60, `${page} names what gets built`);
    assert.ok(data.outcome.does.length >= 60, `${page} names what it does`);
    assert.ok(data.outcome.result.length >= 60, `${page} names the working result`);
    assert.ok(data.outcome.needs.length >= 2 && data.outcome.needs.length <= 8, `${page} lists real prerequisites`);
    for (const need of data.outcome.needs) {
      assert.ok(need.length >= 3 && need.length <= 120, `${page} need stays a short name: ${need}`);
      assert.doesNotMatch(need, /[=]|:\/\//, `${page} need is a name, never a value or link: ${need}`);
    }
    assert.ok(data.links.length >= 2, `${page} links a real demo, source or maintained route`);
    assert.ok(data.links.some((link) => link.href.startsWith('https://')), `${page} links published evidence or source`);
    assert.ok(data.links.some((link) => link.href.startsWith('/')), `${page} links a maintained Composer route`);
  }
});

test('prompts distinguish reproduction, existing-app work and explanation without duplicating text', () => {
  const texts = new Set();
  const seenGuides = new Set();
  for (const { page, guide, data, tokens } of inventory) {
    if (seenGuides.has(guide)) continue;
    seenGuides.add(guide);
    assert.equal(new Set(data.prompts.map((prompt) => prompt.id)).size, data.prompts.length, `${page} prompt ids are unique`);
    assert.equal(new Set(data.prompts.map((prompt) => prompt.label)).size, data.prompts.length, `${page} prompt labels are unique`);
    assert.ok(data.prompts.some((prompt) => prompt.kind === 'reproduce'), `${page} offers a reproduction prompt`);
    for (const prompt of data.prompts) {
      assert.ok(tutorialPromptKinds.includes(prompt.kind), `${page} ${prompt.id} uses a supported kind`);
      assert.ok(prompt.text.length >= 500, `${page} ${prompt.id} is complete enough to stand alone`);
      assert.ok(prompt.text.length <= 8000, `${page} ${prompt.id} stays copyable rather than sprawling`);
      assert.equal(prompt.text, prompt.text.trim(), `${page} ${prompt.id} has no outer whitespace, so copy matches the panel`);
      assert.doesNotMatch(prompt.text, /\{\{[^}]*\}\}|<(?:your|insert)[^>]*>|\[(?:your|insert|todo)\b|\b(?:TODO|TBD|FIXME|XXX)\b/i, `${page} ${prompt.id} has no placeholder`);
      assert.match(prompt.text, /verif|evidence|confirm|prove/i, `${page} ${prompt.id} says how to verify the result`);
      assert.match(prompt.text, /my own|own accounts|example owner|credentials|secrets/i, `${page} ${prompt.id} keeps ownership boundaries`);
      assert.match(prompt.text, /do not|ask me|approval|permission|sign[- ]in/i, `${page} ${prompt.id} stops for human authority`);
      const matched = tokens.filter((token) => prompt.text.toLowerCase().includes(token.toLowerCase()));
      assert.ok(matched.length >= 1, `${page} ${prompt.id} names this tutorial or its subject`);
      assert.doesNotMatch(prompt.text, /\b(?:sk|pk|rk)_[A-Za-z0-9]{10,}\b/, `${page} ${prompt.id} contains no credential-shaped value`);
      assert.doesNotMatch(prompt.text, /\b(?:FAL_KEY|SESSION_SECRET|OWNER_PASSPHRASE|BRIDGE_SECRET)\s*=\s*\S+/, `${page} ${prompt.id} names secrets without values`);
      const normalised = prompt.text.replace(/\s+/g, ' ').trim();
      assert.ok(!texts.has(normalised), `${page} ${prompt.id} repeats another tutorial prompt`);
      texts.add(normalised);
    }
    const guideMatches = tokens.filter((token) => data.prompts.some((prompt) => prompt.text.toLowerCase().includes(token.toLowerCase())));
    assert.ok(guideMatches.length >= 2, `${page} prompts stay specific to ${tokens.join(', ')}`);
  }
  assert.ok(inventory.some(({ data }) => data.prompts.some((prompt) => prompt.kind === 'add')), 'existing-app work is a distinct prompt');
  assert.ok(inventory.some(({ data }) => data.prompts.some((prompt) => prompt.kind === 'explain' || prompt.kind === 'next')), 'a read-only or next-step prompt is available');
});

test('the component renders the same guide text it copies and provides an accessible fallback', () => {
  const component = readFileSync(
    new URL('../src/components/TutorialQuickStart.astro', import.meta.url),
    'utf8',
  );
  assert.match(component, /<pre[^>]*data-prompt[^>]*>\{prompt\.text\}<\/pre>/, 'the visible panel is the prompt text');
  assert.match(component, /prompt\.textContent/, 'copy reads the visible panel rather than a second source');
  assert.match(component, /copyTutorialPrompt\(/, 'copy uses the tested outcome helper');
  assert.match(component, /role="status" aria-live="polite" aria-atomic="true"/, 'the result is announced');
  assert.match(component, /data-copy-fallback hidden/, 'the manual fallback starts hidden');
  assert.match(component, /selectNodeContents\(prompt\)/, 'a failed copy selects the panel');
  assert.match(component, /prompt\.focus\(\{ preventScroll: true \}\)/, 'a failed copy moves focus to the readable prompt');
  assert.match(component, /button\.disabled = false/, 'copy is enabled only when the client code runs');
  assert.match(component, /disabled\s*\n?\s*>/, 'the server-rendered copy button is disabled without JavaScript');
  assert.match(component, /Copy build prompt/, 'the reproduction action is named');
  assert.match(component, /aria-label=\{`\$\{copyLabels\[prompt\.kind\]\}: \$\{prompt\.label\}`\}/, 'each copy control names its own prompt');
  assert.match(component, /<details class="prompt-item"/, 'the full prompt uses a native disclosure');
  assert.match(component, /<summary>/, 'the disclosure has a native summary');
  assert.match(component, /min-height: 48px/, 'touch targets stay at least 48px high');
  assert.doesNotMatch(component, /position:\s*sticky/i, 'the quick start never collides with sticky navigation');
  assert.match(component, /guide\.outcome\.built/, 'the TL;DR renders what gets built');
  assert.match(component, /guide\.outcome\.needs\.map/, 'the TL;DR renders the named prerequisites');
  assert.match(component, /guide\.outcome\.result/, 'the TL;DR renders the expected result');
});

test('copy decisions preserve the exact visible text and report denial or an empty panel', async () => {
  const text = 'Goal\nBuild the result.\n\nVerify it.';
  let written = '';
  assert.equal(await copyTutorialPrompt(text, async (value) => { written = value; }), 'copied');
  assert.equal(written, text, 'the clipboard receives the exact visible text, including blank lines');
  assert.equal(await copyTutorialPrompt(text, async () => { throw new Error('NotAllowedError'); }), 'manual');
  assert.equal(await copyTutorialPrompt(text, undefined), 'manual');
  assert.equal(await copyTutorialPrompt(text, null), 'manual');
  assert.equal(await copyTutorialPrompt('  \n\n ', async () => undefined), 'empty');
  assert.match(tutorialCopyMessages.copied, /same/);
  assert.match(tutorialCopyMessages.manual, /selected/);
  assert.match(tutorialCopyMessages.empty, /reload/);
});

test('the inventory document names every covered and excluded tutorial', () => {
  const doc = readFileSync(new URL('../docs/tutorial-quick-starts.md', import.meta.url), 'utf8');
  for (const { page } of inventory) assert.ok(doc.includes(page), `inventory document lists ${page}`);
  for (const page of excluded) assert.ok(doc.includes(page), `inventory document explains ${page}`);
  assert.match(doc, /\/media-studio/);
  assert.match(doc, /CMS-owned/);
});

test('the building prompt carries the pinned revisions, runtime and each app’s real bindings', () => {
  const prompt = buildingQuickStart.prompts.find((entry) => entry.id === 'reproduce');
  assert.ok(prompt);
  assert.match(prompt.text, /Node 22 exactly/);
  assert.match(prompt.text, /pnpm 12\.8\.1/);
  assert.match(prompt.text, /019ce0d117f9f89e472a5c7642d51d85301f7fcd/);
  assert.match(prompt.text, /20ef9a50c19c7a3419dc06fdae020c6a677ed5cf/);
  assert.match(prompt.text, /ITEM_PROVIDER/);
  assert.match(prompt.text, /Linkarooie has D1/);
  assert.match(prompt.text, /not its own R2 bucket/);
  assert.match(prompt.text, /capture-journey\.mjs/);
  assert.match(prompt.text, /RESOURCE_ACCOUNT_ID/);
  assert.match(prompt.text, /PROVIDER_MOUNT/);
  assert.match(prompt.text, /'Pristine' means leaving them at those revisions without edits or commits/);
  assert.doesNotMatch(prompt.text, /22, 24 or 26/);
  assert.doesNotMatch(prompt.text, /D1 and R2 bindings/);
  assert.match(buildingQuickStart.outcome.needs.join(' '), /Node 22 and pnpm 12\.8\.1/);
  assert.match(buildingQuickStart.outcome.needs.join(' '), /GitHub and Cloudflare only for your own copies or a deployment/);
  assert.doesNotMatch(buildingQuickStart.outcome.needs.join(' '), /22, 24 or 26/);
  assert.doesNotMatch(readFileSync(pageUrl('src/pages/building.astro'), 'utf8'), /supported Node line \(22, 24 or 26\)/);
});

test('a newcomer can create the building lab prerequisites from the copied prompt', () => {
  // A fresh agent with the copied prompt alone stopped because the prompt said
  // the lab copies the sibling checkouts but never told it to make them.
  const prompt = buildingQuickStart.prompts.find((entry) => entry.id === 'reproduce');
  assert.ok(prompt);
  assert.match(prompt.text, /local run needs no GitHub or Cloudflare account/);
  assert.match(prompt.text, /git clone https:\/\/github\.com\/loftwah\/app-composer \./);
  assert.match(prompt.text, /git clone https:\/\/github\.com\/loftwah\/app-composer-guestbook \.\.\/app-composer-guestbook/);
  assert.match(prompt.text, /git clone https:\/\/github\.com\/loftwah\/app-composer-showcase \.\.\/app-composer-showcase/);
  assert.match(prompt.text, /git -C \.\.\/app-composer-guestbook checkout 019ce0d117f9f89e472a5c7642d51d85301f7fcd/);
  assert.match(prompt.text, /git -C \.\.\/app-composer-showcase checkout 20ef9a50c19c7a3419dc06fdae020c6a677ed5cf/);
  assert.match(prompt.text, /pnpm install --frozen-lockfile/);
  assert.match(prompt.text, /creating the checkouts is the first step/);
  assert.match(prompt.text, /npm install playwright/);
  assert.match(prompt.text, /node_modules\/playwright\/index\.mjs/);
  const page = readFileSync(pageUrl('src/pages/building.astro'), 'utf8');
  assert.match(page, /git clone https:\/\/github\.com\/loftwah\/app-composer-guestbook/);
  assert.match(page, /npm install playwright/);
  const labReadme = readFileSync(pageUrl('labs/building/README.md'), 'utf8');
  assert.match(labReadme, /git clone https:\/\/github\.com\/loftwah\/app-composer-guestbook/);
  assert.match(labReadme, /npm install playwright/);
});

test('the Creator Hub prompt names its exact revisions, runtime and real owner path', () => {
  const prompt = creatorHubQuickStart.prompts.find((entry) => entry.id === 'reproduce');
  assert.ok(prompt);
  assert.match(prompt.text, /36797b8028682460c33fe092682bfbd63751ec1a/);
  assert.match(prompt.text, /acca7da3bfac4ebc28fca67a35ac373b23747409/);
  assert.match(prompt.text, /Node 22 and pnpm 12\.8\.1/);
  assert.match(prompt.text, /OWNER_API_TOKEN/);
  assert.match(prompt.text, /Cloudflare Access is not required/);
  assert.match(prompt.text, /hunter2/);
  assert.match(prompt.text, /cannot sign in to \/owner/);
  assert.doesNotMatch(prompt.text, /guest code I choose/);
  assert.doesNotMatch(prompt.text, /Cloudflare Access for the administrator panel/);
  assert.ok(creatorHubQuickStart.links.some((link) => link.href.includes('36797b8028682460c33fe092682bfbd63751ec1a')));
  assert.ok(creatorHubQuickStart.links.some((link) => link.href.includes('acca7da3bfac4ebc28fca67a35ac373b23747409')));
  assert.doesNotMatch(creatorHubQuickStart.outcome.needs.join(' '), /Cloudflare Access/);
  assert.doesNotMatch(creatorHubQuickStart.outcome.needs.join(' '), /guest code/);
});

test('the Media Studio build prompt names the real runtime, resources and source pin', () => {
  const prompt = mediaStudioQuickStart.prompts.find((entry) => entry.id === 'build');
  assert.ok(prompt);
  assert.match(prompt.text, /22\.23\.5/);
  assert.match(prompt.text, /pnpm 12\.19\.0/);
  assert.match(prompt.text, /Workers Paid/);
  assert.match(prompt.text, /error 9432/);
  assert.match(prompt.text, /RENDER_ORIGIN/);
  assert.match(prompt.text, /0001–0025 at the current fallback pin/);
  assert.match(prompt.text, /LAUNCH_KIT_URL/);
  assert.match(prompt.text, /workers\.dev hostname/);
  assert.match(prompt.text, /MEDIA_STUDIO_ORIGIN/);
  assert.match(prompt.text, /pnpm run deploy -- --migrate/);
  assert.match(prompt.text, /b5ef8f629c709c77c25b889bc3e61d0f5a6e90a6/);
  assert.match(prompt.text, /Have me enter OWNER_PASSPHRASE directly/);
});
