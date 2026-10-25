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
import { fileURLToPath } from "node:url";
import { ownedNativeDevPid } from "../../../scripts/lib/native-fixture-process.mjs";

const source = fileURLToPath(new URL("../../../", import.meta.url));
const output = resolve(
  process.argv[2] ?? join(source, "output/incident-desk-20261025"),
);
mkdirSync("/tmp/opencode", { recursive: true });
const root = mkdtempSync("/tmp/opencode/incident-desk-");
const processIds = new Set();
const children = (pid) => {
  let rows = "";
  try {
    rows = execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf8" });
  } catch {}
  return rows.trim().split(/\s+/).filter(Boolean).map(Number);
};
let prepare;
try {
  mkdirSync(output, { recursive: true });
  writeFileSync(join(root, "OWNER"), "Incident Desk local verification only\n");
  prepare = spawn(
    process.execPath,
    [
      join(source, "docs/evidence/admin-journey-20261025/prepare-fixture.mjs"),
      "--source",
      source,
      "--incident-desk",
      "--root",
      root,
      "--origin",
      "http://localhost:4367",
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
      join(source, "docs/evidence/incident-desk-20261025/capture.mjs"),
      root,
      output,
    ],
    { cwd: source, stdio: "inherit", timeout: 240000 },
  );
  if (result.status !== 0)
    throw Error("Incident Desk browser journey failed: " + result.status);
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
  writeFileSync(
    join(output, "cleanup.json"),
    JSON.stringify(
      {
        temporaryRootRemoved: !existsSync(root),
        processesStopped: processIds.size,
        providerCalls: 0,
      },
      null,
      2,
    ),
  );
}
