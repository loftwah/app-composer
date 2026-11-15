// The public /demo sandbox stores one project in the visitor's browser. These
// checks prove the save, reopen and moderation path cannot claim a change that
// is not in the stored state, and that a corrupt save never half-applies.
import assert from "node:assert/strict";
import {
  initialLaunchpad,
  launchpadSpec,
  pendingCount,
  publicContributions,
  readLaunchpad,
  transition,
} from "../../src/lib/launchpad.mjs";
import { check } from "./_checks.mjs";

export const id = "sandbox-save-reopen";
export const name = "Public sandbox: save, reopen and moderation";

const EDITS = [
  { type: "name", value: "Ring market" },
  { type: "tagline", value: "A market strung between asteroids." },
  { type: "theme", value: "daylight" },
  { type: "accent", value: "moss" },
  { type: "layout", value: "editorial" },
  { type: "block", block: "gallery", value: true },
  {
    type: "link",
    id: "link-notes",
    label: "Notes",
    url: "https://example.com/notes",
  },
];

/** The same JSON round trip the browser performs through localStorage. */
const reopen = (state) => readLaunchpad(JSON.stringify(state));

export function run() {
  const edited = EDITS.reduce(transition, initialLaunchpad());

  return [
    check(
      "edit-survives-reopen",
      "An edit survives JSON save and reopen exactly",
      () => {
        const saved = reopen(edited);
        assert.equal(saved.recovered, false, "a valid save must not be reported as recovered");
        assert.deepEqual(saved.state, edited);
        return "7 edits (name, tagline, theme, accent, layout, block, link) reopened byte-identically after JSON.stringify/parse.";
      },
    ),
    check(
      "fake-save-detected",
      "A save that keeps the initial state is detected as different",
      () => {
        const faked = reopen(initialLaunchpad());
        assert.equal(faked.recovered, false, "the untouched save is valid JSON");
        assert.notDeepEqual(faked.state, edited);
        assert.equal(faked.state.project.name, "The wheel, in motion");
        assert.notEqual(faked.state.project.name, edited.project.name);
        return `The untouched save still reads “${faked.state.project.name}”, not the edited “${edited.project.name}”.`;
      },
    ),
    check(
      "tampered-save-rejected",
      "A tampered save is rejected and reported as recovered",
      () => {
        const droppedContributions = JSON.parse(JSON.stringify(edited));
        droppedContributions.contributions = [];
        const rejected = reopen(droppedContributions);
        assert.equal(rejected.recovered, true);
        assert.deepEqual(rejected.state, initialLaunchpad());

        const wrongVersion = JSON.parse(JSON.stringify(edited));
        wrongVersion.version = 2;
        const rejectedVersion = reopen(wrongVersion);
        assert.equal(rejectedVersion.recovered, true);
        assert.deepEqual(rejectedVersion.state, initialLaunchpad());
        return "A save with no contributions and a save with version 2 were both refused; each recovered to the initial sandbox instead of half-applying.";
      },
    ),
    check(
      "approve-makes-public",
      "Approving a pending note makes it public",
      () => {
        const before = initialLaunchpad();
        assert.equal(pendingCount(before), 1);
        assert.deepEqual(
          publicContributions(before).map((note) => note.id),
          ["note-1"],
        );
        const approved = transition(before, {
          type: "review",
          id: "note-2",
          value: "approved",
        });
        assert.equal(pendingCount(approved), 0);
        assert.deepEqual(
          publicContributions(approved).map((note) => note.id),
          ["note-1", "note-2"],
        );
        return "The pending note left the queue and appeared in the public list (2 public, 0 pending).";
      },
    ),
    check(
      "hide-removes-publicly",
      "Hiding an approved note removes it from the public view",
      () => {
        const approved = transition(initialLaunchpad(), {
          type: "review",
          id: "note-2",
          value: "approved",
        });
        const hidden = transition(approved, {
          type: "review",
          id: "note-1",
          value: "hidden",
        });
        assert.deepEqual(
          publicContributions(hidden).map((note) => note.id),
          ["note-2"],
        );
        assert.equal(hidden.contributions.length, 2, "hiding keeps the note, it does not delete it");
        return "note-1 is hidden from the public list and still present in the owner's list.";
      },
    ),
    check(
      "restore-keeps-moderation",
      "Restoring an older version does not republish a hidden note",
      () => {
        const saved = transition(initialLaunchpad(), { type: "save" });
        const renamed = transition(saved, { type: "name", value: "Renamed after the save" });
        const hid = transition(renamed, { type: "review", id: "note-1", value: "hidden" });
        const restored = transition(hid, { type: "restore", revision: 1 });
        assert.equal(
          restored.project.name,
          "The wheel, in motion",
          "restore must actually bring the saved appearance back",
        );
        assert.equal(
          restored.contributions.find((note) => note.id === "note-1")?.status,
          "hidden",
        );
        assert.deepEqual(
          publicContributions(restored).map((note) => note.id),
          [],
          "the hidden note must stay out of the public list",
        );
        assert.equal(pendingCount(restored), 1, "the untouched pending note stays pending");
        return "Version 1 restored the saved name while note-1 stayed hidden and note-2 stayed pending; appearance and moderation travel separately.";
      },
    ),
    check(
      "export-still-reads-restored-state",
      "A restored sandbox still exports a valid blueprint",
      () => {
        const saved = transition(initialLaunchpad(), { type: "save" });
        const restored = transition(saved, { type: "restore", revision: 1 });
        const exported = launchpadSpec(restored);
        assert.ok(exported.spec, "restoring must not break blueprint export");
        assert.equal(exported.spec.preset, "composition");
        return `Export after restore produced preset “${exported.spec.preset}” with ${exported.spec.cards.length} links.`;
      },
    ),
  ];
}
