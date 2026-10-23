// Authored publication metadata. Populate only after reviewing the final media
// and sanitised evidence; pending entries deliberately contain no asset URLs.
export interface DemoAsset {
  href: `/${string}`;
  sha256: string;
  bytes: number;
}
export interface DemoRecording {
  composerSha: string;
  guestbookSha: string;
  showcaseSha: string;
  recordedAt: string;
}
export interface DemoChapter {
  startSeconds: number;
  title: string;
}
interface FilmDescription {
  id: "overview" | "technical";
  title: string;
  description: string;
  targetSeconds: number;
}
export type DemoFilm = FilmDescription &
  (
    | { status: "pending" }
    | {
        status: "ready";
        recording: DemoRecording;
        durationSeconds: number;
        chapters: readonly DemoChapter[];
        width: 1600;
        height: 1200;
        codec: "h264";
        video: DemoAsset;
        poster: DemoAsset;
        captions: DemoAsset;
        transcript: DemoAsset;
        publicReceipt: DemoAsset;
        editRecord: DemoAsset;
      }
  );

export const demoFilms: readonly DemoFilm[] = [
  {
    id: "overview",
    title: "The team journey",
    description:
      "A short view of the request, the working application and the permissions that keep two teams separate.",
    targetSeconds: 75,
    status: "ready",
    recording: {
      composerSha: "25dc7589f7a92d5ba22eb44c49b9a774991799a3",
      guestbookSha: "e097e4dd46abe5dd49a0ee1209276cc506e601fa",
      showcaseSha: "9e166d3c3dcc9d3746ba1680b9f74015c0b521cb",
      recordedAt: "2026-10-23T12:08:38.569Z",
    },
    durationSeconds: 75,
    width: 1600,
    height: 1200,
    codec: "h264",
    chapters: [
      {
        startSeconds: 0,
        title: "Get Ready and current authority",
      },
      {
        startSeconds: 14,
        title: "Two teams and role-10 delegation",
      },
      {
        startSeconds: 24,
        title: "Private canvas, moderation and media",
      },
      {
        startSeconds: 46,
        title: "Content-preserving update and Team B control",
      },
      {
        startSeconds: 59,
        title: "Denials and the recovery contract",
      },
      {
        startSeconds: 67,
        title: "Exact limits and source receipt",
      },
    ],
    video: {
      href: "/demos/platform-native-25dc7589-b3cd5894/overview.mp4",
      sha256:
        "973c67f1c0cd8c2108dc28c2ff1428bd74ba90f9c5b1dc4f30b3c28eed19d6f2",
      bytes: 2077340,
    },
    poster: {
      href: "/demos/platform-native-25dc7589-b3cd5894/overview-poster.jpg",
      sha256:
        "e668fea39f576007793d28d65d96003ae3d0f4e5b621625f0bb3aa6a20cecc07",
      bytes: 191043,
    },
    captions: {
      href: "/demos/platform-native-25dc7589-b3cd5894/overview-cc-20261024.vtt",
      sha256:
        "b7ce234fba7eb93f0956aace4db19cddf3ad8ee7af40444c3122d123d51aa8aa",
      bytes: 2835,
    },
    transcript: {
      href: "/demos/platform-native-25dc7589-b3cd5894/overview.transcript.md",
      sha256:
        "6b548f05727c032ea7039cbf285cd76ae1eda0e826fe07c6026d19091600218d",
      bytes: 15598,
    },
    publicReceipt: {
      href: "/demos/platform-native-25dc7589-b3cd5894/receipt-cc-20261024.json",
      sha256:
        "82c871d41af7675bde57e456540721fc6227848fab365c7d53ddba70ef289622",
      bytes: 15999,
    },
    editRecord: {
      href: "/demos/platform-native-25dc7589-b3cd5894/edit-manifest.json",
      sha256:
        "6aaded6368d633b3c5ec1aab38c6286d685a66621be6bba447dd160ffbd8d369",
      bytes: 80047,
    },
  },
  {
    id: "technical",
    title: "Follow the implementation",
    description:
      "The native forms, exact app resources, contribution and moderation, compatible update and independent checks behind the outcome.",
    targetSeconds: 360,
    status: "ready",
    recording: {
      composerSha: "25dc7589f7a92d5ba22eb44c49b9a774991799a3",
      guestbookSha: "e097e4dd46abe5dd49a0ee1209276cc506e601fa",
      showcaseSha: "9e166d3c3dcc9d3746ba1680b9f74015c0b521cb",
      recordedAt: "2026-10-23T12:08:38.569Z",
    },
    durationSeconds: 360,
    width: 1600,
    height: 1200,
    codec: "h264",
    chapters: [
      {
        startSeconds: 0,
        title: "Get Ready and current authority",
      },
      {
        startSeconds: 60,
        title: "Two teams and role-10 delegation",
      },
      {
        startSeconds: 120,
        title: "Private canvas, moderation and media",
      },
      {
        startSeconds: 180,
        title: "Content-preserving update and Team B control",
      },
      {
        startSeconds: 240,
        title: "Denials and the recovery contract",
      },
      {
        startSeconds: 300,
        title: "Exact limits and source receipt",
      },
    ],
    video: {
      href: "/demos/platform-native-25dc7589-b3cd5894/technical-walkthrough.mp4",
      sha256:
        "54a58bd3f8859bdb7a9f19e7d22cabbf512efa23a01324acf630dde535bfbff2",
      bytes: 8447665,
    },
    poster: {
      href: "/demos/platform-native-25dc7589-b3cd5894/technical-walkthrough-poster.jpg",
      sha256:
        "3f925c127a5c0942950221472f92f5b443e61b3f141a61326da8840217c980db",
      bytes: 213055,
    },
    captions: {
      href: "/demos/platform-native-25dc7589-b3cd5894/technical-walkthrough-cc-20261024.vtt",
      sha256:
        "461ab517408299ba441ec0f05725f631c89be520e31b0c3633ad4c3d4bf3ad5c",
      bytes: 8660,
    },
    transcript: {
      href: "/demos/platform-native-25dc7589-b3cd5894/technical-walkthrough.transcript.md",
      sha256:
        "f7a0571a6e792dc66281242b46c4693c74d30b22213a3d3365121fab1ace9eef",
      bytes: 38811,
    },
    publicReceipt: {
      href: "/demos/platform-native-25dc7589-b3cd5894/receipt-cc-20261024.json",
      sha256:
        "82c871d41af7675bde57e456540721fc6227848fab365c7d53ddba70ef289622",
      bytes: 15999,
    },
    editRecord: {
      href: "/demos/platform-native-25dc7589-b3cd5894/edit-manifest.json",
      sha256:
        "6aaded6368d633b3c5ec1aab38c6286d685a66621be6bba447dd160ffbd8d369",
      bytes: 80047,
    },
  },
];

// Fail closed when publishing ready metadata. All downloads stay on this site;
// no browser-supplied source, endpoint or receipt selects publication content.
export function reviewedDemoFilms(films: readonly DemoFilm[]) {
  if (films.length !== 2 || new Set(films.map((film) => film.id)).size !== 2)
    throw Error("Publish one overview and one technical film.");
  for (const film of films) {
    if (film.status !== "ready") continue;
    if (
      ![
        film.recording.composerSha,
        film.recording.guestbookSha,
        film.recording.showcaseSha,
      ].every((sha) => /^[a-f0-9]{40}$/.test(sha)) ||
      !Number.isFinite(Date.parse(film.recording.recordedAt)) ||
      !Number.isFinite(film.durationSeconds) ||
      (film.id === "overview"
        ? film.durationSeconds < 60 || film.durationSeconds > 90
        : film.durationSeconds < 300 || film.durationSeconds > 480) ||
      film.width !== 1600 ||
      film.height !== 1200 ||
      film.codec !== "h264"
    )
      throw Error("Publish exact reviewed film and recording identities.");
    if (
      !Array.isArray(film.chapters) ||
      film.chapters.length !== 6 ||
      Array.from(film.chapters).some(
        (chapter, index) =>
          !chapter ||
          Object.keys(chapter).length !== 2 ||
          !Object.hasOwn(chapter, "startSeconds") ||
          !Object.hasOwn(chapter, "title") ||
          !Number.isFinite(chapter.startSeconds) ||
          chapter.startSeconds < 0 ||
          chapter.startSeconds >= film.durationSeconds ||
          (index === 0
            ? chapter.startSeconds !== 0
            : chapter.startSeconds <= film.chapters[index - 1].startSeconds) ||
          typeof chapter.title !== "string" ||
          chapter.title.length < 1 ||
          chapter.title.length > 120 ||
          chapter.title !== chapter.title.trim() ||
          /[\x00-\x1f\x7f]/.test(chapter.title),
      )
    )
      throw Error(
        "Publish six titled, ordered film chapters starting at zero and within the reviewed duration.",
      );
    for (const asset of [
      film.video,
      film.poster,
      film.captions,
      film.transcript,
      film.publicReceipt,
      film.editRecord,
    ]) {
      if (
        !/^\/(?!\/)[a-zA-Z0-9/_-]+(?:\.[a-zA-Z0-9]+)+$/.test(asset.href) ||
        !/^[a-f0-9]{64}$/.test(asset.sha256) ||
        !Number.isSafeInteger(asset.bytes) ||
        asset.bytes < 1
      )
        throw Error(
          "Publish existing same-site assets with reviewed hashes and sizes.",
        );
    }
  }
  return films;
}
