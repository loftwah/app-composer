// MIT. Strict maintained TypeScript is checked by Astro. This emits readable
// browser modules. It never downloads fonts or depends on the network.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import ts from 'typescript';
import {STACK_THEMES} from '../src/lib/stack-theme.mjs';

const write = process.argv.slice(2).join(' ') === '--write';
if (!write && process.argv.slice(2).join(' ') !== '--check') throw Error('Use --write or --check.');
const files = [
  ['src/lib/qr-code.ts', 'public/brand/qr-code.mjs'],
  ['src/browser/stack-share.ts', 'public/brand/stack-share.mjs'],
];
let changed = false;
function asset(path, expected) {
  const url = new URL(`../${path}`, import.meta.url);
  let actual = '';
  try { actual = readFileSync(url, 'utf8'); } catch {}
  if (actual === expected) return;
  if (write) {
    mkdirSync(dirname(url.pathname), {recursive: true});
    writeFileSync(url, expected);
  } else {
    changed = true;
    console.error(`${path} differs from maintained source. Run node scripts/stack-share-assets.mjs --write.`);
  }
}
for (const [source, output] of files) {
  const authored = readFileSync(new URL(`../${source}`, import.meta.url), 'utf8');
  const result = ts.transpileModule(authored, {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, removeComments: false},
    fileName: source,
  });
  // The browser consumes its independently committed assets; it never imports
  // a TypeScript source file or a workspace path at runtime.
  const emitted = result.outputText.replaceAll('../lib/qr-code.ts', './qr-code.mjs').replaceAll('../../public/brand/page-share-url.mjs', './page-share-url.mjs');
  asset(output, `// Generated from ${source}; edit the source and run scripts/stack-share-assets.mjs --write.\n${emitted}`);
}
const themes = Object.entries(STACK_THEMES).map(([name, tokens]) => `.stack-view[data-stack-theme="${name}"] {\n${Object.entries(tokens).map(([key, value]) => `  --stack-${key}: ${value};`).join('\n')}\n}`).join('\n\n');
asset('src/styles/stack-theme.generated.css', `/* Generated from src/lib/stack-theme.mjs by scripts/stack-share-assets.mjs. */\n${themes}\n`);
if (changed) process.exitCode = 1;
