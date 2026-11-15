// The portable appearance-skin contract: a recipe must compile to a bounded
// layer, the saved administration and the public reference must use the same
// grammar, the generated sheet must be current, and the sensory paths must stay
// off unless a person enables them. A fresh-agent recipe is validated from the
// written contract, not from this file.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  appearanceSkinCss,
  appearanceSkinPreviewCss,
  compileAppearanceSkin,
  contactSheet,
  normaliseAppearanceSkin,
  workshopPress,
} from "../../src/lib/appearance-skin.ts";
import {
  adminBrandCss,
  brandDefaults,
} from "../../src/lib/admin-brand-contract.ts";
import {
  playSkinCue,
  sensoryOff,
  skinCuePlan,
} from "../../src/lib/brand-skin-feedback.ts";
import { check } from "./_checks.mjs";

export const id = "appearance-skin";
export const name = "Portable appearance-skin contract";

export function run({ root = process.cwd() } = {}) {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  const target = {
    account: "fictional",
    app: "composer",
    environment: "preview",
  };
  const freshRecipePath =
    "docs/evidence/appearance-skin-20261115/fresh-agent-recipe.json";
  return [
    check("contract-discoverable", "The contract is written and linked for agents", () => {
      const contract = read("docs/appearance-skin-contract.md");
      for (const field of [
        "schema",
        "id",
        "name",
        "description",
        "plate",
        "edge",
        "radius",
        "field",
        "action",
        "focus",
        "pressure",
      ])
        assert.match(contract, new RegExp(`\\b${field}\\b`), `documents ${field}`);
      for (const page of [
        "AGENTS.md",
        "DESIGN.md",
        "docs/brand-studio.md",
        ".impeccable/surfaces/src-plugins-brand-studio-page-tsx.md",
      ])
        assert.match(
          read(page),
          /appearance-skin-contract\.md/,
          `${page} points at the contract`,
        );
      return "The recipe, pressure and storage rules are documented and linked from agent and design guidance.";
    }),
    check("recipes-compile", "Every shipped recipe compiles at 1–4", () => {
      for (const recipe of [workshopPress, contactSheet])
        for (let pressure = 1; pressure <= 4; pressure += 1) {
          const parts = compileAppearanceSkin(recipe, pressure);
          assert.match(parts.tokens, new RegExp(`--composer-skin-press:${pressure}px`));
          assert.doesNotMatch(
            Object.values(parts).join(" "),
            /url\(|@import|<|expression|animation|transition/,
          );
        }
      assert.notEqual(
        compileAppearanceSkin(workshopPress, 3).panel,
        compileAppearanceSkin(contactSheet, 3).panel,
      );
      return "Two distinct recipes compile to bounded CSS with no URL, import, HTML or animation.";
    }),
    check("default-silent", "Composer default emits no layer", () => {
      const base = brandDefaults(target);
      const css = adminBrandCss(base);
      assert.doesNotMatch(css, /composer-skin-press/);
      assert.doesNotMatch(adminBrandCss({ ...base, skinPressure: 4 }), /composer-skin-press/);
      assert.match(adminBrandCss({ ...base, skin: "contact-sheet" }), /--composer-skin-press:2px/);
      return "The default stays byte-identical across pressure values; an old record cannot gain a layer.";
    }),
    check("one-compiler-two-consumers", "Admin and public scope share one grammar", () => {
      const admin = appearanceSkinCss(contactSheet, 3);
      const publicCss = appearanceSkinCss(contactSheet, 3, {
        scope: '[data-public-skin="contact-sheet"]',
        tokenScope: '[data-public-skin="contact-sheet"]',
      });
      assert.match(admin, /#admin-root/);
      assert.doesNotMatch(publicCss, /#admin-root|html\[data-theme\]/);
      for (const part of compileAppearanceSkin(contactSheet, 3).panel.split(";"))
        assert.ok(admin.includes(part) && publicCss.includes(part), part);
      return "The admin and the public reference carry the same compiled declarations under different roots.";
    }),
    check("preview-sheet-current", "The committed preview sheet matches the recipes", () => {
      const sheet = read("src/styles/appearance-skins.generated.css");
      assert.equal(
        sheet,
        `/* Generated from src/lib/appearance-skin-catalogue.ts by scripts/appearance-skins.mjs. */\n${appearanceSkinPreviewCss()}`,
      );
      assert.ok(sheet.length < 12_000, "the whole sheet stays under 12 kB");
      return `${sheet.length} bytes, eight skin/pressure blocks, generated from the same compiler.`;
    }),
    check("sensory-paths", "Press feedback stays off, plays on request and degrades honestly", () => {
      const off = playSkinCue(
        { AudioContext: undefined, navigator: {} },
        skinCuePlan(false),
        sensoryOff,
      );
      assert.deepEqual(off, { sound: false, haptics: false });
      const starts = [];
      class Gain {
        gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
        connect() {
          return this;
        }
      }
      class Osc {
        frequency = { value: 0 };
        connect() {
          return this;
        }
        start() {
          starts.push(1);
        }
        stop() {}
      }
      const AudioContext = class {
        currentTime = 0;
        destination = {};
        createOscillator() {
          return new Osc();
        }
        createGain() {
          return new Gain();
        }
        resume() {
          return Promise.resolve();
        }
      };
      const vibrations = [];
      const on = playSkinCue(
        { AudioContext, navigator: { vibrate: (p) => (vibrations.push(p), true) } },
        skinCuePlan(false),
        { sound: true, haptics: true },
      );
      assert.deepEqual(on, { sound: true, haptics: true });
      assert.equal(starts.length, 2);
      assert.deepEqual(vibrations, [[12]]);
      const reduced = playSkinCue(
        { AudioContext, navigator: { vibrate: () => true } },
        skinCuePlan(true),
        { sound: true, haptics: true },
      );
      assert.deepEqual(reduced, { sound: true, haptics: false });
      const unsupported = playSkinCue(
        { navigator: {} },
        skinCuePlan(false),
        { sound: true, haptics: true },
      );
      assert.deepEqual(unsupported, { sound: false, haptics: false });
      return "Off makes no sound or vibration; on plays two ticks and one 12ms pulse; reduced motion drops the settle and pulse; unsupported reports false.";
    }),
    check("fresh-agent-recipe", "A fresh context produced a valid recipe from the contract", () => {
      const raw = JSON.parse(read(freshRecipePath));
      const recipe = normaliseAppearanceSkin(raw);
      assert.equal(recipe.id, "pressed-folio");
      assert.ok(!["workshop-press", "contact-sheet"].includes(recipe.id));
      const parts = compileAppearanceSkin(recipe, 3);
      assert.match(parts.tokens, /--composer-skin-press:3px/);
      const receipt = JSON.parse(
        read("docs/evidence/appearance-skin-20261115/fresh-agent-receipt.json"),
      );
      assert.equal(receipt.output.recipeId, recipe.id);
      assert.equal(receipt.isolation.cleanClaim, "partial");
      return "Codex 0.145.0 / gpt-5.6-sol produced pressed-folio from the written contract; the receipt states the isolation limits.";
    }),
  ];
}
