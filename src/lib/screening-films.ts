const campaign = '/brand/campaign/take-it-with-you-20261118';
const fighter = '/media-studio/demos/fighter-after-hours';

export const screeningFilms = {
  workbench: {
    name: 'Take it with you', duration: '11 sec', kind: 'Short film',
    video: campaign + '.mp4', poster: campaign + '.webp', captions: campaign + '.vtt',
    credit: 'App Composer · Produced in ElevenCreative from App Composer and Woodhouse references.',
    source: 'https://composer.loftwah.com/demo#commercial-title',
    transcript: 'Orange and ivory pieces light up on a blue workbench. A gloved hand lifts them off their dock and carries them to a wooden bench. “Bring your AI agent. Build an app. Take it with you.” The end card reads “App Composer” and “Make software. Keep it yours.”',
    note: 'A short film about making something on one workbench and carrying it to the next.',
  },
  studio: {
    name: 'Inside Media Studio', duration: '72 sec', kind: 'Studio walkthrough',
    video: '/media-studio/films/overview.mp4', poster: '/media-studio/films/overview-poster.jpg',
    captions: '/media-studio/films/overview.vtt',
    credit: 'App Composer · Media Studio. A fictional record release made with the working studio.',
    source: 'https://composer.loftwah.com/media-studio/films',
    transcript: 'The film follows a record release from sleeve artwork through the Studio library and publishing controls. A signed-out visitor plays the published clip. The creation screen shows the model, reference and estimate before a request.',
    note: 'A tour of the workspace behind a record release, from the first sleeve to the published clip.',
  },
  fighter: {
    name: 'Fighter: After Hours', duration: '12 sec', kind: 'Gameplay cut',
    video: fighter + '-20261115.mp4', poster: fighter + '-poster-20261115.jpg',
    captions: '/media-studio/demos/fighter-after-hours.vtt',
    credit: 'Fighter gameplay · “After Hours” by LoftwahFM, made with Suno. Video and music mixed in Media Studio.',
    source: 'https://composer.loftwah.com/media-studio#fighter-after-hours',
    transcript: 'A Fighter match pairs Ned Kelly with Grok. Hit prompts flash over the fight. The clip pairs the gameplay with “After Hours” by LoftwahFM.',
    note: 'A ringside seat for a twelve-second bout, scored by LoftwahFM.',
  },
} as const;

export type FilmId = keyof typeof screeningFilms;
export type Edition = {film: FilmId; title: string; note: string; treatment: 'midnight' | 'matinee'};

export function initialEdition(film: FilmId): Edition {
  return {film, title: screeningFilms[film].name, note: screeningFilms[film].note, treatment: 'midnight'};
}
