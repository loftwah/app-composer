import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {apps} from "../src/lib/apps.ts";

const source = readFileSync(new URL("../src/browser/launcher.ts", import.meta.url), "utf8");
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

function block(name) {
  const match = source.match(new RegExp(`/\\* ${name}:start \\*/([\\s\\S]*?)/\\* ${name}:end \\*/`));
  assert.ok(match, `missing ${name} block in src/browser/launcher.ts`);
  return match[1];
}

// The controller must stay a single classic-deferred script, so its pure data
// and ranking functions are marked blocks rather than an import graph. Node's
// type stripping runs the exact authored code, not a copied expectation.
async function loadBlocks() {
  const dir = mkdtempSync(join(tmpdir(), "composer-launcher-"));
  try {
    const path = join(dir, "launcher-blocks.mts");
    writeFileSync(path, `${block("launcher-registry")}\n${block("launcher-logic")}\nexport {destinations, searchWords, scoreDestination, visibleDestinations};\n`);
    return await import(pathToFileURL(path).href);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

const blocks = await loadBlocks();
const destinations = blocks.destinations;
const {searchWords, scoreDestination, visibleDestinations} = blocks;

const groupOrder = ["make", "explore", "tool", "apps", "more"];
const ranked = (query, audience = "public") => visibleDestinations(destinations, audience)
  .map((destination, order) => ({destination, order, score: scoreDestination(destination, searchWords(query))}))
  .filter(entry => entry.score >= 0)
  .sort((a, b) => b.score - a.score || groupOrder.indexOf(a.destination.group) - groupOrder.indexOf(b.destination.group) || a.order - b.order)
  .map(entry => entry.destination.name);

const same = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.startsWith("/") && b.startsWith("/")) return a.replace(/\/$/, "") === b.replace(/\/$/, "");
  try {
    return new URL(a).href.replace(/\/$/, "") === new URL(b).href.replace(/\/$/, "");
  } catch {
    return false;
  }
};

test("the launcher registry is a complete, unique inventory with real routes", () => {
  assert.ok(destinations.length >= 30, "the menu must keep the full inventory");
  assert.equal(new Set(destinations.map(item => item.name)).size, destinations.length, "names must be unique");
  const hrefs = destinations.map(item => item.path ?? item.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "one destination per working href");
  const hosts = new Set();
  for (const item of destinations) {
    assert.ok(["public", "invitation"].includes(item.audience), item.name + " needs an audience");
    assert.ok(groupOrder.includes(item.group), item.name + " needs a task group");
    assert.ok(item.description.trim().length > 10, item.name + " needs a plain-language outcome");
    assert.ok(item.keywords.trim().length > 0, item.name + " needs search keywords");
    if (item.href) {
      const url = new URL(item.href);
      assert.equal(url.protocol, "https:", item.name + " must use HTTPS");
      assert.equal(url.username, "", item.name + " must not embed credentials");
      assert.equal(url.password, "", item.name + " must not embed credentials");
      hosts.add(url.hostname);
    }
    if (item.path) {
      assert.match(item.path, /^\//, item.name + " is a Composer-relative route");
      assert.ok(!item.path.includes("\\") && !item.path.startsWith("//"), item.name + " has an ambiguous path");
    }
    assert.ok(item.path || item.href, item.name + " needs a destination");
  }
  assert.deepEqual([...hosts].sort(), [
    "ai.loftwah.com",
    "composer-launch-kit.loftwah.workers.dev",
    "composer-paperwork.loftwah.workers.dev",
    "ldraw.loftwah.com",
    "media.loftwah.com",
    "ready.loftwah.com",
    "share.loftwah.com",
  ].sort());
});

test("every relative destination resolves to an authored Composer page", () => {
  const pages = new URL("../src/pages/", import.meta.url);
  const exists = route => {
    const clean = route.split("#")[0].replace(/\/$/, "") || "/";
    if (clean.startsWith("/_emdash/")) return true; // Native plugin pages, gated by EmDash.
    if (["/guestbook", "/showcase"].includes(clean)) return true; // Separately pinned Worker mounts.
    if (clean === "/") return existsSync(new URL("index.astro", pages));
    const base = new URL(clean.slice(1), pages);
    return ["astro", "ts", "tsx"].some(extension => existsSync(new URL(`${base.href}.${extension}`)))
      || ["astro", "ts", "tsx"].some(extension => existsSync(new URL(`${base.href}/index.${extension}`)));
  };
  for (const item of destinations.filter(entry => entry.path)) {
    assert.ok(exists(item.path), `${item.name} points at a stale route: ${item.path}`);
  }
});

test("app destinations reconcile with the public app catalogue, one entry each", () => {
  const catalogue = new Map(apps.map(app => [app.id, app]));
  const represented = new Set();
  for (const item of destinations.filter(entry => entry.catalogue)) {
    const app = catalogue.get(item.catalogue);
    assert.ok(app, `${item.name} names an unknown catalogue app: ${item.catalogue}`);
    assert.ok(!represented.has(item.catalogue), `${item.catalogue} must appear once in the launcher`);
    represented.add(item.catalogue);
    if (item.href) assert.ok(same(item.href, app.standalone), `${item.name} must open its working standalone app`);
    else {
      assert.ok(same(item.path, app.href), `${item.name} must use the catalogue entry`);
      if (item.catalogue === "media-studio")
        assert.equal(item.memberPath, "/media-studio/studio", "the signed-in studio entry is the documented workspace route");
    }
  }
  assert.deepEqual([...represented].sort(), apps.map(app => app.id).sort());
});

test("anonymous visitors get three small task groups and no private destinations", () => {
  const publicItems = visibleDestinations(destinations, "public");
  const privateNames = ["My profile / My apps", "People & access", "Your creator stacks", "Manage mini-apps"];
  for (const name of privateNames) assert.ok(!publicItems.some(item => item.name === name), `${name} must not be visible anonymously`);
  for (const item of publicItems) assert.equal(item.audience, "public");
  for (const group of ["make", "explore", "tool"]) {
    const featured = publicItems.filter(item => item.group === group);
    assert.ok(featured.length >= 2 && featured.length <= 4, `${group} needs a small first view`);
    for (const item of featured) assert.ok(item.aliases?.length, `${item.name} needs plain-language aliases`);
  }
  assert.ok(publicItems.filter(item => ["make", "explore", "tool"].includes(item.group)).length <= 9);
  assert.ok(visibleDestinations(destinations, "member").length > publicItems.length);
  assert.ok(visibleDestinations(destinations, "member").some(item => item.name === "My profile / My apps"));
  for (const item of destinations.filter(entry => entry.audience === "invitation")) {
    assert.match(item.path, /^\/(?:me|people|_emdash\/)/, `${item.name} must be an invited account route`);
  }
  const ownerOnly = destinations.filter(entry => entry.ownerOnly).map(entry => entry.name).sort();
  assert.deepEqual(ownerOnly, ["Manage mini-apps", "People & access", "Your creator stacks"]);
  for (const item of destinations.filter(entry => entry.ownerOnly)) assert.equal(item.audience, "invitation");
});

test("plain-language aliases rank the intended job first", () => {
  assert.equal(ranked("create site")[0], "Create a site");
  assert.equal(ranked("new project")[0], "Create a site");
  assert.equal(ranked("edit media")[0], "Media Studio");
  assert.equal(ranked("check a link")[0], "Check a page before sharing");
  assert.equal(ranked("operate an app")[0], "Your app, your admin");
  assert.ok(ranked("publish").includes("Linkarooie"));
  assert.ok(ranked("postcard")[0] === "Here / there");
  for (const query of ["images", "image workbench", "image editor", "edit images", "resize image"]) {
    assert.equal(ranked(query)[0], "Edit images", `${query} must open Image Tools`);
  }
  for (const query of ["favicon", "make a favicon", "site icon", "app icon", "make an icon"]) {
    assert.equal(ranked(query)[0], "Prepare launch artwork", `${query} must open Launch Kit icons`);
  }
  assert.equal(ranked("launch kit")[0], "Prepare launch artwork");
  assert.equal(ranked("nothing-matches-xyz").length, 0);
});

test("renamed tasks remain findable by their previous names", () => {
  assert.equal(ranked("init")[0], "Create a site");
  assert.equal(ranked("content and form builder")[0], "Shape your content");
  assert.equal(ranked("follow-along tutorial")[0], "Follow the tutorial");
  assert.equal(ranked("explore app composer")[0], "Browse by task");
  assert.equal(ranked("review share report")[0], "Review a saved check");
});

test("the first view ranks names above descriptive mentions", () => {
  assert.equal(ranked("linkarooie")[0], "Linkarooie");
  assert.equal(ranked("moderation")[0], "Here / there");
  const words = searchWords("  Create   SITE ");
  assert.deepEqual(words, ["create", "site"]);
});

test("launcher shell owns one registry and only the server-derived viewer state", () => {
  const component = read("src/components/AppLauncher.astro");
  assert.doesNotMatch(component, /data-destination/, "the Astro shell must not author a second destination list");
  assert.match(component, /Astro\.locals\.user/);
  assert.match(component, /data-viewer=\{member \? 'member' : 'public'\}/);
  assert.match(component, /data-launcher-recents=\{member \? '\/api\/launcher\/recents' : undefined\}/);
  assert.doesNotMatch(component, /user\.id|user\.email|\$\{member\}/, "no owner identity in the launcher markup");
  assert.match(read("public/brand/launcher.js"), /launcher-registry:start/, "the generated controller carries the registry");
});
