const images = new Map([
  ['Fish and chips', '/spin-brand/food-20261127.webp'],
  ...Object.entries({
    Pizza: 'pizza',
    Kebabs: 'kebab',
    Burgers: 'burger',
    'Local burger shop': 'burger',
    Maccas: 'burger',
    'Hungry Jack’s': 'burger',
    'Carl’s Jr.': 'burger',
    'Charcoal chicken': 'chicken',
    'Chicken and chips': 'chicken',
    HSP: 'hsp',
    Dumplings: 'dumplings',
    Sushi: 'sushi',
    'Sushi rolls': 'sushi',
    'Bánh mì': 'banh-mi',
    'Pub parma': 'parma',
  }).map(([name, image]) => [name, `/spin-brand/winners/${image}-20261127.webp`]),
]);

export function winnerArtwork(winner) {
  return images.get(winner) ?? '';
}

export async function loadWinnerArtwork(winner) {
  const path = winnerArtwork(winner);
  if (!path) return null;
  const image = new Image();
  image.src = path;
  try { await image.decode(); } catch { return null; }
  return image;
}
