import test from "node:test";
import assert from "node:assert/strict";
import { unconfirmedReleaseCopy } from "../src/lib/delivery-copy.ts";

test("a failed release attempt does not claim nothing was uploaded", () => {
  const attempted = unconfirmedReleaseCopy(true);
  assert.match(attempted, /attempted/);
  assert.match(attempted, /does not confirm its outcome/);
  assert.match(attempted, /before any retry/);
  assert.doesNotMatch(attempted, /nothing was uploaded/i);
  assert.match(unconfirmedReleaseCopy(false), /No release was attempted/);
});
