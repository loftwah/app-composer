// Generate the finite public preview sheet for Composer skins.
//
// The recipes and their compiler live in src/lib/appearance-skin.ts. This
// script only serialises the result, so a preview cannot drift from the saved
// administration layer. Run with --write after changing a recipe; --check fails
// when the committed sheet is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { appearanceSkinPreviewCss } from "../src/lib/appearance-skin-catalogue.ts";

const mode = process.argv.slice(2).join(" ");
if (mode !== "--write" && mode !== "--check")
  throw new Error("Use --write or --check.");

const target = new URL("../src/styles/appearance-skins.generated.css", import.meta.url);
const banner =
  "/* Generated from src/lib/appearance-skin-catalogue.ts by scripts/appearance-skins.mjs. */\n";
const expected = `${banner}${appearanceSkinPreviewCss()}`;
let actual = "";
try {
  actual = readFileSync(target, "utf8");
} catch {
  actual = "";
}
if (actual === expected) process.exit(0);
if (mode === "--check") {
  console.error(
    "src/styles/appearance-skins.generated.css is stale. Run node scripts/appearance-skins.mjs --write.",
  );
  process.exit(1);
}
writeFileSync(target, expected);
console.log(`Wrote ${expected.split("\n").length - 1} lines of skin preview CSS.`);
