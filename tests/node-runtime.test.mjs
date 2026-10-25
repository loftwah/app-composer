// The reviewed Node runtime line is declared in more than one file, and Get
// Ready refuses an unsupported runtime at execution time. A declaration that
// drifts from the policy therefore turns a clear refusal into a confusing one:
// the manifest would invite a runtime the shipped code then rejects.
//
// This test keeps the declarations on the reviewed stable LTS lines. It reads strings
// only, so it behaves the same under every Node version. Moving to another
// LTS is a deliberate act: update `docs/node-runtime.md`, the policy, the
// manifests and the Get Ready guards together, then record the qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { satisfies } from '../scripts/freshness.mjs';
import { isSupportedNode } from '../lib/get-ready/local-checks.mjs';

const root = resolve(import.meta.dirname, '..');
const readJson = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));

const declarations = [
  ['package.json', () => readJson('package.json').engines?.node],
  ['config/dependency-policy.json', () => readJson('config/dependency-policy.json').runtime?.node],
  ['lib/get-ready/package.json', () => readJson('lib/get-ready/package.json').engines?.node],
  ['lib/get-ready-mcp/package.json', () => readJson('lib/get-ready-mcp/package.json').engines?.node],
];

// Runtimes the reviewed policy must keep out until they are qualified.
const unqualified = ['22.23.3', '23.0.0', '24.0.0', '24.22.0', '25.0.0', '26.0.0'];

test('every Node declaration admits the reviewed runtime and refuses unqualified majors', () => {
  const declared = declarations.map(([file, read]) => [file, read()]);
  for (const [file, range] of declared) {
    assert.equal(typeof range, 'string', `${file} must declare its Node range.`);
    for (const version of ['22.23.4','24.22.1']) {
      assert.equal(satisfies(version, range), true, `${file} must admit the reviewed LTS floor ${version}.`);
      assert.equal(isSupportedNode(version), true);
    }
    for (const version of unqualified) {
      assert.equal(satisfies(version, range), false, `${file} admits ${version}, which has not been qualified.`);
      assert.equal(isSupportedNode(version), false);
    }
  }
  // The Composer manifest and the reviewed policy are one statement, not two.
  assert.equal(declared[1][1], declared[0][1], 'package.json engines.node and the policy runtime.node must match exactly.');
});

test('an unreadable declaration refuses instead of guessing', () => {
  for (const version of ['22.23.4', '24.22.1']) {
    assert.doesNotThrow(() => satisfies(version, '>=22 <23'));
  }
  assert.throws(() => satisfies('22.23.4', '~not-a-range'), /Unsupported range/);
});

test('prerelease and malformed runtimes stay outside tool execution', () => {
  for (const version of ['24.22.1-rc.1','24.22','current','23.12.0',null]) assert.equal(isSupportedNode(version),false);
});

test('the independently qualified content-site recipe retains its Node 22 boundary', () => {
  const range = readJson('lib/content-model/site-template/package.json').engines.node;
  assert.equal(satisfies('22.23.4', range), true);
  assert.equal(satisfies('24.22.1', range), false);
});
