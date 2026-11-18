import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";

// Remove this verification and the two pnpm patches once upstream ships fixes
// for both dependency edges. pnpm audit sees registry versions, not local patches.
const parserHashes = new Map([
  ["2.3.2", "cc683c0a753c99cd689e8dd13b082cb1bab05149d2311d10dda5e2a96c0d3d98"],
  ["4.0.7", "5f0f5f94d9dfabdd886897ed6c8519a175ed933cbdc714a945860aa0a6e607b0"],
]);
const executable = process.env.npm_execpath || "pnpm";
const pnpmIsScript = /\.(?:c|m)?js$/.test(executable);
const pnpm = (args, options) =>
  pnpmIsScript
    ? execFileSync(process.execPath, [executable, ...args], options)
    : execFileSync(executable, args, options);
const list = (...flags) =>
  pnpm(["list", "picomatch", "--depth", "Infinity", "--parseable", ...flags], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .sort();

const installed = list();
const locked = list("--lockfile-only");
if (installed.join("\n") !== locked.join("\n")) {
  throw Error("Install the locked dependencies before running the audit.");
}

const directories = installed.filter((directory) =>
  directory.endsWith(sep + join("node_modules", "picomatch")),
);
const verified = new Set();
const versions = new Set();
for (const directory of directories) {
  const { version } = JSON.parse(
    readFileSync(join(directory, "package.json"), "utf8"),
  );
  const hash = createHash("sha256")
    .update(readFileSync(join(directory, "lib/parse.js")))
    .digest("hex");
  if (hash !== parserHashes.get(version))
    throw Error(`Unverified picomatch parser for ${version}.`);
  verified.add(realpathSync(directory));
  versions.add(version);
}
if (versions.size !== parserHashes.size)
  throw Error("Both picomatch backports must be installed.");

for (const directory of installed) {
  const require = createRequire(join(directory, "package.json"));
  let resolved;
  try {
    resolved = require.resolve("picomatch");
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    continue;
  }
  if (!verified.has(dirname(realpathSync(resolved)))) {
    throw Error("A dependency resolves to an unverified picomatch copy.");
  }
}
console.log(
  "Verified both installed picomatch parser backports for GHSA-fc5q-39xc-vjpf.",
);
pnpm(["audit", "--audit-level", "low", "--ignore", "GHSA-fc5q-39xc-vjpf"], {
  stdio: "inherit",
});
