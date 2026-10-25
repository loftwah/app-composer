// Reuse the maintained native admin fixture, with one owned temporary root.
// All modifications below affect its fictional copy only. No hosted requests.
import { spawn, spawnSync, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { ownedNativeDevPid } from "../../../scripts/lib/native-fixture-process.mjs";

const source = fileURLToPath(new URL("../../../", import.meta.url));
const output = resolve(
  process.argv[2] ?? join(source, "output/incident-lab-20261025"),
);
mkdirSync("/tmp/opencode", { recursive: true });
const root = mkdtempSync("/tmp/opencode/incident-lab-");
const processIds = new Set();
const children = (pid) => {
  let rows = "";
  try {
    rows = execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
  } catch {}
  return rows.trim().split(/\s+/).filter(Boolean).map(Number);
};
let prepare;
const port = await new Promise((resolve) => {
  const server = createServer();
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const origin = "http://localhost:" + port;
try {
  mkdirSync(output, { recursive: true });
  writeFileSync(join(root, "OWNER"), "Incident lab local verification only\n");
  prepare = spawn(
    process.execPath,
    [
      join(source, "docs/evidence/admin-journey-20261025/prepare-fixture.mjs"),
      "--source",
      source,
      "--incident-lab",
      "--root",
      root,
      "--origin",
      origin,
    ],
    { cwd: source, stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  for (const stream of [prepare.stdout, prepare.stderr])
    stream.on("data", (chunk) => {
      log = (log + chunk).slice(-12000);
    });
  for (
    let attempt = 0;
    attempt < 240 && !existsSync(join(root, "fixture.json"));
    attempt++
  ) {
    if (prepare.exitCode !== null)
      throw Error("Native fixture preparation stopped: " + log.slice(-2500));
    await new Promise((yes) => setTimeout(yes, 500));
  }
  if (!existsSync(join(root, "fixture.json")))
    throw Error("Native fixture preparation timed out: " + log.slice(-2500));
  const fixture = JSON.parse(readFileSync(join(root, "fixture.json"), "utf8"));
  const result = spawnSync(
    process.execPath,
    [
      join(source, "docs/evidence/incident-lab-20261025/capture.mjs"),
      root,
      output,
    ],
    { cwd: source, stdio: "inherit", timeout: 300000 },
  );
  if (result.status !== 0)
    throw Error("Incident lab browser journey failed: " + result.status);
} finally {
  const app = join(root, "app");
  if (ownedNativeDevPid(app)) {
    const logs = spawnSync(
      process.execPath,
      [join(source, "node_modules/astro/bin/astro.mjs"), "dev", "logs"],
      { cwd: app, encoding: "utf8" },
    );
    writeFileSync(
      join(output, "native.log"),
      (logs.stdout ?? "") + (logs.stderr ?? ""),
    );
    spawnSync(
      process.execPath,
      [join(source, "node_modules/astro/bin/astro.mjs"), "dev", "stop"],
      { cwd: app, stdio: "ignore" },
    );
  }
  const gather = (pid) => {
    for (const child of children(pid)) {
      gather(child);
      processIds.add(child);
    }
  };
  if (prepare?.pid) {
    gather(prepare.pid);
    processIds.add(prepare.pid);
  }
  for (const pid of processIds)
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  await new Promise((yes) => setTimeout(yes, 500));
  for (const pid of processIds)
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  rmSync(root, { recursive: true, force: true });
  const survivingProcesses = [...processIds].filter((pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  });
  writeFileSync(
    join(output, "cleanup.json"),
    JSON.stringify(
      {
        temporaryRootRemoved: !existsSync(root),
        processesStopped: processIds.size,
        survivingProcesses: survivingProcesses.length,
        providerCalls: 0,
      },
      null,
      2,
    ),
  );
  if (
    !existsSync(root) &&
    survivingProcesses.length === 0 &&
    process.env.LOFTWAH_VALIDATION_COMPLETION &&
    process.env.LOFTWAH_VALIDATION_GENERATION
  ) {
    writeFileSync(
      process.env.LOFTWAH_VALIDATION_COMPLETION,
      JSON.stringify({
        version: 1,
        generation: process.env.LOFTWAH_VALIDATION_GENERATION,
        cleanup: "complete",
      }),
    );
  }
}
