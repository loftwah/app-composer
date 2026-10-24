// Resolve the installed EmDash field-schema generator without pinning a build hash.
// EmDash's bundler hashes this internal module on every release, so a literal
// path breaks on each dependency update. The tests still exercise the exact
// bytes that are installed: exactly one module must match, and it must export
// the generator the content-model fixtures compare against.
import { readdirSync } from 'node:fs';

const directory = new URL('../../node_modules/emdash/dist/', import.meta.url);
const matches = readdirSync(directory)
  .filter((name) => /^zod-generator-[\w-]+\.mjs$/.test(name))
  .sort();

if (matches.length !== 1) {
  throw new Error(
    `Expected exactly one installed EmDash zod-generator module, found ${matches.length}: ${matches.join(', ')}`,
  );
}

const generator = await import(new URL(matches[0], directory).href);

// The bundler also minifies export names, so accept the readable name when it
// survives and otherwise the single minified alias that carries it.
const resolved = generator.generateFieldSchema ?? generator.n;

if (typeof resolved !== 'function') {
  throw new Error(`${matches[0]} does not export a field-schema generator`);
}

export const nativeFieldSchema = resolved;
