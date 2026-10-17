import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { gzipSync, deflateRawSync } from "node:zlib";
import {
  scanPublication,
  privateValues,
  textFindings,
} from "../scripts/lib/publication-secrets.mjs";

const canary = "synthetic-opaque-" + "credential-for-publication-test";
const shaped = "AKIA" + "SYNTHETIC0123456";
const scanner = resolve("scripts/check-publication.mjs");
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "publication-fixture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, data) => {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), data);
  };
  put("dist/index.html", "<!doctype html><title>Innocuous fixture</title>");
  return {
    root,
    put,
    scan: () =>
      scanPublication({ roots: [join(root, "dist")], values: [canary] }),
  };
}
function tar(name, data) {
  const body = Buffer.from(data),
    header = Buffer.alloc(512);
  header.write(name);
  header.write("0000644\0", 100);
  header.write("0000000\0", 108);
  header.write("0000000\0", 116);
  header.write(body.length.toString(8).padStart(11, "0") + "\0", 124);
  header.write("00000000000\0", 136);
  header.fill(32, 148, 156);
  header.write("0", 156);
  header.write("ustar\0", 257);
  header.write(
    [...header]
      .reduce((a, b) => a + b, 0)
      .toString(8)
      .padStart(6, "0") + "\0 ",
    148,
  );
  return gzipSync(
    Buffer.concat([
      header,
      body,
      Buffer.alloc((512 - (body.length % 512)) % 512),
      Buffer.alloc(1024),
    ]),
  );
}
function zip(name, text) {
  const data = Buffer.from(text),
    packed = deflateRawSync(data),
    filename = Buffer.from(name);
  const local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(filename.length, 26);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(filename.length, 28);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  local.writeUInt32LE(crc, 14);
  central.writeUInt32LE(crc, 16);
  const start = local.length + filename.length + packed.length;
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(start, 16);
  return Buffer.concat([local, filename, packed, central, filename, end]);
}
test("innocuous bundle and public URLs pass; missing output fails", (t) => {
  const f = fixture(t);
  f.put("dist/assets/app.js", 'const origin="https://example.test";');
  assert.equal(f.scan().ok, true);
  assert.equal(scanPublication({ roots: [join(f.root, "absent")] }).ok, false);
});
for (const name of [
  ".env",
  ".hidden/nested/.env.production",
  ".git/config",
  "assets/client.js",
  "nested/client.js.map",
]) {
  test(
    "normal release guard refuses synthetic leak in " +
      name +
      " without printing it",
    (t) => {
      const f = fixture(t);
      f.put("dist/" + name, canary);
      const result = spawnSync(process.execPath, [scanner], {
        cwd: f.root,
        encoding: "utf8",
        env: { ...process.env, PUBLIC_API_TOKEN: canary },
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Publication refused/);
      assert.equal((result.stdout + result.stderr).includes(canary), false);
      assert.equal(f.scan().ok, false);
    },
  );
}
test("PUBLIC prefix never exempts configured opaque credentials", () => {
  assert.deepEqual(
    privateValues({
      PUBLIC_API_TOKEN: canary,
      PUBLIC_ORIGIN: "https://example.test",
    }),
    [canary],
  );
  assert.deepEqual(
    textFindings(canary, privateValues({ PUBLIC_API_TOKEN: canary })),
    ["configured private value"],
  );
});
test("high-confidence shape fails without any matching local credentials", (t) => {
  const f = fixture(t);
  f.put("dist/assets/app.js", shaped);
  assert.equal(
    scanPublication({ roots: [join(f.root, "dist")], values: [] }).ok,
    false,
  );
});
for (const [ext, make] of [
  ["tgz", tar],
  ["zip", zip],
]) {
  for (const member of ["package/.env", "package/nested/client.js.map"]) {
    test("inspects compressed " + ext + " member bytes: " + member, (t) => {
      const f = fixture(t);
      f.put("dist/download." + ext, make(member, canary));
      const result = f.scan();
      assert.equal(result.ok, false);
      assert.equal(result.members, 1);
      assert.ok(
        result.findings.some(
          (item) =>
            item.path.endsWith("!" + member) &&
            item.label === "configured private value",
        ),
      );
      assert.equal(JSON.stringify(result).includes(canary), false);
    });
  }
  test("innocuous " + ext + " archive passes; corrupt archive fails", (t) => {
    const f = fixture(t);
    f.put(
      "dist/download." + ext,
      make("package/client.js", "export const value = 42;"),
    );
    assert.equal(f.scan().ok, true);
    f.put("dist/download." + ext, "malformed");
    assert.equal(f.scan().ok, false);
  });
  test("traversing " + ext + " archive member fails", (t) => {
    const f = fixture(t);
    f.put("dist/download." + ext, make("../escape.js", "innocuous"));
    assert.equal(f.scan().ok, false);
  });
}
test("linked publication paths fail closed", (t) => {
  const f = fixture(t);
  symlinkSync(join(f.root, "dist/index.html"), join(f.root, "dist/link"));
  assert.equal(f.scan().ok, false);
});
test("normal build cannot bypass final output guard", () => {
  const pkg = JSON.parse(readFileSync(resolve("package.json")));
  assert.match(pkg.scripts.build, /&& node scripts\/check-publication\.mjs$/);
});
test("normal guard rejects a tracked credential source file and passes clean tracked source", (t) => {
  const f = fixture(t);
  assert.equal(
    spawnSync("git", ["init", "--quiet"], { cwd: f.root }).status,
    0,
  );
  f.put("source.mjs", "export const value = 42;");
  assert.equal(
    spawnSync("git", ["add", "source.mjs"], { cwd: f.root }).status,
    0,
  );
  const run = () =>
    spawnSync(process.execPath, [scanner], { cwd: f.root, encoding: "utf8" });
  assert.equal(run().status, 0);
  f.put(".env.production", "API_TOKEN=" + canary);
  assert.equal(
    spawnSync("git", ["add", "--force", ".env.production"], { cwd: f.root })
      .status,
    0,
  );
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /tracked environment file/);
  assert.equal((result.stdout + result.stderr).includes(canary), false);
});
