import test from "node:test";
import assert from "node:assert/strict";
import {
  blueprint,
  blueprintReadiness,
  blueprintSpec,
  blueprintSources,
  blueprints,
  blueprintsVersion,
  validateBlueprint,
} from "../src/lib/blueprints.mjs";

// The catalogue is publishable data. These checks keep it honest: every entry
// validates, every app is really mounted at an exact revision, and an
// unsupported or credential-shaped blueprint is refused.
test("every shipped blueprint validates", () => {
  assert.ok(blueprints.length > 0);
  for (const entry of blueprints) {
    assert.equal(validateBlueprint(entry), entry);
    assert.equal(entry.version, 1);
  }
  assert.equal(blueprintsVersion, 1);
});

test("the creator hub blueprint names mounted apps at exact revisions", () => {
  const entry = blueprint("creator-hub");
  assert.ok(entry, "creator-hub exists");
  const sources = blueprintSources(entry);
  assert.equal(sources.length, 2);
  for (const source of sources) {
    assert.match(source.commit, /^[0-9a-f]{40}$/, `${source.id} has a full commit`);
    assert.match(source.repository, /^https:\/\/github\.com\//);
    assert.equal(source.short, source.commit.slice(0, 10));
  }
});

test("readiness is a catalogue claim, not a build proof", () => {
  const readiness = blueprintReadiness(blueprint("creator-hub"));
  assert.equal(readiness.state, "reference");
  assert.match(readiness.reason, /independent owner/i);
  assert.equal(readiness.sources.length, 2);
});

test("mounted sources and public links cannot promote replay readiness", () => {
  const reference = blueprint("creator-hub");
  for (const state of ["evidence-pending", "ready"]) {
    const readiness = blueprintReadiness({ ...reference, state });
    assert.equal(readiness.state, "evidence-pending");
    assert.equal(readiness.sources.length, 2);
    assert.match(readiness.reason, /independent owner/i);
  }
});

test("the specification validates and matches the blueprint apps", () => {
  const entry = blueprint("creator-hub");
  const spec = blueprintSpec(entry);
  assert.equal(spec.version, 2);
  assert.equal(spec.preset, "composition");
  assert.deepEqual(spec.apps, ["guestbook", "showcase"]);
  assert.equal(spec.privacy, "review-first");
  assert.equal(spec.deployment.mode, "preview");
  assert.ok(spec.sources.length >= 2, "pinned sources travel with the spec");
});

test("an unsupported app, preset or extra field is refused", () => {
  const base = structuredClone(blueprint("creator-hub"));
  const withApp = structuredClone(base);
  withApp.apps = ["guestbook", "showcase", "media-studio"];
  assert.throws(() => validateBlueprint(withApp), /requires guestbook \+ showcase/);

  const withPreset = structuredClone(base);
  withPreset.preset = "hello";
  assert.throws(() => validateBlueprint(withPreset), /requires hello/);

  const extra = { ...structuredClone(base), ownerToken: "secret" };
  assert.throws(() => validateBlueprint(extra), /Unknown blueprint field: ownerToken/);

  const badEvidence = structuredClone(base);
  badEvidence.evidence[0].url = "http://example.com/private";
  assert.throws(() => validateBlueprint(badEvidence), /https/);

  const missingLimit = structuredClone(base);
  missingLimit.limits = [];
  assert.throws(() => validateBlueprint(missingLimit), /limits/);
});

test("an unknown blueprint id resolves to nothing instead of a fake record", () => {
  assert.equal(blueprint("does-not-exist"), undefined);
});

test("the media studio blueprint reads the standalone pin and validates", () => {
  const entry = blueprint("media-studio");
  assert.ok(entry, "media-studio exists");
  const sources = blueprintSources(entry);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, "media-studio");
  assert.equal(sources[0].commit, "e8b3778cd5d800378f42985afda80820fcb7ef57");
  assert.equal(sources[0].url, "https://media.loftwah.com");
  const spec = blueprintSpec(entry);
  assert.equal(spec.preset, "media-studio");
  assert.deepEqual(spec.apps, ["media-studio"]);
  assert.equal(spec.sources.length, 1);
  assert.equal(spec.sources[0].commit, sources[0].commit);
  const readiness = blueprintReadiness(entry);
  assert.equal(readiness.state, "reference");
  assert.match(readiness.reason, /independent owner/i);
  const pinned = entry.evidence.find((item) => item.label === "Pinned source");
  assert.ok(pinned, "the media studio evidence names its pinned source");
  assert.ok(
    pinned.url.endsWith(`/tree/${sources[0].commit}`),
    "the evidence link carries the same revision as the active source pin",
  );
  const replay = entry.evidence.find((item) => item.label === "Pinned build replay");
  assert.ok(replay, "the pinned build replay is linked from the catalogue");
  assert.ok(
    replay.url.endsWith("/docs/evidence/pin-replay-20261116/README.md"),
    "the replay evidence points at the dated record",
  );
  assert.ok(
    entry.limits.some(
      (limit) =>
        /pinned commit itself was rebuilt/.test(limit) &&
        /independent-owner replay are still not proven/.test(limit),
    ),
    "the limits keep the provider and independent-owner boundary",
  );
});
