import test from "node:test";
import assert from "node:assert/strict";
import { entryPath } from "../src/lib/entry.mjs";
import { numberInputValue } from "../src/lib/number-input.mjs";
import {
  isCalendarDate,
  calendarDateLabel,
} from "../src/lib/calendar-date.mjs";
import { collectionRequest } from "../src/lib/collection.mjs";
import { validateContentModel } from "../src/lib/content-model.mjs";
import modelInput from "../src/content-model.json" with { type: "json" };

test("public entry identities reject paths and executable URLs", () => {
  assert.equal(entryPath("../private"), null);
  assert.equal(entryPath("javascript:alert(1)"), null);
  assert.equal(entryPath("safe_entry-1"), "/entries/safe_entry-1");
});
test("empty numbers remain distinct from explicit zero and dates remain calendar days", () => {
  assert.equal(numberInputValue(""), null);
  assert.equal(numberInputValue("0"), 0);
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2024-02-29"), true);
  assert.equal(calendarDateLabel("2024-02-29"), "29 February 2024");
});
test("public query choices come from the validated model and duplicate URL inputs are refused", () => {
  const model = validateContentModel(modelInput);
  for (const query of [
    "page=1&page=2",
    "filter=one&filter=two",
    "page=0",
    "page=1&filter=javascript%3Aalert(1)",
  ])
    assert.equal(
      collectionRequest(model, new URLSearchParams(query)).valid,
      false,
    );
  assert.equal(collectionRequest(model, new URLSearchParams()).valid, true);
});
