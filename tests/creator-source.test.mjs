import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

test("Creator author errors and stale output fail without rewriting distributions", () => {
  const root = mkdtempSync(join(tmpdir(), "composer-creator-source-"));
  try {
    const source = fileURLToPath(new URL("../", import.meta.url));
    for (const name of [
      "scripts/creator-source.mjs",
      "src/lib/app-settings.mts",
      "src/lib/app-settings.mjs",
      "src/lib/app-settings.d.mts",
      "composition.lock.json",
    ]) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      copyFileSync(join(source, name), join(root, name));
    }
    // Reuse the reviewed compiler read-only; this fixture installs nothing.
    mkdirSync(join(root, "node_modules"));
    const require = createRequire(import.meta.url);
    symlinkSync(
      dirname(dirname(require.resolve("typescript"))),
      join(root, "node_modules/typescript"),
      "dir",
    );
    const run = (mode) =>
      spawnSync(process.execPath, ["scripts/creator-source.mjs", mode], {
        cwd: root,
        encoding: "utf8",
        timeout: 15000,
      });
    assert.equal(run("--check").status, 0);
    assert.equal(run("--lint").status, 0);
    const author = join(root, "src/lib/app-settings.mts");
    const output = join(root, "src/lib/app-settings.mjs");
    const original = readFileSync(author, "utf8");
    const distribution = readFileSync(output, "utf8");
    writeFileSync(
      author,
      original +
        '\nexport const controlledCreatorTypeError: number = "wrong type";\n',
    );
    const failed = run("--write");
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /TS2322/);
    assert.equal(
      readFileSync(output, "utf8"),
      distribution,
      "a failed compiler cannot replace deployed output",
    );
    writeFileSync(author, original);
    writeFileSync(output, distribution + "\n// controlled stale output\n");
    const stale = run("--check");
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Stale Creator distribution/);
    assert.equal(run("--write").status, 0);
    assert.equal(readFileSync(output, "utf8"), distribution);
    assert.equal(run("--check").status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
