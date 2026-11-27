export const spinExamples = Object.freeze({
  takeaway: 'Australian takeaway',
  'game-night': 'Game night',
  coin: 'Heads or tails',
});

const loaders = {
  takeaway: () => import('../data/spin-examples/takeaway.json', { with: { type: 'json' } }),
  'game-night': () => import('../data/spin-examples/game-night.json', { with: { type: 'json' } }),
  coin: () => import('../data/spin-examples/coin.json', { with: { type: 'json' } }),
};

export async function readSpinExample(key) {
  if (!Object.hasOwn(loaders, key)) return null;
  return (await loaders[key]()).default;
}
