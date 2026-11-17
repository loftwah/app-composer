import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { resolveLocalTargets } from "../labs/building/local-targets.mjs";

test("the building lab keeps its defaults and accepts an exact loopback pair", () => {
  assert.deepEqual(resolveLocalTargets({}), {
    guestbook: "https://localhost:8788",
    linkarooie: "https://localhost:8787",
    guestbookPort: 8788,
    linkarooiePort: 8787,
  });
  const selected = resolveLocalTargets({
    GUESTBOOK_URL: "https://localhost:18788",
    LINKAROOIE_URL: "https://localhost:18787",
  });
  assert.equal(selected.guestbookPort, 18788);
  assert.equal(selected.linkarooiePort, 18787);
  for (const invalid of [
    "https://example.com:18788",
    "http://localhost:18788",
    "https://localhost:18788/path",
    "https://localhost:65536",
    "https://localhost:01878",
  ]) {
    assert.throws(() => resolveLocalTargets({ GUESTBOOK_URL: invalid }));
  }
  assert.throws(() => resolveLocalTargets({
    GUESTBOOK_URL: "https://localhost:18788",
    LINKAROOIE_URL: "https://localhost:18788",
  }), /different ports/);
});

test("invalid or duplicate start ports are refused", () => {
  for (const [left, right, reason] of [
    ["x", "18787", /whole number/],
    ["18788", "18788", /must be different/],
  ]) {
    const result = spawnSync("sh", ["labs/building/start-local.sh"], {
      env: { ...process.env, GUESTBOOK_PORT: left, LINKAROOIE_PORT: right },
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, reason);
  }
});

test("cleanup finds the selected ports and understands earlier URL-only records", () => {
  const root = mkdtempSync(join(tmpdir(), "building-lab-ports-"));
  try {
    const record = join(root, "run.env");
    const read = () => execFileSync("sh", [
      "-c", '. ./labs/building/local-ports.sh; ports_from_run_env "$1"', "sh", record,
    ], { encoding: "utf8" }).trim();
    writeFileSync(record, "GUESTBOOK_PORT=18788\nLINKAROOIE_PORT=18787\n");
    assert.equal(read(), "18788 18787");
    writeFileSync(record, "GUESTBOOK_URL=https://localhost:8788\nLINKAROOIE_URL=https://localhost:8787\n");
    assert.equal(read(), "8788 8787");
  } finally {
    rmSync(root, { recursive: true });
  }
});
