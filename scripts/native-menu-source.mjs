// The native adapter is a browser realm; no Node or Worker ambient fallback.
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
export function checkNativeMenuSource(
  root = fileURLToPath(new URL("../", import.meta.url)),
) {
  const config = ts.readConfigFile(
    resolve(root, "tsconfig.native-launcher.json"),
    ts.sys.readFile,
  );
  if (config.error) throw Error("Invalid native menu compiler configuration.");
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length)
    throw Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      }),
    );
  console.log("Native menu browser source checks.");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  checkNativeMenuSource();
