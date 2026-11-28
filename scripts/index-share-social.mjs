import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  improvements,
  placements,
  socialRubric,
} from "./review-share-social.mjs";

const path = process.argv[2];
if (!path) throw Error("Pass the completed public social-review.json");
const run = JSON.parse(await readFile(path, "utf8"));
if (
  run.rubric !== socialRubric ||
  run.sample ||
  run.stoppedBy ||
  run.items.length !== run.eligible
)
  throw Error(
    "Use a complete public catalogue snapshot. Keep pilot results in output.",
  );
const seen = new Set();
const assets = {};
const counts = { promising: 0, revise: 0, reference: 0, unreviewed: 0 };
for (const item of run.items) {
  if (
    !/^[a-z0-9][a-z0-9-]{0,127}$/.test(item.id) ||
    !/^[a-f0-9]{64}$/.test(item.revision) ||
    seen.has(item.id)
  )
    throw Error("Invalid catalogue identity in review");
  seen.add(item.id);
  if (item.status !== "reviewed") {
    counts.unreviewed++;
    continue;
  }
  if (
    !Object.hasOwn(placements, item.placement) ||
    !Object.hasOwn(improvements, item.fix) ||
    !Number.isFinite(item.score) ||
    item.score < 0 ||
    item.score > 4 ||
    !/^[a-f0-9]{64}$/.test(item.hash) ||
    !["https://composer.loftwah.com", "https://woodhouse.loftwah.com"].includes(
      URL.parse(item.thumbnailUrl)?.origin,
    )
  )
    throw Error("Invalid review evidence");
  const status =
    item.fix === "retain" || item.placement === "library"
      ? "reference"
      : item.fix === "ready" && item.score >= 2
        ? "promising"
        : "revise";
  counts[status]++;
  assets[item.id] = [
    item.revision,
    status,
    item.placement,
    item.fix,
    item.score,
    item.hash,
    createHash("sha256").update(item.thumbnailUrl).digest("hex"),
  ];
}
const filmRun = await readFile(
  join(dirname(path), "clef-film-openings.json"),
  "utf8",
)
  .then(JSON.parse)
  .catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
const filmRows = new Map((filmRun?.items ?? []).map((item) => [item.id, item]));
const films = run.films.map(({ id, title, href }) => {
  const url = URL.parse(href);
  if (
    !/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 160 ||
    !url ||
    url.username ||
    url.password ||
    url.search ||
    ![
      "https://composer.loftwah.com",
      "https://media.loftwah.com",
      "https://woodhouse.loftwah.com",
    ].includes(url.origin)
  )
    throw Error("Invalid public film identity.");
  const film = { id, title, href };
  const evidence = filmRows.get(id);
  if (
    !evidence ||
    evidence.href !== film.href ||
    evidence.status !== "reviewed"
  )
    return film;
  const hook = evidence.hook?.choice;
  const score = evidence.fit?.score;
  if (
    !["use", "faster", "context", "captions", "reference"].includes(hook) ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 4 ||
    !/^[a-f0-9]{64}$/.test(evidence.sampleHash)
  )
    throw Error("Invalid film opening review.");
  return {
    ...film,
    opening: [hook, Math.round(score * 100) / 100, evidence.sampleHash],
  };
});
const index = {
  rubric: run.rubric,
  evaluatedAt: run.evaluatedAt,
  artwork: run.eligible,
  counts,
  films,
  filmUnique: filmRun?.unique ?? 0,
  assets,
};
await writeFile(
  "src/data/share-social-intelligence.json",
  JSON.stringify(index) + "\n",
);
console.log(JSON.stringify(counts));
