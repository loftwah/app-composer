import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync,
  symlinkSync, readlinkSync, lstatSync, existsSync,
} from "node:fs";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyReservedDirectory } from "../lib/get-ready/workspace-tools.mjs";

test("reserved directory adoption works across Node runtimes and preserves relative package links", (t) => {
  const root = mkdtempSync(join(tmpdir(), "composer-reserved-copy-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false);
  });
  const source = join(root, "source"), target = join(root, "reserved");
  mkdirSync(source); mkdirSync(target);
  mkdirSync(join(source, ".pnpm"));
  writeFileSync(join(source, ".pnpm", "compiler"), "reviewed compiler bytes");
  symlinkSync(".pnpm/compiler", join(source, "typescript"));
  const identity = lstatSync(target);
  copyReservedDirectory(source, target, { verbatimSymlinks: true });
  assert.equal(lstatSync(target).ino, identity.ino);
  assert.equal(readlinkSync(join(target, "typescript")), ".pnpm/compiler");
  assert.equal(readFileSync(join(target, "typescript"), "utf8"), "reviewed compiler bytes");
  writeFileSync(join(target, ".pnpm", "compiler"), "retained owner bytes");
  assert.throws(() => copyReservedDirectory(source, target, { verbatimSymlinks: true }), { code: "ERR_FS_CP_EEXIST" });
  assert.equal(readFileSync(join(target, ".pnpm", "compiler"), "utf8"), "retained owner bytes");
});

test("reserved copy refuses a linked destination and detects replacement between children", (t) => {
  const root = mkdtempSync(join(tmpdir(), "composer-reserved-copy-boundary-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source"), outside = join(root, "outside"), target = join(root, "reserved");
  mkdirSync(source); mkdirSync(outside);
  writeFileSync(join(source, "a"), "reviewed first file");
  writeFileSync(join(source, "b"), "reviewed second file");
  writeFileSync(join(outside, "owner"), "retained outside bytes");
  symlinkSync(outside, target);
  assert.throws(() => copyReservedDirectory(source, target), { code: "source" });
  assert.equal(existsSync(join(outside, "a")), false);
  fs.unlinkSync(target); mkdirSync(target);
  const identity = lstatSync(target), original = fs.cpSync;
  let replaced = false;
  try {
    fs.cpSync = (...args) => {
      original(...args);
      if (!replaced) {
        replaced = true;
        fs.renameSync(target, join(root, "retained-reservation"));
        symlinkSync(outside, target);
      }
    };
    syncBuiltinESMExports();
    assert.throws(() => copyReservedDirectory(source, target, { identity }), { code: "source" });
    assert.equal(replaced, true);
    assert.equal(existsSync(join(outside, "a")), false);
    assert.equal(existsSync(join(outside, "b")), false);
    assert.equal(readFileSync(join(outside, "owner"), "utf8"), "retained outside bytes");
  } finally {
    fs.cpSync = original;
    syncBuiltinESMExports();
  }
});
