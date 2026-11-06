// Controlled fixture for scripts/lib/owned-resources.mjs.
// It creates a temporary directory and a child process, reports both, then
// completes, fails, times out or is cancelled. A parent test owns everything
// outside the reported fixture resources.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createOwnedRun,
  OwnedResourceError,
  withOwnedResources,
} from "../../scripts/lib/owned-resources.mjs";

const mode = process.argv[2];
const readyFile = process.env.OWNED_READY_FILE;
const reportFile = process.env.OWNED_REPORT_FILE;
if (!["success", "failure", "timeout", "signal"].includes(mode))
  throw new Error("Choose success, failure, timeout or signal.");
if (!readyFile || !reportFile)
  throw new Error("OWNED_READY_FILE and OWNED_REPORT_FILE are required.");

const writeReport = (report) =>
  writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n", {
    mode: 0o600,
  });
const makeResources = (run) => {
  const directory = run.directory(
    mkdtempSync(join(tmpdir(), "composer-owned-fixture-")),
    { id: "fixture-directory" },
  );
  const child = run.spawn(process.execPath, ["-e", "setTimeout(()=>{}, 60000)"], {
    id: "fixture-child",
  });
  writeFileSync(
    readyFile,
    JSON.stringify({ directory, pid: child.pid, label: run.label }) + "\n",
    { mode: 0o600 },
  );
  return { directory, child };
};

if (mode === "signal") {
  const run = createOwnedRun({ label: "fixture-signal" });
  makeResources(run);
  run.installSignalHandlers({ onSignal: writeReport });
  await new Promise(() => {});
} else {
  try {
    await withOwnedResources(
      {
        label: "fixture-" + mode,
        timeoutMs: mode === "timeout" ? 300 : 10_000,
        onReport: writeReport,
      },
      async (run) => {
        makeResources(run);
        if (mode === "failure") throw new Error("controlled fixture failure");
        if (mode === "timeout") await run.wait(60_000);
      },
    );
  } catch (error) {
    if (mode !== "timeout") throw error;
    if (!(error instanceof OwnedResourceError) || error.code !== "timeout")
      throw error;
  }
  if (mode === "failure") process.exitCode = 1;
  if (mode === "timeout") process.exitCode = 2;
}
