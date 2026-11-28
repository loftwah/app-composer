import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const directory = process.argv[2];
if (!directory) throw Error("Provide the completed public review directory.");
const readJson = async (path) =>
  JSON.parse(await readFile(join(directory, path), "utf8"));
const index = JSON.parse(
  await readFile("src/data/share-social-intelligence.json", "utf8"),
);
const [art, films, methods, visual] = await Promise.all([
  readJson("social-review.json"),
  readJson("clef-film-openings.json"),
  readJson("clef-methods.json"),
  readJson("clef-visual.json"),
]);
if (
  art.sample ||
  art.stoppedBy ||
  art.items.length !== index.artwork ||
  art.evaluatedAt !== index.evaluatedAt
)
  throw Error(
    "Refresh the index from the same complete eligible snapshot first.",
  );

const dispositions = {
  promising: "Promising",
  revise: "Needs an edit",
  reference: "Library reference",
  unreviewed: "Needs a fresh review",
};
const filmActions = {
  use: "Review full cut and destination",
  faster: "Show the subject or payoff sooner",
  context: "Add a quick reason to keep watching",
  captions: "Improve on-screen text or captions",
  reference: "Use this as a chapter or reference",
};
const designQuestions = {
  first: "Find work worth opening",
  identity: "Relevant and distinctive art direction",
  action: "Understand the next action",
  editorial: "Start a credited social campaign",
};
const reviewPlace = {
  feed: "Feed image",
  link: "Link card",
  sequence: "Carousel, story or cover",
  library: "Library reference",
};
const nextEdit = {
  ready: "Check the source, destination and final crop",
  crop: "Make a dedicated crop or export",
  legibility: "Improve contrast, hierarchy or small text",
  purpose: "Give it a clearer audience and job",
  retain: "Keep it as a reference",
};
const methodLabels = {
  proof: "Verify the changed interaction or result",
  continuity: "Carry forward the exact decision and source",
  performance: "Measure and fix the bottleneck",
  explore: "Run a bounded comparison",
  unclear: "Get stronger evidence",
};
const evidence =
  "https://github.com/loftwah/app-composer/blob/main/docs/share-intelligence.md";
const columns = [
  "kind",
  "id",
  "title",
  "project",
  "category",
  "url",
  "disposition",
  "suggested_placement",
  "next_edit",
  "score_0_to_4",
  "leading_option_weight",
  "source_revision",
  "sample_sha256",
  "evaluated_at",
  "review_scope",
  "known_width",
  "known_height",
  "has_original",
  "has_source",
  "export_format_count",
];
const rows = art.items.map((item) => {
  const row = index.assets[item.id];
  if (
    !/^[a-z0-9][a-z0-9-]{0,127}$/.test(item.id) ||
    (row && row[0] !== item.revision)
  )
    throw Error("Mismatched artwork in the public snapshot.");
  return [
    "artwork",
    item.id,
    item.title,
    item.project,
    item.category,
    "https://composer.loftwah.com/share/artwork/" + item.id,
    dispositions[row?.[1] ?? "unreviewed"],
    reviewPlace[row?.[2]],
    nextEdit[row?.[3]],
    row?.[4],
    null,
    item.revision,
    row?.[5],
    index.evaluatedAt,
    "Clef-flash thumbnail",
    item.width,
    item.height,
    item.hasOriginal,
    item.hasSource,
    item.formats,
  ];
});
for (const item of index.films) {
  const [hook, score, hash] = item.opening ?? [];
  rows.push([
    "film",
    item.id,
    item.title,
    "media-studio",
    "opening",
    item.href,
    item.opening ? "Reviewed" : "Unreviewed",
    "Short video",
    filmActions[hook],
    score,
    null,
    null,
    hash,
    films.evaluatedAt,
    "Clef-omni first six seconds or shorter complete clip",
  ]);
}
const methodsPass = methods.results[0];
for (const item of methodsPass.state.issues) {
  if (!/^\d{1,5}$/.test(item.id)) throw Error("Invalid public issue number.");
  const answer = methodsPass.answers["issue_" + item.id];
  if (!Object.hasOwn(methodLabels, answer.choice))
    throw Error("Unexpected issue review output.");
  rows.push([
    "issue-method",
    item.id,
    item.evidence,
    "app-composer",
    "operating method",
    "https://github.com/loftwah/app-composer/issues/" + item.id,
    "Reviewed",
    null,
    methodLabels[answer.choice],
    null,
    answer.probabilities[answer.choice],
    null,
    null,
    methods.evaluated,
    "Clef-flash distilled public issue evidence",
  ]);
}
const visualPass = visual.results[0];
for (const [id, label] of Object.entries(designQuestions)) {
  const answer = visualPass.answers[id];
  const treatments = {
    live: "Current live opening",
    wall: "Stitch artwork wall",
    feature: "Stitch single feature",
    unclear: "Insufficient evidence",
  };
  if (!Object.hasOwn(treatments, answer.choice))
    throw Error("Unexpected design review output.");
  rows.push([
    "design-comparison",
    id,
    label,
    "share",
    "phone layout",
    evidence,
    "Reviewed",
    null,
    treatments[answer.choice],
    null,
    answer.probabilities[answer.choice],
    null,
    null,
    visual.evaluated,
    "Clef-flash current public capture and two draft concepts",
  ]);
}
function csvCell(value) {
  const text = String(value ?? "");
  const safe =
    typeof value === "string" && /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(text)
      ? "'" + text
      : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
const csv =
  [columns, ...rows]
    .map((row) => columns.map((_, i) => csvCell(row[i])).join(","))
    .join("\n") + "\n";
await mkdir("public/share", { recursive: true });
await writeFile("public/share/intelligence.csv", csv);
console.log(
  JSON.stringify({
    columns: columns.length,
    rows: rows.length,
    bytes: Buffer.byteLength(csv),
  }),
);
