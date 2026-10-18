// Scope formatting to the maintained Creator source slice; generated outputs
// belong to TypeScript. No traversal of owner projects or unrelated legacy JS.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
const mode = process.argv[2];
if (!["--check", "--write"].includes(mode))
  throw Error("Use --check or --write.");
const files = [
  ...[
    "app-settings",
    "stacks",
    "app-configuration",
    "stack-activation",
    "miniapp-profile-settings-fields",
    "miniapp-profile-settings",
    "miniapp-achievements",
    "miniapp-tag-fields",
    "miniapp-tags",
    "miniapp-admin",
    "stacks-admin",
  ].map((name) => "src/lib/" + name + ".mts"),
  "tests/private-enquiries.test.mjs",
  "src/enquiries/enquiry-model.ts",
  "src/enquiries/enquiry-model-validator.ts",
  "src/enquiries/enquiry-calendar.ts",
  "src/enquiries/browser/enquiry-form.ts",
  "src/lib/enquiry-protocol.ts",
  "src/lib/private-enquiries.ts",
  "src/lib/public-enquiries.ts",
  "src/lib/enquiry-form.ts",
  "src/pages/s/[slug]/enquiry/[instance]/[action].ts",
  "src/plugins/enquiries.tsx",
  "src/plugins/enquiries.css",
  "scripts/enquiry-assets.mjs",
  "tsconfig.enquiries.json",
  "scripts/creator-source.mjs",
  "scripts/creator-format.mjs",
  "scripts/app-configuration.mjs",
  "tests/creator-source.test.mjs",
  "tests/creator-boundaries.test.mjs",
  "tests/configuration-apply.test.mjs",
  "tests/miniapp-boundaries.test.mjs",
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
