import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RELATIONSHIP_TIERS, loadInventory } from "../scripts/portfolio-inventory.mjs";
import { inventoryPath, projectFamily, relationshipTiers } from "../src/lib/project-family.mjs";
import { publicPagePaths } from "../src/lib/public-pages.mjs";

const page = readFileSync(new URL("../src/pages/projects.astro", import.meta.url), "utf8");
const blueprintsPage = readFileSync(new URL("../src/pages/blueprints.astro", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/layouts/Base.astro", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const inventory = loadInventory();
const family = projectFamily(inventory);
const rows = family.groups.flatMap((group) => group.projects);
const byTier = Object.fromEntries(family.groups.map((group) => [group.id, group.projects]));

test("the family page and the validator share one tier vocabulary", () => {
  assert.deepEqual(
    relationshipTiers.map((tier) => tier.id),
    [...RELATIONSHIP_TIERS],
    "the rendered tiers and the checked tiers must not drift",
  );
  assert.equal(new Set(relationshipTiers.map((tier) => tier.id)).size, 5);
  for (const tier of relationshipTiers) {
    assert.ok(tier.label.length > 3, `${tier.id} needs a plain label`);
    assert.ok(tier.meaning.length > 40, `${tier.id} needs a plain-language meaning`);
    assert.ok(tier.empty.length > 20, `${tier.id} needs an honest empty state`);
  }
});

test("all twelve project records are grouped once under their recorded tier", () => {
  assert.equal(family.total, 12);
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((row) => row.id)).size, 12);
  for (const group of family.groups) {
    for (const row of group.projects) assert.equal(row.tier, group.id, `${row.id} is in ${group.id}`);
  }
});

test("no project claims an integration the inventory cannot back", () => {
  // These three tiers need a real build receipt, a registered app identity or a
  // shipped project blueprint. None exists for these records, so the page must
  // show the empty state rather than relabel a showcased project.
  assert.deepEqual(byTier["built-with-composer"], [], "no fake built-with-Composer claim");
  assert.deepEqual(byTier["connected-managed"], [], "no fake connected-and-managed claim");
  assert.deepEqual(byTier["blueprint-rebuildable"], [], "no project blueprint exists yet");

  for (const row of byTier.showcased) assert.equal(row.lifecycle, "active", `${row.id} is current`);
  for (const row of byTier.legacy) assert.notEqual(row.lifecycle, "active", `${row.id} is paused or retired`);
  for (const row of rows) assert.ok(row.evidence.length > 40, `${row.id} records why it has this tier`);
});

test("the page renders every project from the inventory, never a typed list", () => {
  assert.match(page, /import \{ projectFamily, recordedDay \} from '\.\.\/lib\/project-family\.mjs'/);
  assert.match(page, /const family = projectFamily\(\)/);
  assert.match(page, /family\.groups\.map\(group =>/);
  assert.match(page, /group\.projects\.map\(project =>/);
  assert.match(page, /data-project=\{project\.id\} data-tier=\{project\.tier\}/);
  assert.match(page, /<h3>\{project\.name\}<\/h3>/);
  assert.match(page, /\{group\.label\}/);
  assert.match(page, /\{project\.summary\}/);
  for (const row of rows) {
    assert.ok(!page.includes(`<h3>${row.name}</h3>`), `${row.name} comes from the inventory, not the template`);
  }
});

test("unknown or absent project records say 'not recorded' instead of linking nowhere", () => {
  assert.match(page, /project\.canonicalUrl \? \(/);
  assert.match(page, /project\.sourcePin \? \(/);
  assert.match(page, /project\.blueprint \? \(/);
  assert.match(page, /groups\.filter\(group => group\.projects\.length > 0\)/);
  assert.match(page, /<span class="not-recorded">not recorded<\/span>/);
  assert.match(page, /blueprint not recorded/);
  assert.doesNotMatch(page, /href=""|href=\{undefined\}|href=\{null\}/);

  const pirates = rows.find((row) => row.id === "pirates");
  assert.equal(pirates.canonicalUrl, null);
  assert.equal(pirates.live, null);
  assert.equal(pirates.probe.status, 522);
  assert.ok(rows.some((row) => row.sourcePin === null), "some records have no published source pin");
});

test("the page reads build-time data and never fetches a project at request time", () => {
  assert.doesNotMatch(page, /\bfetch\(/);
  assert.doesNotMatch(page, /getEmDashCollection/);
  assert.doesNotMatch(page, /Astro\.response/);
  assert.doesNotMatch(page, /<script/);
  assert.ok(page.includes("<Base title=\"Project family\""));
});

test("every emitted project link resolves to a recorded, https location", () => {
  assert.equal(new Set(rows.map((row) => row.dossier)).size, rows.length, "dossiers are distinct");
  for (const row of rows) {
    const recorded = inventory.projects.find((project) => project.id === row.id);
    assert.equal(row.dossier, `https://woodhouse.loftwah.com/projects/${row.id}/`);
    if (row.canonicalUrl === null) {
      assert.equal(recorded.live, undefined, `${row.id} has no invented live origin`);
    } else {
      assert.match(row.canonicalUrl, /^https:\/\//);
      assert.equal(row.canonicalUrl, recorded.live.finalUrl, `${row.id} canonical is the observed URL`);
    }
    if (row.blueprint === null) assert.match(page, /blueprint not recorded/);
    else assert.ok(inventory.blueprints.some((blueprint) => blueprint.id === row.blueprint.id));
    assert.ok(row.sourcePin === null || /^[0-9a-f]{40}$/.test(row.sourcePin));
  }
});

test("the project family is a maintained public page and the real navigation links it", () => {
  assert.ok(publicPagePaths.includes("/projects"));
  assert.ok(publicPagePaths.includes("/blueprints"));
  assert.match(layout, /class="nav-direct" href="\/projects">Projects<\/a>/, "primary navigation carries Projects");
  assert.match(layout, /<a href="\/projects">Project family<\/a>/, "the Explore menu carries it on small screens");
  assert.match(layout, /<details class="site-menu">/, "the small-screen menu needs no JavaScript");
  assert.match(blueprintsPage, /href="\/projects"/, "the blueprint catalogue links to the family");
});

test("the Foilbury build record names each verification link", () => {
  const receipt = page.match(/<details class="flagship-receipt">[\s\S]*?<\/details>/)?.[0];
  assert.ok(receipt, "the flagship build record is rendered");
  const links = [...receipt.matchAll(/href="https:\/\/github\.com\/loftwah\/composer-media-studio\/issues\/183#issuecomment-([\d]+)">([^<]+)<\/a>/g)];
  assert.deepEqual(links.map(([, comment, label]) => [comment, label]), [
    ["6937217543", "Web-ready images release record"],
    ["6937400509", "Image export receipt record"],
    ["6938735525", "Social kit release record"],
  ]);
});

test("the build refuses a missing or unusable inventory before rendering", () => {
  assert.match(packageJson.scripts.build, /scripts\/portfolio-inventory\.mjs --check/);
  assert.match(packageJson.scripts["check:types"], /scripts\/portfolio-inventory\.mjs --check/);
  assert.throws(() => projectFamily({}), new RegExp(`${inventoryPath}: projects must be a list`));
  assert.throws(
    () => projectFamily({ ...inventory, projects: [{ ...inventory.projects[0], relationship: undefined }] }),
    /needs a relationship record/,
  );
  assert.throws(
    () =>
      projectFamily({
        ...inventory,
        projects: [{ ...inventory.projects[0], relationship: { ...inventory.projects[0].relationship, tier: "vibes" } }],
      }),
    /no supported relationship tier/,
  );
  assert.throws(
    () =>
      projectFamily({
        ...inventory,
        projects: [
          {
            ...inventory.projects[0],
            relationship: { ...inventory.projects[0].relationship, canonicalUrl: "http://example.com/" },
          },
        ],
      }),
    /unsafe canonical URL/,
  );
});
