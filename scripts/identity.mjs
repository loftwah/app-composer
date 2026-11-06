import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

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

writeFileSync(
  "src/lib/build.json",
  JSON.stringify(
    {
      app: "app-composer",
      commit,
      reviewed: "2026-10-13",
      reviewedScope: "original-build-identity-contract",
      sourceCommittedAt,
      contract: 1,
    },
    null,
    2,
  ) + "\n",
);
