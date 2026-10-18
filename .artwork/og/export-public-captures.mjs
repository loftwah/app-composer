// Authoring only: export the finite reviewed public screenshots to ignored output.
// This does not fetch live pages, install tools or write another app checkout.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const source = JSON.parse(await readFile(resolve(root, "docs/images/capture-20261018.json"), "utf8"));
const output = resolve(root, "output/public-captures-20261018");
const identities = new Map([
  ["guestbook", "herethere"],
  ["showcase", "linkarooie"],
  ["linkcheck", "linkcheck"],
  ["hello", "hello"],
  ["state", "carryforward"],
]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const plans = [];
for (const [id, prefix] of identities) {
  const records = source.records.filter(record => record.id === id && record.width === 1440);
  if (records.length !== 1 || records[0].height !== 960 || records[0].requestOverrides !== false)
    throw Error("Review the screenshot inventory before exporting " + id);
  const path = resolve(root, `docs/images/${prefix}-20261018-desktop.png`);
  if (digest(await readFile(path)) !== records[0].sha256)
    throw Error("The captured source pixels changed: " + id);
  plans.push({ path, prefix });
}
await mkdir(output, { recursive: true });
const files = [];
for (const { path, prefix } of plans) {
  for (const width of [960, 1440]) {
    const file = join(output, `${prefix}-20261018-${width}.webp`);
    execFileSync("magick", [path, "-resize", `${width}x`, "-strip", "-quality", "86", file]);
    files.push({ file, sha256: digest(await readFile(file)) });
  }
}
await writeFile(join(output, "export.json"), JSON.stringify({
  source: "docs/images/capture-20261018.json",
  tool: execFileSync("magick", ["-version"], { encoding: "utf8" }).split("\n")[0],
  files,
}, null, 2) + "\n");
console.log("Exported ten reviewed screenshots under " + output);
