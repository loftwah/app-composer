import type { SuiteAuthorBase } from './benchmark-suite-author.ts';
import { validateBenchmarkSuite } from './benchmark-suite.mjs';

const directories = ['benchmarks/suites', 'benchmarks/cloudflare-composition'] as const;
const foundation = 'benchmarks/cloudflare-composition';

export function projectSuiteLocalTask(
  definition: unknown,
  catalogue: SuiteAuthorBase[],
  revision: string,
): { filename: string; markdown: string } {
  const { ok, summary } = validateBenchmarkSuite(definition);
  if (!ok || !summary) throw Error('Open a valid native suite definition first.');
  if (!/^[a-f0-9]{40}$/.test(revision) || revision.length !== 40)
    throw Error('The exact Composer checkout revision is unavailable. Reload Benchmarks and try again.');

  if (catalogue.some(pack => pack.id === summary.id))
    throw Error('Choose a new suite ID so the local task leaves the checkout’s catalogue file intact.');

  const known = (directory: SuiteAuthorBase['directory']) => new Set(
    catalogue.filter(pack => pack.directory === directory)
      .flatMap(pack => pack.checks.map(check => check.module + '::' + check.id)),
  );
  const keys = summary.checks.map(check => check.module + '::' + check.id);
  const selectedDirectory = directories.find(directory => {
    const trustedChecks = known(directory);
    return keys.every(key => trustedChecks.has(key));
  });
  if (!selectedDirectory)
    throw Error('A local run needs checks from one supported runner folder. Create a separate suite for each folder.');

  const id = summary.id;
  const slug = id.toLowerCase();
  const flag = selectedDirectory === foundation ? ' --suites ' + foundation : '';
  const command = 'node benchmarks/runner.mjs' + flag + ' --suite ' + id + ' > ' + slug + '-result.json';
  return {
    filename: slug + '-run-task.md',
    markdown: [
      '# Run ' + id + ' locally',
      '',
      'Use an isolated App Composer checkout at commit `' + revision + '`. Verify the commit before running the checks.',
      'Keep this task and the suite JSON from the same saved project row together.',
      'Copy the downloaded JSON to `' + selectedDirectory + '/' + slug + '.json` in the checkout. If that file already exists, create a suite with an unused ID.',
      '',
      '```sh',
      command,
      '```',
      '',
      'Return the actual `' + slug + '-result.json` and report any failure or blocked check.',
      'Open the report in the [Benchmarks result inspector](https://composer.loftwah.com/benchmarks/suites#local-result). Use Private run history only if you want to upload a copy.',
      '',
      'Use the existing local fixtures. This run needs no credentials, model or provider spend.',
      '',
    ].join('\n'),
  };
}
