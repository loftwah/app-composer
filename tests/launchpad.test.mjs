import test from "node:test";
import assert from "node:assert/strict";
import { selectedSources } from "../src/lib/app-settings.mjs";
import {
  agentPrompt,
  initialLaunchpad,
  launchpadSpec,
  publicContributions,
  readLaunchpad,
  specToLaunchpad,
  transition,
} from "../src/lib/launchpad.mjs";

// First real fixture suite for the public /demo sandbox. Each case answers a
// question a visitor could be misled by: did my change save, did approval reach
// the public view, and does the exported blueprint carry what I chose?
function saved(state) {
  return JSON.stringify(state);
}

test("a rename survives save and reopen", () => {
  const start = initialLaunchpad();
  const edited = transition(start, { type: "name", value: "Ring market notes" });
  assert.equal(edited.project.name, "Ring market notes");
  assert.equal(start.project.name, "The wheel, in motion", "the input state is not mutated");
  assert.notDeepEqual(edited, start, "an edit produces a different state");
  const reopened = readLaunchpad(saved(edited));
  assert.equal(reopened.recovered, false);
  assert.deepEqual(reopened.state, edited, "reopening returns exactly what was saved");
});

test("a broken save/reopen cannot pass as working", () => {
  const edited = transition(initialLaunchpad(), {
    type: "tagline",
    value: "Notes from a market between asteroids.",
  });
  // A fake save that quietly keeps the starting state instead of the change.
  const brokenReopen = readLaunchpad(saved(initialLaunchpad()));
  assert.notDeepEqual(
    brokenReopen.state,
    edited,
    "a save that drops the edit is visibly different after reopen",
  );
});

test("a corrupt save starts clean and reports it", () => {
  for (const raw of ['{"version":1,', "null", "[]", '{"version":9}']) {
    const result = readLaunchpad(raw);
    assert.equal(result.recovered, true, `${raw} is not treated as a usable save`);
    assert.deepEqual(result.state, initialLaunchpad());
  }
  // No save at all is a first visit, not a recovery.
  assert.equal(readLaunchpad(null).recovered, false);
  assert.equal(readLaunchpad("").recovered, false);
});

test("an edited save is rejected rather than half-applied", () => {
  const tampered = structuredClone(initialLaunchpad());
  tampered.project.theme = "neon";
  const result = readLaunchpad(saved(tampered));
  assert.equal(result.recovered, true);
  assert.equal(result.state.project.theme, "midnight");
});

test("approval changes the public view and hiding revokes it", () => {
  let state = initialLaunchpad();
  assert.equal(publicContributions(state).length, 1);
  state = transition(state, { type: "review", id: "note-2", value: "approved" });
  assert.equal(publicContributions(state).length, 2, "an approved note becomes public");
  state = transition(state, { type: "review", id: "note-1", value: "hidden" });
  assert.equal(publicContributions(state).length, 1, "a hidden note leaves the public view");
  assert.ok(!publicContributions(state).some((note) => note.id === "note-1"));
});

test("restoring an older version does not republish a hidden note", () => {
  let state = initialLaunchpad();
  state = transition(state, { type: "save" });
  const version = state.revisions.at(-1).id;
  state = transition(state, { type: "review", id: "note-2", value: "approved" });
  state = transition(state, { type: "review", id: "note-2", value: "hidden" });
  state = transition(state, { type: "restore", revision: version });
  assert.equal(state.contributions.find((n) => n.id === "note-2").status, "hidden");
  assert.ok(!publicContributions(state).some((note) => note.id === "note-2"));
});

test("the exported blueprint validates and carries the chosen fields", () => {
  let state = transition(initialLaunchpad(), { type: "name", value: "Ring market notes" });
  state = transition(state, { type: "theme", value: "daylight" });
  state = transition(state, { type: "layout", value: "editorial" });
  const { spec, carried } = launchpadSpec(state);
  assert.equal(spec.version, 2);
  assert.equal(spec.preset, "composition");
  assert.equal(spec.config.title, "Ring market notes");
  assert.equal(spec.config.theme, "daylight");
  assert.equal(spec.config.layout, "editorial");
  assert.equal(spec.privacy, "review-first");
  assert.equal(spec.cards.length, 2);
  assert.ok(carried.includes("Project name"));
});

test("a preview-only block is reported, never exported silently", () => {
  let state = transition(initialLaunchpad(), { type: "block", block: "gallery", value: true });
  const { spec, notCarried } = launchpadSpec(state);
  assert.ok(notCarried.some((note) => note.startsWith("Media Studio gallery")));
  assert.equal(JSON.stringify(spec).includes("gallery"), false);
});

test("the round trip keeps supported fields and names the rest", () => {
  let state = transition(initialLaunchpad(), { type: "name", value: "Moon harbour" });
  state = transition(state, { type: "block", block: "gallery", value: true });
  const { spec } = launchpadSpec(state);
  const applied = specToLaunchpad(JSON.parse(JSON.stringify(spec)), state);
  assert.equal(applied.state.project.name, "Moon harbour");
  assert.equal(applied.state.project.theme, spec.config.theme);
  assert.equal(applied.state.links.length, spec.cards.length);
  assert.ok(applied.notCarried.some((note) => note.includes("Accent")));
  assert.ok(applied.notCarried.some((note) => note.includes("gallery")));
});

test("an invalid blueprint is refused instead of applied", () => {
  assert.throws(
    () => specToLaunchpad({ version: 2, preset: "composition" }, initialLaunchpad()),
    /title/i,
  );
});

test("a valid Init blueprint for another app does not replace the sandbox", () => {
  const state = initialLaunchpad();
  const { spec } = launchpadSpec(state);
  for (const preset of ["hello", "media-studio"]) {
    const otherApp = {
      ...spec,
      preset,
      sources: selectedSources([preset]),
      appSettings: {},
      cards: [],
    };
    assert.throws(() => specToLaunchpad(otherApp, state), /open it in Init/i);
  }
});

test("an empty selection exports nothing and says why", () => {
  let state = initialLaunchpad();
  for (const block of ["profile", "guestbook"]) {
    state = transition(state, { type: "block", block, value: false });
  }
  const { spec, notCarried } = launchpadSpec(state);
  assert.equal(spec, null);
  assert.match(notCarried.join(" "), /nothing to export/i);
});

test("the agent brief describes work, not a completed deployment", () => {
  const brief = agentPrompt(initialLaunchpad());
  assert.match(brief, /The wheel, in motion/);
  assert.match(brief, /not a deployment/i);
  assert.doesNotMatch(brief, /deployed successfully|is live now/i);
});
