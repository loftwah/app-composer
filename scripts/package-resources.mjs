import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zip } from './package-extension.mjs';
import { resources, resourceVersion, renderResource } from '../src/lib/resource-library.ts';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = join(repository, 'public/resources/v1');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function packageResources() {
  for (const resource of resources) {
    writeFileSync(join(folder, `${resource.id}.md`), renderResource(resource.id));
  }
  writeFileSync(join(folder, 'LICENSE'), readFileSync(join(repository, 'LICENSE')));
  writeFileSync(join(folder, 'INDEX.md'), `# App Composer operating kit\n\nVersion: ${resourceVersion}\nReviewed: 2026/10/24 (Australia/Melbourne)\n\n## Start with one job\n\n${resources.map(resource => `- [${resource.title}](${resource.id}.md): ${resource.outcome}`).join('\n')}\n\n## Use in your project\n\nRead the selected Markdown runbook and its complete prompt template. Answer its labelled placeholders or delegate discoverable details to project inspection. Reconcile existing project instructions before adopting files. No previous chat or Composer website is needed to read the kit. External tools and access are still required to act.\n\n## Runnable fictional examples\n\nRequires Node 22. From this unpacked folder run:\n\n\`\`\`sh\nnode examples/exercise.mjs\n\`\`\`\n\nThis exercises failed-check publication blocking, ordered local stages, missing access, duplicate suppression, authentication/scope rejection, uncertain-effect reconciliation and a bounded synthetic incident. It creates no files, makes no network requests, sends no mail and publishes nothing. The event fixture is not a provider webhook endpoint; its in-memory Map is not a production outbox.\n\n## Complete local change example\n\nSee [the actual Field Notes change](examples/field-notes-example.md), its complete resulting Python fixture, reviewable patch, provenance and real browser captures. It needs an already installed compatible Python interpreter only if you choose that optional example. The original failed regression stopped local patch export; it is not production release proof.\n\n## Editable files\n\nThe diagrams are Mermaid source (.mmd) plus readable SVG exports. Open the PDF in a PDF viewer. To regenerate it, use Python 3 with ReportLab and run \`python3 operating-cheatsheet.py\`; the included Space Grotesk font is under the accompanying OFL licence. The mark is Composer's approved merging-block identity. Share PNGs are composed explanatory artwork, never product screenshots.\n\n## Scope and proof\n\nLocal fixtures prove only their named behaviour. Real provider, production, physical-device and fresh-agent longitudinal acceptance remain separate. Do not treat a downloaded prompt as authority to deploy, spend or change access. See the selected runbook for prerequisites, failure and continuation.\n\nSource: https://composer.loftwah.com/resources\nEvidence: https://github.com/loftwah/app-composer/issues/11\nLicence: MIT; bundled Space Grotesk uses OFL.\n`);
  const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error('Linked kit member refused');
    if (entry.isDirectory()) return walk(path);
    const name = relative(folder, path).replaceAll('\\', '/');
    if (name === 'starter-kit.zip' || name === 'manifest.json') return [];
    return [[name, readFileSync(path)]];
  });
  const files = walk(folder).sort(([a], [b]) => a.localeCompare(b));
  const archive = zip(files);
  const metadata = { version: resourceVersion, bytes: archive.length, sha256: sha256(archive),
    files: files.map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: sha256(bytes) })) };
  writeFileSync(join(folder, 'starter-kit.zip'), archive);
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
  return metadata;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = packageResources();
  console.log(`Packaged ${result.version}: ${result.files.length} files, ${result.bytes} bytes, sha256 ${result.sha256}`);
}
