export const stationOrigin = 'https://fm.loftwah.com';
export const stationId = 'night-signal';
export const stationName = 'Night Signal';
export const builderUrl = `${stationOrigin}/widgets?station=${stationId}#builder`;
export const widgetUrl = `${stationOrigin}/widget?station=${stationId}`;

export const embed = {
  src: widgetUrl,
  title: `LoftwahFM ${stationName} station`,
  width: '560',
  height: '420',
  style: 'border:0;max-width:100%',
  loading: 'lazy',
  allow: 'autoplay; clipboard-write; web-share',
} as const;

export type WidgetRecipe = {
  version: number;
  id: string;
  provider: string;
  builder: string;
  target: 'iframe';
  permissionsPolicy: string;
  requirements: { frameSource: string; account: boolean; credentials: boolean };
  config: { station: string; width: number; height: number; autoplay: boolean };
  embed: string;
};

export const widgetRecipe: WidgetRecipe = {
  version: 1,
  id: 'loftwahfm-night-signal',
  provider: stationOrigin,
  builder: builderUrl,
  target: 'iframe',
  permissionsPolicy: embed.allow,
  requirements: { frameSource: stationOrigin, account: false, credentials: false },
  config: { station: stationId, width: Number(embed.width), height: Number(embed.height), autoplay: false },
  embed: embed.src,
};

export const widgetRecipeJson = JSON.stringify(widgetRecipe);

export const recipeFilename = 'loftwahfm-night-signal-v1.json';
export const recipePath = `/widgets/${recipeFilename}`;
export const recipeUrl = `https://composer.loftwah.com${recipePath}`;

export const embedHtml = [
  '<iframe',
  `  src="${embed.src}"`,
  `  title="${embed.title}"`,
  `  width="${embed.width}"`,
  `  height="${embed.height}"`,
  `  style="${embed.style}"`,
  `  loading="${embed.loading}"`,
  `  allow="${embed.allow}"`,
  '></iframe>',
].join('\n');

export const starterFilename = `${widgetRecipe.id}-v${widgetRecipe.version}.html`;
export const starterPath = `/widgets/${starterFilename}`;
export const stationAgentTaskFilename = `${widgetRecipe.id}-v${widgetRecipe.version}-agent-task.md`;
export const stationAgentTaskPath = `/widgets/${stationAgentTaskFilename}`;

export const starterHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${stationOrigin}; style-src 'unsafe-inline'">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${stationName} | LoftwahFM</title>
</head>
<body>
  <main>
    <h1>${stationName}</h1>
    <p>Station player by <a href="${stationOrigin}/">LoftwahFM</a>.</p>
${embedHtml}
  </main>
</body>
</html>
`;

export const embedJsx = [
  '<iframe',
  `  src="${embed.src}"`,
  `  title="${embed.title}"`,
  `  width="${embed.width}"`,
  `  height="${embed.height}"`,
  `  style={{ border: 0, maxWidth: '100%' }}`,
  `  loading="${embed.loading}"`,
  `  allow="${embed.allow}"`,
  '/>',
].join('\n');

export const agentTask = [
  `Add the LoftwahFM ${stationName} station player to this project.`,
  '',
  'Use the official public iframe served by fm.loftwah.com.',
  '',
  `<iframe src="${embed.src}" title="${embed.title}" width="${embed.width}" height="${embed.height}" style="${embed.style}" loading="${embed.loading}" allow="${embed.allow}"></iframe>`,
  '',
  `The same recipe as machine-readable data: ${recipeUrl}`,
  '',
  'Inspect this project’s stack and conventions first, then integrate',
  'non-destructively: use the HTML above, or the same attributes as a React',
  'iframe component when the host is React. No account, API key or extra',
  'script is needed. Do not add a second audio player, and do not try to',
  'restyle the inside of the iframe — host CSS cannot reach it.',
  '',
  'If this host sets a Content-Security-Policy, allow exactly',
  '`frame-src https://fm.loftwah.com`. Leave autoplay off so',
  'playback starts with the visitor’s Play press. Building a',
  'game? Use LoftwahFM’s game audio SDK instead of embedding a player:',
  `${stationOrigin}/game-music`,
  '',
  'Check and report: the player renders; Play starts audio from a real',
  'click, keyboard and touch; Pause stops it; the embed fits without',
  'horizontal overflow at phone (~390px) and desktop widths; existing',
  'audio, styles and features still work; and only one audio source plays',
  'at a time.',
].join('\n');
