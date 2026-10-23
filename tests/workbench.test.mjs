import test from "node:test";
import assert from "node:assert/strict";
import {
  initialBench,
  transition,
  featured,
  readBench,
  startingSpec,
} from "../src/lib/workbench.ts";

test("current source identity, edits and visibility govern both presentation histories", () => {
  let state = initialBench();
  state = transition(state, { type: "connect", slot: 0 });
  state = transition(state, { type: "publish" });
  state = transition(state, { type: "caption", value: "Latest value" });
  assert.equal(
    featured(state, state.revisions[0].presentation)[0].caption,
    "Latest value",
  );
  state = transition(state, { type: "visibility" });
  assert.equal(featured(state, state.revisions[0].presentation)[0], null);
  state = transition(state, { type: "restore", revision: 1 });
  assert.equal(featured(state)[0], null);
  assert.equal(state.items[0].status, "hidden");
});
test("three revisions are real operations; preview and restore never rewind app records", () => {
  let state = initialBench();
  for (const slot of [0, 1, 0]) {
    state = transition(state, { type: "connect", slot });
    state = transition(state, { type: "publish" });
  }
  assert.equal(state.revisions.length, 3);
  const before = structuredClone(state.draft);
  featured(state, state.revisions[0].presentation);
  assert.deepEqual(state.draft, before);
  state = transition(state, { type: "later" });
  state = transition(state, { type: "restore", revision: 1 });
  assert.equal(state.items.length, 3);
  assert.equal(state.revisions.length, 4);
  assert.deepEqual(state.draft, state.revisions[0].presentation);
});
test("ten interrupted sequences retain independent data and latest selected identity", () => {
  let state = initialBench();
  for (let n = 0; n < 10; n++) {
    const id = n % 2 ? "demo-lighthouse" : "demo-ringmarket";
    for (const action of [
      { type: "select", id },
      { type: "caption", value: "Old" },
      { type: "caption", value: "Final " + n },
      { type: "connect", slot: n % 2 },
      { type: "visibility" },
      { type: "connect", slot: 0 },
      { type: "visibility" },
      { type: "connect", slot: n % 2 },
      { type: "disconnect" },
      { type: "connect", slot: n % 2 },
      { type: "publish" },
    ])
      state = transition(state, action);
    assert.equal(featured(state)[n % 2].id, id);
    assert.equal(featured(state)[n % 2].caption, "Final " + n);
    assert.equal(state.items.length, 2);
    assert.deepEqual(readBench(JSON.stringify(state)), state);
  }
});
test("malformed persistence resets only the sandbox; handoff is a valid current spec", () => {
  assert.deepEqual(readBench("{bad"), initialBench());
  const state = initialBench();
  state.draft.slots[0] = "private-unknown";
  assert.deepEqual(readBench(JSON.stringify(state)), initialBench());
  const spec = startingSpec(initialBench());
  assert.equal(spec.version, 2);
  assert.equal(spec.preset, "composition");
  assert.equal(spec.sources.length, 2);
  assert.deepEqual(spec.cards, []);
});
