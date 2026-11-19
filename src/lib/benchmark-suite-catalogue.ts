import { assertBenchmarkSuite } from './benchmark-suite.mjs';

const definitions = import.meta.glob([
  '../../benchmarks/suites/*.json',
  '../../benchmarks/cloudflare-composition/cf-compose-01.json',
], { eager: true, import: 'default' });

export function benchmarkSuiteCatalogue(results?: unknown) {
  return Object.entries(definitions)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, spec]) => ({
      file: path.split('/').at(-1) ?? path,
      inCloudflareDirectory: path.startsWith('../../benchmarks/cloudflare-composition/'),
      spec,
      summary: assertBenchmarkSuite(spec, { results }),
    }));
}
