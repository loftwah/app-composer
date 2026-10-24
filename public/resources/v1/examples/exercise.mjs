import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pipeline } from './guarded-pipeline.mjs';
import { acceptEvent } from './event-handler.mjs';
import { syntheticIncident } from './synthetic-incident.mjs';

let publications = 0;
const failed = await pipeline({ check: async () => false, review: async () => true,
  publish: async () => { publications++; return true; }, verify: async () => true });
assert.equal(failed.stage, 'check'); assert.equal(publications, 0);
const success = await pipeline({ check: async () => true, review: async () => true,
  publish: async () => { publications++; return true; }, verify: async () => true });
assert.equal(success.state, 'verified'); assert.equal(publications, 1);
const missing = await pipeline({ check: async () => true, review: async () => true,
  publish: async () => { throw Error('Missing access'); }, verify: async () => true });
assert.equal(missing.state, 'needs-attention'); assert.match(missing.next, /Reconcile/);

const event = JSON.parse(await readFile(new URL('./enquiry.json', import.meta.url), 'utf8'));
let effects = 0;
const context = { authenticated: true, workspace: event.workspace, environment: event.environment,
  store: new Map(), effect: async () => { effects++; } };
await acceptEvent(event, context); await acceptEvent(event, context);
assert.equal(effects, 1);
await assert.rejects(acceptEvent(event, { ...context, authenticated: false }), /Authentication/);
await assert.rejects(acceptEvent({ ...event, workspace: 'other' }, context), /target/);
await assert.rejects(acceptEvent({ ...event, message: 42 }, context), /target/);
const beforeInvalidScope = effects;
for (const value of [undefined, '', null, 42, '../another-workspace']) {
  await assert.rejects(acceptEvent({ ...event, workspace: value }, { ...context, workspace: value }), /workspace and environment/);
  await assert.rejects(acceptEvent({ ...event, environment: value }, { ...context, environment: value }), /workspace and environment/);
}
assert.equal(effects, beforeInvalidScope); // Missing values never match by accident.
const uncertainContext = { ...context, store: new Map(), effect: async () => { effects++; throw Error('Unknown completion'); } };
assert.equal((await acceptEvent(event, uncertainContext)).state, 'uncertain');
await acceptEvent(event, uncertainContext); assert.equal(effects, 2);
assert.equal(syntheticIncident().recovered, false);
assert.equal(syntheticIncident({ responseAuthorised: true }).recovered, true);
console.log(JSON.stringify({ scope: 'fictional local fixtures only', checks: ['failed check blocks publication', 'successful ordered stages', 'missing access preserves stage', 'duplicate event has one effect', 'authentication and scope rejection', 'uncertain effect is not replayed', 'incident authority and recovery'], passed: true }, null, 2));
