import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  appearanceSkinCss,
  appearanceSkinPreviewCss,
  appearanceSkinRecipe,
  appearanceSkinRecipes,
  compileAppearanceSkin,
  contactSheet,
  normaliseAppearanceSkin,
  skinIds,
  skinPressureNames,
  workshopPress,
} from "../src/lib/appearance-skin.ts";
import {
  adminBrandCss,
  brandDefaults,
  brandSkinName,
  normaliseAdminBrandConfig,
} from "../src/lib/admin-brand-contract.ts";

const target = {
  account: "fictional",
  app: "composer",
  environment: "preview",
};

test("the shipped recipes are complete, unique and portable", () => {
  assert.deepEqual(
    appearanceSkinRecipes.map((recipe) => recipe.id),
    ["workshop-press", "contact-sheet"],
  );
  assert.deepEqual(skinIds, ["composer", "workshop-press", "contact-sheet"]);
  assert.equal(skinPressureNames.length, 4);
  assert.equal(brandSkinName("contact-sheet"), "Contact sheet");
  for (const recipe of appearanceSkinRecipes) {
    assert.equal(appearanceSkinRecipe.safeParse(recipe).success, true);
    assert.throws(() => normaliseAppearanceSkin(recipe), /already shipped/);
    for (let pressure = 1; pressure <= 4; pressure += 1) {
      const parts = compileAppearanceSkin(recipe, pressure);
      assert.match(parts.tokens, /--composer-skin-press:\dpx/);
      assert.ok(parts.focus.length > 0, `${recipe.id} keeps a focus rule`);
      assert.ok(parts.panel.length > 0, `${recipe.id} keeps a panel rule`);
      assert.doesNotMatch(
        [parts.tokens, parts.root, parts.panel, parts.field, parts.action, parts.focus].join(
          " ",
        ),
        /<|url\(|@import|expression|animation|transition/,
      );
    }
  }
  assert.throws(() => compileAppearanceSkin(workshopPress, 0), /1 to 4/);
  assert.throws(() => compileAppearanceSkin(workshopPress, 2.5), /1 to 4/);
});

test("a fresh recipe is accepted only with every measured choice", () => {
  const candidate = {
    schema: "composer.appearance-skin/1",
    id: "quiet-ledger",
    name: "Quiet ledger",
    description: "An underlined field and a hairline panel for a dense ledger",
    plate: "none",
    edge: "hairline",
    radius: "square",
    field: "underline",
    action: "outline",
    focus: "inset",
    pressure: "field",
  };
  assert.equal(normaliseAppearanceSkin(candidate).id, "quiet-ledger");
  const { focus, ...missing } = candidate;
  assert.throws(() => normaliseAppearanceSkin(missing));
  assert.throws(() =>
    normaliseAppearanceSkin({ ...candidate, extra: "not allowed" }),
  );
  assert.throws(() => normaliseAppearanceSkin({ ...candidate, plate: "glass" }));
  assert.throws(() => normaliseAppearanceSkin({ ...candidate, id: "Composer" }));
  assert.throws(() =>
    normaliseAppearanceSkin({ ...candidate, id: "composer" }),
  );
  assert.throws(() =>
    normaliseAppearanceSkin({ ...candidate, name: "<script>alert(1)</script>" }),
  );
  const compiled = compileAppearanceSkin(candidate, 4);
  assert.match(compiled.field, /border-width:0 0 var\(--composer-skin-press\)/);
  assert.match(compiled.tokens, /--composer-skin-press:4px/);
});

test("the two skins are genuinely different while sharing one grammar", () => {
  const press = compileAppearanceSkin(workshopPress, 3);
  const sheet = compileAppearanceSkin(contactSheet, 3);
  assert.match(press.root, /border-inline:var\(--composer-skin-press\)/);
  assert.equal(sheet.root, "", "Contact sheet frames panels, not the root");
  assert.match(sheet.panel, /border-block-start:var\(--composer-skin-press\)/);
  assert.match(press.panel, /background:var\(--composer-skin-plate\)/);
  assert.doesNotMatch(sheet.panel, /background:var\(--composer-skin-plate\)/);
  assert.match(press.action, /box-shadow:0 1px 0/);
  assert.doesNotMatch(sheet.action, /box-shadow/);
  assert.match(press.focus, /outline-offset:3px|outline-width/);
  assert.match(sheet.focus, /outline-offset:2px/);
  for (const recipe of [workshopPress, contactSheet]) {
    const one = compileAppearanceSkin(recipe, 1);
    const four = compileAppearanceSkin(recipe, 4);
    assert.notEqual(one.tokens, four.tokens);
  }
});

test("the same compiler serves the admin and a scoped second consumer", () => {
  const recipe = contactSheet;
  const admin = appearanceSkinCss(recipe, 3);
  const preview = appearanceSkinCss(recipe, 3, {
    scope: '[data-public-skin="contact-sheet"]',
    tokenScope: '[data-public-skin="contact-sheet"]',
  });
  assert.match(admin, /html\[data-theme\]\{--composer-skin-press:3px/);
  assert.match(admin, /#admin-root :is\(\.co-overview/);
  assert.doesNotMatch(preview, /#admin-root|html\[data-theme\]/);
  assert.match(
    preview,
    /\[data-public-skin="contact-sheet"\]\{--composer-skin-press:3px/,
  );
  assert.match(
    preview,
    /\[data-public-skin="contact-sheet"\] :is\(input,textarea,select\)/,
  );
  for (const line of compileAppearanceSkin(recipe, 3).panel.split(";"))
    assert.ok(admin.includes(line), `admin carries ${line}`);
});

test("Composer default emits no layer and older records still normalise", () => {
  const base = brandDefaults(target);
  assert.equal(adminBrandCss(base), adminBrandCss({ ...base, skinPressure: 4 }));
  assert.doesNotMatch(adminBrandCss(base), /--composer-skin-press/);
  const legacy = {
    schema: "composer.admin-brand/1",
    target,
    siteName: "Owner admin",
    footerLabel: "Owner footer",
    mark: "composer-approved",
    palette: "composer-orange",
    density: "compact",
    typeScale: "large",
  };
  const normalised = normaliseAdminBrandConfig(legacy);
  assert.equal(normalised.skin, "composer");
  assert.equal(normalised.skinPressure, 2);
  const sheet = normaliseAdminBrandConfig({
    ...legacy,
    skin: "contact-sheet",
    skinPressure: 3,
  });
  assert.equal(sheet.skin, "contact-sheet");
  assert.match(adminBrandCss(sheet), /border-block-start:var\(--composer-skin-press\)/);
});

test("the committed preview sheet is current and bounded", () => {
  const generated = readFileSync(
    new URL("../src/styles/appearance-skins.generated.css", import.meta.url),
    "utf8",
  );
  assert.equal(
    generated,
    `/* Generated from src/lib/appearance-skin-catalogue.ts by scripts/appearance-skins.mjs. */\n${appearanceSkinPreviewCss()}`,
  );
  for (const recipe of appearanceSkinRecipes)
    for (let pressure = 1; pressure <= 4; pressure += 1)
      assert.ok(
        generated.includes(
          `[data-composer-skin="${recipe.id}"][data-composer-pressure="${pressure}"]`,
        ),
        `${recipe.id} at ${pressure}`,
      );
  assert.doesNotMatch(generated, /#admin-root|url\(|@import|<script/i);
  assert.doesNotMatch(generated, /\b(animation|transition):/);
  assert.ok(generated.length < 12_000, "the whole sheet stays small");
});
