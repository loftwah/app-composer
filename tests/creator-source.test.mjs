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
      ...["stacks", "app-configuration", "stack-activation"].flatMap((name) =>
        [".mts", ".mjs", ".d.mts"].map((suffix) => "src/lib/" + name + suffix),
      ),
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
    mkdirSync(join(root, "node_modules/@cloudflare"));
    symlinkSync(
      dirname(require.resolve("@cloudflare/workers-types/package.json")),
      join(root, "node_modules/@cloudflare/workers-types"),
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
    for (const name of [
      "app-settings",
      "stacks",
      "app-configuration",
      "stack-activation",
    ]) {
      const author = join(root, "src/lib/" + name + ".mts");
      const original = readFileSync(author, "utf8");
      const outputs = [
        "app-settings",
        "stacks",
        "app-configuration",
        "stack-activation",
      ].flatMap((name) =>
        [".mjs", ".d.mts"].map((suffix) =>
          join(root, "src/lib/" + name + suffix),
        ),
      );
      const before = outputs.map((path) => readFileSync(path, "utf8"));
      try {
        writeFileSync(
          author,
          original +
            '\nexport const controlledCreatorTypeError: number = "wrong type";\n',
        );
        const failed = run("--write");
        assert.notEqual(failed.status, 0);
        assert.match(failed.stderr, /TS2322/);
        assert.deepEqual(
          outputs.map((path) => readFileSync(path, "utf8")),
          before,
          "no output changes after any author error",
        );
        writeFileSync(
          author,
          original + "\nexport const controlledNodeLeak = process.pid;\n",
        );
        const leak = run("--check");
        assert.notEqual(leak.status, 0);
        assert.match(
          leak.stderr,
          /Cannot find name 'process'/,
          "Creator code cannot acquire Node-only globals",
        );
      } finally {
        writeFileSync(author, original);
      }
    }
    const lintAuthor = join(root, "src/lib/stack-activation.mts");
    const cleanAuthor = readFileSync(lintAuthor, "utf8");
    try {
      writeFileSync(
        lintAuthor,
        cleanAuthor + "\nconst controlledUnusedCreatorValue = 1;\n",
      );
      const unused = run("--lint");
      assert.notEqual(unused.status, 0);
      assert.match(unused.stderr, /TS6133/);
    } finally {
      writeFileSync(lintAuthor, cleanAuthor);
    }
    for (const suffix of [".mjs", ".d.mts"]) {
      const output = join(root, "src/lib/stack-activation" + suffix);
      const distribution = readFileSync(output, "utf8");
      writeFileSync(output, distribution + "\n// controlled stale output\n");
      const stale = run("--check");
      assert.notEqual(stale.status, 0);
      assert.match(stale.stderr, /Stale Creator distribution/);
      assert.equal(run("--write").status, 0);
      assert.equal(readFileSync(output, "utf8"), distribution);
      assert.equal(run("--check").status, 0);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
