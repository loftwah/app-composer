const root = '/prints-desktop/';

export const printsArchiveVideo = {
  title: 'The Creative Archive in 15 seconds',
  description: 'Watch the native Prints Desktop archive compare the Higher Than Before cover and release poster, find Fighter artwork and switch to Afterlight.',
  uploadDate: '2026-11-25',
  duration: 15,
  width: 1280,
  height: 790,
  poster: root + 'archive-native-v0.4.0.webp',
  src: root + 'archive-demo-v0.4.0.mp4',
  captions: root + 'archive-demo-v0.4.0.en.vtt',
  version: 'v0.4.0',
  transcript: [
    'Open the Loftwah Creative Archive on the released Higher Than Before album cover.',
    'Compare the square cover with the tall release poster side by side.',
    'Press Command+F and find Fighter’s Before the Bell artwork. Add it to Favourites.',
    'Switch to Afterlight, a separate set of offline studies.',
  ],
};

export const printsAfterlightVideo = {
  title: 'From first look to export',
  description: 'Browse Afterlight, save an original, draft a prompt and open an example Oyster library.',
  duration: 28,
  width: 1440,
  height: 880,
  poster: root + 'afterlight-native-v0.3.1.webp',
  src: root + 'prints-desktop-walkthrough-v0.3.1.mp4',
  captions: root + 'prints-desktop-walkthrough-v0.3.1.en.vtt',
  version: 'v0.3.1',
  transcript: [
    'Open Afterlight and pick Blue Hour from the contact sheet. View it at full size.',
    'Add the study to Favourites, return to it and export the bundled JPEG.',
    'Copy the brief from The Last Horizon into a prompt draft and save it locally.',
    'Browse a folder and preview a print in an Oyster library seeded with fictional media.',
  ],
};

export const printsWorkshopVideo = {
  title: 'Compare, shortlist and export',
  description: 'Use the Loftwah Creative Archive to compare the Higher Than Before cover and release poster, export the original and save a brief for your next print.',
  uploadDate: '2026-11-25',
  duration: 61,
  width: 1280,
  height: 790,
  poster: root + 'archive-workshop-v0.4.1.webp',
  src: root + 'archive-workshop-v0.4.1.mp4',
  captions: root + 'archive-workshop-v0.4.1.en.vtt',
  version: 'v0.4.1',
  transcript: [
    'Open the Creative Archive and select Higher Than Before. Choose Compare formats to see how the lettering and artwork fit the square cover and tall release poster.',
    'Press Escape, select Release Poster and choose Add to favourites. Open Favourites to find your shortlist.',
    'Choose Export original and select a destination. The exported JPEG matches the archive original byte for byte.',
    'Return to the Creative Archive. Press Command+F on Mac, or Ctrl+F on Windows and Linux, then type “bell” to find Fighter’s Before the Bell poster.',
    'Press Escape to clear Find. Open Afterlight, choose Use in draft for The Last Horizon, then Save draft to keep the brief on your device.',
  ],
};
