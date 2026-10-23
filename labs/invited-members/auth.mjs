import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pointer = resolve(
  (process.argv.includes("--pointer")
    ? process.argv[process.argv.indexOf("--pointer") + 1]
    : undefined) ?? join(repo, "output/invited-members/local-root"),
);
const root = readFileSync(pointer, "utf8").trim();
const run = JSON.parse(readFileSync(join(root, "run.json"), "utf8"));
if (run.schema !== "composer.invited-local/1" || run.root !== root)
  throw Error("Use a registered isolated lab.");
const cli =
  process.env.PLAYWRIGHT_CLI ??
  join(process.env.HOME, ".codex/skills/playwright/scripts/playwright_cli.sh");
const session = "invited-" + root.split("-").at(-1);
run.cliSession = session;
writeFileSync(join(root, "run.json"), JSON.stringify(run, null, 2), {
  mode: 0o600,
});
const source = readFileSync(
  join(repo, "labs/invited-members/auth-browser.js"),
  "utf8",
).replace(
  /const lab\s*=\s*LAB_OPTIONS;/,
  "const lab=" + JSON.stringify({ root, origin: run.origins.composer }) + ";",
);
const filename = join(root, "auth-browser.js");
writeFileSync(filename, source.trim().replace(/;$/, ""), { mode: 0o600 });
const execute = (args) =>
  execFileSync(cli, ["-s=" + session, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
try {
  console.log(
    execute([
      "open",
      run.origins.composer + "/_emdash/admin/setup",
      "--config",
      join(root, "playwright.config.json"),
      "--profile",
      join(root, "browser-profile"),
    ]),
  );
  const result = execute(["run-code", "--filename", filename, "--json"]);
  writeFileSync(join(root, "auth-cli-result.json"), result, { mode: 0o600 });
  // The receipt contains only fictional account ids/roles and denial results;
  // session state files stay exclusively in the owned temporary root.
  mkdirSync(join(repo, "output/invited-members"), { recursive: true });
  writeFileSync(
    join(repo, "output/invited-members/auth-cli-result.json"),
    result,
  );
  const envelope = JSON.parse(result);
  const receipt = JSON.parse(envelope.result);
  writeFileSync(
    join(repo, "output/invited-members/auth-receipt.json"),
    JSON.stringify(
      {
        ...receipt,
        sourceAtAuthentication: run.sources,
        recordedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(result);
  console.log(
    "Owned CLI session: " +
      session +
      "; private native storage states: " +
      root +
      "/{owner,member-a,member-b}-state.json",
  );
} catch (error) {
  console.error(error.stdout?.toString() ?? "");
  console.error(error.stderr?.toString() ?? "");
  throw error;
}
