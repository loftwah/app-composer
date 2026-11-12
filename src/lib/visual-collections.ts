import creator from '../../config/creator-hub-reference.json';
import paperwork from '../../lib/paperwork/source.json';

interface Image {
  src: string;
  width: number;
  height: number;
  alt: string;
}

interface Source {
  href: string;
  label: string;
  note: string;
}

export interface VisualPin {
  id: string;
  title: string;
  type: string;
  image: Image;
  href: string;
  action: string;
  description: string;
  source: Source;
  crop?: 'top' | 'bottom';
  video?: { src: string; width: number; height: number };
  download?: boolean;
}

export interface VisualCollection {
  id: string;
  title: string;
  description: string;
  href: string;
  lead: Image;
  pins: readonly VisualPin[];
}

export const creatorHubMedia = {
  card: '/creator-hub/share-20261112.jpg',
  clip: '/creator-hub/social-walkthrough-20261112-1080p.mp4',
  poster: '/creator-hub/social-walkthrough-20261112.webp',
};

const creatorCover = {
  src: creatorHubMedia.card, width: 1200, height: 630,
  alt: 'Orange Creator Hub cover beside Mara Quinn’s Linkarooie profile.',
};

export const creatorHubCollection: VisualCollection = {
  id: 'creator-hub',
  title: 'Creator Hub',
  description: 'A studio profile, a moderated guestbook and the editable setup that connects them.',
  href: '/creator-hub/share',
  lead: creatorCover,
  pins: [
    {
      id: 'film', title: 'From example to your draft', type: 'Film · 22 seconds',
      image: { src: creatorHubMedia.poster, width: 720, height: 1280, alt: 'Opening frame of the Creator Hub walkthrough.' },
      video: { src: creatorHubMedia.clip, width: 1080, height: 1920 }, crop: 'top',
      href: '#walkthrough-film', action: 'Transcript and download',
      description: 'See Mara’s live profile, then watch the same setup open as a draft you can adapt.',
      source: { href: '/creator-hub', label: 'Creator Hub case study', note: 'Edited screen captures from the public fictional reference.' },
    },
    {
      id: 'cover', title: 'Creator Hub link cover', type: 'Image · 1200 × 630',
      image: creatorCover, href: creatorHubMedia.card, action: 'Download link cover', download: true,
      description: 'The wide cover pairs Composer’s orange mark with the live Linkarooie profile. Use it with the X, LinkedIn or Facebook draft.',
      source: { href: '/creator-hub', label: 'Creator Hub case study', note: 'Composer campaign image using the published profile capture.' },
    },
    {
      id: 'profile', title: 'Mara Quinn’s profile', type: 'Live app · Linkarooie',
      image: { src: '/creator-hub/profile-20261111.webp', width: 1440, height: 960, alt: 'The Mara Quinn studio profile with a short bio and four work links.' },
      href: creator.apps.showcase.origin, action: 'Open live profile',
      description: 'The fictional studio’s public home for selected work, workshop notes and commissions.',
      source: { href: creator.apps.showcase.repository, label: 'Reference source', note: 'Public capture from 11 November 2026.' },
    },
    {
      id: 'postcards', title: 'Postcards for Mara', type: 'Live app · Here / there', crop: 'bottom',
      image: { src: '/creator-hub/guestbook-phone-20261111.webp', width: 390, height: 844, alt: 'The public guestbook with an orange action and illustrated postcard wall.' },
      href: creator.apps.guestbook.origin, action: 'Open live guestbook',
      description: 'Visitors can explore the guestbook. Contributions are reviewed before they appear publicly.',
      source: { href: creator.apps.guestbook.repository, label: 'Reference source', note: 'Public capture from 11 November 2026.' },
    },
    {
      id: 'sample', title: 'Make the setup your own', type: 'Editable example · Init',
      image: { src: '/creator-hub/draft-review-20261112.webp', width: 684, height: 810, alt: 'Init review shows the fictional sample and the choices to replace or keep the current draft.' },
      href: '/init?start=creator-hub', action: 'Review the sample draft',
      description: 'Open the two-app sample in Init. You can keep your existing draft or load the example and adapt it.',
      source: { href: '/creator-hub', label: 'Creator Hub case study', note: 'Public Init capture from 12 November 2026.' },
    },
  ],
};

const launchKit = 'https://composer-launch-kit.loftwah.workers.dev';
const nightSignal = {
  src: '/launch-kit/cards/night-signal-board-20261112.webp', width: 1200, height: 630,
  alt: 'Cream Night Signal type beside a violet radio and a moth in a moonlit window.',
};

const signalAndType: VisualCollection = {
  id: 'signal-and-type',
  title: 'Signal & Type',
  description: 'Three covers with very different voices. Open a recipe and make it your own.',
  href: '/collections/signal-and-type',
  lead: nightSignal,
  pins: [
    {
      id: 'night-signal', title: 'Night Signal', type: 'Illustrated cover',
      image: nightSignal, href: launchKit + '/profile.html?example=night-signal-artwork', action: 'Open editable cover',
      description: 'A moth caught in the glow of a late-night radio. The dark illustration carries the mood while the cream type keeps the name clear.',
      source: { href: '/launch-kit/cards/night-signal-artwork.png', label: 'Original PNG', note: 'Fictional Launch Kit example. Generated background with type composed locally.' },
    },
    {
      id: 'river', title: 'River', type: 'Type-only cover',
      image: { src: '/launch-kit/cards/river-typography.png', width: 1200, height: 630, alt: 'The River cover built from type and flat colour.' },
      href: launchKit + '/profile.html?example=river-typography', action: 'Open editable cover',
      description: 'A short introduction and a deliberately small palette give the name room to hold the composition.',
      source: { href: '/launch-kit/cards/river-typography.png', label: 'Original PNG', note: 'Fictional Launch Kit typography recipe.' },
    },
    {
      id: 'field-notes', title: 'Field Notes', type: 'Editorial cover',
      image: { src: '/launch-kit/cards/field-notes-editorial.png', width: 1200, height: 630, alt: 'Green geometric hills and a pale sun above a cream Field Notes title block.' },
      href: launchKit + '/profile.html?example=field-notes-editorial', action: 'Open editable cover',
      description: 'An illustrated horizon sits above a clean text block. The banner and the words can change independently.',
      source: { href: '/launch-kit/cards/field-notes-editorial.png', label: 'Original PNG', note: 'Fictional Launch Kit editorial recipe with a geometric landscape.' },
    },
  ],
};

const printShopPress = {
  src: '/paperwork/press-20261024.webp', width: 1152, height: 768,
  alt: 'Orange stamp press and pencil arm marking a form.',
};
const printShop: VisualCollection = {
  id: 'print-shop',
  title: 'The Print Shop',
  description: 'An ink-textured press, the working PDF editor and a finished fictional form.',
  href: '/collections/print-shop',
  lead: printShopPress,
  pins: [
    {
      id: 'press', title: 'The Paperwork press', type: 'Original illustration',
      image: printShopPress, href: '/paperwork', action: 'See the Paperwork story',
      description: 'One machine does the two jobs the editor puts together: write on a page and mark it finished. The orange press gives Paperwork its print-shop identity.',
      source: { href: '/paperwork/press-20261024.webp', label: 'Original illustration', note: 'Published Paperwork artwork from the owner-selected print-shop direction.' },
    },
    {
      id: 'editor', title: 'At the workbench', type: 'Working editor',
      image: { src: '/paperwork/editor-20261024-printshop.webp', width: 1440, height: 1100, alt: 'Paperwork editor with a fictional lab form and editing tools visible.' },
      href: paperwork.origin + '/?sample=lab', action: 'Open the fictional sample',
      description: 'Try the form in the live editor. Its controls and additions stay in the browser while you work.',
      source: { href: 'https://github.com/loftwah/app-composer/blob/main/docs/paperwork-acceptance.md', label: 'Paperwork acceptance record', note: 'Capture of the working editor with the fictional lab form, 24 October 2026.' },
    },
    {
      id: 'finished-form', title: 'A finished form', type: 'PDF · fictional lab',
      image: { src: '/paperwork/lab-page-20261112.webp', width: 708, height: 1000, alt: 'First page of the completed fictional form, showing filled fields and a checked box.' },
      href: '/paperwork/lab-completed-20261024b.pdf', action: 'Open the finished PDF',
      description: 'Inspect the actual export from the editor. The four-page sample includes interactive field values, handwriting and a demonstration signature.',
      source: { href: 'https://github.com/loftwah/app-composer/blob/main/docs/paperwork-acceptance.md', label: 'Paperwork acceptance record', note: 'First-page render from the published fictional PDF. The original remains available.' },
    },
  ],
};

export const visualCollections = [signalAndType, printShop, creatorHubCollection];
