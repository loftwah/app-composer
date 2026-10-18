// Scope formatting to the maintained Creator source slice; generated outputs
// belong to TypeScript. No traversal of owner projects or unrelated legacy JS.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
const mode = process.argv[2];
if (!["--check", "--write"].includes(mode))
  throw Error("Use --check or --write.");
const files = [
  ...["app-settings", "stacks", "app-configuration", "stack-activation"].map(
    (name) => "src/lib/" + name + ".mts",
  ),
  "scripts/creator-source.mjs",
  "scripts/creator-format.mjs",
  "scripts/app-configuration.mjs",
  "tests/creator-source.test.mjs",
  "tests/creator-boundaries.test.mjs",
];
const stale = [];
for (const name of files) {
  const path = fileURLToPath(new URL("../" + name, import.meta.url));
  const source = readFileSync(path, "utf8");
  const expected = await format(source, { filepath: path });
  if (source === expected) continue;
  if (mode === "--write") writeFileSync(path, expected);
  else stale.push(name);
}
if (stale.length)
  throw Error(
    "Creator formatting differs: " + stale.join(", ") + ". Run pnpm format.",
  );
console.log(
  files.length +
    " maintained Creator files " +
    (mode === "--write" ? "formatted." : "match formatting."),
);
