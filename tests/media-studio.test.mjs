import test from "node:test";
import assert from "node:assert/strict";
import { validateSpec, handoff, specVersion, presets, defaultMediaStudio, mediaStudioRecovery } from "../src/lib/spec.mjs";
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
    version: 3,
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
  assert.equal(spec.mediaStudio.version, 3);
  assert.equal(spec.mediaStudio.audioModel, "studio-score");
  assert.equal(spec.mediaStudio.audioSeconds, 15);
  const roundTrip = validateSpec(JSON.parse(JSON.stringify(spec)));
  assert.deepEqual(roundTrip, spec);
});

test("a retired Studio Draft selection loads as FLUX.2 Klein 9B with a recovery notice", () => {
  const older = {
    version: 1,
    focus: "image",
    imageModel: "studio-draft",
    videoModel: "hailuo-standard",
    aspect: "portrait",
    durationSeconds: 6,
    projectName: "Product plates",
  };
  const spec = validateSpec(mediaSpec({ mediaStudio: older }));
  assert.equal(spec.mediaStudio.imageModel, "studio-craft");
  assert.equal(spec.mediaStudio.version, 3);
  assert.match(mediaStudioRecovery(older), /FLUX\.2 Klein 9B/);
  assert.match(mediaStudioRecovery(older), /save the draft/i);
  assert.equal(mediaStudioRecovery(spec.mediaStudio), "");
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
  assert.match(text, /Brief your first Media Studio pack/);
  assert.match(text, /Keep exact originals and signed provenance/);
  assert.match(text, /recover the existing result by operation ID/);
  assert.match(text, /A configured key or available balance is not approval to spend/);
  assert.match(text, /OWNER_PASSPHRASE and SESSION_SECRET/);
  assert.match(text, /FAL_KEY/);
  assert.match(text, /guarded `pnpm run deploy`/);
  assert.doesNotMatch(text, /rS\/pXeTzaR/);
  const recipe = buildRecipe(spec);
  assert.ok(recipe.length > 3);
  assert.ok(recipe.some((step) => step.title.includes("Media Studio")));
  assert.match(recipeText(spec), /Workers AI binding named AI/);
  assert.match(humanOnlyActions(spec).join(" "), /OWNER_PASSPHRASE and SESSION_SECRET for Media Studio/);
  assert.match(humanOnlyActions(spec).join(" "), /sign in to Cloudflare/);
});

test('current and historical Studio briefs retain their exact reviewed source pins', async () => {
  assert.equal(mediaStudioSource.source.commit, 'e8b3778cd5d800378f42985afda80820fcb7ef57');
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === '8e465d309028f233c653b58d6e960f8d2de3d411'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === 'c9ae60019bdcdd103530fdab33a0632cd0d93fe8'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === '341a0feae8d552a1ae1abdbab5902d74764edee5'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === 'c3bcaff0cfbd0ab6f87f8064ed008bd38ee0fcce'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === '1717dffef5119e97dcd3464dd57fcd6a88ecd270'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === '577e659aa88bb376becd3a630bdb99887697ae23'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === '466b8f9883fcb5ac51d0e813c3263cc54b3d13b6'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === 'ac2012afedf184650d97bb48e7c954a535a34e60'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === 'ac2012afedf184650d97bb48e7c954a535a34e60'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === 'b0712b773502bf24812306ae99847a1f8cc8759a'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === 'c3c80fcd30891a86e4f997fa75eb999569fa4df1'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === 'c91184fd6c940f13940109b27b9a4c82849f6312'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === 'e2f4e83d8e30df44e3288b9a8ce2f40555d059f2'));
  assert.ok(mediaStudioSource.legacySources.some(source => source.commit === '52193c9bdb322c8406f6138400b811aa783032a9'));
  const { readFile } = await import('node:fs/promises');
  const historical = JSON.parse(await readFile(new URL('../public/media-studio/media-studio-brief-20261114.json', import.meta.url), 'utf8'));
  assert.equal(historical.sources[0].commit, mediaStudioSource.legacySources[0].commit);
  const restored = validateSpec(historical);
  assert.deepEqual(restored.sources, historical.sources);
  assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(restored))).sources, historical.sources);
  for (const oldSource of mediaStudioSource.legacySources) {
    const previous = {...historical, sources:[oldSource]};
    assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(previous))).sources, previous.sources);
    for (const patch of [{manifestDigest:'sha256:'+'b'.repeat(64)}, {repository:'https://example.com/other'}, {id:'wrong'}]) {
      assert.throws(() => validateSpec({...historical, sources:[{...oldSource,...patch}]}), /contracts have changed/);
    }
  }
  const current = validateSpec(mediaSpec());
  assert.equal(current.sources[0].commit, mediaStudioSource.source.commit);
  assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(current))).sources, current.sources);
  for (const patch of [{commit:'a'.repeat(40)}, {manifestDigest:'sha256:'+'b'.repeat(64)}, {repository:'https://example.com/other'}]) {
    assert.throws(() => validateSpec({...historical, sources:[{...historical.sources[0], ...patch}]}), /contracts have changed/);
  }
});
