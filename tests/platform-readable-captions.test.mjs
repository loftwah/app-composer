import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  readableCaptionCues,
  readableCaptionVTT,
  readableCaptionFormat,
} from "../labs/platform/media-captions.mjs";
import { captions } from "../labs/platform/native-media-plan.mjs";
import { demoFilms } from "../src/lib/platform-demo.ts";

const directory = new URL(
  "../public/demos/platform-native-25dc7589-b3cd5894/",
  import.meta.url,
);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (path) => readFile(new URL(path, directory));
const plan = JSON.parse(await read("edit-manifest.json"));
const original = JSON.parse(await read("receipt.json"));
const timestamp = (text) =>
  text.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
function parsedCues(vtt) {
  return vtt
    .split("\n\n")
    .filter((block) => /^\d+\n/.test(block))
    .map((block) => {
      const [id, timing, ...lines] = block.trim().split("\n");
      const [start, end] = timing.split(" --> ");
      return {
        id,
        start: timestamp(start),
        end: timestamp(end.split(" ")[0]),
        lines,
        settings: end.slice(end.indexOf(" ") + 1),
      };
    });
}
const conciseFilm = (film) => ({
  ...film,
  segments: film.segments.map((segment) => ({
    ...segment,
    cc: captions[segment.caption].cc,
  })),
});

function readable(cues) {
  for (const [index, cue] of cues.entries()) {
    const lines = cue.lines ?? cue.text.split("\n");
    assert(lines.length > 0 && lines.length <= 2);
    assert(lines.every((line) => line.length > 0 && line.length <= 32));
    assert(
      cue.end - cue.start >= readableCaptionFormat.minimumCueSeconds - 0.00001,
    );
    assert(lines.join(" ").length / (cue.end - cue.start) <= 20.00001);
    if (index)
      assert(Math.round((cue.start - cues[index - 1].end) * 1000) >= 40);
  }
}

test("identical adjacent body spans merge without repeating headings or losing words", () => {
  const body =
    "Current membership and the exact app grant remain separate checks.";
  const segments = [0, 4, 8].map((start) => ({
    start,
    end: start + 4,
    body,
    heading: "Repeated heading",
  }));
  const cues = readableCaptionCues(segments);
  readable(cues);
  assert.equal(
    cues.map((cue) => cue.text.replaceAll("\n", " ")).join(" "),
    body,
  );
  assert.equal(cues[0].start, 0);
  assert.equal(cues.at(-1).end, 11.96);
});

test("concise optional text leaves the full source paragraph and provenance untouched", () => {
  const segment = {
    start: 0,
    end: 4,
    body: "Full explanation remains in the transcript. ".repeat(20),
    cc: "Team A keeps the same request, stack and application resource.",
  };
  const before = structuredClone(segment);
  const cues = readableCaptionCues([segment]);
  readable(cues);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text.replaceAll("\n", " "), segment.cc);
  assert.deepEqual(segment, before);
});

for (const [name, change] of [
  [
    "overlap",
    (segments) => segments.push({ ...segments[0], start: 1, end: 5 }),
  ],
  [
    "negative start",
    (segments) => {
      segments[0].start = -1;
    },
  ],
  [
    "nonfinite end",
    (segments) => {
      segments[0].end = Infinity;
    },
  ],
  [
    "reversed interval",
    (segments) => {
      segments[0].end = 0;
    },
  ],
  [
    "flash cue",
    (segments) => {
      segments[0].end = 1;
    },
  ],
  [
    "excessive reading rate",
    (segments) => {
      segments[0].end = 2.1;
      segments[0].body =
        "This sentence contains enough characters to exceed the allowed reading speed.";
    },
  ],
  [
    "unbreakable word",
    (segments) => {
      segments[0].body = "x".repeat(33);
    },
  ],
  [
    "cue delimiter",
    (segments) => {
      segments[0].body = "text --> second cue";
    },
  ],
  [
    "control character",
    (segments) => {
      segments[0].body = "text\nsecond line";
    },
  ],
])
  test("unsafe caption input is refused: " + name, () => {
    const segments = [
      { start: 0, end: 12, body: "Current app access is checked." },
    ];
    change(segments);
    assert.throws(() => readableCaptionCues(segments));
  });

test("VTT escapes cue markup and keeps identity notes outside the displayed payload", () => {
  const provenance = ["LOCAL DEMO source " + "a".repeat(40)];
  const vtt = readableCaptionVTT({
    segments: [
      { start: 0, end: 12, body: "Read <source> & current role.", provenance },
    ],
  });
  assert(vtt.includes("Read &lt;source&gt; &amp; current role."));
  assert(vtt.includes("NOTE Recording provenance"));
  assert(vtt.includes(provenance[0]));
  assert(
    !parsedCues(vtt).some((cue) => cue.lines.join(" ").includes(provenance[0])),
  );
  assert.throws(() =>
    readableCaptionVTT({
      segments: [
        { start: 0, end: 12, body: "Text.", provenance: ["bad\ncue"] },
      ],
    }),
  );
});

test("published cues regenerate from the maintained concise source mapping and exact original edit", async () => {
  for (const film of plan.films) {
    const filename = film.name + "-cc-20261024.vtt";
    const actual = (await read(filename)).toString();
    assert.equal(actual, readableCaptionVTT(conciseFilm(film)));
    const cues = parsedCues(actual);
    readable(cues);
    assert(
      cues.every((cue) => cue.settings === readableCaptionFormat.settings),
    );
    const expectedBodies = film.segments
      .map((s) => captions[s.caption].cc)
      .filter((body, index, all) => index === 0 || all[index - 1] !== body);
    assert.equal(
      cues.flatMap((cue) => cue.lines).join(" "),
      expectedBodies.join(" "),
    );
    for (const identity of [
      plan.nativeReceiptSHA256,
      ...Object.values(plan.sources),
      ...Object.values(plan.teams).flatMap(Object.values),
    ]) {
      assert(
        actual.includes(identity),
        "Recording identity is retained in NOTE: " + identity,
      );
      assert(!cues.some((cue) => cue.lines.join(" ").includes(identity)));
    }
    const transcript = (await read(film.name + ".transcript.md")).toString();
    for (const segment of film.segments) {
      assert.equal(
        captions[segment.caption].text,
        segment.body,
        "Full maintained paragraph changed",
      );
      assert(transcript.includes(segment.body));
    }
  }
});

test("exact chapter and internal boundaries never activate adjacent cues together", async () => {
  for (const film of plan.films) {
    const cues = parsedCues(
      (await read(film.name + "-cc-20261024.vtt")).toString(),
    );
    const probes = [
      ...film.segments.flatMap((s) => [s.start, s.end]),
      ...cues.flatMap((c) => [c.start - 0.001, c.start, c.end, c.end + 0.001]),
      181,
      183.5,
      288,
      288.5,
      289.5,
    ];
    for (const at of probes)
      assert(
        cues.filter((c) => c.start <= at && c.end >= at).length <= 1,
        "Inclusive boundary collision at " + at,
      );
  }
});

test("cache-safe active caption metadata and revision receipt preserve historical media evidence", async () => {
  const receiptName = "receipt-cc-20261024.json";
  const bytes = await read(receiptName),
    revision = JSON.parse(bytes);
  assert.equal(
    revision.captionRevision.previousPublicReceipt.sha256,
    digest(await read("receipt.json")),
  );
  assert.deepEqual(revision.nativeRun, original.nativeRun);
  assert.deepEqual(revision.agentReview, original.agentReview);
  assert.deepEqual(revision.rendererHashes, original.rendererHashes);
  assert.equal(
    revision.originalMediaReceiptSHA256,
    original.originalMediaReceiptSHA256,
  );
  assert.equal(revision.editSHA256, original.editSHA256);
  assert.equal(revision.nativeReceiptSHA256, original.nativeReceiptSHA256);
  assert.equal(
    digest(await read("receipt.json")),
    "1aefc42ca8a39375a1257576c3289431a5e3324f94fc7e2c2e8549eb526170e8",
  );
  for (const asset of original.artifacts) {
    assert.deepEqual(
      revision.artifacts.find((a) => a.path === asset.path),
      asset,
    );
    // The publication package deliberately omits unused chapter JPEGs.
    if (
      asset.path.includes("-chapter-") ||
      ["native-edit.json", "render-instructions.md"].includes(asset.path)
    )
      continue;
    const content = await read(asset.path);
    assert.equal(
      digest(content),
      asset.sha256,
      "Historical artifact changed: " + asset.path,
    );
  }
  for (const film of demoFilms) {
    const name = film.id === "overview" ? "overview" : "technical-walkthrough";
    assert(film.captions.href.endsWith(name + "-cc-20261024.vtt"));
    assert(film.publicReceipt.href.endsWith(receiptName));
    const content = await read(name + "-cc-20261024.vtt");
    assert.equal(digest(content), film.captions.sha256);
    assert.equal(content.length, film.captions.bytes);
    assert.equal(digest(bytes), film.publicReceipt.sha256);
    assert.equal(bytes.length, film.publicReceipt.bytes);
    assert.deepEqual(
      revision.captionRevision.assets.find(
        (a) => a.path === name + "-cc-20261024.vtt",
      ),
      {
        path: name + "-cc-20261024.vtt",
        bytes: content.length,
        sha256: digest(content),
      },
    );
  }
  for (const [path, hash] of Object.entries(
    revision.captionRevision.generatorHashes,
  ))
    assert.equal(
      digest(await readFile(new URL("../" + path, import.meta.url))),
      hash,
    );
});
