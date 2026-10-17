// MIT. Check/emit the small shared launcher without a second build framework.
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
export function launcherAsset({ write = false } = {}) {
  const configPath = resolve(root, 'tsconfig.launcher.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const outputs = [];
  const emit = program.emit(undefined, (name, bytes) => { if (name.endsWith('/launcher.js')) outputs.push(bytes); });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program), ...emit.diagnostics];
  if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  if (outputs.length !== 1) throw Error('Expected one checked launcher output.');
  const path = resolve(root, 'public/brand/launcher.js');
  const bytes = '// Generated from src/browser/launcher.ts; edit that source. MIT.\n' + outputs[0];
  let before = '';
  try { before = readFileSync(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const changed = before !== bytes;
  if (changed && write) writeFileSync(path, bytes);
  if (changed && !write) throw Error('Launcher output differs; run node scripts/launcher-assets.mjs --write.');
  return { changed };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!['--check', '--write'].includes(process.argv[2])) throw Error('Use --check or --write.');
    const result = launcherAsset({ write: process.argv[2] === '--write' });
    console.log(result.changed ? 'Updated checked launcher output.' : 'Checked launcher output matches.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
