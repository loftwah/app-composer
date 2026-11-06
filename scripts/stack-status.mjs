// Generate the read-only Stack status snapshot after the ordinary build
// identity. Run explicitly by dev/build/check:types; this script performs no
// network request and changes only the ignored generated snapshot.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStackStatusFromRepository } from './lib/stack-status.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = JSON.parse(readFileSync(join(root, 'src/lib/build.json'), 'utf8'));
if (!/^[a-f0-9]{40}$/.test(build.commit ?? '')) {
  throw new Error('Run scripts/identity.mjs before generating Stack status.');
}
const status = buildStackStatusFromRepository({
  root,
  build,
  now: new Date(),
});
writeFileSync(
  join(root, 'src/lib/stack-status.json'),
  `${JSON.stringify(status, null, 2)}\n`,
);
console.log(
  `Stack status generated: ${status.status}, ${status.packages.length} packages, registry ${status.remote.state}.`,
);
