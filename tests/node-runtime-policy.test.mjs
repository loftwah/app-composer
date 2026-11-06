import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedNode } from "../lib/get-ready/local-checks.mjs";

test("runtime policy admits the declared Node lines only", () => {
  assert.equal(isSupportedNode("22.23.4"), true);
  assert.equal(isSupportedNode("24.22.1"), true);
  assert.equal(isSupportedNode("26.13.0"), true);
  assert.equal(isSupportedNode("22.23.3"), false);
  assert.equal(isSupportedNode("24.22.0"), false);
  assert.equal(isSupportedNode("26.12.0"), false);
  assert.equal(isSupportedNode("27.0.0"), false);
  assert.equal(isSupportedNode("23.0.0"), false);
});

test("the EmDash 1.2.0 site-skill recipe keeps its tested 22/24 scope", () => {
  assert.equal(isSupportedNode("22.23.4", { majorLines: [22, 24] }), true);
  assert.equal(isSupportedNode("24.22.1", { majorLines: [22, 24] }), true);
  assert.equal(isSupportedNode("26.13.0", { majorLines: [22, 24] }), false);
});
