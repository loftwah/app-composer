import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "composer-build-identity-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false);
  });
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "src/lib"), { recursive: true });
  copyFileSync(
    new URL("../scripts/identity.mjs", import.meta.url),
    join(root, "scripts/identity.mjs"),
  );
  const env = {
    PATH: process.env.PATH,
    HOME: root,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
  };
  const git = (args, dates = {}) =>
    execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd: root,
      env: { ...env, ...dates },
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  git(["init", "-q", "-b", "main"]);
  function commit(value, date) {
    writeFileSync(join(root, "source.txt"), value);
    git(["add", "source.txt"]);
    git(
      [
        "-c",
        "user.name=Fictional fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "Synthetic source",
      ],
      {
        GIT_AUTHOR_DATE: "2001-01-01T00:00:00Z",
        GIT_COMMITTER_DATE: date,
      },
    );
    return git(["rev-parse", "HEAD"]);
  }
  function generate() {
    execFileSync(process.execPath, ["scripts/identity.mjs"], {
      cwd: root,
      env,
      stdio: "pipe",
    });
    return JSON.parse(readFileSync(join(root, "src/lib/build.json"), "utf8"));
  }
  return { commit, generate, git };
}

test("identity preserves legacy fields and scopes the historical review separately from the exact commit date", (t) => {
  const f = fixture(t);
  const date = "2004-02-29T23:15:00+11:00";
  const commit = f.commit("Original source", date);
  const identity = f.generate();
  assert.equal(identity.app, "app-composer");
  assert.equal(identity.commit, commit);
  assert.equal(identity.contract, 1);
  assert.equal(identity.reviewed, "2026-10-13");
  assert.equal(identity.reviewedScope, "original-build-identity-contract");
  assert.equal(identity.sourceCommittedAt, date);
});

test("regenerating an earlier source uses that commit's date rather than the newer source or generation time", (t) => {
  const f = fixture(t);
  const first = f.commit("Original source", "2004-02-29T23:15:00+11:00");
  const original = f.generate();
  const second = f.commit("Second source", "2008-03-02T01:30:00-07:00");
  const changed = f.generate();
  assert.equal(changed.commit, second);
  assert.equal(changed.sourceCommittedAt, "2008-03-02T01:30:00-07:00");
  f.git(["checkout", "--detach", first]);
  assert.deepEqual(f.generate(), original);
});
