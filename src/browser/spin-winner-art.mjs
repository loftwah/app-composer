import { spinTasteArt } from '../lib/spin-tastes.mjs';

export function winnerArtwork(winner) {
  return spinTasteArt(winner);
}

export async function loadWinnerArtwork(winner) {
  const path = winnerArtwork(winner);
  if (!path) return null;
  const image = new Image();
  image.src = path;
  try { await image.decode(); } catch { return null; }
  return image;
}
