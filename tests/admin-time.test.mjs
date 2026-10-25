import test from "node:test";
import assert from "node:assert/strict";
import {
  adminTime,
  melbourneTime,
  utcTime,
} from "../src/lib/admin-time.ts";

test("owner times use YYYY/MM/DD in Melbourne and UTC", () => {
  const value = "2026-10-24T22:32:00.000Z";
  assert.equal(utcTime(value), "2026/10/24 22:32 UTC");
  assert.equal(melbourneTime(value), "2026/10/25 09:32 Melbourne");
  assert.equal(
    adminTime(value),
    "2026/10/25 09:32 Melbourne · 2026/10/24 22:32 UTC",
  );
});

test("midnight stays 00 and an invalid value is stated, not guessed", () => {
  assert.equal(utcTime("2026-10-24T00:05:00.000Z"), "2026/10/24 00:05 UTC");
  assert.equal(utcTime("not a date"), "Unknown time");
});
