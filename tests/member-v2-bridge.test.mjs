import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("isolated synthetic v2 contract exercises trusted dispatch, receipt lookup and negative authority boundaries", () => {
  const result = execFileSync(
    process.execPath,
    ["--experimental-transform-types", "tests/helpers/member-v2-scenario.mjs"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 20000,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.deepEqual(JSON.parse(result), {
    syntheticContractOnly: true,
    scenarios: 11,
    actualPinPromoted: false,
  });
});
