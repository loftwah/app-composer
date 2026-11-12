import test from "node:test";
import assert from "node:assert/strict";
import { handoff, validateSpec } from "../src/lib/spec.mjs";
import { recommendationSpec } from "../src/lib/init-recommendations.mjs";

const older = {
  version: 1,
  preset: "composition",
  config: {
    title: "Clay studio",
    intro: "",
    theme: "daylight",
    layout: "grid",
  },
  privacy: "review-first",
  deployment: { mode: "existing-domain", hostname: "studio.example.com" },
};

const direction = {
  version: 1,
  voice: "Short, plain captions with the artist’s own spelling.",
  visual: "Lead with photos of finished pieces.",
  references: [
    {
      source: "https://example.org/work/ceramics",
      decision: "Use the gallery structure.",
      status: "selected",
      usage: "Layout only",
    },
    {
      source: "Another studio",
      decision: "Skip animated transitions.",
      status: "rejected",
    },
  ],
};

test("creative direction survives a draft round trip and travels in the agent handoff", () => {
  const spec = validateSpec({ ...older, projectDirection: direction });
  assert.deepEqual(validateSpec(JSON.parse(JSON.stringify(spec))), spec);
  assert.deepEqual(
    recommendationSpec(spec, "showcase").projectDirection,
    direction,
  );
  assert.equal(spec.deployment.hostname, "studio.example.com");
  assert.equal(
    spec.sources.some((source) => source.repository.includes("example.org")),
    false,
  );
  assert.match(handoff(spec), /Carry the draft’s projectDirection/);
  assert.match(handoff(spec), /Skip animated transitions/);
  assert.doesNotMatch(handoff(validateSpec(older)), /projectDirection/);
});

test("unsupported, incomplete and credential-bearing references are rejected", () => {
  const reference = direction.references[0];
  for (const invalid of [
    { ...direction, version: 2 },
    { ...direction, secrets: "not part of the contract" },
    { ...direction, references: Array(4).fill(reference) },
    { ...direction, references: [{ ...reference, decision: "" }] },
    { ...direction, references: [{ ...reference, status: "automatic" }] },
    {
      ...direction,
      references: [{ ...reference, source: "https://user:pass@example.org" }],
    },
    {
      ...direction,
      references: [{ ...reference, source: "javascript:alert(1)" }],
    },
  ]) {
    assert.throws(() => validateSpec({ ...older, projectDirection: invalid }));
  }
});
