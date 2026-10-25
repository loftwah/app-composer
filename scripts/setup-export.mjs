#!/usr/bin/env node
// Capture the actual Markdown a visitor gets from the public /setup UI, plus
// the role-pack downloads, for the fresh-agent evaluation. This records what was
// exported; it never starts an agent or claims a setup attempt.
//
//   node scripts/setup-export.mjs --origin http://127.0.0.1:4377
//
// The local render must come from the committed source under review. The
// captured files are fictional inputs stored in labs/fresh-agent/guides/ with a
// hash receipt so a later run can prove which bytes an agent received.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '..');
const lab = resolve(repository, 'labs/fresh-agent');
const guides = resolve(lab, 'guides');
const casesDir = resolve(lab, 'cases');

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const origin = option('--origin', 'http://127.0.0.1:4377').replace(/\/$/, '');

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return import(process.env.PLAYWRIGHT_MODULE);
  const base = `${process.env.HOME}/.npm/_npx`;
  const candidates = [];
  try {
    for (const entry of readdirSync(base)) {
      const path = `${base}/${entry}/node_modules/playwright/index.mjs`;
      try { candidates.push([statSync(path).mtimeMs, path]); } catch { /* not installed here */ }
    }
  } catch { /* no npx cache */ }
  candidates.sort((a, b) => b[0] - a[0]);
  for (const [, path] of candidates) {
    try { return await import(path); } catch { /* try the next one */ }
  }
  return import('playwright');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const caseFiles = readdirSync(casesDir).filter((name) => name.endsWith('.json')).sort();
const cases = caseFiles.map((name) => ({ file: name, ...JSON.parse(readFileSync(resolve(casesDir, name), 'utf8')) }));
if (cases.length === 0) throw new Error('No fresh-agent cases are defined.');
if (cases.length > 20) throw new Error('Refusing more than 20 cases in one bounded capture.');

mkdirSync(guides, { recursive: true });
const playwright = await loadPlaywright();
const browser = await playwright.chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const originStatus = await page.goto(`${origin}/setup`, { waitUntil: 'domcontentloaded' });
if (!originStatus || originStatus.status() !== 200) throw new Error(`/setup did not answer 200 at ${origin}.`);

const receipt = {
  schema: 'composer.fresh-agent-exports/1',
  capturedAt: new Date().toISOString(),
  origin,
  source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--porcelain'], { cwd: repository, encoding: 'utf8' }).trim().split('\n').filter(Boolean).slice(0, 20),
  browser: `Chromium ${browser.version()} via Playwright ${playwright.version ?? 'unknown'}`,
  note: 'Captured from the real /setup form and the real role-pack download routes on a local render of this source. Settings are fictional. Nothing was deployed.',
  exports: [],
};

for (const entry of cases) {
  if (entry.export) {
    const settings = entry.export;
    const fields = { mode: settings.mode, target: settings.target, project: settings.project ?? '', outcome: settings.outcome ?? '', constraints: settings.constraints ?? '' };
    for (const [name, value] of Object.entries(fields)) {
      if (typeof value !== 'string' || value.length > 2400) throw new Error(`Unsupported ${name} in ${entry.file}.`);
    }
    if (!['new', 'existing', 'resume'].includes(settings.mode)) throw new Error(`Unsupported mode in ${entry.file}.`);
    await page.goto(`${origin}/setup`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`${origin}/setup`, { waitUntil: 'domcontentloaded' });
    await page.check(`input[name="mode"][value="${settings.mode}"]`);
    await page.selectOption('select[name="target"]', settings.target);
    await page.fill('input[name="project"]', fields.project);
    await page.fill('textarea[name="outcome"]', fields.outcome);
    if (await page.locator('details.setup-options').evaluate((node) => !node.open)) await page.click('details.setup-options > summary');
    await page.fill('textarea[name="constraints"]', fields.constraints);
    if (settings.deploy === true) await page.check('input[name="deploy"]');
    const value = await page.locator('#setup-preview').inputValue();
    if (!value.includes('Guide: app-composer.project-setup/1')) throw new Error(`The exported guide for ${entry.id} is not the expected schema.`);
    if (value.length > 60000) throw new Error(`The exported guide for ${entry.id} exceeds the UI limit.`);
    const path = resolve(guides, `${entry.id}.md`);
    writeFileSync(path, value);
    receipt.exports.push({
      case: entry.id,
      kind: 'setup-guide',
      file: `guides/${entry.id}.md`,
      bytes: Buffer.byteLength(value),
      sha256: sha256(value),
      settings: { mode: fields.mode, target: fields.target, deploy: settings.deploy === true, projectChars: fields.project.length, outcomeChars: fields.outcome.length, constraintsChars: fields.constraints.length },
    });
    console.log(`captured ${entry.id}: ${Buffer.byteLength(value)} bytes ${sha256(value).slice(0, 12)}…`);
  }
  if (entry.pack) {
    const response = await page.request.get(`${origin}/roles/v1/${entry.pack}.md`);
    if (!response.ok()) throw new Error(`/roles/v1/${entry.pack}.md answered ${response.status()}.`);
    const text = await response.text();
    if (!text.startsWith('# ') || text.length > 60000) throw new Error(`Unexpected role-pack export for ${entry.pack}.`);
    const path = resolve(guides, `${entry.id}-pack.md`);
    writeFileSync(path, text);
    receipt.exports.push({ case: entry.id, kind: 'role-pack', file: `guides/${entry.id}-pack.md`, bytes: Buffer.byteLength(text), sha256: sha256(text), pack: entry.pack });
    console.log(`captured ${entry.id}: role pack ${entry.pack}, ${Buffer.byteLength(text)} bytes`);
  }
}

await context.close();
await browser.close();
writeFileSync(resolve(guides, 'provenance.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(`Wrote ${receipt.exports.length} exports and guides/provenance.json.`);
