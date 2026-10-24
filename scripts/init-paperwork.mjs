// Offline, explicit reproduction of a reviewed static mini-app; no install or deployment.
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  lstatSync,
} from "node:fs";
import { resolve, dirname, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest } from "./contracts.mjs";
import { validatePaperworkConfig } from "../lib/paperwork/config.mjs";
const sourcePin = JSON.parse(
  readFileSync(
    new URL("../lib/paperwork/source.json", import.meta.url),
    "utf8",
  ),
);
export function reproducePaperwork({ source, destination, configuration }) {
  const config = validatePaperworkConfig(configuration);
  if (
    !isAbsolute(source || "") ||
    !isAbsolute(destination || "") ||
    existsSync(destination)
  )
    throw Error(
      "Choose an existing absolute source and an absent absolute destination.",
    );
  const from = resolve(source),
    to = resolve(destination),
    git = (args) =>
      execFileSync("git", ["-C", from, ...args], {
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
      }).trim();
  if (
    lstatSync(from).isSymbolicLink() ||
    !lstatSync(dirname(to)).isDirectory() ||
    lstatSync(dirname(to)).isSymbolicLink()
  )
    throw Error("Use ordinary source and destination-parent directories.");
  if (git(["rev-parse", "HEAD"]) !== sourcePin.commit)
    throw Error("Paperwork source differs from the reviewed exact pin.");
  const remote = git(["remote", "get-url", "origin"]);
  if (
    ![
      "https://github.com/loftwah/app-composer-paperwork.git",
      "https://github.com/loftwah/app-composer-paperwork",
      "git@github.com:loftwah/app-composer-paperwork.git",
    ].includes(remote)
  )
    throw Error("Unexpected Paperwork repository.");
  const manifest = validateManifest(
    JSON.parse(git(["show", sourcePin.commit + ":app.manifest.json"])),
  );
  if (manifest.id !== "paperwork" || manifest.runtime !== "static-assets")
    throw Error("Unexpected Paperwork contract.");
  const entries = execFileSync(
    "git",
    ["-C", from, "ls-tree", "-rz", "--full-tree", sourcePin.commit],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [metadata, name] = line.split("\t");
      if (
        !metadata.startsWith("100644 ") ||
        !name ||
        name.startsWith("/") ||
        name.split("/").some((p) => p === ".." || p === ".git")
      )
        throw Error("Source contains an unsupported file.");
      return name;
    });
  mkdirSync(to);
  try {
    for (const name of entries) {
      const bytes = execFileSync(
        "git",
        ["-C", from, "show", sourcePin.commit + ":" + name],
        { maxBuffer: 8 * 1024 * 1024 },
      );
      const target = join(to, name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes, { flag: "wx" });
    }
    // Reproduction transfers source, never the reference instance's upload target.
    const target = JSON.parse(readFileSync(join(to, "wrangler.jsonc"), "utf8"));
    delete target.account_id;
    delete target.routes;
    target.name = "paperwork-unconfigured";
    writeFileSync(join(to, "wrangler.jsonc"), JSON.stringify(target, null, 2) + "\n");
    writeFileSync(
      join(to, "public/paperwork.json"),
      JSON.stringify(config, null, 2) + "\n",
    );
    writeFileSync(
      join(to, "composer-project.json"),
      JSON.stringify(
        {
          format: "app-composer.static-miniapp",
          version: 1,
          app: "paperwork",
          source: sourcePin,
          configuration: config,
          prepared: true,
          deployed: false,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    return {
      destination: to,
      source: sourcePin.commit,
      configured: ["title", "intro", "theme"],
      deployed: false,
    };
  } catch (error) {
    rmSync(to, { recursive: true, force: true });
    throw error;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2),
    flags = ["--source", "--destination", "--config"];
  if (
    args.length !== 6 ||
    args.some((arg, i) => i % 2 === 0 && !flags.includes(arg)) ||
    new Set(args.filter((_, i) => i % 2 === 0)).size !== 3
  )
    throw Error(
      "Use --source ABS_CHECKOUT --destination NEW_ABS_DIRECTORY --config JSON_FILE",
    );
  const value = (flag) => args[args.indexOf(flag) + 1];
  const configFile = value("--config");
  if (lstatSync(configFile).size > 2048)
    throw Error("Configuration is too large.");
  console.log(
    JSON.stringify(
      reproducePaperwork({
        source: value("--source"),
        destination: value("--destination"),
        configuration: JSON.parse(readFileSync(configFile, "utf8")),
      }),
      null,
      2,
    ),
  );
}
