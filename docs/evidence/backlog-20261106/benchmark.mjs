// Reproducible benchmark for the #407 record. Run from the repository root:
//   node docs/evidence/backlog-20261106/benchmark.mjs
// It stubs the three independent D1 reads in readResourceInventory with a fixed
// latency, so the async waterfall is measurable without production data.
import {readResourceInventory} from '../../../src/lib/resource-inventory.ts';

const LATENCY_MS = 40;
const reads = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fakeDb() {
  return {
    prepare(sql) {
      const statement = {
        bind() { return statement; },
        async all() {
          reads.push(sql.split(/\s+/).slice(0, 4).join(' '));
          await sleep(LATENCY_MS);
          return {results: []};
        },
      };
      return statement;
    },
  };
}

const samples = [];
for (let run = 0; run < 5; run++) {
  reads.length = 0;
  const start = performance.now();
  const result = await readResourceInventory(fakeDb(), {
    workspace: {id: 'fictional-workspace', name: 'Fictional workspace'},
    account: 'fictional-account',
    environment: 'production',
    installedSource: null,
    now: Date.now(),
  });
  const elapsed = performance.now() - start;
  if (result.resources.length !== 0 || reads.length !== 3)
    throw new Error('Unexpected benchmark shape');
  samples.push(elapsed);
}
samples.sort((a, b) => a - b);
console.log(JSON.stringify({
  read: 'readResourceInventory',
  latencyPerReadMs: LATENCY_MS,
  independentReads: 3,
  samplesMs: samples.map(value => Number(value.toFixed(1))),
  medianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(1)),
}, null, 2));
