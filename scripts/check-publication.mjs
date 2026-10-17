import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import {
  privateValues,
  scanPublication,
  trackedPathFindings,
} from "./lib/publication-secrets.mjs";

export function publicationPrivateValues({
  environment = process.env,
  directory = process.cwd(),
} = {}) {
  const local = {};
  for (const name of readdirSync(directory)) {
    if (!/^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/.test(name)) continue;
    // Node's parser handles quoted/inline comments, multiline values and
    // escaped newlines. A line splitter compared a different value than runtime.
    const parsed = parseEnv(readFileSync(resolve(directory, name), "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      local[key + "_" + Object.keys(local).length] = value;
    }
  }
  return [...privateValues(environment), ...privateValues(local)];
}
export function checkPublication({
  roots = ["dist"],
  environment = process.env,
  directory = process.cwd(),
} = {}) {
  const result = scanPublication({
    roots,
    values: publicationPrivateValues({ environment, directory }),
  });
  if (existsSync(resolve(directory, ".git")))
    result.findings.push(...trackedPathFindings({ directory }));
  result.ok = result.findings.length === 0;
  return result;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = checkPublication({
    roots: process.argv.slice(2).length ? process.argv.slice(2) : ["dist"],
  });
  for (const finding of result.findings)
    console.error(
      "Publication refused: " + finding.label + " in " + finding.path,
    );
  if (!result.ok) process.exitCode = 1;
  else
    console.log(
      `Publication guard passed: ${result.files} files, ${result.members} archive members inspected.`,
    );
}
