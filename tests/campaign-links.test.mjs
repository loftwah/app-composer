import assert from 'node:assert/strict';
import test from 'node:test';
import { campaignLink } from '../src/lib/campaign-links.ts';

const story = 'https://composer.loftwah.com/creator-hub';
const landing = { url: story, queryKeys: ['ref', 'page'] };
const hubTags = (source) => ({ utm_source: source, utm_medium: 'social', utm_campaign: 'creator_hub' });

test('Creator Hub channels keep their exact working links', () => {
  for (const channel of ['x', 'linkedin', 'facebook', 'tiktok', 'instagram', 'youtube']) {
    assert.equal(
      campaignLink(landing, hubTags(channel)),
      `${story}?utm_source=${channel}&utm_medium=social&utm_campaign=creator_hub`,
    );
  }
});

test('approved query values and fragments survive deterministic tag replacement', () => {
  const destination = `${story}?ref=hello%20world&%75tm_source=old&utm_source=stale&page=2#walkthrough`;
  assert.equal(
    campaignLink(landing, { ...hubTags(' X '), utm_id: 'cmp_17', utm_content: 'Launch_A' }, destination),
    `${story}?ref=hello+world&page=2&utm_source=x&utm_medium=social&utm_campaign=creator_hub&utm_content=launch_a&utm_id=cmp_17#walkthrough`,
  );
});

test('unapproved destinations and query parameters are refused', () => {
  for (const destination of [
    'http://composer.loftwah.com/creator-hub',
    'https://elsewhere.test/creator-hub',
    'https://user:secret@composer.loftwah.com/creator-hub',
    'https://composer.loftwah.com/login',
    `${story}?X-Amz-Signature=abc`,
    `${story}?redirect=https://elsewhere.test`,
  ]) {
    assert.throws(() => campaignLink(landing, hubTags('x'), destination), /approved/);
  }
});

test('the required tags, controlled medium and public slug bounds are enforced', () => {
  const tags = hubTags('x');
  assert.throws(() => campaignLink(landing, { ...tags, utm_campaign: undefined }), /utm_campaign/);
  assert.throws(() => campaignLink(landing, { ...tags, utm_medium: 'unknown' }), /supported campaign medium/);
  assert.throws(() => campaignLink(landing, { ...tags, utm_content: 'first & second' }), /utm_content/);
  assert.throws(() => campaignLink(landing, { ...tags, utm_source: 'a'.repeat(129) }), /utm_source/);
  assert.throws(
    () => campaignLink(landing, tags, `${story}?ref=${'a'.repeat(2048)}`),
    /2048/,
  );
});
