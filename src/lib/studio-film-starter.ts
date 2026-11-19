// MIT. Portable HTML starter for the published Media Studio film.

export const filmTitle = 'Take it with you';
export const filmWidgetHref = '/widgets#take-it-with-you-film';
const studioOrigin = 'https://media.loftwah.com';
export const watchUrl = `${studioOrigin}/p/PbvQYtyGG-YlF0Dh`;
export const videoUrl = `${watchUrl}/media`;
export const posterUrl = `${watchUrl}/thumb`;
export const videoSha256 = '187134b76dc0687d95e263d7b3bb2b7cf6507affb4204e61c2badaeff567d046';

// Exact bytes of the committed public/brand/campaign/take-it-with-you-20261118.vtt.
// Inlined so the starter stays self-contained; a focused test ties this string
// back to that file so the approved English captions cannot drift.
export const captionText = `WEBVTT

00:00.000 --> 00:00.600 line:12%
[A sharp click]

00:00.600 --> 00:02.050 line:12%
Bring your AI agent.

00:02.050 --> 00:03.650 line:12%
Build an app.

00:03.850 --> 00:07.700 line:12%
[Power-up chime]
Take it with you.
`;

export const captionTrackUrl = `data:text/vtt;charset=utf-8,${encodeURIComponent(captionText)}`;

// The in-page preview uses the committed VTT from this same origin: the same
// four English cues as captionText, with no data: source needed in the page CSP.
export const filmCaptionSrc = '/brand/campaign/take-it-with-you-20261118.vtt';

export const starterFilename = 'take-it-with-you-v1.html';
export const starterPath = `/widgets/${starterFilename}`;

const filmMarkup = `    <video controls playsinline preload="none" width="1280" height="720" poster="${posterUrl}" aria-label="${filmTitle}, an App Composer commercial">
      <source src="${videoUrl}" type="video/mp4">
      <track kind="captions" src="${captionTrackUrl}" srclang="en" label="English captions" default>
      Your browser does not support HTML video. <a href="${watchUrl}">Watch ${filmTitle} on Media Studio</a>.
    </video>
    <p class="credit">Produced in ElevenCreative from App Composer and Woodhouse references. <a href="${watchUrl}">Watch the published film on Media Studio</a>.</p>`;

export const filmEmbedFragment = filmMarkup.trimStart().replace('<video ', '<video style="display:block;max-width:100%;height:auto" ');

export const starterHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${studioOrigin}; media-src ${studioOrigin} data:; style-src 'unsafe-inline'; base-uri 'none'">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${filmTitle} · App Composer</title>
  <!-- Published media SHA-256: ${videoSha256} -->
  <style>
    :root { color-scheme: light dark; }
    body { max-width: 760px; margin: 0 auto; padding: 1.5rem; font: 1rem/1.6 system-ui, sans-serif; }
    h1 { font-size: 1.6rem; line-height: 1.2; margin: 0 0 .5rem; }
    video { display: block; width: 100%; height: auto; background: #000; }
    p { max-width: 65ch; }
    .credit { font-size: .9rem; }
  </style>
</head>
<body>
  <main>
    <h1>${filmTitle}</h1>
${filmMarkup}
  </main>
</body>
</html>
`;
