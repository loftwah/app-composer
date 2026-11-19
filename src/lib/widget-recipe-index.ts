// Compact public index of the four released widget sections and their real
// actions. Data only: nothing here fetches, executes or writes anything.
import {
  builderUrl,
  stationOrigin,
  recipeUrl,
  starterPath as stationStarterPath,
  stationAgentTaskPath,
} from './widget-recipe.ts';
import {
  filmTitle,
  reactComponentPath,
  recipeV2Path,
  starterPath as filmStarterPath,
} from './studio-film-starter.ts';
const composerOrigin = new URL(recipeUrl).origin;
export const widgetIndexPath = '/widgets/recipes.json';

export const bubblesReport = `${stationOrigin}/analytics/?source=games&game=bubbles&days=30`;
export const topTracksReport = `${stationOrigin}/analytics?view=music&days=30&report=tracks`;


export type BubblesCard = {
  format: 'landscape' | 'square' | 'portrait';
  label: string;
  dimensions: string;
  url: string;
};

const bubblesCardUrl = (format: BubblesCard['format']) =>
  `${stationOrigin}/api/analytics/games-card.png?game=bubbles&days=30&format=${format}&download=1`;

export const bubblesCards: BubblesCard[] = [
  { format: 'landscape', label: 'Landscape', dimensions: '1200 × 630', url: bubblesCardUrl('landscape') },
  { format: 'square', label: 'Square', dimensions: '1200 × 1200', url: bubblesCardUrl('square') },
  { format: 'portrait', label: 'Portrait', dimensions: '1080 × 1920', url: bubblesCardUrl('portrait') },
];

export const widgetRecipeIndex = {
  version: 1,
  widgets: [
    {
      id: 'loftwahfm-station',
      title: 'LoftwahFM station player',
      section: composerOrigin + '/widgets#loftwahfm-station',
      actions: [
        { kind: 'recipe', label: 'Download recipe (JSON)', url: recipeUrl },
        { kind: 'html', label: 'Download HTML starter', url: `${composerOrigin}${stationStarterPath}` },
        { kind: 'agent-task', label: 'Download agent task (Markdown)', url: `${composerOrigin}${stationAgentTaskPath}` },
        { kind: 'builder', label: 'LoftwahFM’s public widget builder', url: builderUrl },
      ],
    },
    {
      id: 'bubbles-listening-card',
      title: 'Bubbles listening card',
      section: composerOrigin + '/widgets#bubbles-listening-card',
      actions: [
        ...bubblesCards.map(({ format, label, dimensions, url }) => ({
          kind: 'png',
          label: `${label} ${dimensions} PNG`,
          format,
          url,
        })),
        { kind: 'snapshot', label: 'Bubbles report on LoftwahFM', url: bubblesReport },
      ],
    },
    {
      id: 'top-tracks-share-card',
      title: 'Top Tracks share card',
      section: composerOrigin + '/widgets#top-tracks-share-card',
      actions: [
        {
          kind: 'generated-recipe',
          label: 'Open Top Tracks report (HTML)',
          url: topTracksReport,
          instruction: 'Choose a shape, then select Download Top Tracks recipe (JSON) on the LoftwahFM page.',
        },
      ],
    },
    {
      id: 'take-it-with-you-film',
      title: filmTitle,
      section: composerOrigin + '/widgets#take-it-with-you-film',
      actions: [
        { kind: 'recipe', label: 'Download film recipe (JSON)', url: `${composerOrigin}${recipeV2Path}` },
        { kind: 'html', label: 'Download film HTML starter', url: `${composerOrigin}${filmStarterPath}` },
        { kind: 'tsx', label: 'Download React + TS component', url: `${composerOrigin}${reactComponentPath}` },
      ],
    },
  ],
} as const;

export const widgetRecipeIndexJson = JSON.stringify(widgetRecipeIndex, null, 2);
