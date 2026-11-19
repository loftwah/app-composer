import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import child from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createAstroWebsite, astroWebsiteFiles } from '../lib/astro-website/create.mjs';
import { createAstroWebsiteWorkerConfig } from '../lib/astro-website/worker-config.mjs';
import { starterHtml } from '../src/lib/widget-recipe.ts';

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

test('an explicit Worker name writes only a bounded local wrangler.jsonc; the default scaffold is unchanged', () => {
  const root = fixture();
  try {
    const file = write(root, spec()), destination = join(root, 'named-site');
    const result = run(file, destination, ['--worker-name', 'field-notes-971']);
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(fs.readFileSync(join(destination, 'wrangler.jsonc'), 'utf8'));
    assert.deepEqual(config, createAstroWebsiteWorkerConfig('field-notes-971'));
    assert.deepEqual(config, {
      name: 'field-notes-971',
      compatibility_date: '2026-10-20',
      assets: {
        directory: './dist',
        not_found_handling: '404-page',
        html_handling: 'auto-trailing-slash',
      },
    });
    for (const forbidden of ['account_id', 'routes', 'vars', 'main', 'd1_databases',
      'r2_buckets', 'kv_namespaces', 'services', 'secrets', 'workers_dev'])
      assert.equal(Object.hasOwn(config, forbidden), false, forbidden);
    assert.equal(Object.hasOwn(config.assets, 'binding'), false);

    // The pure builder returns fresh, equal data and rejects invalid names.
    const first = createAstroWebsiteWorkerConfig('field-notes-971');
    const second = createAstroWebsiteWorkerConfig('field-notes-971');
    assert.deepEqual(first, second);
    assert.notEqual(first, second);
    assert.throws(() => createAstroWebsiteWorkerConfig('Field-Notes'));

    // No --worker-name: default scaffold, no wrangler.jsonc.
    const plain = join(root, 'plain-site');
    assert.equal(run(file, plain).status, 0);
    assert.equal(fs.existsSync(join(plain, 'wrangler.jsonc')), false);
    for (const [name, bytes] of Object.entries(astroWebsiteFiles(spec()).files))
      assert.equal(hash(fs.readFileSync(join(plain, name))), hash(bytes), name);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test('invalid or occupied Worker-name requests fail before any write and preserve an occupied destination', () => {
  const root = fixture();
  try {
    const file = write(root, spec());
    const invalid = [
      'Field-Notes',
      '-leading',
      'trailing-',
      'has_underscore',
      'has space',
      'trailing-newline\n',
      'a'.repeat(64),
      '',
    ];
    for (const [index, name] of invalid.entries()) {
      const destination = join(root, 'bad-' + index);
      assert.equal(run(file, destination, ['--worker-name', name]).status, 1, name);
      assert.equal(fs.existsSync(destination), false, name);
    }
    const occupied = join(root, 'occupied-named');
    fs.mkdirSync(occupied);
    fs.writeFileSync(join(occupied, 'owner.txt'), 'Fictional owner content');
    assert.equal(run(file, occupied, ['--worker-name', 'valid-name']).status, 1);
    assert.equal(fs.readFileSync(join(occupied, 'owner.txt'), 'utf8'), 'Fictional owner content');
    assert.equal(fs.existsSync(join(occupied, 'wrangler.jsonc')), false);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test('the optional Night Signal widget emits the exact starter; default and unknown values stay bounded', () => {
  const root = fixture();
  try {
    const file = write(root, spec());
    const widget = 'loftwahfm-night-signal-v1';

    // Supported flag: byte-for-byte the maintained .ts starter, on its own page.
    const destination = join(root, 'widget-site');
    const result = run(file, destination, ['--widget', widget]);
    assert.equal(result.status, 0, result.stderr);
    const radio = fs.readFileSync(join(destination, 'public/radio/index.html'));
    assert.equal(radio.toString('utf8'), starterHtml);

    // It composes with --worker-name without changing either artifact.
    const both = join(root, 'both-site');
    const bothResult = run(file, both, ['--worker-name', 'night-signal-971', '--widget', widget]);
    assert.equal(bothResult.status, 0, bothResult.stderr);
    assert.ok(fs.existsSync(join(both, 'wrangler.jsonc')));
    assert.equal(hash(fs.readFileSync(join(both, 'public/radio/index.html'))), hash(Buffer.from(starterHtml)));

    // The default scaffold has no radio page.
    const plain = join(root, 'plain-site');
    assert.equal(run(file, plain).status, 0);
    assert.equal(fs.existsSync(join(plain, 'public/radio/index.html')), false);
    for (const [name, bytes] of Object.entries(astroWebsiteFiles(spec()).files))
      assert.equal(hash(fs.readFileSync(join(plain, name))), hash(bytes), name);

    // Unknown flags fail before any write, including near misses.
    for (const [index, value] of [widget + '2', widget + '.json', 'Night-Signal', ''].entries()) {
      const target = join(root, 'bad-widget-' + index);
      assert.equal(run(file, target, ['--widget', value]).status, 1, value);
      assert.equal(fs.existsSync(target), false, value);
    }
    assert.throws(() => astroWebsiteFiles(spec(), undefined, widget + '2'));
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});
