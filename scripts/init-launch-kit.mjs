// MIT. Explicit local asset application into a fresh supported static app.
import { resolve, dirname, basename } from "node:path";
import { selectedFile } from "../lib/get-ready/project-files.mjs";
import { createLaunchKitProject } from "../lib/content-model/project.mjs";
const args = process.argv.slice(2),
  flags = new Map();
try {
  for (let i = 0; i < args.length; i++) {
    if (
      ![
        "--package",
        "--adoption",
        "--destination",
        "--base",
        "--origin",
      ].includes(args[i]) ||
      flags.has(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw Error(
        "Choose an explicit package, adoption record and absent destination.",
      );
    flags.set(args[i], args[++i]);
  }
  if (
    !["--package", "--adoption", "--destination"].every((key) => flags.has(key))
  )
    throw Error(
      "Use --package ZIP --adoption JSON --destination ABSENT_ABSOLUTE_DIRECTORY. Optional --origin HTTPS_ORIGIN --base /public/path/ only records reviewed output paths, not deployment authority.",
    );
  const load = (key, max) => {
    const path = resolve(flags.get(key)),
      file = selectedFile(dirname(path), basename(path), max);
    if (file.state !== "present")
      throw Error("Use ordinary bounded local input files.");
    return file.data;
  };
  console.log(
    JSON.stringify(
      await createLaunchKitProject({
        destination: flags.get("--destination"),
        packageBytes: load("--package", 8 * 1024 * 1024),
        adoption: JSON.parse(load("--adoption", 32768).toString("utf8")),
        ...(flags.has("--origin") ? { origin: flags.get("--origin") } : {}),
        ...(flags.has("--base") ? { base: flags.get("--base") } : {}),
      }),
      null,
      2,
    ),
  );
} catch (error) {
  process.stderr.write(
    (error instanceof Error ? error.message : "App creation failed.") +
      " Existing/partial projects are retained; no deployment was attempted.\n",
  );
  process.exitCode = 1;
}
