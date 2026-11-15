// The /demo handoff: a sandbox exports the same versioned blueprint Init already
// validates, and can re-import one. These checks prove the round trip carries
// exactly the supported fields, names the preview-only ones it drops, and refuses
// an invalid blueprint instead of applying part of it.
import assert from "node:assert/strict";
import {
  initialLaunchpad,
  launchpadSpec,
  specToLaunchpad,
  transition,
} from "../../src/lib/launchpad.mjs";
import { check } from "./_checks.mjs";

export const id = "blueprint-roundtrip";
export const name = "Blueprint export and re-import";

const EDITS = [
  { type: "name", value: "Ring market" },
  { type: "tagline", value: "A market strung between asteroids." },
  { type: "theme", value: "daylight" },
  { type: "layout", value: "editorial" },
  { type: "accent", value: "clay" },
  { type: "block", block: "gallery", value: true },
  {
    type: "link",
    id: "link-notes",
    label: "Notes",
    url: "https://example.com/notes",
  },
];

export function run() {
  const shaped = EDITS.reduce(transition, initialLaunchpad());
  const exported = launchpadSpec(shaped);
  const imported = JSON.parse(JSON.stringify(exported.spec));

  return [
    check("export-succeeds", "The sandbox exports a validated blueprint", () => {
      assert.ok(exported.spec, "a blueprint is exported when a block is on");
      assert.equal(exported.spec.version, 2);
      assert.equal(exported.spec.preset, "composition");
      assert.equal(exported.spec.config.title, "Ring market");
      assert.equal(exported.spec.cards.length, 3);
      return `Exported version ${exported.spec.version} preset “${exported.spec.preset}” with ${exported.spec.cards.length} links.`;
    }),
    check("fields-survive", "Re-importing carries the supported fields", () => {
      const roundtrip = specToLaunchpad(imported, shaped);
      assert.equal(roundtrip.state.project.name, "Ring market");
      assert.equal(roundtrip.state.project.tagline, "A market strung between asteroids.");
      assert.equal(roundtrip.state.project.theme, "daylight");
      assert.equal(roundtrip.state.project.layout, "editorial");
      assert.equal(roundtrip.state.blocks.profile, true);
      assert.equal(roundtrip.state.blocks.guestbook, true);
      assert.deepEqual(
        roundtrip.state.links.map((link) => [link.label, link.url]),
        imported.cards.map((card) => [card.title, card.url]),
      );
      return "Name, introduction, theme, layout, both enabled blocks and 3 links survived export → JSON → re-import.";
    }),
    check(
      "preview-only-reported",
      "Preview-only gallery and accent are reported as not carried",
      () => {
        const galleryNote = exported.notCarried.find((note) => /gallery/i.test(note));
        const accentNote = exported.notCarried.find((note) => /accent/i.test(note));
        assert.ok(galleryNote, "the export names the dropped gallery");
        assert.ok(accentNote, "the export names the dropped accent");

        assert.equal(Object.hasOwn(exported.spec.config, "accent"), false);
        assert.equal(
          JSON.stringify(exported.spec).includes("gallery"),
          false,
          "the blueprint must not pretend to carry a gallery field",
        );

        const roundtrip = specToLaunchpad(imported, shaped);
        assert.equal(roundtrip.state.blocks.gallery, false, "the preview-only block is off after import");
        assert.ok(
          roundtrip.notCarried.some((note) => /gallery/i.test(note)),
          "the import says the gallery was turned off",
        );
        assert.ok(
          roundtrip.notCarried.some((note) => /accent/i.test(note)),
          "the import says the accent is not part of the blueprint",
        );
        assert.equal(roundtrip.state.project.accent, "clay", "the receiving sandbox keeps its own accent");

        const other = specToLaunchpad(imported, initialLaunchpad());
        assert.equal(other.state.project.accent, "ember", "a second sandbox keeps its own accent too");
        return "Gallery and accent are named as not carried; re-import turned the gallery off and kept each sandbox's own accent (clay, ember).";
      },
    ),
    check("invalid-refused", "An invalid blueprint is refused", () => {
      assert.throws(
        () => specToLaunchpad({ ...imported, preset: "not-a-preset" }, shaped),
        /supported app preset/,
      );
      assert.throws(
        () => specToLaunchpad({ ...imported, config: { ...imported.config, theme: "neon" } }, shaped),
        /Unsupported theme/,
      );
      assert.throws(
        () => specToLaunchpad({ ...imported, privacy: "public" }, shaped),
        /review before public publication/,
      );
      assert.throws(() => specToLaunchpad({ version: 2 }, shaped));
      assert.equal(shaped.project.name, "Ring market", "a refused import must not touch the sandbox");
      assert.equal(
        shaped.contributions.length,
        2,
        "a refused import must not touch the owner's notes",
      );
      return "Four invalid blueprints (bad preset, bad theme, no review-first privacy, no version) were refused and the sandbox was left untouched.";
    }),
  ];
}
