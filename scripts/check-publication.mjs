import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
    for (const line of readFileSync(resolve(directory, name), "utf8").split(
      /\r?\n/,
    )) {
      const match =
        /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
      // Preserve every source's values, even when the same name is overridden.
      local[match[1] + "_" + Object.keys(local).length] = value;
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
