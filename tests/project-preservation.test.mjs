import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  symlinkSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  captureProjectState,
  compareProjectState,
} from "../scripts/lib/project-preservation.mjs";
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "composer-preservation-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false);
  });
  const project = join(root, "project");
  mkdirSync(project);
  const git = (...args) =>
    execFileSync("git", ["-C", project, ...args], { stdio: "pipe" });
  git("init", "-q");
  writeFileSync(join(project, "source.txt"), "existing source\n");
  writeFileSync(join(project, ".gitignore"), "scratch/\n.env\n");
  git("add", ".");
  git(
    "-c",
    "user.name=Synthetic",
    "-c",
    "user.email=synthetic@example.invalid",
    "commit",
    "-qm",
    "baseline",
  );
  return { root, project, git };
}
test("captures explicitly selected ignored owner drafts without leaking contents or following external symlinks", (t) => {
  const { root, project } = fixture(t);
  mkdirSync(join(project, "scratch"));
  writeFileSync(
    join(project, "scratch", "owner.txt"),
    "private synthetic owner draft",
  );
  writeFileSync(join(project, ".env"), "SECRET=not-for-receipt");
  writeFileSync(join(root, "outside.txt"), "outside synthetic data");
  symlinkSync(join(root, "outside.txt"), join(project, "external-link"));
  const before = captureProjectState(project, ["scratch/owner.txt"]);
  assert.ok(before.files["scratch/owner.txt"]);
  assert.equal(before.files[".env"], undefined);
  assert.equal(before.files["external-link"].kind, "symlink");
  assert.equal(JSON.stringify(before).includes("private synthetic"), false);
  assert.equal(JSON.stringify(before).includes("not-for-receipt"), false);
  writeFileSync(join(root, "outside.txt"), "changed outside data");
  assert.equal(
    compareProjectState(
      before,
      captureProjectState(project, ["scratch/owner.txt"]),
    ).unchanged,
    true,
  );
  writeFileSync(join(project, "scratch", "owner.txt"), "changed owner draft");
  assert.deepEqual(
    compareProjectState(
      before,
      captureProjectState(project, ["scratch/owner.txt"]),
    ).changedFiles,
    ["scratch/owner.txt"],
  );
  assert.throws(
    () => captureProjectState(project, ["../outside.txt"]),
    /project-relative/,
  );
  assert.throws(
    () => captureProjectState(project, ["scratch/missing.txt"]),
    /ENOENT/,
  );
});
test("records owner deletions and detects new files while malformed or incompatible receipts cannot pass", (t) => {
  const { project } = fixture(t);
  rmSync(join(project, "source.txt"));
  const before = captureProjectState(project);
  assert.equal(before.files["source.txt"].kind, "missing");
  assert.equal(
    compareProjectState(before, captureProjectState(project)).unchanged,
    true,
  );
  writeFileSync(join(project, "source.txt"), "recreated source");
  assert.deepEqual(
    compareProjectState(before, captureProjectState(project)).changedFiles,
    ["source.txt"],
  );
  assert.throws(
    () =>
      compareProjectState(
        { schema: before.schema, source: "invented", files: {} },
        before,
      ),
    /supported/,
  );
  assert.throws(
    () => compareProjectState(before, { ...before, ownerFiles: ["different"] }),
    /supported/,
  );
});
test("standalone capture refuses overwrite and comparison returns failure after a real source edit", (t) => {
  const { root, project } = fixture(t),
    receipt = join(root, "receipt.json");
  const call = (action) =>
    execFileSync(
      process.execPath,
      ["scripts/project-preservation.mjs", action, project, receipt],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  assert.ok(JSON.parse(call("capture")).captured > 0);
  assert.throws(() => call("capture"), /Command failed/);
  assert.equal(JSON.parse(call("compare")).unchanged, true);
  writeFileSync(join(project, "source.txt"), "changed source");
  assert.throws(() => call("compare"), /Command failed/);
  assert.equal(
    JSON.parse(readFileSync(receipt, "utf8")).files["source.txt"].kind,
    "file",
  );
});
