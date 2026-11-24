import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('../src/browser/share-experiences.ts', import.meta.url), 'utf8');
const start = controller.indexOf('if (personaOutcome) {');
const end = controller.indexOf('if (cardDownloads) {', start);
assert.ok(start > 0 && end > start, 'the shared prepared persona card branch exists');
const block = controller.slice(start, end);
const shareStart = block.indexOf('if (personaFileToShare) {');
const shareEnd = block.indexOf('if (imageClipboard)', shareStart);
assert.ok(shareStart > 0 && shareEnd > shareStart, 'native sharing is gated on the prepared File');
const share = block.slice(shareStart, shareEnd);

test('the persona preview shares its exact prepared PNG and saved filename', () => {
  assert.match(block, /const filename = `\$\{game\}-\$\{outcome\}-\$\{cardFormat\}\.png`;/);
  assert.match(block, /const personaFileToShare = twentyOneShareFile\(blob, filename, navigator\)/);
  assert.match(block, /link\.download = filename/);
  assert.match(share, /shareButton\.textContent = "Share PNG"/);
  assert.match(share, /await navigator\.share\(\{ files: \[personaFileToShare\] \}\)/);
  assert.doesNotMatch(share, /navigator\.share\(\{[^}]*\b(?:url|title|text)\s*:/, 'only the files field reaches native share');
});

test('the native call starts on the click and stale replies cannot change the current card', () => {
  const click = share.indexOf('shareButton.addEventListener("click", async () => {');
  const nativeCall = share.indexOf('await navigator.share', click);
  assert.ok(click > 0 && nativeCall > click, 'share starts from the click handler');
  assert.doesNotMatch(share.slice(click, nativeCall), /\bawait\b/, 'no asynchronous work precedes the user-gesture call');
  assert.match(share, /sharingPersona \|\| version !== personaVersion/);
  assert.match(share, /if \(version !== personaVersion\) return;/g, 'success and failure both reject stale results');
  assert.doesNotMatch(share, /URL\.revokeObjectURL|personaUrls|renderPersonaCard/, 'sharing never replaces or retires the prepared file');
});

test('cancellation and denial leave Save PNG, Copy PNG and the description fallback available', () => {
  assert.match(share, /error\.name === "AbortError"/);
  assert.match(share, /Use Save \$\{cardFormat\} PNG to keep it\./);
  assert.ok(shareStart > block.indexOf('link.textContent = `Save ${cardFormat} PNG`;'), 'Save remains beside Share');
  assert.ok(shareEnd < block.indexOf('copyButton.textContent = "Copy PNG"'), 'Copy PNG remains available');
  assert.match(block, /copyDescription\.textContent = "Copy image description"/);
  assert.match(block, /Clipboard unavailable\. Use Save PNG to keep the card\./);
  assert.doesNotMatch(share, /resultPath|href|download|avatarFile|localStorage|fetch\(/, 'no URL, fields or local-remix data joins the handoff');
});
