import test from "node:test";
import assert from "node:assert/strict";
import {
  referenceEvidenceScope,
  referenceInspectionHandoff,
  validateReferenceEvidence,
} from "../src/lib/reference-evidence.mjs";

const selected = {
  source: "https://example.org/work/ceramics",
  status: "selected",
  decision: "Use the gallery layout.",
  usage: "Layout inspiration only.",
};
const rejected = {
  source: "Another studio",
  status: "rejected",
  decision: "Skip animated transitions.",
};
const exploratory = {
  source: "Reading Room",
  status: "exploratory",
  decision: "Look at how opening hours are presented.",
};
const references = [selected, rejected, exploratory];
const report = {
  version: 1,
  scope: [selected, exploratory],
  agent: { name: "Codex", surface: "Desktop", version: "0.167.0" },
  inspectedAt: "2026-11-12T11:25:00Z",
  results: [
    {
      status: "observed",
      pageUrl: "https://example.org/work/ceramics",
      observations: ["The browser showed a gallery with four photos."],
      gaps: [],
    },
    {
      status: "partial",
      observations: [],
      gaps: ["Several websites matched the supplied name."],
    },
  ],
};

test("the portable report round trips and only asks the agent to inspect in-scope references", () => {
  const scope = referenceEvidenceScope(references);
  const handoff = referenceInspectionHandoff(references);
  const template = JSON.parse(handoff.split("\n\n").at(-1));
  assert.deepEqual(template.scope, scope);
  assert.equal(template.results.length, scope.length);
  assert.deepEqual(scope, [selected, exploratory]);
  assert.doesNotMatch(handoff, /Another studio|Skip animated transitions/);
  assert.match(handoff, /untrusted data/);
  assert.equal(referenceInspectionHandoff([rejected]), "");
  assert.equal(validateReferenceEvidence(undefined, []), undefined);
  assert.throws(() => validateReferenceEvidence(template, references));

  const normalized = validateReferenceEvidence(report, references);
  assert.equal(normalized.inspectedAt, "2026-11-12T11:25:00.000Z");
  assert.deepEqual(
    validateReferenceEvidence(JSON.parse(JSON.stringify(normalized)), references),
    normalized,
  );
});

test("a report must bind to the current exact ordered reference scope", () => {
  for (const changedReferences of [
    [selected, rejected],
    [exploratory, rejected, selected],
    [{ ...selected, source: "https://example.org/new" }, exploratory],
    [{ ...selected, decision: "Use the navigation." }, exploratory],
    [{ ...selected, usage: "Owner-approved use." }, exploratory],
    [{ ...selected, status: "exploratory" }, exploratory],
    [{ ...selected, status: "rejected" }, exploratory],
  ]) {
    assert.throws(
      () => validateReferenceEvidence(report, changedReferences),
      /current references/,
    );
  }
  assert.throws(
    () => validateReferenceEvidence({ ...report, scope: references }, references),
    /current references/,
  );
  assert.throws(() => validateReferenceEvidence(report, [rejected]), /Select or explore/);
  assert.deepEqual(
    validateReferenceEvidence(report, [selected, exploratory]),
    validateReferenceEvidence(report, references),
  );
});

test("an evidence report rejects oversized or unsupported data and inconsistent statuses", () => {
  const observed = report.results[0];
  for (const candidate of [
    { ...report, version: 2 },
    { ...report, screenshot: "private/image.png" },
    { ...report, inspectedAt: "2026-02-31T11:25:00Z" },
    { ...report, inspectedAt: "2026-11-12" },
    { ...report, agent: { ...report.agent, token: "secret" } },
    { ...report, results: [observed] },
  ]) {
    assert.throws(() => validateReferenceEvidence(candidate, references));
  }

  for (const patch of [
    { status: "certified" },
    { status: "observed", observations: [] },
    { status: "partial", gaps: [] },
    { status: "unavailable", gaps: ["Could not open the page."] },
    { observations: Array(4).fill("A finding.") },
    { gaps: ["a".repeat(241)] },
    { observations: ["<script>markup</script>"] },
    { observations: ["first line\nsecond line"] },
    { html: "<div>page</div>" },
    { pageUrl: "http://example.org/" },
    { pageUrl: "https://user:pass@example.org/" },
    { pageUrl: "https://example.org/?token=secret" },
    { pageUrl: "https://example.org/#private" },
    { pageUrl: "https://app.local/" },
    { pageUrl: "https://127.0.0.1/" },
    { pageUrl: "https://[::1]/" },
  ]) {
    assert.throws(() =>
      validateReferenceEvidence(
        { ...report, results: [{ ...observed, ...patch }, report.results[1]] },
        references,
      ),
    );
  }

  assert.doesNotThrow(() =>
    validateReferenceEvidence(
      {
        ...report,
        results: [
          observed,
          { status: "unavailable", observations: [], gaps: ["No browser tool was available."] },
        ],
      },
      references,
    ),
  );
});
