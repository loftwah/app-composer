import type { parseLocalBenchmarkResult } from './benchmark-local-result';

type LocalResult = ReturnType<typeof parseLocalBenchmarkResult>;
export const LOCAL_BENCHMARK_STORAGE_KEY = 'composer:benchmarks:local-result:v1';
export const MAX_LOCAL_BENCHMARK_BYTES = 1024 * 1024;

function checkSize(raw: string) {
  if (raw.length > MAX_LOCAL_BENCHMARK_BYTES ||
      new TextEncoder().encode(raw).length > MAX_LOCAL_BENCHMARK_BYTES) {
    throw new RangeError('The saved result exceeds the local file limit.');
  }
}

export async function readSavedLocalBenchmark(storage: Storage) {
  const raw = storage.getItem(LOCAL_BENCHMARK_STORAGE_KEY);
  if (raw === null) return null;
  checkSize(raw);
  const { parseLocalBenchmarkResult: parse } = await import('./benchmark-local-result.ts');
  return parse(JSON.parse(raw));
}

export function saveLocalBenchmark(storage: Storage, result: LocalResult) {
  const { source, generatedAt, packId, suites } = result;
  const raw = JSON.stringify({ source, generatedAt, suites, pack: packId ? { id: packId } : undefined });
  checkSize(raw);
  storage.setItem(LOCAL_BENCHMARK_STORAGE_KEY, raw);
}
