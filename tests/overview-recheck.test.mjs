import test from "node:test";
import assert from "node:assert/strict";
import { sourceRecheckResult } from "../src/lib/overview-attention.ts";

const source = { id: "orders", label: "Orders", atLimit: false };

test("a checked zero is a successful read; unavailable and restricted are not", () => {
  assert.deepEqual(
    sourceRecheckResult(
      { ...source, status: "checked", count: 0, note: "" },
      "12:00 UTC",
    ),
    {
      ok: true,
      message: "Orders rechecked. 0 retained problem records, read 12:00 UTC.",
    },
  );
  for (const status of ["unavailable", "restricted"]) {
    const result = sourceRecheckResult(
      { ...source, status, count: null, note: "Could not read orders." },
      "12:00 UTC",
    );
    assert.equal(result.ok, false);
    assert.equal(result.message, "Could not read orders.");
  }
  assert.equal(sourceRecheckResult(undefined, "12:00 UTC").ok, false);
  assert.equal(
    sourceRecheckResult(
      { ...source, status: "checked", count: null, note: "Count unavailable." },
      "12:00 UTC",
    ).ok,
    false,
  );
});
