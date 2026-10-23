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
    status: "pending",
  },
  {
    id: "technical",
    title: "Follow the implementation",
    description:
      "The native forms, exact app resources, contribution and moderation, compatible update and independent checks behind the outcome.",
    targetSeconds: 360,
    status: "pending",
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
