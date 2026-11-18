import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RELATIONSHIP_TIERS,
  checkInventory,
  loadInventory,
  revisionsIn,
} from "../scripts/portfolio-inventory.mjs";

const recipe = readFileSync(new URL("../docs/portfolio/blueprints.md", import.meta.url), "utf8");
const base = () => structuredClone(loadInventory());

function problems(mutate) {
  const doc = base();
  mutate?.(doc);
  return checkInventory(doc, { recipe });
}

test("the committed inventory validates against the lock and the recipe", () => {
  assert.deepEqual(problems(), []);
});

test("a shortened deployed revision is refused", () => {
  const found = problems((doc) => {
    doc.projects.find((entry) => entry.id === "fighter").deployedSource.value = "81f5350e";
  });
  assert.match(found.join("\n"), /full revision/);
});

test("an unknown deployed source must state why it is unknown", () => {
  const found = problems((doc) => {
    doc.projects.find((entry) => entry.id === "bubbles").deployedSource.reason = "";
  });
  assert.match(found.join("\n"), /unknown deployed source needs a reason/);
});

test("a private repository cannot publish a URL or a HEAD", () => {
  const found = problems((doc) => {
    doc.projects.find((entry) => entry.id === "bubbles").repository.head = "a".repeat(40);
  });
  assert.match(found.join("\n"), /must not publish a URL or HEAD/);
});

test("a blueprint cannot claim to be ready without a replay", () => {
  const found = problems((doc) => {
    doc.blueprints[0].state = "ready";
  });
  assert.match(found.join("\n"), /ready requires a replay/);
});

test("a blueprint pin must match the declaration it names", () => {
  const found = problems((doc) => {
    doc.blueprints.find((entry) => entry.id === "creator-hub").pins[0].commit = "0".repeat(40);
  });
  assert.match(found.join("\n"), /does not match composition\.lock\.json/);
});

test("the recipe cannot introduce a source revision that was never observed", () => {
  const found = problems(undefined);
  assert.deepEqual(found, []);
  const withFake = checkInventory(base(), {
    recipe: `${recipe}\nA fabricated pin: \`${"f".repeat(40)}\`\n`,
  });
  assert.match(withFake.join("\n"), /neither a declared pin nor an observed identity/);
});

test("the recipe names every declared pin and labels both builds as not replayed", () => {
  const doc = base();
  const named = new Set(revisionsIn(recipe));
  for (const blueprint of doc.blueprints) {
    for (const pin of blueprint.pins) assert.ok(named.has(pin.commit), `${pin.commit} is named`);
    const heading = blueprint.recipe.split("#")[1];
    const body = recipe.split(/^## /m).find((part) =>
      part.split("\n")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-") === heading,
    );
    assert.ok(body, `${heading} section exists`);
    assert.match(body, /Replay status:.*not replayed/is);
  }
});

test("a project cannot disappear from the snapshot coverage", () => {
  const found = problems((doc) => {
    doc.projects.pop();
  });
  assert.match(found.join("\n"), /cover exactly snapshot\.projectIds/);
});

test("every project carries an evidenced relationship tier and a real canonical URL", () => {
  for (const project of base().projects) {
    assert.ok(RELATIONSHIP_TIERS.includes(project.relationship.tier), `${project.id} has a supported tier`);
    assert.ok(project.relationship.evidence.length > 40, `${project.id} explains the tier`);
    if (project.live) {
      assert.equal(project.relationship.canonicalUrl, project.live.finalUrl, `${project.id} canonical matches the live record`);
    } else {
      assert.equal(project.relationship.canonicalUrl, null, `${project.id} keeps an unknown live identity unknown`);
    }
  }
});

test("a missing relationship or an unknown tier is refused", () => {
  const missing = problems((doc) => {
    delete doc.projects.find((entry) => entry.id === "bubbles").relationship;
  });
  assert.match(missing.join("\n"), /relationship is required/);

  const unknown = problems((doc) => {
    doc.projects.find((entry) => entry.id === "bubbles").relationship.tier = "built-by-vibes";
  });
  assert.match(unknown.join("\n"), /relationship tier must be one of/);
});

test("a relationship needs a real evidence note and no invented fields", () => {
  const empty = problems((doc) => {
    doc.projects.find((entry) => entry.id === "bubbles").relationship.evidence = " ";
  });
  assert.match(empty.join("\n"), /relationship evidence is required/);

  const invented = problems((doc) => {
    doc.projects.find((entry) => entry.id === "bubbles").relationship.deploymentOrigin = "https://example.com/";
  });
  assert.match(invented.join("\n"), /relationship has an unsupported field: deploymentOrigin/);
});

test("a canonical URL cannot invent a deployment origin", () => {
  const mismatched = problems((doc) => {
    doc.projects.find((entry) => entry.id === "bubbles").relationship.canonicalUrl = "https://bubbles.example.com/";
  });
  assert.match(mismatched.join("\n"), /canonical URL must match the recorded live finalUrl/);

  const insecure = problems((doc) => {
    doc.projects.find((entry) => entry.id === "bubbles").relationship.canonicalUrl = "http://bubbles.loftwah.com/";
  });
  assert.match(insecure.join("\n"), /canonicalUrl must be an https URL or null/);
});

test("an unknown live identity stays null and a canonical URL needs a live record", () => {
  const contradicted = problems((doc) => {
    doc.projects.find((entry) => entry.id === "bubbles").relationship.canonicalUrl = null;
  });
  assert.match(contradicted.join("\n"), /unknown canonical URL contradicts the recorded live entry point/);

  const invented = problems((doc) => {
    doc.projects.find((entry) => entry.id === "pirates").relationship.canonicalUrl = "https://pirates.loftwah.com/";
  });
  assert.match(invented.join("\n"), /canonical URL requires a recorded live entry point/);
});

test("two projects cannot claim the same canonical URL", () => {
  const found = problems((doc) => {
    const bubbles = doc.projects.find((entry) => entry.id === "bubbles");
    const fighter = doc.projects.find((entry) => entry.id === "fighter");
    fighter.live.finalUrl = bubbles.live.finalUrl;
    fighter.relationship.canonicalUrl = bubbles.live.finalUrl;
  });
  assert.match(found.join("\n"), /duplicate canonical URL, already recorded for bubbles/);
});

test("invalid inventory evidence returns actionable findings", () => {
  const found = problems((doc) => {
    doc.asOf = "2026-02-31";
    doc.projects.find((entry) => entry.live).live.finalUrl = "invalid";
    delete doc.projects.find((entry) => entry.probe).probe.status;
    doc.projects.push(null);
    doc.connected[1] = doc.connected[0];
    doc.surfaces[0].id = "unknown";
    doc.method.snapshot.projectIds = {};
    doc.blueprints[0].pins = {};
    doc.blueprints[1].pins.push(null);
  }).join("\n");
  for (const reason of [
    "asOf must be a real YYYY-MM-DD date", "finalUrl must be https",
    "a probe is only for a failed entry point", "id must be lowercase",
    "connected must list", "surfaces must hold Woodhouse",
    "snapshot.projectIds must be ids", "pins are required", "each pin must be a record",
  ]) assert.ok(found.includes(reason), reason);
  assert.match(problems((doc) => { doc.connected = {}; }).join("\n"), /connected must be a list/);
});
