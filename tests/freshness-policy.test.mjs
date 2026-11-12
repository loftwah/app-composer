import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  exitCodeFor,
  formatReport,
  inspectFreshness,
  readLockfileImporter,
  satisfies,
} from "../scripts/freshness.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

test("the committed freshness policy covers every declared dependency", () => {
  const report = inspectFreshness({ root });
  assert.equal(report.summary.drift, 0);
  assert.equal(report.summary.unknown, 0);
  assert.equal(report.summary.unresolved, 0);
  assert.equal(report.summary.ok, report.packages.length + report.runtime.filter((row) => row.status === "ok").length);
  assert.equal(exitCodeFor(report), 0);
  assert.match(formatReport(report), /Summary: \d+ ok, 0 drift, 0 unknown, 0 unresolved/);
});

test("a declared pnpm pin is never reported as the installed executable", () => {
  const unobserved = inspectFreshness({ root, nodeVersion: "26.13.1", pnpmVersion: null });
  const pnpm = unobserved.runtime.find((row) => row.name === "pnpm");
  assert.equal(pnpm.default, "12.19.0");
  assert.equal(pnpm.installed, null);
  assert.equal(pnpm.observed, false);
  assert.equal(pnpm.status, "unobserved");
  assert.equal(unobserved.summary.unobserved, 1);
  assert.equal(exitCodeFor(unobserved), 0);
  assert.match(formatReport(unobserved), /pnpm +12\.19\.0 +12\.19\.0 +unobserved/);

  const falseGreen = inspectFreshness({ root, nodeVersion: "26.13.1", pnpmVersion: "12.8.1" });
  assert.equal(falseGreen.runtime.find((row) => row.name === "pnpm").status, "drift");
  assert.equal(falseGreen.summary.drift, 1);
  assert.equal(exitCodeFor(falseGreen), 1);
});

test("the selected Node default and the observed process stay distinct", () => {
  const report = inspectFreshness({ root, nodeVersion: "22.23.4", pnpmVersion: "12.19.0" });
  const node = report.runtime.find((row) => row.name === "node");
  assert.equal(node.default, "26.13.1");
  assert.equal(node.installed, "22.23.4");
  assert.equal(node.status, "drift");
  assert.deepEqual(node.tested, ["22.23.5", "24.22.3", "26.13.1"]);
  assert.equal(exitCodeFor(report), 1);
});

test("the supported Node line includes the tested security-patched floors only", () => {
  const range = ">=22.23.5 <23 || >=24.22.3 <25 || >=26.13.1 <27";
  for (const version of ["22.23.5", "22.99.0", "24.22.3", "26.13.1", "26.99.0"])
    assert.equal(satisfies(version, range), true, version);
  for (const version of ["22.23.4", "23.0.0", "24.22.2", "25.0.0", "26.13.0", "27.0.0"])
    assert.equal(satisfies(version, range), false, version);
});

test("the lockfile importer parser reads the root dependency versions", () => {
  const importer = readLockfileImporter(`lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      astro:
        specifier: 7.4.5
        version: 7.4.5(react@19.3.1)
    devDependencies:
      wrangler:
        specifier: 4.152.0
        version: 4.152.0
`);
  assert.equal(importer.get("astro").version, "7.4.5");
  assert.equal(importer.get("wrangler").version, "4.152.0");
});

test("an uncovered dependency outranks drift in the exit code", () => {
  assert.equal(exitCodeFor({ summary: { unknown: 0, drift: 1, unresolved: 0 } }), 1);
  assert.equal(exitCodeFor({ summary: { unknown: 1, drift: 1, unresolved: 0 } }), 2);
  assert.equal(exitCodeFor({ summary: { unknown: 0, drift: 0, unresolved: 0 } }), 0);
});
