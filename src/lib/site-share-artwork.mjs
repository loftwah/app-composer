// Finished, single-render editorial artwork for public Composer entry points.
// Explicit page artwork (real captures, user assets and data cards) takes priority.
const campaignCard = (name, alt, revision = "20261117") => ({
  path: `/brand/campaign/${name}-og-${revision}.jpg`,
  alt,
});

export const composerShareArtwork = campaignCard('composer', 'App Composer. Make an app. Keep it yours. Three machined metal blocks fit together in orange light.');
const ready = campaignCard('ready', 'Even your grandma should be able to get started. An older woman wearing orange glasses works at her laptop.');
const init = campaignCard('init', 'Describe your app in plain English. An orange sketch on a laptop turns into a simple list.');
const firstApp = campaignCard('first-app', 'What would make your Saturday easier? A smartphone shows a warmly lit market stall.');
const share = campaignCard('share', 'App Composer Share. Find your next idea. Three large prints light a dark gallery wall.', '20261117-v2');
const diagrams = campaignCard('diagrams', 'LDraw. Draw the plan. Keep it editable. A brass pen traces an Excalidraw-style diagram on a dark drawing board.', '20261117-v2');

export const mediaStudioShareArtwork = campaignCard('media-studio',
  'Media Studio. Make something worth keeping. A glowing jellyfish appears inside a camera lens.', '20261117-v2');

export const buildingShareArtwork = campaignCard('building',
  'App Composer. Build it. Keep it running. A paper sketch feeds into a warm-lit row of workshop modules.');

const cards = new Map([
  ['/ready', ready],
  ['/ready/guide', ready],
  ['/init', init],
  ['/learn', firstApp],
  ['/share', share],
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
