// Test-only harness for the native command-centre page. It transpiles the real
// page source with the repository's TypeScript, strips the CSS import, and
// renders the exported board with react-dom/server. No production module or
// fake source is shipped from here.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("..", import.meta.url));

export async function loadCommandCentrePage(t) {
  mkdirSync(join(root, ".private"), { recursive: true });
  const directory = mkdtempSync(join(root, ".private/command-centre-ui-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = readFileSync(
    join(root, "src/plugins/command-centre-page.tsx"),
    "utf8",
  )
    .replace('import "./command-centre-page.css";', "")
    .replace(
      'from "../lib/command-centre-contract"',
      `from ${JSON.stringify(
        pathToFileURL(join(root, "src/lib/command-centre-contract.ts")).href,
      )}`,
    );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const target = join(directory, "page.mjs");
  writeFileSync(target, compiled.outputText);
  return import(pathToFileURL(target).href);
}

export function renderBoard(board, report, initialView) {
  return renderToStaticMarkup(
    React.createElement(board, { report, initialView }),
  );
}
