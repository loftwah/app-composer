import test from "node:test";
import assert from "node:assert/strict";
import { validateSpec, handoff, specVersion, presets, defaultMediaStudio } from "../src/lib/spec.mjs";
import { selectedSources } from "../src/lib/app-settings.mjs";
import { buildRecipe, humanOnlyActions, recipeText } from "../src/lib/build-recipe.mjs";
import { presetRecommendation, recommendationSpec } from "../src/lib/init-recommendations.mjs";
import mediaStudioSource from "../config/media-studio-standalone.json" with { type: "json" };

const mediaSpec = (overrides = {}) => ({
  version: specVersion,
  preset: "media-studio",
  sources: selectedSources(["media-studio"]),
  config: {
    title: "Paper & Light",
    intro: "Images and short films with a warm, editorial eye.",
    theme: "daylight",
    layout: "grid",
  },
  privacy: "review-first",
  cards: [],
  deployment: { mode: "preview", hostname: "" },
  decisions: {},
  ...overrides,
});

test("Media Studio is a real preset with a pinned independent source", () => {
  assert.deepEqual(presets["media-studio"].apps, ["media-studio"]);
  assert.equal(mediaStudioSource.source.repository, "https://github.com/loftwah/composer-media-studio");
  assert.match(mediaStudioSource.source.commit, /^[a-f0-9]{40}$/);
  assert.match(mediaStudioSource.source.manifestDigest, /^sha256:[a-f0-9]{64}$/);
  const spec = validateSpec(mediaSpec());
  assert.equal(spec.preset, "media-studio");
  assert.deepEqual(spec.sources, [mediaStudioSource.source]);
  assert.deepEqual(spec.mediaStudio, {
    version: 2,
    focus: "both",
    imageModel: "studio-print",
    videoModel: "hailuo-standard",
    audioModel: "studio-score",
    audioSeconds: 15,
    aspect: "portrait",
    durationSeconds: 6,
    projectName: "Paper & Light",
  });
  assert.equal(presetRecommendation("media-studio").apps[0], "media-studio");
  assert.match(presetRecommendation("media-studio").limitation, /without a model account/);
});

test("media defaults round trip through export and import unchanged", () => {
  const spec = validateSpec(mediaSpec({
    mediaStudio: {
      version: 1,
      focus: "video",
      imageModel: "studio-film",
      videoModel: "kling-standard",
      aspect: "wide",
      durationSeconds: 10,
      projectName: "Night Signals",
    },
  }));
  assert.equal(spec.mediaStudio.videoModel, "kling-standard");
  assert.equal(spec.mediaStudio.durationSeconds, 10);
  // A revision 1 draft keeps its choices and gains the current sound defaults.
  assert.equal(spec.mediaStudio.version, 2);
  assert.equal(spec.mediaStudio.audioModel, "studio-score");
  assert.equal(spec.mediaStudio.audioSeconds, 15);
  const roundTrip = validateSpec(JSON.parse(JSON.stringify(spec)));
  assert.deepEqual(roundTrip, spec);
});

test("unsupported or mismatched media settings fail closed", () => {
  for (const patch of [
    { version: 9 },
    { imageModel: "higgsfield-soul" },
    { videoModel: "text-to-video" },
    { aspect: "ultrawide" },
    { durationSeconds: 30 },
    { videoModel: "kling-standard", durationSeconds: 6 },
    { focus: "everything" },
    { surprise: true },
  ]) {
    assert.throws(() =>
      validateSpec(mediaSpec({
        mediaStudio: { ...defaultMediaStudio({ title: "Paper & Light" }), ...patch },
      })),
    );
  }
  assert.throws(
    () =>
      validateSpec({
        version: 1,
        preset: "composition",
        config: { title: "Our corner", intro: "Kept", theme: "daylight", layout: "grid" },
        privacy: "review-first",
        cards: [],
        deployment: { mode: "preview", hostname: "" },
        decisions: {},
        mediaStudio: defaultMediaStudio({ title: "Our corner" }),
      }),
    /belong only/,
  );
  assert.throws(() =>
    validateSpec({
      ...mediaSpec(),
      sources: [{ ...mediaStudioSource.source, commit: "a".repeat(40) }],
    }),
  );
});

test("an older app specification keeps working without Media Studio fields", () => {
  const composition = validateSpec({
    version: 1,
    preset: "composition",
    config: { title: "Our corner", intro: "Kept", theme: "daylight", layout: "grid" },
    privacy: "review-first",
    cards: [],
    deployment: { mode: "preview", hostname: "" },
    decisions: {},
  });
  assert.equal(Object.hasOwn(composition, "mediaStudio"), false);
  assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(composition))), composition);
});

test("switching starting points preserves unrelated settings and media defaults", () => {
  const current = validateSpec({
    ...mediaSpec(),
    decisions: { goal: "media-studio", target: "preview" },
  });
  const toComposition = recommendationSpec(current, "composition");
  assert.equal(toComposition.preset, "composition");
  assert.equal(Object.hasOwn(toComposition, "mediaStudio"), false);
  const back = recommendationSpec(current, "media-studio");
  assert.equal(back.mediaStudio.projectName, "Paper & Light");
  assert.equal(back.config.title, "Paper & Light");
});

test("the handoff and build plan carry the owned studio work without secrets", () => {
  const spec = validateSpec(mediaSpec());
  const text = handoff(spec);
  assert.match(text, /Media Studio is an independently owned application/);
  assert.match(text, new RegExp(mediaStudioSource.source.commit));
  assert.match(text, /one genuine image-to-video clip/);
  assert.match(text, /OWNER_PASSPHRASE and SESSION_SECRET/);
  assert.match(text, /FAL_KEY/);
  assert.doesNotMatch(text, /rS\/pXeTzaR/);
  const recipe = buildRecipe(spec);
  assert.ok(recipe.length > 3);
  assert.ok(recipe.some((step) => step.title.includes("Media Studio")));
  assert.match(recipeText(spec), /Workers AI binding named AI/);
  assert.match(humanOnlyActions(spec).join(" "), /OWNER_PASSPHRASE and SESSION_SECRET for Media Studio/);
  assert.match(humanOnlyActions(spec).join(" "), /sign in to Cloudflare/);
});
