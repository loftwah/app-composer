import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyLive} from '../scripts/verify-live.mjs';

test('verification reads root and pins in parallel and waits for each to propagate independently', async () => {
  const original = globalThis.fetch;
  const source = 'new-root';
  const apps = [
    {id: 'guestbook', commit: 'gb-new', manifest: {dataVersion: 2}},
    {id: 'showcase', commit: 'sh-new', manifest: {dataVersion: 4}},
  ];

  // Each endpoint reaches its expected value on its own attempt. Root is ready
  // on attempt 2 and guestbook on 1, but showcase only on 3; acceptance must
  // wait for the independently slowest pin rather than the first ready read.
  const readyOn = new Map([
    ['/build.json', {attempt: 2, body: {commit: source}}],
    ['/guestbook/build.json', {attempt: 1, body: {app: 'guestbook', revision: 'gb-new', dataVersion: 2}}],
    ['/showcase/build.json', {attempt: 3, body: {app: 'showcase', revision: 'sh-new', dataVersion: 4}}],
  ]);

  let batch = 0;
  let inFlight = 0;
  let peakInFlight = 0;

  globalThis.fetch = async (url) => {
    if (inFlight === 0) batch++; // first read of a new attempt
    const attempt = batch;
    inFlight++;
    peakInFlight = Math.max(peakInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5)); // overlap window
    inFlight--;

    const path = new URL(url).pathname; // strips the ?verification= cache buster
    const state = readyOn.get(path);
    assert.ok(state, 'unexpected identity path: ' + path);
    const stale = path === '/build.json'
      ? {commit: 'old-root'}
      : {app: state.body.app, revision: 'old-pin', dataVersion: -1};
    return Response.json(attempt >= state.attempt ? state.body : stale);
  };

  try {
    await verifyLive(source, {apps}, 'https://example.test');
    assert.equal(batch, 3, 'waits for the slowest independently propagating pin');
    assert.equal(peakInFlight, 3, 'root and both pins are read in parallel each attempt');
  } finally {
    globalThis.fetch = original;
  }
});
