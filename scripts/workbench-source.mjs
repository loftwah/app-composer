// MIT. Explicit reviewed copies of app-owned pure view adapters. No fetched code
// is evaluated, and this never changes a source pin or deploys an application.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const manifestPath = "src/vendor/workbench/sources.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const lock = JSON.parse(readFileSync("composition.lock.json", "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = process.argv[2] === "--write";
if (!write && process.argv[2] !== "--check")
  throw Error("Use --check or --write GUESTBOOK_CHECKOUT SHOWCASE_CHECKOUT");
for (const [index, entry] of manifest.apps.entries()) {
  const pin = lock.apps.find((app) => app.id === entry.id);
  if (!pin || pin.repository !== entry.repository)
    throw Error("Unknown view source");
  if (write) {
    const checkout = resolve(process.argv[index + 3] ?? "");
    if (!process.argv[index + 3])
      throw Error("Choose both reviewed source checkouts explicitly");
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: checkout,
      encoding: "utf8",
    }).trim();
    if (head !== pin.commit)
      throw Error(
        entry.id + " checkout must match the selected composition pin",
      );
    if (
      execFileSync("git", ["status", "--porcelain"], {
        cwd: checkout,
        encoding: "utf8",
      }).trim()
    )
      throw Error("Preserve and review source changes before copying views");
    const bytes = readFileSync(resolve(checkout, entry.source));
    entry.commit = head;
    entry.sha256 = hash(bytes);
    writeFileSync(entry.copy, bytes);
  }
  if (
    pin.commit !== entry.commit ||
    hash(readFileSync(entry.copy)) !== entry.sha256
  )
    throw Error(
      entry.id +
        " view adapter differs from its exact pinned source; review and recopy",
    );
}
if (write)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  "Two app-owned view adapters match their exact reviewed source pins and digests.",
);
