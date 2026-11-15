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
