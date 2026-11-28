// Finished, single-render editorial artwork for public Composer entry points.
// Explicit page artwork (real captures, user assets and data cards) takes priority.
const campaignCard = (name, alt, revision = "20261117") => ({
  path: `/brand/campaign/${name}-og-${revision}.jpg`,
  alt,
});

export const composerShareArtwork = {
  path: '/brand/campaign/composer-make-an-app-20261128.png',
  alt: 'App Composer. Make an app you own. Large black type on signature orange.',
};
const ready = campaignCard('ready', 'Even your grandma should be able to get started. An older woman wearing orange glasses works at her laptop.');
const init = campaignCard('init', 'Describe your app in plain English. An orange sketch on a laptop turns into a simple list.');
const firstApp = campaignCard('first-app', 'What would make your Saturday easier? A smartphone shows a warmly lit market stall.');
export const shareGalleryArtwork = {
  path: '/brand/campaign/share-find-artwork-20261128.png',
  alt: 'App Composer Share. Find artwork you can use. Search, open the source and download.',
};
const diagrams = campaignCard('diagrams', 'LDraw. Draw the plan. Keep it editable. A brass pen traces an Excalidraw-style diagram on a dark drawing board.', '20261117-v2');

export const mediaStudioShareArtwork = {
  path: '/brand/campaign/media-studio-next-cut-20261128.png',
  alt: 'Media Studio. Make the next cut. Edit images, clip video and trim audio.',
};

export const buildingShareArtwork = campaignCard('building',
  'App Composer. Build it. Keep it running. A paper sketch feeds into a warm-lit row of workshop modules.');

export const briefingShareArtwork = campaignCard('briefing',
  'App Composer. From idea to operation. Film, audio and slides. A projector lights up layers of workshop diagrams.', '20261120');

export const visionShareArtwork = campaignCard('vision',
  'App Composer. Build it. Keep it running. The completed product vision. An open workshop case holds plans, a storage module and a key.', '20261120');

const cards = new Map([
  ['/pitch', buildingShareArtwork],
  ['/pitch/vision', visionShareArtwork],
  ['/pitch/briefing', briefingShareArtwork],
  ['/pitch/briefing/film', briefingShareArtwork],
  ['/ready', ready],
  ['/ready/guide', ready],
  ['/init', init],
  ['/learn', firstApp],
  ['/share', shareGalleryArtwork],
  ['/diagrams', diagrams],
  ['/media-studio', mediaStudioShareArtwork],
  ['/media-studio/films', mediaStudioShareArtwork],
  ['/media-studio/direct', mediaStudioShareArtwork],
]);

export function siteShareArtwork(pathname) {
  return cards.get(pathname.replace(/\/$/, '')) ?? composerShareArtwork;
}

export function siteShareImageType(pathname) {
  if (/\.png$/i.test(pathname)) return 'image/png';
  if (/\.webp$/i.test(pathname)) return 'image/webp';
  return 'image/jpeg';
}
