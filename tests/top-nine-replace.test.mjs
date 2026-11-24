import test from 'node:test';
import assert from 'node:assert/strict';
import {
  replaceAttachmentList, replaceOfferApplies, replacePrompt,
} from '../src/lib/top-nine-replace.ts';

// #1063 one catalogue result must not overwrite an occupied exhibit in one tap.
// These cover the two pieces the panel relies on: the exact-state guard that
// lets a confirmation apply, and the plain warning it shows first.

const cover = { url: 'blob:one', fit: 'cover' };
const offer = {
  slot: 2,
  title: 'Old title',
  href: 'https://music.apple.com/au/album/697194953',
  page: 'https://example.com/old',
  cover,
};

test('a confirmation applies only to the same slot in exactly the state it named', () => {
  assert.equal(replaceOfferApplies(offer, { ...offer }), true);
  for (const change of [
    { slot: 3 },
    { title: 'Edited after reading' },
    { href: null },
    { page: null },
    { cover: { ...cover } },
  ]) {
    assert.equal(replaceOfferApplies(offer, { ...offer, ...change }), false,
      `${JSON.stringify(Object.keys(change)[0])} makes the offer stale`);
  }
});

test('the prompt names both titles and warns plainly what replacing removes', () => {
  assert.equal(
    replacePrompt(2, 'Old title', 'New title', ['Apple Music source link', 'web page', 'cover art']),
    'Replace exhibit 3? “Old title” becomes “New title”. This removes its Apple Music source link, web page and cover art.',
  );
  assert.equal(
    replacePrompt(0, '', 'New title', ['cover art']),
    'Replace exhibit 1? The untitled exhibit becomes “New title”. This removes its cover art.',
  );
  // An occupied title with no attachments still warns that the title changes,
  // and never claims to remove a source, page or cover that isn't there.
  assert.equal(
    replacePrompt(4, 'Typed title', 'New title', []),
    'Replace exhibit 5? “Typed title” becomes “New title”.',
  );
});

test('the attachment list stays one plain sentence at one, two or three items', () => {
  assert.equal(replaceAttachmentList([]), '');
  assert.equal(replaceAttachmentList(['source link']), 'source link');
  assert.equal(replaceAttachmentList(['source link', 'cover art']), 'source link and cover art');
  assert.equal(
    replaceAttachmentList(['source link', 'web page', 'cover art']),
    'source link, web page and cover art',
  );
});
