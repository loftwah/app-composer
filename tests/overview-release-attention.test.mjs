import test from "node:test";
import assert from "node:assert/strict";
import {
  releaseAttentionCopy,
  releaseAttentionKey,
} from "../src/lib/release-attention.ts";

const row = (overrides = {}) => ({
  id: "delivery-run-abc",
  commit_sha: "a".repeat(40),
  environment: "production",
  state: "failed",
  release_performed: 0,
  verification_performed: 0,
  ...overrides,
});

test("repeated release attempts for one commit and environment are one problem", () => {
  assert.equal(releaseAttentionKey(row()), releaseAttentionKey(row({id: "another"})));
  assert.equal(releaseAttentionKey(row()), `${"a".repeat(40)}:production`);
  assert.notEqual(
    releaseAttentionKey(row()),
    releaseAttentionKey(row({commit_sha: "b".repeat(40)})),
  );
  assert.notEqual(
    releaseAttentionKey(row()),
    releaseAttentionKey(row({environment: "staging"})),
  );
});

test("a failed release and an unverified upload have honest copy", () => {
  const failed = releaseAttentionCopy(row());
  assert.equal(failed.title, "A production release needs attention");
  assert.match(failed.summary, /did not complete/);
  assert.match(failed.summary, /do not repeat an ambiguous upload/);
  assert.equal(failed.action, "Open Delivery runs");

  const unverified = releaseAttentionCopy(
    row({release_performed: 1, verification_performed: 0}),
  );
  assert.match(unverified.summary, /performed an upload/);
  assert.match(unverified.summary, /no independent live read/);
  assert.match(unverified.summary, /before calling it accepted/);
});
