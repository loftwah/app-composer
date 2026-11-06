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
  assert.equal(
    report.summary.ok,
    report.packages.length + report.runtime.length,
  );
  assert.equal(exitCodeFor(report), 0);
  assert.match(formatReport(report), /Summary: \d+ ok, 0 drift, 0 unknown, 0 unresolved/);
});

test("the supported Node line includes the tested 26.13.0 floor only", () => {
  const range = ">=22.23.4 <23 || >=24.22.1 <25 || >=26.13.0 <27";
  for (const version of ["22.23.4", "22.99.0", "24.22.1", "26.13.0", "26.99.0"])
    assert.equal(satisfies(version, range), true, version);
  for (const version of ["22.23.3", "23.0.0", "24.22.0", "25.0.0", "26.12.0", "27.0.0"])
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
