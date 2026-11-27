import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { median } from '../../src/lib/benchmark-compare.mjs';
import { hash } from './web.mjs';

const output = resolve(process.argv[2] ?? 'output/agent-search-01');
const web = resolve(process.argv[3] ?? 'public/benchmarks/agent-search-01');
const load = async path => JSON.parse(await readFile(path, 'utf8'));
const protocolBytes = await readFile(new URL('./protocol.json', import.meta.url));
const protocol = JSON.parse(protocolBytes);
const judgments = await load(new URL('./judgments.json', import.meta.url));
const probes = await load(resolve('output/agent-search-probes/probes.json'));
const managed = await load(new URL('./managed-pilot.json', import.meta.url));
const files = await readdir(output);
const receipts = await Promise.all(files.filter(name => /^(codex|opencode)-.*\.json$/.test(name)).sort()
  .map(name => load(join(output, name))));
const runs = await Promise.all(files.filter(name => /^run.*\.json$/.test(name)).sort()
  .map(name => load(join(output, name))));
if (!runs.length || runs.some(run => run.endingCommit !== protocol.build || run.protocolHash !== hash(protocolBytes))) {
  throw Error('The frozen corpus or protocol changed between runs');
}

const norm = value => {
  try {
    const url = new URL(value);
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch { return ''; }
};
const siteRows = [];
const controls = [];
for (const receipt of receipts) {
  const { id, harness, task, arm, status, answer, startedAt, durationMs, tokens, requests, tools, timedOut, exitCode,
  } = receipt;
  const external = task === protocol.externalTask.id;
  const origin = external ? protocol.controlOrigin : protocol.origin;
  const specification = external ? protocol.externalTask : protocol.tasks.find(item => item.id === task);
  const first = requests.find(request => request.discovered);
  const searches = requests.filter(request => request.isSearch);
  const firstSearch = searches[0];
  const expected = specification.source === '/spin' ? 'https://spin.loftwah.com/' : specification.source && new URL(specification.source, origin).href;
  const normalizedExpected = norm(expected);
  const evidence = new Set(requests.flatMap(request => [
    ...(request.sources ?? []).map(norm),
    ...(request.status === 200 && !request.isSearch ? [norm(request.url)] : []),
  ]));
  const citations = [...new Set((answer.match(/https:\/\/[^\s<>)\],;]+/g) ?? [])
    .map(value => value.replace(/[.!*]+$/, '')).filter(value => !value.includes('/.well-known/search')))];
  const canonicalCitations = citations.filter(value => evidence.has(norm(value)));
  const judgmentId = hash(answer).slice(0, 6);
  const issue = judgments.exceptions[judgmentId] ?? null;
  const hasPriorMetadata = first && firstSearch && first.finishedMs <= firstSearch.requestedMs;
  const row = {
    id, harness, task, arm, status, startedAt, durationMs, timedOut, exitCode,
    answer, tokens, reportedUsd: receipt.costFieldVerified ? receipt.harnessReportedUsd ?? null : null, chargedUsd: null, tools,
    traffic: { requests: requests.length, bytes: requests.reduce((sum, request) => sum + (request.bytes ?? 0), 0),
      searchRequests: searches.length, declinedOrFailedRequests: requests.filter(request => request.status !== 200).length,
      cacheHitRequests: requests.filter(request => request.cacheStatus === 'HIT').length },
    discovery: { metadataExposed: Boolean(first),
      usedAdvertisedEndpoint: arm === 'discovery' && Boolean(hasPriorMetadata),
      timeToSearchMs: hasPriorMetadata ? firstSearch.requestedMs : null },
    score: { judgmentId, factsComplete: external || status !== 'answered' ? null : issue ? false : judgments.accepted.includes(judgmentId) ? true : null, issue,
      unsupported: !specification.source, citations, evidencedCitations: canonicalCitations,
      expectedCitation: Boolean(normalizedExpected && citations.some(value => norm(value) === normalizedExpected)),
      retrievalRecallAt5: !external && specification.source !== '/spin' && normalizedExpected && searches.length
        ? searches.some(request => (request.sources ?? []).slice(0, 5).some(value => norm(value) === normalizedExpected)) : null },
    requests: requests.map(({ location, ...request }) => ({
      ...request, ...(location ? { redirects: true } : {}),
    })),
  };
  (external ? controls : siteRows).push(row);
}
const views = [];
const pairs = [];
for (const harness of Object.keys(protocol.harnesses)) {
  const rows = siteRows.filter(row => row.harness === harness);
  const byArm = Object.fromEntries(protocol.arms.map(arm => [arm, rows.filter(row => row.arm === arm)]));
  for (const [arm, trials] of Object.entries(byArm)) {
    const accepted = trials.filter(row => row.status === 'answered');
    const supported = accepted.filter(row => !row.score.unsupported);
    const unsupported = accepted.filter(row => row.score.unsupported);
    const recall = supported.filter(row => row.score.retrievalRecallAt5 !== null);
    const discovered = accepted.filter(row => row.discovery.usedAdvertisedEndpoint);
    const cited = supported.flatMap(row => row.score.citations);
    views.push({ harness, arm, attempted: trials.length, answered: accepted.length, expected: protocol.tasks.length,
      supported: supported.length, factsComplete: supported.filter(row => row.score.factsComplete).length,
      groundedCorrect: supported.filter(row => row.score.factsComplete && row.score.evidencedCitations.length).length,
      expectedCitation: supported.filter(row => row.score.expectedCitation).length,
      unsupported: unsupported.length, abstained: unsupported.filter(row => row.score.factsComplete).length,
      citationCount: cited.length, evidencedCitationCount: supported.flatMap(row => row.score.evidencedCitations).length,
      discoveryCount: discovered.length, searchUsed: accepted.filter(row => row.traffic.searchRequests > 0).length,
      discoveryMs: median(discovered.map(row => row.discovery.timeToSearchMs)),
      recallAt5: recall.filter(row => row.score.retrievalRecallAt5).length, recallCount: recall.length,
      requestMedian: median(accepted.map(row => row.traffic.requests)),
      requests: accepted.reduce((sum, row) => sum + row.traffic.requests, 0),
      searchRequests: accepted.reduce((sum, row) => sum + row.traffic.searchRequests, 0),
      cacheHits: accepted.reduce((sum, row) => sum + row.traffic.cacheHitRequests, 0),
      bytesMedian: median(accepted.map(row => row.traffic.bytes)),
      durationMs: median(accepted.map(row => row.durationMs)),
      inputMedian: median(accepted.map(row => row.tokens?.input).filter(Number.isFinite)),
      cachedInputMedian: median(accepted.map(row => row.tokens?.cachedInput).filter(Number.isFinite)),
      outputMedian: median(accepted.map(row => row.tokens?.output).filter(Number.isFinite)),
      reportedUsd: accepted.every(row => Number.isFinite(row.reportedUsd)) && accepted.length
        ? accepted.reduce((sum, row) => sum + row.reportedUsd, 0) : null,
      billedUsd: null,
    });
  }
  for (const task of protocol.tasks) {
    const baseline = byArm.navigation.find(row => row.task === task.id && row.status === 'answered');
    if (!baseline) continue;
    for (const arm of ['explicit', 'discovery']) {
      const trial = byArm[arm].find(row => row.task === task.id && row.status === 'answered');
      if (!trial) continue;
      pairs.push({ harness, task: task.id, arm, elapsedMsDelta: trial.durationMs - baseline.durationMs,
        requestsDelta: trial.traffic.requests - baseline.traffic.requests,
        inputTokensDelta: trial.tokens && baseline.tokens ? trial.tokens.input - baseline.tokens.input : null,
        factsCompleteDelta: trial.score.factsComplete === null || baseline.score.factsComplete === null
          ? null : Number(trial.score.factsComplete) - Number(baseline.score.factsComplete) });
    }
  }
}

const corpusReconciliation = {
  opencode: {
    startCheck: 'The runner verified the frozen source before launching the 36 sessions.',
    endCheck: 'The runner timed out on the final build.json request after writing all 36 independent session receipts.',
    corroboration: 'The Codex start and end checks fell in or after the OpenCode window. Cloudflare production deployment history showed the Worker version active from 10:25:22 UTC and its successor deployed at 11:13:18 UTC.',
    workerVersion: 'e6c25f35-399d-467b-a7c8-c75bc31d17ee',
    successorWorkerVersion: 'c9965f7c-bfa4-4bc1-b862-64f3f885e406',
  },
};
const result = { schema: 'app-composer-agent-search-results/1', protocol, protocolHash: hash(protocolBytes),
  generatedAt: new Date().toISOString(), runs, corpusReconciliation, scoring: judgments.method, managed, probes, views, controls, pairs };
const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const csv = ['harness,task,arm,status,seconds,requests,bytes,search_requests,discovered,input_tokens,cached_input_tokens,output_tokens,observed_run_usd,billed_run_usd,facts_complete,expected_citation',
  ...[...siteRows, ...controls].map(row => [row.harness, row.task, row.arm, row.status, row.durationMs / 1000,
    row.traffic.requests, row.traffic.bytes, row.traffic.searchRequests, row.discovery.usedAdvertisedEndpoint,
    row.tokens?.input, row.tokens?.cachedInput, row.tokens?.output, row.reportedUsd, row.chargedUsd, row.score.factsComplete,
    row.score.expectedCitation].map(quote).join(',')),
].join('\n') + '\n';
await mkdir(web, { recursive: true });
await Promise.all([
  writeFile(join(web, 'results.json'), JSON.stringify(result, null, 2) + '\n'),
  writeFile(join(web, 'trials.json'), JSON.stringify(siteRows, null, 2) + '\n'),
  writeFile(join(web, 'trials.csv'), csv),
]);
console.table(views.map(({ harness, arm, answered, factsComplete, abstained, discoveryCount, searchUsed, requestMedian, durationMs,
  inputMedian, outputMedian, reportedUsd }) => ({
  harness, arm, answered, factsComplete, abstained, discoveryCount, searchUsed, requestMedian, durationMs,
  inputMedian, outputMedian, reportedUsd,
})));
