import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { twentyOneShareFile } from '../src/lib/twenty-one-questions.ts';

const png = new Blob([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)], { type: 'image/png' });
const filename = 'twenty-one-questions-story-card-2-of-2.png';

test('the native capability check receives the exact prepared PNG and saved filename', async () => {
  let candidate;
  const file = twentyOneShareFile(png, filename, {
    canShare(data) { candidate = data; return true; },
    share() { assert.fail('a capability check must not open the share sheet'); },
  });
  assert.deepEqual(Object.keys(candidate), ['files']);
  assert.equal(candidate.files[0], file);
  assert.equal(file.name, filename);
  assert.equal(file.type, 'image/png');
  assert.deepEqual(await file.arrayBuffer(), await png.arrayBuffer());
});

test('missing, denied and throwing native capability leave the download-only path available', () => {
  function share() { assert.fail('must wait for a user gesture'); }
  assert.equal(twentyOneShareFile(png, filename, {}), null);
  assert.equal(twentyOneShareFile(png, filename, { share, canShare: () => false }), null);
  assert.equal(twentyOneShareFile(png, filename, { share, canShare() { throw new TypeError(); } }), null);
});

test('a prepared card shares its captured File on click, keeps Save and retires stale replies', () => {
  const controller = readFileSync(new URL('../src/browser/share-experiences.ts', import.meta.url), 'utf8');
  const begin = controller.indexOf('const fileToShare = twentyOneShareFile');
  const end = controller.indexOf('if (imageClipboard)', begin);
  assert.ok(begin > 0 && end > begin);
  const build = controller.slice(begin, end);
  assert.match(build, /link\.download = filename/);
  assert.match(build, /addEventListener\("click", async \(\) => \{/);
  assert.match(build, /sharingCard \|\| version !== cardVersion/);
  assert.match(build, /await navigator\.share\(\{ files: \[fileToShare\] \}\)/);
  assert.match(build, /if \(version !== cardVersion\) return;/);
  assert.match(build, /error\.name === "AbortError"/);
});
