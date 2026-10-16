import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { maintainPublicUiAssets, publicUiFiles } from '../scripts/public-ui-assets.mjs';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'composer-ui-assets-'));
  try {
    const app = join(root, 'app');
    mkdirSync(join(app, 'public/brand'), { recursive: true });
    writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app-composer-hello' }));
    for (const name of publicUiFiles) writeFileSync(join(app, 'public/brand', name), 'old source');
    return run(app, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('checking is read-only; explicit writing updates only named assets and repeats without writes', () => fixture(app => {
  const sentinel = join(app, 'public/brand/owner.svg');
  writeFileSync(sentinel, 'owner artwork');
  assert.equal(maintainPublicUiAssets([app]).filter(item => item.changed).length, 4);
  assert.equal(readFileSync(join(app, 'public/brand/page-share.mjs'), 'utf8'), 'old source');
  maintainPublicUiAssets([app], { write: true });
  for (const name of publicUiFiles) assert.deepEqual(readFileSync(join(app, 'public/brand', name)), readFileSync(new URL('../public/brand/' + name, import.meta.url)));
  assert.equal(readFileSync(sentinel, 'utf8'), 'owner artwork');
  const before = statSync(join(app, 'public/brand/page-share.mjs'));
  assert(maintainPublicUiAssets([app], { write: true }).every(item => !item.changed));
  assert.equal(statSync(join(app, 'public/brand/page-share.mjs')).mtimeMs, before.mtimeMs);
}));

test('invalid or linked destinations are refused before any selected app is updated', () => fixture((app, root) => {
  const bad = join(root, 'bad');
  mkdirSync(bad);
  writeFileSync(join(bad, 'package.json'), JSON.stringify({ name: 'unrelated-project' }));
  assert.throws(() => maintainPublicUiAssets([app, bad], { write: true }), /Unsupported app/);
  assert.equal(readFileSync(join(app, 'public/brand/page-share.mjs'), 'utf8'), 'old source');
  const target = join(app, 'public/brand/theme-control.css');
  const owner = join(root, 'owner.css');
  writeFileSync(owner, 'owner styles');
  rmSync(target);
  symlinkSync(owner, target);
  assert.throws(() => maintainPublicUiAssets([app], { write: true }), /unlinked file/);
  assert.equal(readFileSync(owner, 'utf8'), 'owner styles');
  assert.equal(readFileSync(join(app, 'public/brand/page-share.mjs'), 'utf8'), 'old source');
}));
