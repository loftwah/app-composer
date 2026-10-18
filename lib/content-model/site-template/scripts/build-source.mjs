// MIT. Strict application source and reproducible readable JS/declarations.
import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2];
if (!["--check", "--write", "--lint"].includes(mode))
  throw Error("Use --check, --write or --lint.");
const config = ts.readConfigFile(
  resolve(root, "tsconfig.source.json"),
  ts.sys.readFile,
);
if (config.error)
  throw Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
if (mode === "--lint")
  Object.assign(parsed.options, {
    noUnusedLocals: true,
    noUnusedParameters: true,
  });
const program = ts.createProgram(parsed.fileNames, parsed.options),
  outputs = [];
const emission = program.emit(undefined, (path, bytes) =>
  outputs.push({ path, bytes }),
);
const errors = [
  ...parsed.errors,
  ...ts.getPreEmitDiagnostics(program),
  ...emission.diagnostics,
];
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
        "Stale generated output: " + path + ". Run pnpm source:write.",
      );
  }
console.log(
  mode === "--lint"
    ? "Strict application unused-source checks pass."
    : outputs.length +
        " application distributions " +
        (mode === "--write" ? "written" : "match") +
        ".",
);
