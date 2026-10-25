// A copied Astro dev.json can name a daemon in the original checkout. Never
// stop it merely because a disposable copy inherited its lock file.
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
export function ownedNativeDevPid(app) {
  try {
    const { pid } = JSON.parse(
      readFileSync(join(app, ".astro/dev.json"), "utf8"),
    );
    if (!Number.isSafeInteger(pid) || pid <= 0) return null;
    const output = execFileSync(
      "lsof",
      ["-a", "-p", String(pid), "-d", "cwd", "-Fn"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 },
    );
    const cwd = output
      .split("\n")
      .find((line) => line.startsWith("n"))
      ?.slice(1);
    return cwd && realpathSync(cwd) === realpathSync(app) ? pid : null;
  } catch {
    return null;
  }
}
