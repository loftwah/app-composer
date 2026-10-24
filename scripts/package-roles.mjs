// Build the downloadable role-pack edition and its content-addressed manifest.
// The Markdown is generated from the same maintained module the site and CLI use.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip } from './package-extension.mjs';
import {
  renderRolePack,
  renderRolePrompt,
  rolePackReviewed,
  rolePackSuite,
  rolePacks,
} from '../src/lib/role-packs.ts';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = join(repository, 'public/roles/v1');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function packageRolePacks() {
  mkdirSync(join(folder, 'examples'), { recursive: true });
  mkdirSync(join(folder, 'prompts'), { recursive: true });
  for (const pack of rolePacks) {
    writeFileSync(join(folder, `${pack.id}.md`), renderRolePack(pack.id));
    writeFileSync(join(folder, `prompts/${pack.id}.txt`), renderRolePrompt(pack.id));
  }
  writeFileSync(join(folder, 'LICENSE'), readFileSync(join(repository, 'LICENSE')));
  writeFileSync(
    join(folder, 'examples/fictional-trail-notes.json'),
    readFileSync(join(repository, 'examples/role-packs/fictional-trail-notes.json')),
  );
  const invalid = [
    ['unsafe-self-approval.json', 'An agent requests and approves the same change; the runner must refuse.'],
    ['unsafe-secret.json', 'A bearer token appears in evidence; the runner must refuse and ask for rotation.'],
    ['wrong-target-production.json', 'Programmer work is pointed at production; the runner must refuse.'],
  ];
  for (const [name] of invalid) {
    const source = readFileSync(join(repository, 'examples/role-packs', name));
    writeFileSync(join(folder, 'examples', name), source);
  }

  writeFileSync(
    join(folder, 'INDEX.md'),
    `# App Composer agent role packs

Version: ${rolePackSuite}
Reviewed: ${rolePackReviewed} (Australia/Melbourne)

Six job contracts for an owner's local agent. Each pack states its inputs,
evidence, output, stop rules, prohibited actions, negative tests and one worked
fictional example. A pack is expertise and a job template, not an access grant.

## Packs

${rolePacks.map((pack) => `- [${pack.label}: ${pack.title}](${pack.id}.md) — v${pack.version}`).join('\n')}

## Run a brief

From a checkout of App Composer with Node 22:

\`\`\`sh
node scripts/roles.mjs check
node scripts/roles.mjs brief --role qa --input examples/role-packs/fictional-trail-notes.json
\`\`\`

A refused brief exits 2 with a human action. A brief with a blocking stop prints
the brief and exits 3. Nothing is approved, deployed, merged, spent or granted.

## Shared fictional bundle

[examples/fictional-trail-notes.json](examples/fictional-trail-notes.json) is one
bundle for Trail Notes, its service, isolated Preview, dependencies, ownership,
gates, drift and security paths. All six packs read the same evidence so their
jobs can be compared.

## Boundaries

Proposal only. The accountable human decides. Never place credentials, private
records or customer data in a bundle. No provider action, deployment or paid
commitment is authorised by a pack, prompt or generated brief.

Source: https://composer.loftwah.com/roles
Evidence: https://github.com/loftwah/app-composer/issues/11
Licence: MIT.
`,
  );
  const refusalLines = invalid.map(([name, note]) => `- [${name}](${name}) — ${note}`).join('\n');
  writeFileSync(
    join(folder, 'examples/README.md'),
    `# Role-pack examples

All records are fictional. Do not replace them with real private data.

## Valid bundle

- [fictional-trail-notes.json](fictional-trail-notes.json) — the shared bundle for all six packs.

## Refusal fixtures

${refusalLines}

Run each with \`node scripts/roles.mjs brief --role programmer --input <file>\`.
The expected result is exit 2 and a named human action, never a brief.
`,
  );

  const walk = [
    ...rolePacks.map((pack) => [`${pack.id}.md`, readFileSync(join(folder, `${pack.id}.md`))]),
    ...rolePacks.map((pack) => [`prompts/${pack.id}.txt`, readFileSync(join(folder, `prompts/${pack.id}.txt`))]),
    ['INDEX.md', readFileSync(join(folder, 'INDEX.md'))],
    ['LICENSE', readFileSync(join(folder, 'LICENSE'))],
    ['examples/README.md', readFileSync(join(folder, 'examples/README.md'))],
    ['examples/fictional-trail-notes.json', readFileSync(join(folder, 'examples/fictional-trail-notes.json'))],
    ...invalid.map(([name]) => [`examples/${name}`, readFileSync(join(folder, 'examples', name))]),
  ].sort(([a], [b]) => a.localeCompare(b));
  const archive = zip(walk);
  writeFileSync(join(folder, 'role-packs.zip'), archive);
  const metadata = {
    version: rolePackSuite,
    reviewed: rolePackReviewed,
    bytes: archive.length,
    sha256: sha256(archive),
    packs: rolePacks.map((pack) => ({ id: pack.id, version: pack.version, title: pack.title })),
    files: walk.map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: sha256(bytes) })),
  };
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = packageRolePacks();
  console.log(`Packaged ${result.version}: ${result.packs.length} packs, ${result.files.length} files, ${result.bytes} bytes, sha256 ${result.sha256}`);
}
