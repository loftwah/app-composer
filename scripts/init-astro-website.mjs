// Local-only CLI: a spec file and one absent absolute destination. No install,
// provider call, Git action or deployment happens here.
import { resolve, dirname, basename } from 'node:path';
import { createAstroWebsite } from '../lib/astro-website/create.mjs';
import { selectedFile } from '../lib/get-ready/project-files.mjs';

const args = process.argv.slice(2), flags = new Map();
try {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Create a new independent Astro + Markdown website: pnpm init:website --spec FILE --destination ABSOLUTE_ABSENT_DIRECTORY. Existing projects are never updated. This installs nothing, contacts no provider and does not deploy.');
  } else {
    for (let i = 0; i < args.length; i++) {
      if (!['--spec', '--destination'].includes(args[i]) || flags.has(args[i]) ||
          !args[i + 1] || args[i + 1].startsWith('--'))
        throw Error('Use --spec FILE and --destination ABSOLUTE_ABSENT_DIRECTORY.');
      flags.set(args[i], args[++i]);
    }
    if (!flags.has('--spec') || !flags.has('--destination'))
      throw Error('Select the spec file and an absent absolute project directory.');
    const path = resolve(flags.get('--spec'));
    const file = selectedFile(dirname(path), basename(path), 65536);
    if (file.state !== 'present')
      throw Error('Use an ordinary spec JSON file under 64 KiB.');
    const result = createAstroWebsite({
      spec: JSON.parse(file.data.toString('utf8')),
      destination: flags.get('--destination'),
    });
    console.log(JSON.stringify(result, null, 2));
  }
} catch {
  process.stderr.write('Astro website creation did not finish. Use a supported spec, an absent absolute destination and an existing unlinked parent. Existing/partial files are preserved; inspect them before a separate retry. No dependency installation, provider call, Git action or deployment was attempted.\n');
  process.exitCode = 1;
}
