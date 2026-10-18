// Captured app-owned finite form source. No remote setup, fetch or app import.
import ts from "typescript";
import { readFileSync, writeFileSync, lstatSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)),
  mode = process.argv[2];
if (!["--check", "--write"].includes(mode))
  throw Error("Use --check or --write.");
const config = ts.readConfigFile(
  root + "tsconfig.enquiries.json",
  ts.sys.readFile,
);
if (config.error)
  throw Error("The finite enquiry compiler configuration is invalid.");
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root),
  outputs = [];
const program = ts.createProgram(parsed.fileNames, parsed.options),
  emit = program.emit(undefined, (path, bytes) =>
    outputs.push({ path, bytes }),
  );
const diagnostics = [
  ...parsed.errors,
  ...ts.getPreEmitDiagnostics(program),
  ...emit.diagnostics,
];
if (diagnostics.length)
  throw Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (path) => path,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }),
  );
const destinations = new Map(
  [
    "enquiry-calendar.js",
    "enquiry-model.js",
    "enquiry-model-validator.js",
    "browser/enquiry-form.js",
  ].map((name) => [name, root + "public/brand/enquiries/" + name]),
);
const plan = [];
for (const { path, bytes } of outputs) {
  const relative = path.split("/dist/enquiries/")[1],
    target = destinations.get(relative);
  if (!target) throw Error("Unexpected enquiry output: " + path);
  const expected =
    "// Generated from checked TypeScript; edit src/enquiries. MIT.\n" + bytes;
  // Refuse linked destinations before any output is written.
  let parent = root;
  for (const component of target.slice(root.length).split("/")) {
    parent += component;
    const stat = lstatSync(parent);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()))
      throw Error("Linked or unsupported enquiry output: " + relative);
    parent += "/";
  }
  plan.push({ target, expected, relative });
  destinations.delete(relative);
}
if (destinations.size) throw Error("Missing finite enquiry output.");
for (const { target, expected, relative } of plan) {
  if (mode === "--write") writeFileSync(target, expected);
  else if (readFileSync(target, "utf8") !== expected)
    throw Error("Stale enquiry asset: " + relative);
}
console.log(
  "4 app-owned enquiry distributions " +
    (mode === "--write" ? "written." : "match."),
);
