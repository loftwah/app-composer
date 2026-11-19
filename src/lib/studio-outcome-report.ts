const metricUnits = new Map([
  ['saved_provider_outputs', 'saved_outputs'],
  ['saved_local_exports', 'saved_exports'],
  ['publication_published', 'publication_transitions'],
  ['publication_unlisted', 'publication_transitions'],
  ['publication_withdrawn', 'publication_transitions'],
]);

export type StudioOutcomeReport = {
  fromInclusive: string;
  toExclusive: string;
  generatedAt: string;
  revision: string;
  metrics: {
    key: string;
    label: string;
    unit: string;
    value: number | null;
    status: 'partial' | 'unavailable';
    coverage: string;
    evidenceLevel: string;
  }[];
};

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const bounded = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max && value.trim().length > 0;
const utcDay = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const utcInstant = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function parseStudioOutcomeReport(input: unknown): StudioOutcomeReport | null {
  if (!object(input) || input.format !== 'media-studio.creator-outcomes/v1' ||
      input.schemaVersion !== 1 || !utcInstant(input.generatedAt) ||
      !object(input.window) || input.window.timezone !== 'UTC' ||
      !object(input.source) || typeof input.source.revision !== 'string' ||
      !/^[a-f0-9]{40}$/.test(input.source.revision) || input.source.revision.length !== 40 ||
      !Array.isArray(input.metrics) || input.metrics.length !== metricUnits.size) return null;

  const { fromInclusive, toExclusive } = input.window;
  if (!utcDay(fromInclusive) || !utcDay(toExclusive) ||
      toExclusive > input.generatedAt.slice(0, 10)) return null;
  const days = (Date.parse(toExclusive) - Date.parse(fromInclusive)) / 86_400_000;
  if (days < 1 || days > 30) return null;

  const seen = new Set<string>();
  const metrics: StudioOutcomeReport['metrics'] = [];
  for (const metric of input.metrics) {
    if (!object(metric)) return null;
    const { key, label, unit, status, value, coverage, evidenceLevel } = metric;
    if (typeof key !== 'string' || seen.has(key) || typeof unit !== 'string' ||
        metricUnits.get(key) !== unit || metric.definitionVersion !== 1 ||
        !bounded(label, 160) || !bounded(coverage, 1200) || !bounded(evidenceLevel, 180)) return null;
    if (status !== 'partial' && status !== 'unavailable') return null;
    if (status === 'unavailable' ? value !== null :
        typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return null;
    seen.add(key);
    metrics.push({ key, label, unit, status, value: value as number | null, coverage, evidenceLevel });
  }
  return { fromInclusive, toExclusive, generatedAt: input.generatedAt, revision: input.source.revision, metrics };
}
