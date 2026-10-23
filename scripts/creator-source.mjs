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
  "src/lib/miniapp-profile-settings-fields.mts",
  "src/lib/miniapp-profile-settings.mts",
  "src/lib/miniapp-achievements.mts",
  "src/lib/miniapp-tag-fields.mts",
  "src/lib/miniapp-tags.mts",
  "src/lib/miniapp-admin.mts",
  "src/lib/miniapp-share-card.mts",
  "src/lib/stacks-admin.mts",
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
  emitDeclarationOnly: true,
  allowImportingTsExtensions: true,
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
// Existing native runtime imports intentionally keep their .ts paths: Astro
// bundles them and Node 22 strips them in the route fixtures. Check the complete
// graph and emit real declarations first, then emit the closed authors' JS with
// the same pinned compiler. No distribution is written before both phases pass.
for (const source of sources) {
  const checked = program.getSourceFile(resolve(root, source));
  if (!checked) throw Error("Missing checked Creator author: " + source);
  const result = ts.transpileModule(checked.text, {
    fileName: source,
    reportDiagnostics: true,
    compilerOptions: {
      target: options.target,
      module: options.module,
      moduleResolution: options.moduleResolution,
      strict: true,
      resolveJsonModule: true,
      types: [],
    },
  });
  if (result.diagnostics?.length)
    throw Error(
      ts.formatDiagnosticsWithColorAndContext(result.diagnostics, {
        getCanonicalFileName: (path) => path,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      }),
    );
  outputs.set(source.replace(/\.mts$/, ".mjs"), result.outputText);
}
for (const source of sources)
  if (
    readFileSync(resolve(root, source), "utf8") !==
    program.getSourceFile(resolve(root, source)).text
  )
    throw Error("Creator author changed during checking: " + source);
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
