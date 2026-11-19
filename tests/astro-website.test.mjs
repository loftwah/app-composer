import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createAstroWebsite, astroWebsiteFiles } from '../lib/astro-website/create.mjs';

const schema = 'app-composer/astro-website/v1';
const templateRoot = resolve('lib/astro-website/template');
const command = resolve('scripts/init-astro-website.mjs');
const fixture = () => fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'composer-astro-website-')));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const spec = (overrides = {}) => ({
  schema,
  title: 'Field notes',
  description: 'A small independent website.',
  about: 'A short introduction to the work.',
  firstPost: {
    title: 'First entry',
    description: 'Where this starts.',
    date: '2026-11-19',
    body: 'A first paragraph.\n\nA second paragraph.',
  },
  ...overrides,
});
const write = (root, data) => {
  const file = join(root, 'spec.json');
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
};
const run = (file, destination, extra = []) =>
  child.spawnSync(process.execPath, [command, '--spec', file, '--destination', destination, ...extra], { encoding: 'utf8' });
function tree(path) {
  return fs.readdirSync(path, { withFileTypes: true })
    .map((entry) => [entry.name, entry.isDirectory() ? tree(join(path, entry.name)) : entry.isSymbolicLink() ? 'link' : hash(fs.readFileSync(join(path, entry.name)))]);
}

test('the local CLI writes only the reviewed template and the spec-derived site and first post', () => {
  const root = fixture();
  try {
    const file = write(root, spec()), destination = join(root, 'new website café');
    const result = run(file, destination);
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.state, 'website-created');
    assert.equal(summary.dependenciesInstalled, false);
    assert.equal(summary.deployed, false);
    const files = astroWebsiteFiles(spec()).files;
    for (const [name, bytes] of Object.entries(files))
      assert.equal(hash(fs.readFileSync(join(destination, name))), hash(bytes), name);
    assert.deepEqual(JSON.parse(fs.readFileSync(join(destination, 'src/site.json'), 'utf8')), {
      title: 'Field notes',
      description: 'A small independent website.',
      about: 'A short introduction to the work.',
    });
    const post = fs.readFileSync(join(destination, 'src/content/posts/first-post.md'), 'utf8');
    assert.equal(post, [
      '---',
      'title: "First entry"',
      'description: "Where this starts."',
      'date: "2026-11-19"',
      'draft: false',
      '---',
      '',
      'A first paragraph.\n\nA second paragraph.\n',
    ].join('\n'));
    assert.equal(fs.existsSync(join(destination, 'node_modules')), false);
    assert.equal(fs.existsSync(join(destination, '.git')), false);
    assert.equal(fs.existsSync(join(destination, 'src/pages/posts/[slug]/index.astro')), true);
    assert.equal(hash(fs.readFileSync(join(destination, 'package.json'))), hash(fs.readFileSync(join(templateRoot, 'package.json'))));
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test('invalid specs and occupied or relative destinations fail before any write', () => {
  const root = fixture();
  try {
    const invalid = [
      spec({ schema: 'app-composer/astro-website/v2' }),
      spec({ firstPost: { ...spec().firstPost, date: '2026-02-30' } }),
      spec({ title: 7 }),
      { ...spec(), extra: 'unsupported' },
    ];
    for (const [index, data] of invalid.entries()) {
      const file = write(root, data), destination = join(root, 'invalid-' + index);
      assert.equal(run(file, destination).status, 1);
      assert.equal(fs.existsSync(destination), false);
    }
    const file = write(root, spec());
    const occupied = join(root, 'occupied');
    fs.mkdirSync(occupied);
    fs.writeFileSync(join(occupied, 'owner.txt'), 'Fictional owner content');
    assert.equal(run(file, occupied).status, 1);
    assert.equal(fs.existsSync(join(occupied, 'src/site.json')), false);
    assert.equal(fs.readFileSync(join(occupied, 'owner.txt'), 'utf8'), 'Fictional owner content');
    assert.equal(run(file, 'relative-destination').status, 1);
    assert.equal(child.spawnSync(process.execPath, [command, '--spec', file, '--destination', join(root, 'applied'), '--apply'], { encoding: 'utf8' }).status, 1);
    assert.equal(fs.existsSync(join(root, 'applied')), false);
    assert.equal(child.spawnSync(process.execPath, [command, '--spec', file, '--destination', join(root, 'installed'), '--install'], { encoding: 'utf8' }).status, 1);
    assert.equal(fs.existsSync(join(root, 'installed')), false);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test('adversarial text becomes literal text and cannot inject frontmatter or HTML', () => {
  const root = fixture();
  try {
    const payload = '</script><img src=x onerror=alert(1)>';
    const data = spec({
      title: 'A "quoted" title',
      about: 'Text with ' + payload,
      firstPost: {
        title: 'A "quoted" post title',
        description: 'A "quoted" description',
        date: '2026-11-19',
        body: payload + '\n\nKeep & share <literal> text.',
      },
    });
    const prepared = astroWebsiteFiles(data), files = prepared.files;
    assert.deepEqual(JSON.parse(files['src/site.json']), { title: data.title, description: data.description, about: data.about });
    const post = files['src/content/posts/first-post.md'].toString('utf8');
    assert.ok(post.includes(`title: ${JSON.stringify(data.firstPost.title)}\n`));
    assert.ok(post.includes(`description: ${JSON.stringify(data.firstPost.description)}\n`));
    assert.match(post, /^draft: false$/m);
    const body = post.slice(post.indexOf('\n---\n\n') + 6);
    assert.equal(body.includes('<'), false);
    assert.equal(body.includes('>'), false);
    assert.equal(body.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).trim(), data.firstPost.body);
    assert.equal(files['src/pages/index.astro'].includes('onerror'), false);
    const destination = join(root, 'literal-site');
    assert.equal(createAstroWebsite({ spec: data, destination }).state, 'website-created');
    assert.equal(hash(fs.readFileSync(join(destination, 'src/content/posts/first-post.md'))), hash(files['src/content/posts/first-post.md']));
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test('an interrupted write keeps partial output and never auto-replaces it', () => {
  const root = fixture(), destination = join(root, 'site'), original = child.spawnSync;
  let groups = 0, swapped = false;
  try {
    child.spawnSync = (...args) => {
      const request = JSON.parse(args[2].input);
      if (request.operation === 'files' && ++groups === 2 && !swapped) {
        swapped = true;
        return { status: 2, stdout: '', stderr: '' };
      }
      return original(...args);
    };
    syncBuiltinESMExports();
    assert.equal(swapped, false);
    assert.throws(() => createAstroWebsite({ spec: spec(), destination }));
    assert.equal(swapped, true);
    assert.equal(fs.existsSync(join(destination, 'package.json')), true);
    const before = tree(destination);
    child.spawnSync = original;
    syncBuiltinESMExports();
    assert.throws(() => createAstroWebsite({ spec: spec(), destination }));
    assert.deepEqual(tree(destination), before);
  } finally {
    child.spawnSync = original;
    syncBuiltinESMExports();
    fs.rmSync(root, { recursive: true });
  }
});
