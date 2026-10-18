// MIT. Strict Creator domain sources own their readable runtime/declarations.
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2];
if (!["--check", "--write", "--lint"].includes(mode))
  throw Error("Use --check, --write or --lint.");
const sources = [
  "src/lib/app-settings.mts",
  "src/lib/stacks.mts",
  "src/lib/app-configuration.mts",
  "src/lib/stack-activation.mts",
];
const outputRoot = resolve(root, "output/creator-source-emission");
const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.webworker.d.ts"],
  types: [],
  strict: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  declaration: true,
  noEmitOnError: true,
  rootDir: root,
  outDir: outputRoot,
  ...(mode === "--lint"
    ? { noUnusedLocals: true, noUnusedParameters: true }
    : {}),
};
const program = ts.createProgram(
  sources.map((name) => resolve(root, name)),
  options,
);
const outputs = new Map();
const emission = program.emit(undefined, (path, bytes) =>
  outputs.set(relative(outputRoot, path), bytes),
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
  for (const source of sources)
    for (const suffix of [".mjs", ".d.mts"]) {
      const name = source.replace(/\.mts$/, suffix);
      const bytes = outputs.get(name);
      if (typeof bytes !== "string")
        throw Error("Missing checked Creator distribution: " + name);
      const expected =
        "// Generated from checked TypeScript; edit the corresponding .mts source. MIT.\n" +
        bytes;
      if (mode === "--write") writeFileSync(resolve(root, name), expected);
      else if (readFileSync(resolve(root, name), "utf8") !== expected)
        throw Error(
          "Stale Creator distribution: " +
            name +
            ". Run node scripts/creator-source.mjs --write.",
        );
    }
console.log(
  mode === "--lint"
    ? "Strict Creator unused-source checks pass."
    : sources.length * 2 +
        " Creator distributions " +
        (mode === "--write" ? "written." : "match."),
);
