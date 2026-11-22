import test from 'node:test';
import assert from 'node:assert/strict';
import { topNineAltText } from '../src/lib/top-nine-alt-text.ts';

// The description is text the downloaded image also prints: one title, one
// optional byline and nine exhibit titles in their 3×3 row order. These checks
// cover that string only; the copy control and its denied fallback are
// exercised in the browser journey noted in the delivery record.
const nine = ['Kid A', 'Blue', 'Vespertine', 'Homogenic', 'Dummy', 'Mezzanine', 'Aja', 'Innervisions', 'Selected Ambient Works'];

test('title, byline and nine exhibits read in top, middle and bottom rows', () => {
  assert.equal(
    topNineAltText({ title: 'Nine albums I took everywhere', byline: ' Mina ', items: nine }),
    'Nine albums I took everywhere. By Mina. '
    + 'Top row has Kid A, Blue and Vespertine. Middle row has Homogenic, Dummy and Mezzanine. '
    + 'Bottom row has Aja, Innervisions and Selected Ambient Works.',
  );
});

test('an untyped byline adds no empty label', () => {
  const text = topNineAltText({ title: 'My internet hall of fame', items: nine });
  assert.equal(text.includes('By '), false);
  assert.equal(text.startsWith('My internet hall of fame.'), true);
});

test('an incomplete exhibition produces no description', () => {
  assert.equal(topNineAltText({ title: 'Nine things', items: [...nine.slice(0, 8), ' '] }), '');
  assert.equal(topNineAltText({ title: 'Nine things', items: nine.slice(0, 8) }), '');
  assert.equal(topNineAltText({ title: '  ', items: nine }), '');
});

test('the editor limits and single spacing keep the text legible', () => {
  const text = topNineAltText({
    title: `  Nine   albums  `, byline: 'x'.repeat(60), items: nine.map((item) => ` ${item}  live `),
  });
  assert.equal(text.startsWith('Nine albums. By ' + 'x'.repeat(48) + '.'), true);
  assert.equal(text.includes('Top row has Kid A live, Blue live and Vespertine live.'), true);
  assert.equal(text.includes('x'.repeat(49)), false);
});

test('a title that already ends a sentence keeps one full stop', () => {
  const text = topNineAltText({ title: 'What did I listen to?', items: nine });
  assert.equal(text.includes('?.'), false);
  assert.equal(text.startsWith('What did I listen to? '), true);
});

test('the description carries no link, cover or file detail', () => {
  const text = topNineAltText({ title: 'Nine albums', items: nine });
  assert.equal(/https?:|www\.|\/Users\/|\.(png|jpe?g|webp)\b|cover|link/i.test(text), false);
});
