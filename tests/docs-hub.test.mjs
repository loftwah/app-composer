import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  docsGuideLinks,
  docsReferenceSections,
  docsSearchCount,
  docsTaskPaths,
  docsUnavailable,
  legacyDocsAnchors,
  searchDocs,
} from '../src/lib/docs-hub.ts';
import { promptModule, renderPrompt } from '../src/lib/prompt-library.ts';
import { publicPagePaths } from '../src/lib/public-pages.mjs';

const hub = readFileSync(new URL('../src/pages/docs.astro', import.meta.url), 'utf8');
const reference = readFileSync(new URL('../src/pages/docs/how-it-works.astro', import.meta.url), 'utf8');

function sourceFiles(directory) {
  return readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:astro|ts|mjs)$/.test(entry) ? [path] : [];
  });
}

test('six plain-language task paths carry an outcome, prerequisites, action, guide and next step', () => {
  assert.equal(docsTaskPaths.length, 6, 'the hub promises six starting points');
  assert.equal(new Set(docsTaskPaths.map(item => item.id)).size, 6);
  assert.equal(new Set(docsTaskPaths.map(item => item.anchor)).size, 6);
  for (const task of docsTaskPaths) {
    assert.match(task.anchor, /^path-[a-z-]+$/, `${task.id} needs a stable anchor`);
    assert.ok(task.question.endsWith('?') || /^(I|Add|Publish|Improve)/.test(task.question), `${task.id} question reads like a task`);
    assert.ok(task.outcome.length > 40, `${task.id} outcome must explain the result`);
    assert.ok(task.prerequisites.length >= 2, `${task.id} needs real prerequisites`);
    assert.ok(task.prerequisites.every(item => item.length > 20), `${task.id} prerequisites must be specific`);
    assert.ok(task.promptNote.length > 60, `${task.id} must explain the prompt before copying`);
    assert.ok(task.limit.length > 30, `${task.id} needs a concrete current limit`);
    assert.notEqual(task.guide.href, task.next.href, `${task.id} guide and next step stay different`);
    assert.ok(task.guide.href.startsWith('/'), `${task.id} guide must be a maintained route`);
    assert.ok(task.next.href.startsWith('/') || task.next.href.startsWith('#'), `${task.id} next step must resolve`);
    for (const link of task.also ?? []) assert.ok(link.href.startsWith('/'), `${task.id} related prompt must resolve`);
  }
});

test('every task action is a canonical prompt from the shared library', () => {
  for (const task of docsTaskPaths) {
    const prompt = promptModule(task.promptId);
    assert.ok(prompt, `${task.id} points at a real prompt module`);
    assert.ok(['Ready to use', 'Assess and prepare'].includes(prompt.support), `${task.id} uses a maintained support status`);
    const template = renderPrompt(task.promptId, {}, { template: true });
    assert.ok(template.text.length > 200, `${prompt.id} has real canonical text`);
    assert.doesNotMatch(template.text, /undefined|null/, `${prompt.id} template has no missing interpolation`);
    assert.match(template.text, /Your project: \[PROJECT\]/, `${prompt.id} template names its project field`);
  }
});

test('in-page next steps resolve to another task anchor', () => {
  const anchors = new Set(docsTaskPaths.map(task => `#${task.anchor}`));
  for (const task of docsTaskPaths) {
    if (task.next.href.startsWith('#')) assert.ok(anchors.has(task.next.href), `${task.id} next step ${task.next.href} must exist`);
  }
});

test('the technical reference keeps every maintained section and legacy anchor', () => {
  assert.ok(publicPagePaths.includes('/docs/how-it-works'));
  assert.ok(existsSync(new URL('../src/pages/docs/how-it-works.astro', import.meta.url)));
  assert.equal(docsReferenceSections.length, 17);
  const sectionIds = new Set(docsReferenceSections.map(section => section.id));
  const rendered = [...reference.matchAll(/<section class="section"[^>]*id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(rendered.length, 17, 'all seventeen reference sections carry an id');
  for (const id of sectionIds) assert.ok(rendered.includes(id), `reference section ${id} is present`);
  const originalAnchors = [
    'standalone-get-ready', 'local-get-ready-mcp', 'domain-diagnosis', 'workspace-tools',
    'app-settings', 'hello-init', 'guestbook-contributions', 'state-vision',
    'project-inspection', 'reference-dependencies', 'project-preparation', 'content-project',
  ];
  for (const anchor of originalAnchors) assert.ok(legacyDocsAnchors.includes(anchor), `${anchor} stays reachable`);
  assert.deepEqual([...legacyDocsAnchors], [...sectionIds], 'every reference section is a legacy target');
});

test('plain and technical searches return maintained results', () => {
  const fixtures = [
    ['make a site', 'tasks', 'have-an-idea'],
    ['publish', 'tasks', 'publish-share'],
    ['fix a broken app', 'tasks', 'improve-operate'],
    ['new to agents', 'tasks', 'new-to-agents'],
    ['codex', 'tasks', 'new-to-agents'],
    ['github', 'tasks', 'existing-project'],
    ['cloudflare', 'tasks', 'new-to-agents'],
    ['edit content', 'tasks', 'add-something'],
    ['add a form', 'tasks', 'add-something'],
    ['MCP', 'sections', 'local-get-ready-mcp'],
    ['rollback', 'sections', 'updates-and-rollback'],
    ['healthz', 'sections', 'page-performance'],
    ['database', 'tasks', 'improve-operate'],
    ['stripe', 'guides', 'commerce'],
    ['connect instagram', 'unavailable', 'instagram'],
    ['customer login', 'unavailable', 'customer-login'],
    ['one click wordpress import', 'unavailable', 'wordpress-import'],
    ['deploy for me', 'unavailable', 'hosted-deploy'],
  ];
  for (const [query, group, id] of fixtures) {
    const result = searchDocs(query);
    assert.ok(result[group].includes(id), `“${query}” must find ${group}:${id} (got ${JSON.stringify(result)})`);
  }
});

test('search is case, punctuation and apostrophe insensitive with an honest empty state', () => {
  assert.deepEqual(searchDocs('   '), {
    tasks: docsTaskPaths.map(item => item.id),
    sections: docsReferenceSections.map(item => item.id),
    guides: docsGuideLinks.map(item => item.id),
    unavailable: docsUnavailable.map(item => item.id),
  });
  assert.equal(docsSearchCount(searchDocs('')), 6 + 17 + docsGuideLinks.length + docsUnavailable.length);
  const curly = searchDocs('I’m NEW to Agents!');
  assert.ok(curly.tasks.includes('new-to-agents'));
  const miss = searchDocs('quantum banana telescope');
  assert.deepEqual(miss, { tasks: [], sections: [], guides: [], unavailable: [] });
  assert.equal(docsSearchCount(miss), 0);
});

test('unsupported requests stay explicitly unavailable with a real closest route', () => {
  assert.equal(docsUnavailable.length, 6);
  assert.equal(new Set(docsUnavailable.map(item => item.id)).size, docsUnavailable.length);
  for (const item of docsUnavailable) {
    assert.ok(item.explanation.length > 60, `${item.id} explains the missing capability`);
    assert.ok(item.closest.href.startsWith('/') || item.closest.href.startsWith('#'), `${item.id} closest route resolves`);
    assert.ok(!docsTaskPaths.some(task => task.question === item.request), `${item.id} is not presented as a shipped task`);
  }
});

test('the hub renders the required first viewport and reuses the prompt renderer', () => {
  assert.match(hub, /What do you want to make or do\?/);
  assert.match(hub, /Use the agent you choose\./);
  assert.match(hub, /the app, source and data stay yours/);
  assert.match(hub, /href="\/prompts">Get a prompt for my agent/);
  assert.match(hub, /data-docs-search/);
  assert.match(hub, /href="\/docs\/how-it-works"/);
  for (const task of docsTaskPaths) {
    assert.ok(task.id.length > 2, `${task.id} is a real task id`);
  }
  assert.match(hub, /data-docs-task=\{task\.id\}/, 'every task is server-rendered');
  assert.match(hub, /data-docs-copy=\{task\.id\}/, 'every task has a copy action');
  assert.match(hub, /href=\{`\/prompts#\$\{task\.promptId\}`\}/, 'every task opens its canonical prompt');
  assert.match(hub, /renderPrompt\(task\.promptId, \{\}, \{ template: true \}\)/);
  assert.doesNotMatch(hub, /Inspect the actual project and its trusted instructions first\./, 'prompt prose is not forked into the page');
  assert.match(hub, /import '\.\.\/lib\/docs-hub-client'/, 'the local search stays the only client behaviour');
});

test('internal documentation links point at the stable reference route', () => {
  const stale = sourceFiles(new URL('../src/', import.meta.url).pathname)
    .filter(path => readFileSync(path, 'utf8').includes('/docs#'))
    .map(path => path.replace(new URL('../', import.meta.url).pathname, ''));
  assert.deepEqual(stale, [], 'legacy /docs# links move to /docs/how-it-works#');
});

test('the reference prose is preserved rather than summarised away', () => {
  assert.match(reference, /Portable assistant context/);
  assert.match(reference, /Turn a field model into a local EmDash site/);
  assert.match(reference, /Update without losing your work/);
  assert.match(reference, /Code rollback restores an executable only/);
  assert.match(reference, /optional local Get Ready MCP adapter/);
  assert.ok(reference.length > 25000, 'the complete reference content is retained');
});
