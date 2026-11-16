import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
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
