// Deterministic authoring exports. No app checkout, public asset or owner setting is written.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const source = JSON.parse(await readFile(resolve(root, ".artwork/identity-exports-20261018.json"), "utf8"));
const output = resolve(root, "output/visual-20261018/identity-family");
const known = new Set(["composer", "herethere", "linkcheck", "hello", "carryforward"]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const plans = [];
for (const entry of source.exports) {
  if (!known.delete(entry.id) || entry.master !== `.artwork/masters/icons/${entry.id}-20261018-master.png`)
    throw Error("Review the explicit master inventory before exporting.");
  const master = resolve(root, entry.master);
  if (digest(await readFile(master)) !== entry.sha256) throw Error("The reviewed master changed: " + entry.id);
  plans.push({ id: entry.id, master });
}
if (known.size) throw Error("The selected family inventory is incomplete.");
await mkdir(output, { recursive: true });
const files = [];
for (const { id, master } of plans) {
  for (const width of [16, 32, 48, 96, 180, 192, 512]) {
    const path = join(output, `${id}-icon-20261018-${width}.png`);
    execFileSync("magick", [master, "-resize", `${width}x${width}`, "-strip", path]);
    files.push({ file: path, sha256: digest(await readFile(path)) });
  }
  const path = join(output, `${id}-small-20261018.webp`);
  execFileSync("magick", [join(output, `${id}-icon-20261018-96.png`), "-strip", "-quality", "90", path]);
  files.push({ file: path, sha256: digest(await readFile(path)) });
}
await writeFile(join(output, "export.json"), JSON.stringify({
  source: ".artwork/identity-exports-20261018.json",
  tool: execFileSync("magick", ["-version"], { encoding: "utf8" }).split("\n")[0],
  files,
}, null, 2) + "\n");
console.log("Exported finite reviewed optical identities under " + output);
