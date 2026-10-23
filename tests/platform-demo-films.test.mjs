import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demoFilms, reviewedDemoFilms } from "../src/lib/platform-demo.ts";

// Contract fixtures only. These names and hashes do not declare publishable media.
const asset = { href: "/fixtures/film.mp4", sha256: "a".repeat(64), bytes: 1 };
const ready = (id) => ({
  id,
  title: "Fixture film",
  description: "Metadata validation fixture",
  targetSeconds: id === "overview" ? 75 : 360,
  status: "ready",
  durationSeconds: id === "overview" ? 75 : 360,
  chapters: Array.from({ length: 6 }, (_, index) => ({
    startSeconds: index * 10,
    title: "Fixture chapter " + (index + 1),
  })),
  recording: {
    composerSha: "a".repeat(40),
    guestbookSha: "b".repeat(40),
    showcaseSha: "c".repeat(40),
    recordedAt: "2026-10-23T00:00:00Z",
  },
  width: 1600,
  height: 1200,
  codec: "h264",
  video: asset,
  poster: asset,
  captions: asset,
  transcript: asset,
  publicReceipt: asset,
  editRecord: asset,
});
const inspect = (film) => reviewedDemoFilms([film, ready("technical")]);

test("maintained film metadata is pending or passes the strict reviewed-ready contract", () => {
  assert.equal(reviewedDemoFilms(demoFilms), demoFilms);
  for (const film of demoFilms)
    assert.ok(["pending", "ready"].includes(film.status));
});

test("explicit pending fixtures stay free of invented assets, chapter times and source receipts", () => {
  const pending = ["overview", "technical"].map((id) => ({
    id,
    title: "Pending fixture",
    description: "Not publishable media",
    targetSeconds: id === "overview" ? 75 : 360,
    status: "pending",
  }));
  assert.equal(reviewedDemoFilms(pending), pending);
  for (const film of pending)
    assert.deepEqual(Object.keys(film).sort(), [
      "description",
      "id",
      "status",
      "targetSeconds",
      "title",
    ]);
});

test("ready metadata accepts six strictly ordered finite chapters from zero, including fractional frame times", () => {
  const film = ready("overview");
  film.chapters[1].startSeconds = 10.5;
  assert.doesNotThrow(() => inspect(film));
  assert.doesNotThrow(() =>
    reviewedDemoFilms([ready("overview"), ready("technical")]),
  );
});

for (const [name, change] of [
  [
    "missing chapters",
    (film) => {
      delete film.chapters;
    },
  ],
  [
    "empty chapters",
    (film) => {
      film.chapters = [];
    },
  ],
  [
    "five chapters",
    (film) => {
      film.chapters.pop();
    },
  ],
  [
    "seven chapters",
    (film) => {
      film.chapters.push({ startSeconds: 60, title: "Extra" });
    },
  ],
  [
    "sparse chapters",
    (film) => {
      film.chapters = Array(6);
    },
  ],
  [
    "nonzero opening",
    (film) => {
      film.chapters[0].startSeconds = 1;
    },
  ],
  [
    "negative time",
    (film) => {
      film.chapters[0].startSeconds = -1;
    },
  ],
  [
    "duplicate time",
    (film) => {
      film.chapters[1].startSeconds = 0;
    },
  ],
  [
    "reversed time",
    (film) => {
      film.chapters[2].startSeconds = 5;
    },
  ],
  [
    "time at duration",
    (film) => {
      film.chapters[5].startSeconds = film.durationSeconds;
    },
  ],
  [
    "time past duration",
    (film) => {
      film.chapters[5].startSeconds = film.durationSeconds + 1;
    },
  ],
  [
    "infinite time",
    (film) => {
      film.chapters[5].startSeconds = Infinity;
    },
  ],
  [
    "NaN time",
    (film) => {
      film.chapters[5].startSeconds = NaN;
    },
  ],
  [
    "string time",
    (film) => {
      film.chapters[5].startSeconds = "50";
    },
  ],
  [
    "null chapter",
    (film) => {
      film.chapters[1] = null;
    },
  ],
  [
    "empty title",
    (film) => {
      film.chapters[1].title = "";
    },
  ],
  [
    "space-only title",
    (film) => {
      film.chapters[1].title = " ";
    },
  ],
  [
    "untrimmed title",
    (film) => {
      film.chapters[1].title = " Chapter";
    },
  ],
  [
    "long title",
    (film) => {
      film.chapters[1].title = "x".repeat(121);
    },
  ],
  [
    "non-text title",
    (film) => {
      film.chapters[1].title = 1;
    },
  ],
  [
    "control in title",
    (film) => {
      film.chapters[1].title = "Chapter\nOne";
    },
  ],
  [
    "additional chapter fields",
    (film) => {
      film.chapters[1].url = "https://example.invalid";
    },
  ],
])
  test("ready chapter contract rejects " + name, () => {
    const film = ready("overview");
    change(film);
    assert.throws(() => inspect(film), /six titled, ordered film chapters/);
  });

test("chapter validation retains the existing recording and asset evidence gates", () => {
  const film = ready("overview");
  film.recording.composerSha = "not-a-source";
  assert.throws(() => inspect(film), /exact reviewed film/);
  const other = ready("overview");
  other.video = { ...asset, href: "https://example.invalid/film.mp4" };
  assert.throws(() => inspect(other), /same-site assets/);
});

test("the prepared player exposes chapter times and keeps optional VTT disabled initially", () => {
  const source = readFileSync(
    new URL("../src/pages/platform/demo.astro", import.meta.url),
    "utf8",
  );
  const track = source.match(/<track\b[^>]*\/>/s)?.[0];
  assert.ok(track);
  assert.doesNotMatch(track, /\bdefault(?:\s|=|\/|>)/);
  assert.match(source, /film\.chapters\.map/);
  assert.match(source, /<time datetime=/);
  assert.match(source, /Both films are silent/);
  assert.match(source, /Use fullscreen to read interface details/);
});
