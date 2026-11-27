export const spinExamples = Object.freeze({
  takeaway: 'Australian takeaway',
  'share-draw': 'First Share film draw',
  'editor-draw': 'Choice editor demo draw',
  'game-night': 'Game night',
  coin: 'Heads or tails',
});

const loaders = {
  'editor-draw': () => import('../data/spin-examples/editor-draw.json', { with: { type: 'json' } }),
  'share-draw': () => import('../data/spin-examples/share-draw.json', { with: { type: 'json' } }),
  takeaway: () => import('../data/spin-examples/takeaway.json', { with: { type: 'json' } }),
  'game-night': () => import('../data/spin-examples/game-night.json', { with: { type: 'json' } }),
  coin: () => import('../data/spin-examples/coin.json', { with: { type: 'json' } }),
};

export async function readSpinExample(key) {
  if (!Object.hasOwn(loaders, key)) return null;
  return (await loaders[key]()).default;
}
