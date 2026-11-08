import test from "node:test";
import assert from "node:assert/strict";
import { replaySitrep } from "../src/lib/incident-replay.ts";
import {
  decide,
  emailPreview,
  requestChanges,
  resetRehearsal,
  startRehearsal,
} from "../src/lib/incident-rehearsal.ts";

const begin = () => startRehearsal(replaySitrep);

test("the rehearsal starts read-only with one version and no send", () => {
  const state = begin();
  assert.equal(state.stage, "review");
  assert.equal(state.active, 1);
  assert.equal(state.versions.length, 1);
  assert.equal(state.emailSent, false);
  assert.equal(state.writesPerformed, 0);
  assert.equal(state.outcome, null);
  assert.match(state.versions[0].digest, /^[a-f0-9]{12}$/);
});

test("a send-back needs useful instructions and retains both versions", () => {
  const state = begin();
  const refused = requestChanges(state, "fix it");
  assert.equal(refused.ok, false);
  assert.match(refused.message, /12 characters/);
  assert.equal(refused.state.versions.length, 1);

  const changed = requestChanges(
    state,
    "Keep the failing request and control. Reproduce the missing caption and add a regression check.",
  );
  assert.equal(changed.ok, true);
  assert.equal(changed.state.versions.length, 2);
  assert.equal(changed.state.active, 2);
  assert.equal(changed.state.decision, "changes-requested");
  assert.equal(changed.state.versions[0].evidence.length, 2);
  assert.equal(changed.state.versions[1].evidence.length, 5);
  assert.notEqual(changed.state.versions[0].digest, changed.state.versions[1].digest);
  assert.match(changed.message, /old approval is invalid/);
  assert.equal(changed.state.writesPerformed, 0);
});

test("approving the stale version is refused after the revision", () => {
  const changed = requestChanges(
    begin(),
    "Keep the failing request and control. Reproduce the missing caption and add a regression check.",
  ).state;
  const stale = decide(changed, "approve", 1);
  assert.equal(stale.ok, false);
  assert.match(stale.message, /stale/);
  assert.equal(stale.state.stage, "review");
  const current = decide(changed, "approve", 2);
  assert.equal(current.ok, true);
  assert.equal(current.state.stage, "approved");
  assert.match(current.state.outcome, /No email was sent/);
  assert.equal(current.state.writesPerformed, 0);
  assert.equal(current.state.emailSent, false);
});

test("repeating an approval is idempotent and executes nothing", () => {
  const approved = decide(begin(), "approve", 1);
  assert.equal(approved.ok, true);
  const again = decide(approved.state, "approve", 1);
  assert.equal(again.ok, false);
  assert.equal(again.repeated, true);
  assert.deepEqual(again.state, approved.state);
  assert.equal(again.state.outcome, approved.state.outcome);
});

test("rejection preserves the investigation and cannot then approve", () => {
  const rejected = decide(begin(), "reject", 1);
  assert.equal(rejected.state.stage, "rejected");
  assert.match(rejected.state.outcome, /evidence and versions stay readable/);
  assert.equal(rejected.state.versions.length, 1);
  const approve = decide(rejected.state, "approve", 1);
  assert.equal(approve.ok, false);
  assert.equal(approve.state.stage, "rejected");
});

test("reset returns an untouched rehearsal", () => {
  const changed = requestChanges(
    begin(),
    "Add the reproduction and a regression check before asking for approval.",
  ).state;
  const reset = resetRehearsal(replaySitrep);
  assert.equal(reset.active, 1);
  assert.equal(reset.versions.length, 1);
  assert.equal(reset.decision, "none");
  assert.notEqual(changed.versions[1].digest, reset.versions[0].digest);
});

test("the email preview is fictional, unsent and carries no approval link", () => {
  const preview = emailPreview(replaySitrep);
  assert.equal(preview.sent, false);
  assert.equal(preview.to, "owner@example.invalid");
  assert.match(preview.note, /No delivery provider is contacted/);
  assert.match(preview.body, /rehearsal preview/);
  assert.doesNotMatch(preview.body, /https?:/);
  assert.doesNotMatch(preview.body, /approve\?token|bearer|secret/i);
});
