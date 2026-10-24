// MIT. Source maintenance only: each app keeps its own committed, deployable copy.
import { readFileSync, lstatSync, realpathSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { launcherAsset } from './launcher-assets.mjs';

export const publicUiFiles = Object.freeze([
  'page-share-url.mjs',
  'page-share.mjs',
  'page-share.css',
  'theme-control.css',
  'launcher.js',
  'launcher.css',
  'space-latin-20261018.woff2',
  'apps/linkarooie-small-20261018.webp',
  'apps/herethere-small-20261018.webp',
  'apps/linkcheck-small-20261018.webp',
  'apps/hello-small-20261018.webp',
  'apps/carryforward-small-20261018.webp',
  'composer-icon-20261022b-96.png',
]);

// Reviewed immutable delivery identities. New pixels/fonts get a new name;
// this operation may create these files, but never replace different bytes.
const versionedAssets = new Map([
  ['space-latin-20261018.woff2', '61d00a1c57fcd7d4826c7a69cd85b61d15d133d5471d3c9c4731d70193d9f71f'],
  ['apps/linkarooie-small-20261018.webp', 'b9b0cad6ce37c35a8a43899b30834bc001ae1a9c7acff4997a16467cd442d033'],
  ['apps/herethere-small-20261018.webp', '4fec95fe6cfccd8b901c8f424599f4cb57aea6ad2eb11f56e79b95a57260b568'],
  ['apps/linkcheck-small-20261018.webp', 'be9d5e7b8f24ec6d8b8d073075e3208dbd3e68afc78ecc00c9184882f98b0326'],
  ['apps/hello-small-20261018.webp', 'c2aef7354c04affc6060d095912307794cc5436acff8a45d26c913b989222db1'],
  ['apps/carryforward-small-20261018.webp', 'd684c61b50c8f1c44eefc376c232fb9192c40d4b80365eb971a3ad1684add88c'],
  ['composer-icon-20261022b-96.png', 'ecbadefaf28866750a7db31e848a50f2023ecac1d6cb6db4a598a04b60cc5992'],
]);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

const sourceDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../public/brand');
const appPackages = new Set([
  '@loftwah/composer-guestbook',
  '@loftwah/composer-showcase',
  'app-composer-hello',
  '@loftwah/composer-linkcheck',
  'app-composer-state',
  'app-composer-launch-kit',
  'app-composer-paperwork',
]);

function regular(path, directory = false) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) {
    throw Error('Expected an existing unlinked ' + (directory ? 'directory: ' : 'file: ') + path);
  }
  return stat;
}

export function maintainPublicUiAssets(directories, { write = false, launcherOnly = false } = {}) {
  if (!directories.length) throw Error('Select at least one absolute app checkout path.');
  launcherAsset();
  const sources = publicUiFiles.filter(name => !launcherOnly || name.startsWith('launcher.') || versionedAssets.has(name)).map(name => {
    const path = join(sourceDirectory, name);
    regular(path);
    const bytes = readFileSync(path);
    if (versionedAssets.has(name) && digest(bytes) !== versionedAssets.get(name))
      throw Error('Reviewed source identity changed; select a new version: ' + path);
    return { name, bytes };
  });
  const roots = new Set();
  // Preflight every selected destination before changing any file.
  const plans = directories.flatMap(directory => {
    if (!isAbsolute(directory)) throw Error('Select an absolute app checkout path.');
    regular(directory, true);
    const root = realpathSync(directory);
    if (roots.has(root)) throw Error('Select each app checkout only once.');
    roots.add(root);
    regular(join(root, 'package.json'));
    const packageName = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name;
    if (!appPackages.has(packageName)) {
      throw Error('Unsupported app checkout: ' + root);
    }
    regular(join(root, 'public'), true);
    regular(join(root, 'public/brand'), true);
    return sources.map(({ name, bytes }) => {
      const path = name === 'space-latin-20261018.woff2' && packageName === '@loftwah/composer-linkcheck'
        ? join(root, 'public', name)
        : join(root, 'public/brand', name);
      regular(dirname(path), true);
      const stat = existsSync(path) ? regular(path) : (() => {
        try { lstatSync(path); throw Error('Preserve linked destination: ' + path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (!name.startsWith('launcher.') && !versionedAssets.has(name)) throw Error('Expected an existing unlinked file: ' + path);
        return null;
      })();
      if (stat && stat.nlink !== 1) throw Error('Preserve linked destination: ' + path);
      const before = stat ? readFileSync(path) : null;
      if (before && versionedAssets.has(name) && !before.equals(bytes))
        throw Error('Preserve different bytes at versioned destination; select a new version: ' + path);
      return { root, name, path, bytes, before, stat, changed: !before?.equals(bytes) };
    });
  });
  if (write) {
    for (const plan of plans.filter(plan => plan.changed)) {
      if (!plan.stat) {
        // New launcher distribution copies must never overwrite concurrent work.
        writeFileSync(plan.path, plan.bytes, { flag: 'wx', mode: 0o644 });
        continue;
      }
      const stat = regular(plan.path);
      if (stat.ino !== plan.stat.ino || stat.nlink !== 1 || !readFileSync(plan.path).equals(plan.before)) {
        throw Error('Destination changed during review; inspect before retrying: ' + plan.path);
      }
      const staging = plan.path + '.' + randomUUID() + '.tmp';
      try {
        writeFileSync(staging, plan.bytes, { flag: 'wx', mode: plan.stat.mode & 0o777 });
        renameSync(staging, plan.path);
      } finally {
        try { unlinkSync(staging); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
  }
  return plans.map(({ root, name, path, changed }) => ({ root, name, path, changed }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [mode, ...selected] = process.argv.slice(2);
    const launcherOnly = selected[0] === '--launcher-only';
    const directories = launcherOnly ? selected.slice(1) : selected;
    if (!['--check', '--write'].includes(mode)) throw Error('Use --check or --write followed by absolute app checkout paths.');
    const results = maintainPublicUiAssets(directories, { write: mode === '--write', launcherOnly });
    for (const item of results) console.log((item.changed ? (mode === '--write' ? 'Updated ' : 'Differs ') : 'Matches ') + item.path);
    if (mode === '--check' && results.some(item => item.changed)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
