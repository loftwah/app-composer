// Supported local Astro + Markdown website scaffold. Spec text never becomes
// executable source: frontmatter is JSON-quoted and post text is escaped.
import { lstatSync, realpathSync } from 'node:fs';
import { resolve, dirname, basename, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { selectedFile } from '../get-ready/project-files.mjs';
import { childDirectory, mutate } from '../get-ready/project-write.mjs';
import { normalizeAstroWebsiteSpec } from '../../src/lib/astro-website-spec.mjs';
import { createAstroWebsiteWorkerConfig } from './worker-config.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const templateRoot = 'lib/astro-website/template';
const templateFiles = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'astro.config.mjs',
  'tsconfig.json',
  '.gitignore',
  'README.md',
  'src/content.config.ts',
  'src/content/posts/first-post.md',
  'src/layouts/SiteLayout.astro',
  'src/pages/index.astro',
  'src/pages/about.astro',
  'src/pages/posts/index.astro',
  'src/pages/posts/[slug]/index.astro',
  'src/pages/404/index.astro',
  'src/site.json',
];
const reviewedPatches = ['patches/picomatch@2.3.2.patch', 'patches/picomatch@4.0.7.patch'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Keep brief text literal when Astro renders the generated Markdown.
const escapeText = (text) => text
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map(line => line.trimStart().replace(/[&<>\\`*_#[\]~]/g, char => `&#${char.charCodeAt(0)};`))
  .join('\n');

function renderFirstPost(post) {
  const body = escapeText(post.body);
  return [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(post.description)}`,
    `date: ${JSON.stringify(post.date)}`,
    'draft: false',
    '---',
    '',
    body + (body.endsWith('\n') ? '' : '\n'),
  ].join('\n');
}

function capture(name) {
  const file = selectedFile(repository, name, 1048576);
  if (file.state !== 'present')
    throw Error('A reviewed Astro website template file is unavailable or changed. No existing project was replaced.');
  return file;
}

function bound(path) {
  let cursor = path;
  const entries = [];
  while (true) {
    const stat = lstatSync(cursor);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw Error('Choose an existing unlinked parent folder.');
    entries.push({ path: cursor, dev: stat.dev, ino: stat.ino });
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const check = () => {
    for (const entry of entries) {
      const stat = lstatSync(entry.path);
      if (!stat.isDirectory() || stat.isSymbolicLink() ||
          stat.dev !== entry.dev || stat.ino !== entry.ino)
        throw Error('The selected project parent changed. Prepared files are retained.');
    }
  };
  check.identity = { dev: entries[0].dev, ino: entries[0].ino };
  return check;
}

export function astroWebsiteFiles(input, workerName) {
  const spec = normalizeAstroWebsiteSpec(input), files = {}, captures = [];
  const add = (source, output) => {
    const file = capture(source);
    files[output] = file.data;
    captures.push({ name: source, sha256: file.sha256 });
  };
  for (const name of templateFiles) add(templateRoot + '/' + name, name);
  for (const name of reviewedPatches) add(name, name.replace('@', '-'));
  files['src/site.json'] = Buffer.from(
    JSON.stringify({ title: spec.title, description: spec.description, about: spec.about }, null, 2) + '\n',
  );
  files['src/content/posts/first-post.md'] = Buffer.from(renderFirstPost(spec.firstPost));
  if (workerName !== undefined)
    files['wrangler.jsonc'] = Buffer.from(
      JSON.stringify(createAstroWebsiteWorkerConfig(workerName), null, 2) + '\n',
    );
  return {
    spec,
    files,
    recheck: () => {
      for (const entry of captures)
        if (capture(entry.name).sha256 !== entry.sha256)
          throw Error('The Astro website template changed. Prepared files are retained for inspection.');
    },
  };
}

export function createAstroWebsite(options = {}) {
  const { spec: input, destination, workerName, ...unknown } = options;
  if (Object.keys(unknown).length ||
      typeof destination !== 'string' ||
      !isAbsolute(destination) ||
      resolve(destination) !== destination ||
      destination.includes('\0') ||
      destination === dirname(destination))
    throw Error('Choose one explicit absent absolute project directory.');
  const prepared = astroWebsiteFiles(input, workerName);
  const { files, recheck } = prepared;
  const parent = dirname(destination);
  if (realpathSync(parent) !== parent)
    throw Error('Choose the canonical, unlinked existing parent folder.');
  const check = bound(parent);
  recheck();
  check();
  const rootIdentity = childDirectory(parent, check.identity, basename(destination), true);
  const directories = new Map([['', rootIdentity]]);
  const ensure = (relative) => {
    if (directories.has(relative)) return directories.get(relative);
    const parentRelative = dirname(relative) === '.' ? '' : dirname(relative);
    const identity = childDirectory(join(destination, parentRelative), ensure(parentRelative), basename(relative), true);
    directories.set(relative, identity);
    return identity;
  };
  const groups = new Map();
  for (const name of Object.keys(files)) {
    const bytes = files[name];
    if (!bytes) throw Error('An Astro website output is unavailable. No existing project was replaced.');
    const groupParent = dirname(name) === '.' ? '' : dirname(name);
    const group = groups.get(groupParent) ?? [];
    group.push({ name: basename(name), text: bytes.toString('base64'), encoding: 'base64' });
    groups.set(groupParent, group);
  }
  const verifyDirectories = () => {
    for (const [relative, identity] of directories) {
      const current = lstatSync(join(destination, relative));
      if (!current.isDirectory() || current.isSymbolicLink() ||
          current.dev !== identity.dev || current.ino !== identity.ino)
        throw Error('Astro website output changed. Files are retained for inspection.');
    }
  };
  for (const [relative, group] of groups) {
    check();
    recheck();
    mutate(join(destination, relative), ensure(relative), { operation: 'files', files: group });
  }
  check();
  recheck();
  verifyDirectories();
  for (const name of Object.keys(files)) {
    const actual = selectedFile(destination, name, Math.max(1048576, files[name].length));
    if (actual.state !== 'present' || actual.sha256 !== hash(files[name]))
      throw Error('Astro website output could not be verified. Files are retained for inspection.');
  }
  check();
  verifyDirectories();
  return {
    state: 'website-created',
    destination,
    schema: prepared.spec.schema,
    files: Object.keys(files).length,
    dependenciesInstalled: false,
    deployed: false,
    next: 'Review the independent source, install the pinned lockfile and run locally before an explicit Git and Cloudflare release. Existing projects are never updated by this recipe.',
  };
}
