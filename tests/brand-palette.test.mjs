import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const luminance = (hex) => {
  const channels = hex
    .match(/[0-9a-f]{2}/gi)
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return (
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  );
};
const contrast = (foreground, background) => {
  const [light, dark] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
};
const token = (css, name) =>
  css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];

const maintained = [
  "src/styles/global.css",
  "public/brand/launcher.css",
  "src/plugins/outcomes.css",
  "src/plugins/miniapps-admin.css",
  "src/plugins/stacks-admin.css",
  "src/lib/stack-theme.mjs",
  "lib/content-model/site-template/src/styles/site.css",
];
const legacy = /#(?:ff9b55|ffc18f|a63d08|8d3203|ffa471|a63e10|ad440f|f49a61|e77743|b8451c)\b/i;

test("Composer UI sources use the canonical orange and documented roles, not the legacy peach family", () => {
  for (const path of maintained) {
    const source = read(path);
    assert.match(source, /#fc5b05/i, `${path} names the canonical orange`);
    assert.doesNotMatch(source, legacy, `${path} keeps no legacy UI orange`);
  }
  assert.match(read("public/brand/launcher.css"), /--menu-signal:\s*#c74400/i);
  const briefing = read("src/pages/php2shell.astro");
  assert.match(briefing, /background:var\(--color-action\)/);
  assert.doesNotMatch(briefing, legacy);
  assert.match(read("src/lib/stack-theme.mjs"), /accent:\s*'#c74400'/);
  assert.match(read("src/lib/stack-theme.mjs"), /accent:\s*'#fc5b05'/);
  assert.match(
    read("lib/content-model/site-template/src/styles/site.css"),
    /--action:\s*#fc5b05/i,
  );
});

test("declared foreground/background pairs clear WCAG AA where they are used for text", () => {
  const css = read("src/styles/global.css");
  assert.equal(token(css, "color-brand"), "#fc5b05");
  const darkAccent = token(css, "color-accent");
  const lightBlock = css.slice(css.indexOf(':root[data-theme="light"]'));
  const lightAccent = lightBlock.match(/--color-accent:\s*(#[0-9a-f]{6})/i)?.[1];
  const action = token(css, "color-action");
  const onAction = token(css, "color-on-action");
  const focus = token(css, "color-focus");
  assert.ok(contrast(darkAccent, "#17181b") >= 4.5);
  assert.ok(contrast(lightAccent, "#faf9f7") >= 4.5);
  assert.ok(contrast(onAction, action) >= 4.5);
  assert.ok(contrast(focus, "#17181b") >= 3);
  assert.ok(contrast(focus, "#faf9f7") >= 3);
  assert.equal(token(css, "color-action-hover"), "#ff7a33");
  assert.ok(contrast(onAction, "#ff7a33") >= 4.5);
  assert.ok(contrast(onAction, "#e85404") >= 4.5);
});

test("generated stack themes and the published diagram set follow the maintained palette", () => {
  const generated = read("src/styles/stack-theme.generated.css");
  assert.match(generated, /daylight[\s\S]*--stack-accent:\s*#c74400/);
  assert.match(generated, /midnight[\s\S]*--stack-accent:\s*#fc5b05/);
  const sources = JSON.parse(read("public/diagrams/journey-sources.json"));
  for (const key of [
    "composer",
    "composition",
    "activity",
    "get-ready",
    "state",
    "extension",
  ]) {
    const stem = sources[key];
    assert.match(stem, /20261023$/, `${key} uses a new published stem`);
    for (const variant of ["dark", "light"]) {
      const svg = read(`public/diagrams/${stem}-${variant}.svg`);
      assert.match(svg, variant === "dark" ? /#fc5b05/i : /#c74400/i);
      assert.doesNotMatch(svg, legacy);
    }
  }
  for (const key of [
    "building-architecture",
    "building-workflow",
    "building-contribution",
  ])
    for (const variant of ["dark", "light"]) {
      const svg = read(`public/diagrams/${sources[key]}-${variant}.svg`);
      assert.doesNotMatch(svg, legacy);
    }
  const building = read("src/pages/building.astro");
  assert.match(building, /building-architecture-20261023-dark\.svg/);
  assert.match(building, /building-workflow-20261023-light\.svg/);
  assert.match(building, /building-contribution-20261023-mobile-dark\.svg/);
});

// The same local launcher stylesheet is explicitly copied into all five apps
// and every generated project, so adding a role cannot silently skip consumers.
test("the copied palette contract carries every approved role", () => {
  const css = read("public/brand/launcher.css");
  assert.match(css, /composer\.palette\/1/);
  for (const [role, expected] of Object.entries({
    brand: "#fc5b05", action: "#fc5b05", "action-hover": "#ff7a33",
    "action-pressed": "#e85404", "on-action": "#17181b", focus: "#fc5b05",
  })) assert.equal(token(css, "composer-" + role), expected, role);
  assert.match(css, /--composer-accent:\s*#c74400/);
  assert.match(read("scripts/public-ui-assets.mjs"), /'launcher\.css'/);
  assert.match(read("lib/content-model/project.mts"), /"launcher\.css"/);
});
