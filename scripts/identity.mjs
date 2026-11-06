import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStackStatusFromRepository } from "./lib/stack-status.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Read the commit and its committer date together so a concurrent HEAD change
// cannot pair one revision with another revision's date. Neither is a test or
// deployment timestamp; the release receipt owns that evidence.
const [commit, sourceCommittedAt] = execFileSync(
  "git",
  ["show", "--no-patch", "--format=%H%n%cI", "HEAD"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n");

if (
  !/^[a-f0-9]{40}$/.test(commit ?? "") ||
  !Number.isFinite(Date.parse(sourceCommittedAt ?? ""))
)
  throw Error("The exact source identity and commit date could not be read.");

const build = {
  app: "app-composer",
  commit,
  reviewed: "2026-10-13",
  reviewedScope: "original-build-identity-contract",
  sourceCommittedAt,
  contract: 1,
};

writeFileSync(
  "src/lib/build.json",
  JSON.stringify(build, null, 2) + "\n",
);

// Stack status is generated with the same build identity. It reads the
// reviewed policy/lockfile, local install metadata and the last explicitly
// generated registry report; it never performs a network request.
const stackStatus = buildStackStatusFromRepository({
  root: repositoryRoot,
  build,
  now: new Date(),
});
writeFileSync(
  "src/lib/stack-status.json",
  JSON.stringify(stackStatus, null, 2) + "\n",
);
