import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A source-level layout contract for Composer's public and owner surfaces.
// Rendered checks still own actual pixels; these rules protect the failure
// classes behind #605: fixed widths that cannot fit a 390px phone, a fixed
// layout track with no collapse, nowrap prose, and a control wider than the
// space it is dropped into. A deliberately broken fixture proves the audit.

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const compact = (value) => value.replace(/\s+/g, " ").trim();

const PHONE = 390;
const SHARED = [
  "src/styles/global.css",
  "src/styles/header.css",
  "src/styles/workbench.css",
];

const SURFACES = [
  { name: "/", page: "src/pages/index.astro", extra: ["src/components/ProductHome.astro"] },
  { name: "/learn", page: "src/pages/learn.astro" },
  { name: "/ready", page: "src/pages/ready.astro" },
  { name: "/init", page: "src/pages/init.astro" },
  { name: "/agent", page: "src/pages/agent.astro" },
  { name: "/docs", page: "src/pages/docs.astro" },
  { name: "/blueprints", page: "src/pages/blueprints.astro" },
  { name: "/projects", page: "src/pages/projects.astro" },
].map((surface) => ({ ...surface, extra: surface.extra ?? [] }));

const pluginCss = fs
  .readdirSync(path.join(root, "src/plugins"))
  .filter((name) => name.endsWith(".css"))
  .sort()
  .map((name) => "src/plugins/" + name);

function inside(value, open) {
  let depth = 0;
  let quote = null;
  for (let index = open; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("Unclosed CSS block");
}

// Enough CSS grammar for maintained source files: at-rules with blocks are
// walked for their contents, statement at-rules and declarations are ignored.
function cssRules(source, media = [], rules = []) {
  source = source.replace(/\/\*[\s\S]*?\*\//g, "");
  let index = 0;
  let prelude = "";
  let quote = null;
  while (index < source.length) {
    const char = source[index];
    if (quote) {
      prelude += char;
      if (char === quote && source[index - 1] !== "\\") quote = null;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      prelude += char;
      index += 1;
      continue;
    }
    if (char === "{") {
      const close = inside(source, index);
      const head = compact(prelude);
      const body = source.slice(index + 1, close);
      if (/^@media\b/.test(head)) cssRules(body, [...media, head], rules);
      else if (/^@(supports|layer|container)\b/.test(head)) cssRules(body, media, rules);
      else if (!head.startsWith("@")) rules.push({ selector: head, body, media });
      prelude = "";
      index = close + 1;
      continue;
    }
    if (char === "}" || char === ";") {
      prelude = "";
      index += 1;
      continue;
    }
    prelude += char;
    index += 1;
  }
  return rules;
}

function declarations(body) {
  const found = {};
  let start = 0;
  let depth = 0;
  let quote = null;
  const parts = [];
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === quote && body[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === ";" && depth === 0) {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(body.slice(start));
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    const property = compact(part.slice(0, colon)).toLowerCase();
    const value = compact(part.slice(colon + 1)).replace(/\s*!important$/, "");
    if (property) found[property] = value;
  }
  return found;
}

const selectors = (selector) => selector.split(",").map(compact).filter(Boolean);
const pixels = (value) => {
  const text = String(value ?? "").trim();
  if (text === "0") return 0;
  const match = text.match(/^(-?[\d.]+)px$/);
  return match ? Number(match[1]) : null;
};
const isDesktopOnly = (media) =>
  media.some((query) => {
    const match = query.match(/min-width:\s*([\d.]+)px/);
    return match ? Number(match[1]) > PHONE : false;
  });
const isTable = (selector) => /(^|[\s>+~])table([\s.#:[]|$)/.test(selector);
const hasHorizontalScroll = (rules) =>
  rules.some((rule) => /auto|scroll/.test(declarations(rule.body)["overflow-x"] ?? ""));
const isProse = (selector) =>
  /(^|[\s>+~,(])(p|dd|blockquote|figcaption)([\s.,:>+~)#[]|$)/.test(selector) ||
  (/[.#][\w-]*(copy|text|lede|description|prose|body|intro|help|message|note|summary|outcome|detail)/i.test(
    selector,
  ) &&
    !/[.#][\w-]*(badge|status|kicker|label|tag|pill|chip|meta|count|state|prompt|code)/i.test(
      selector,
    ));

function filesFor(surface) {
  const seen = new Set(SHARED);
  const queue = [surface.page, ...surface.extra];
  while (queue.length) {
    const relative = queue.shift();
    if (!relative || seen.has(relative)) continue;
    seen.add(relative);
    if (relative.endsWith(".css")) continue;
    const source = read(relative);
    for (const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(relative), match[1]),
      );
      if (!/\.(astro|css|tsx)$/.test(resolved)) continue;
      if (!fs.existsSync(path.join(root, resolved))) continue;
      queue.push(resolved);
    }
  }
  return [...seen];
}

function cssFor(file) {
  const source = read(file);
  if (file.endsWith(".css")) return [{ file, source }];
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => ({
    file,
    source: match[1],
  }));
}

function rulesFor(files) {
  return files.flatMap((file) =>
    cssFor(file).flatMap(({ source }) => cssRules(source).map((rule) => ({ ...rule, file }))),
  );
}

const phoneOverride = (rule) =>
  rule.media.some((query) => {
    const match = query.match(/max-width:\s*([\d.]+)px/);
    return match ? Number(match[1]) >= PHONE : false;
  });

function responsiveOverride(rules, selector, predicate) {
  const own = new Set(selectors(selector));
  return rules.some((rule) => {
    if (!phoneOverride(rule)) return false;
    if (!selectors(rule.selector).some((candidate) => own.has(candidate))) return false;
    return Object.entries(declarations(rule.body)).some(([property, value]) =>
      predicate(property, value),
    );
  });
}

const safeWidth = (property, value) =>
  property === "width" && (/^(100%|auto)$/.test(value) || (pixels(value) ?? Infinity) <= PHONE);
const safeMinWidth = (property, value) =>
  property === "min-width" && (pixels(value) ?? Infinity) <= 0;
const safeTrack = (property, value) =>
  property === "grid-template-columns" &&
  !/(?<![\w-])([\d.]+)px/.test(value.replace(/minmax\([^)]*\)/g, ""));

// The returned categories are stable so the fixture test can prove each rule
// has teeth independently.
export function auditCss(rules, { tables = true } = {}) {
  const findings = { width: [], minWidth: [], nowrap: [], controls: [], tracks: [] };
  const scrollable = hasHorizontalScroll(rules);
  for (const rule of rules) {
    const style = declarations(rule.body);
    const desktop = isDesktopOnly(rule.media);
    const table = tables && isTable(rule.selector) && scrollable;

    const width = pixels(style.width);
    if (
      width != null &&
      width > PHONE &&
      !desktop &&
      !table &&
      !/^(0|100%|auto)$/.test(style["max-width"] ?? "") &&
      !/^(img|video|canvas|svg)$/i.test(rule.selector.split(/[\s>+~]/).pop()) &&
      !responsiveOverride(rules, rule.selector, safeWidth)
    ) {
      findings.width.push({ file: rule.file, selector: rule.selector, value: style.width });
    }

    const minWidth = pixels(style["min-width"]);
    if (minWidth != null && minWidth > PHONE && !desktop && !table) {
      if (!responsiveOverride(rules, rule.selector, safeMinWidth)) {
        findings.minWidth.push({ file: rule.file, selector: rule.selector, value: style["min-width"] });
      }
    }

    if (
      /nowrap/.test(style["white-space"] ?? "") &&
      selectors(rule.selector).some(isProse) &&
      !/text-overflow:\s*ellipsis/.test(rule.body) &&
      !responsiveOverride(
        rules,
        rule.selector,
        (property, value) => property === "white-space" && !/nowrap/.test(value),
      )
    ) {
      findings.nowrap.push({ file: rule.file, selector: rule.selector });
    }

    if (/(^|[\s,>+~])(input|select|textarea)([\s,.:#[]|$)/.test(rule.selector)) {
      const smallControl = /(checkbox|radio|file)/.test(rule.selector);
      const fixedWidth = pixels(style.width);
      const fixedMin = pixels(style["min-width"]);
      const controlLimit = 240;
      if (
        !smallControl &&
        (((fixedWidth ?? 0) > controlLimit &&
          !responsiveOverride(rules, rule.selector, safeWidth)) ||
          ((fixedMin ?? 0) > controlLimit &&
            !responsiveOverride(rules, rule.selector, safeMinWidth)))
      ) {
        findings.controls.push({
          file: rule.file,
          selector: rule.selector,
          value: style.width ?? style["min-width"],
        });
      }
    }

    const tracks = (style["grid-template-columns"] ?? "")
      .replace(/minmax\([^)]*\)/g, "")
      .replace(/repeat\([^)]*\)/g, "")
      .match(/(?<![\w-])([\d.]+)px/g)
      ?.map((value) => Number.parseFloat(value))
      .filter((value) => value >= 240);
    if (
      tracks?.length &&
      !desktop &&
      !responsiveOverride(rules, rule.selector, safeTrack)
    ) {
      findings.tracks.push({
        file: rule.file,
        selector: rule.selector,
        value: style["grid-template-columns"],
      });
    }
  }
  return findings;
}

const format = (list) =>
  list.map((entry) => `${entry.file} · ${entry.selector} · ${entry.value ?? ""}`.trim()).join("\n");

for (const surface of SURFACES) {
  test(`${surface.name} keeps its source layout inside a 390px phone`, () => {
    const rules = rulesFor(filesFor(surface));
    const findings = auditCss(rules);
    assert.deepEqual(findings.width, [], `fixed width can overflow a phone:\n${format(findings.width)}`);
    assert.deepEqual(
      findings.minWidth,
      [],
      `min-width needs a phone override:\n${format(findings.minWidth)}`,
    );
    assert.deepEqual(findings.nowrap, [], `nowrap on prose:\n${format(findings.nowrap)}`);
    assert.deepEqual(
      findings.controls,
      [],
      `form control assumed wider than its container:\n${format(findings.controls)}`,
    );
    assert.deepEqual(
      findings.tracks,
      [],
      `fixed layout track needs a collapse breakpoint:\n${format(findings.tracks)}`,
    );
  });
}

test("admin plugin styles keep their forms and tables inside the viewport", () => {
  const rules = rulesFor(pluginCss.map((file) => file));
  const findings = auditCss(rules);
  assert.deepEqual(findings.width, [], format(findings.width));
  assert.deepEqual(findings.minWidth, [], format(findings.minWidth));
  assert.deepEqual(findings.nowrap, [], format(findings.nowrap));
  assert.deepEqual(findings.controls, [], format(findings.controls));
  assert.deepEqual(findings.tracks, [], format(findings.tracks));
});

test("the audit catches each deliberate failure class in a broken fixture", () => {
  const broken = `
    .page-banner { width: 720px; }
    .side-panel { min-width: 460px; }
    .summary-copy { white-space: nowrap; }
    .contact-form input { width: 520px; }
    .search-form select { min-width: 420px; }
    .split-panel { grid-template-columns: 360px minmax(0, 1fr); }
  `;
  const findings = auditCss(cssRules(broken));
  assert.equal(findings.width.length, 2);
  assert.equal(findings.minWidth.length, 2);
  assert.equal(findings.nowrap.length, 1);
  assert.equal(findings.controls.length, 2);
  assert.equal(findings.tracks.length, 1);
});

test("a responsive override makes those failures pass", () => {
  const repaired = `
    .page-banner { width: 720px; }
    .side-panel { min-width: 460px; }
    .summary-copy { white-space: nowrap; }
    .contact-form input { width: 520px; }
    .search-form select { min-width: 420px; }
    .split-panel { grid-template-columns: 360px minmax(0, 1fr); }
    @media (max-width: 700px) {
      .page-banner { width: 100%; }
      .side-panel { min-width: 0; }
      .summary-copy { white-space: normal; }
      .contact-form input { width: 100%; }
      .search-form select { min-width: 0; }
      .split-panel { grid-template-columns: 1fr; }
    }
  `;
  const findings = auditCss(cssRules(repaired));
  for (const [name, list] of Object.entries(findings)) {
    assert.deepEqual(list, [], `repaired fixture still fails ${name}`);
  }
});

test("measured /projects rows use the available desktop width, not the 72ch prose cap", () => {
  const files = filesFor(SURFACES.find((surface) => surface.name === "/projects"));
  const rules = rulesFor(files);
  const list = rules.find(
    (rule) => rule.file === "src/pages/projects.astro" && rule.selector === ".project-list",
  );
  assert.ok(list, "the project list still has its own rule");
  assert.match(declarations(list.body)["max-width"] ?? "", /none|100%/);
});

test("measured /learn stacks its index before the reading column gets narrow", () => {
  const rules = rulesFor(filesFor(SURFACES.find((surface) => surface.name === "/learn")));
  const layout = rules.find(
    (rule) => rule.file === "src/pages/learn.astro" && rule.selector === ".learn-layout",
  );
  assert.ok(layout, "the tutorial layout still has its own rule");
  assert.match(declarations(layout.body)["grid-template-columns"] ?? "", /^260px/);
  const collapse = rules.find(
    (rule) =>
      rule.file === "src/pages/learn.astro" &&
      rule.selector === ".learn-layout" &&
      rule.media.some((query) => /max-width/.test(query)) &&
      /grid-template-columns:\s*1fr/.test(rule.body),
  );
  assert.ok(collapse, "the two-column tutorial layout has a collapse rule");
  const breakpoint = collapse.media
    .map((query) => Number.parseFloat(query.match(/max-width:\s*([\d.]+)px/)?.[1] ?? "0"))
    .sort((a, b) => b - a)[0];
  assert.ok(
    breakpoint >= 900,
    `the tutorial index must stack at tablet widths, not at ${breakpoint}px`,
  );
});

test("measured 320px header keeps the wordmark clear of the menu control", () => {
  const rules = rulesFor(["src/styles/product-home.css"]);
  const narrow = rules.find(
    (rule) =>
      rule.media.some((query) => /max-width:\s*359px/.test(query)) &&
      rule.selector === ".home-shell > .site-header .brand",
  );
  assert.ok(narrow, "the narrow presentation header has a brand rule");
  const style = declarations(narrow.body);
  assert.ok(
    Number.parseFloat(style["font-size"] ?? "99") <= 15,
    "the narrow wordmark must step down so it cannot overlap the menu",
  );
});
