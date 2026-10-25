import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewLabel} from '../src/lib/date-label.mjs';

test('a plain ISO review date renders as readable copy', () => {
  assert.equal(reviewLabel('2026-10-24'), '24 October 2026');
  assert.equal(reviewLabel('2026-10-13'), '13 October 2026');
  assert.equal(reviewLabel('2026-01-01'), '1 January 2026');
  assert.equal(reviewLabel(' 2026-10-24 '), '24 October 2026');
});

test('a malformed or impossible review date never renders as Invalid Date', () => {
  for (const value of [
    undefined,
    null,
    42,
    '',
    '2026/10/24',
    '24 October 2026',
    '2026-13-01',
    '2026-02-30',
    '2026-10-32',
    '2026-1-1',
    'not-a-date',
    '2026-10-24T00:00:00Z',
  ]) {
    const label = reviewLabel(value);
    assert.equal(label, null, 'expected no label for ' + String(value));
    assert.ok(!String(label).includes('Invalid'));
  }
});
