import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

// D1 applies migration files in filename order and records each applied name.
// A new numeric prefix collision would make the intent of the applied sequence
// ambiguous and can cause two independent branches to claim the same slot.
//
// Two pairs predate this policy and are already recorded in production. Their
// filenames are distinct and their lexical order is stable, so renaming them now
// would break the registry. They are listed explicitly rather than silently
// tolerated; every later number must be unique.
const legacyDuplicatePrefixes = new Map([
  ["0003", ["0003_postcard_receipts.sql", "0003_stacks.sql"]],
  ["0010", ["0010_member_app_grants.sql", "0010_public_reports.sql"]],
]);

test("migration numbers never add a new collision and the inbox journey uses a fresh prefix", () => {
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.ok(files.length >= 17);
  for (const name of files)
    assert.match(
      name,
      /^\d{4}_[a-z0-9_]+\.sql$/,
      name + " is not a numbered migration",
    );

  const prefixes = files.map((name) => name.slice(0, 4));
  for (let index = 1; index < prefixes.length; index++)
    assert.ok(
      prefixes[index] >= prefixes[index - 1],
      "migration filenames must sort in non-decreasing numeric order",
    );

  const groups = new Map();
  for (const name of files) {
    const prefix = name.slice(0, 4);
    groups.set(prefix, [...(groups.get(prefix) ?? []), name]);
  }
  for (const [prefix, names] of groups) {
    if (names.length === 1) continue;
    assert.deepEqual(
      names,
      legacyDuplicatePrefixes.get(prefix),
      prefix + " added a new migration prefix collision: " + names.join(", "),
    );
  }
  assert.equal(groups.size, files.length - legacyDuplicatePrefixes.size);

  const highest = prefixes.at(-1);
  assert.equal(
    files.filter((name) => name.startsWith(highest + "_")).length,
    1,
    "the highest migration prefix must be unique",
  );
  assert.equal(highest, "0018");
  assert.ok(files.includes("0017_inbox_journey.sql"));
  assert.ok(files.includes("0018_agent_grant_connections.sql"));
  assert.ok(!files.includes("0014_inbox_journey.sql"));
});
