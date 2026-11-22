import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// The Init handoff is already authored in the visible prompt. Copy feedback must
// describe that exact request, and a denied clipboard must leave a keyboard user
// able to select the same text. This mirrors the guard Get Ready already ships.
test('Init copy feedback is tied to its request and manually recoverable', () => {
  const client = read('src/lib/init-client.ts');

  assert.ok(client.includes('let copyAttempt=0'), 'tracks the latest copy attempt');
  assert.ok(
    client.includes('const attemptId=++copyAttempt,startedAt=revision,shown=prompt.textContent;'),
    'snapshots attempt, draft revision and the visible handoff before the write',
  );
  assert.ok(
    client.includes('prompt.textContent=text;'),
    'the visible handoff is the authoritative source of what is copied',
  );
  assert.ok(
    client.includes('const current=()=>attemptId===copyAttempt&&startedAt===revision&&prompt.textContent===shown;'),
    'a result is current only for its own request',
  );
  assert.ok(
    client.includes("await navigator.clipboard.writeText(text);if(!current())return;handoffStatus.dataset.state='copied';"),
    'copied feedback waits for the guard',
  );
  assert.ok(
    client.includes("catch{if(!current())return;prompt.closest('details')!.open=true;prompt.focus();"),
    'manual feedback waits for the guard',
  );
  assert.ok(client.includes('range.selectNodeContents(prompt);'), 'the exact handoff is selected for manual copy');
  assert.ok(client.includes("handoffStatus.dataset.state='manual';"), 'the manual outcome is announced');

  const page = read('src/pages/init.astro');
  assert.ok(page.includes('<summary>Read or copy the agent handoff</summary>'), 'the panel advertises manual copy');
  assert.ok(page.includes('<pre id="prompt" tabindex="0"></pre>'), 'the handoff is keyboard focusable');
});
