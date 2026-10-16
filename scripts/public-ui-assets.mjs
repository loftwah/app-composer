// MIT. Source maintenance only: each app keeps its own committed, deployable copy.
import { readFileSync, lstatSync, realpathSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export const publicUiFiles = Object.freeze([
  'page-share-url.mjs',
  'page-share.mjs',
  'page-share.css',
  'theme-control.css',
]);

const sourceDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../public/brand');
const appPackages = new Set([
  '@loftwah/composer-guestbook',
  '@loftwah/composer-showcase',
  'app-composer-hello',
  '@loftwah/composer-linkcheck',
  'app-composer-state',
]);

function regular(path, directory = false) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile())) {
    throw Error('Expected an existing unlinked ' + (directory ? 'directory: ' : 'file: ') + path);
  }
  return stat;
}

export function maintainPublicUiAssets(directories, { write = false } = {}) {
  if (!directories.length) throw Error('Select at least one absolute app checkout path.');
  const sources = publicUiFiles.map(name => {
    const path = join(sourceDirectory, name);
    regular(path);
    return { name, bytes: readFileSync(path) };
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
    if (!appPackages.has(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name)) {
      throw Error('Unsupported app checkout: ' + root);
    }
    regular(join(root, 'public'), true);
    regular(join(root, 'public/brand'), true);
    return sources.map(({ name, bytes }) => {
      const path = join(root, 'public/brand', name);
      const stat = regular(path);
      if (stat.nlink !== 1) throw Error('Preserve linked destination: ' + path);
      const before = readFileSync(path);
      return { root, name, path, bytes, before, stat, changed: !before.equals(bytes) };
    });
  });
  if (write) {
    for (const plan of plans.filter(plan => plan.changed)) {
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
  return plans.map(({ root, name, changed }) => ({ root, name, changed }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [mode, ...directories] = process.argv.slice(2);
    if (!['--check', '--write'].includes(mode)) throw Error('Use --check or --write followed by absolute app checkout paths.');
    const results = maintainPublicUiAssets(directories, { write: mode === '--write' });
    for (const item of results) console.log((item.changed ? (mode === '--write' ? 'Updated ' : 'Differs ') : 'Matches ') + join(item.root, 'public/brand', item.name));
    if (mode === '--check' && results.some(item => item.changed)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
