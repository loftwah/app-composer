import test from "node:test";
import assert from "node:assert/strict";
import {journeyResponse, readJourneyPayload} from "../src/lib/inbox-journey-contract.ts";

// Production regression: a journey read was validated with the write-only
// {ok,message} envelope, so every real read threw Zod's
// "Unrecognized keys: version, workspace, …" and the owner saw raw schema JSON.
const journeyShaped = {
  ok: true,
  version: "composer.inbox-journey/1",
  workspace: {id: "ws-1", name: "dean", role: "owner"},
  scope: {
    resource: "res-1",
    account: "1003dc1d93af0ebea56b2f1252f89627",
    environment: "production",
    target: "https://composer.loftwah.com/guestbook",
    source: "5075d7be53b43aca288d3707fd06851aca91e8c2",
  },
  resourceVersion: 1,
  enquiry: {},
  workflow: {},
  delivery: {},
  notificationPreference: {enabled: false, revision: 0},
  next: {},
  timezone: "UTC",
};

test('a journey read is never judged by the write envelope', () => {
  // The old code rethrew "Unrecognized keys: version, workspace, …" here.
  assert.throws(
    () => journeyResponse(journeyShaped, false),
    (error) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /unrecognized_keys|Unrecognized keys/);
      assert.doesNotMatch(error.message, /^\[|\]$/);
      assert.match(error.message, /did not match the supported contract/);
      return true;
    },
  );
});

test('a refused read says so without echoing a schema dump', () => {
  assert.throws(
    () => journeyResponse({ok: false, message: "Not your workspace."}, false),
    /request was refused/,
  );
  assert.throws(() => journeyResponse(null, false), /request was refused/);
  assert.throws(() => journeyResponse("nope", false), /request was refused/);
});

test('a write status still uses the strict envelope', () => {
  assert.deepEqual(journeyResponse({ok: true}, true), {ok: true});
  assert.deepEqual(journeyResponse({ok: false, message: "Refused."}, true), {
    ok: false,
    message: "Refused.",
  });
  for (const value of [{ok: true, extra: 1}, {}, null, "ok"]) {
    assert.throws(
      () => journeyResponse(value, true),
      (error) => {
        assert.doesNotMatch(error.message, /unrecognized_keys|Unrecognized keys/);
        assert.match(error.message, /did not match the supported contract/);
        return true;
      },
    );
  }
});

test('an unreadable payload returns one readable failure, never raw JSON', () => {
  for (const value of [{}, [], {ok: true}, journeyShaped, "x", 7, null]) {
    assert.throws(
      () => readJourneyPayload(value),
      (error) => {
        assert.match(error.message, /did not match the supported contract/);
        assert.doesNotMatch(error.message, /unrecognized_keys|"code"|"path"/);
        return true;
      },
    );
  }
});
