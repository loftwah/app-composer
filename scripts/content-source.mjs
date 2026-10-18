// MIT. Check maintained model/recipe modules and their readable distributions.
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2];
if (!["--check", "--write", "--lint"].includes(mode))
  throw Error("Use --check, --write or --lint.");
const sources = [
  "lib/content-model/calendar-date.mts",
  "lib/content-model/index.mts",
  ...["collection", "entry", "number-input", "editor-compatibility"].map(
    (name) => "lib/content-model/site-template/src/lib/" + name + ".mts",
  ),
];
const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  types: [],
  strict: true,
  skipLibCheck: true,
  declaration: true,
  noEmitOnError: true,
  ...(mode === "--lint"
    ? { noUnusedLocals: true, noUnusedParameters: true }
    : {}),
};
const host = ts.createCompilerHost(options);
// A generated site receives this same model source as content-model.mts. Resolve
// its helpers against the authored implementation here, never a stale declaration.
const templateLibrary = resolve(root, "lib/content-model/site-template/src/lib");
host.resolveModuleNames = (names, containingFile) => names.map(name =>
  name === "./content-model.mjs" && dirname(containingFile) === templateLibrary
    ? {resolvedFileName: resolve(root, "lib/content-model/index.mts"), extension: ts.Extension.Mts}
    : ts.resolveModuleName(name, containingFile, options, host).resolvedModule
);
const program = ts.createProgram(
    sources.map((name) => resolve(root, name)),
    options,
    host,
  ),
  outputs = [];
const emission = program.emit(undefined, (path, bytes) =>
  outputs.push({ path, bytes }),
);
const errors = [...ts.getPreEmitDiagnostics(program), ...emission.diagnostics];
if (errors.length)
  throw Error(
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: (path) => path,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }),
  );
if (mode !== "--lint")
  for (const { path, bytes } of outputs) {
    const expected =
      "// Generated from checked TypeScript; edit the corresponding .mts source. MIT.\n" +
      bytes;
    if (mode === "--write") writeFileSync(path, expected);
    else if (readFileSync(path, "utf8") !== expected)
      throw Error(
        "Stale source output: " +
          path +
          ". Run node scripts/content-source.mjs --write.",
      );
  }
console.log(
  mode === "--lint"
    ? "Strict model/recipe unused-source checks pass."
    : outputs.length +
        " model/recipe distributions " +
        (mode === "--write" ? "written" : "match") +
        ".",
);
