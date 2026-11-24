// VOXEL-FILM-01A: provider-free synthetic fixture checks, NOT a Studio film test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check } from './_checks.mjs';

export const id = 'voxel-film-01';
export const name = 'VOXEL-FILM-01 fictional world contract (provider-free)';
const fixture = JSON.parse(readFileSync(new URL('../fixtures/voxel-film-01.json', import.meta.url), 'utf8'));

function validate(scene) {
  assert.equal(scene.schema, 'voxel-film-01-fixture/v1');
  assert.equal(scene.classification, 'fictional-contract-only');
  assert.match(scene.projectId, /^fictional-/);
  assert.ok(Number.isSafeInteger(scene.seed));
  const { fps, durationSeconds, expectedFrames } = scene.timeline;
  assert.equal(fps, 24);
  assert.equal(durationSeconds, 10);
  assert.equal(expectedFrames, fps * durationSeconds);
  assert.ok(scene.tiles.length >= 5);
  assert.ok(scene.lights.length >= 10);
  const ids = new Set();
  for (const tile of scene.tiles) {
    assert.ok(!ids.has(tile.id), 'duplicate tile ID');
    ids.add(tile.id);
    assert.ok(Number.isFinite(tile.origin.x) && Number.isFinite(tile.origin.z));
  }
  const tiles = [...scene.tiles].sort((a, b) => a.origin.x - b.origin.x);
  for (let i = 1; i < tiles.length; i += 1) {
    assert.equal(tiles[i].origin.z, tiles[0].origin.z, 'tile z mismatch');
    assert.equal(tiles[i].origin.x - tiles[i - 1].origin.x, scene.tileSize.x, 'tile gap or overlap');
  }
  const lightIds = new Set();
  for (const light of scene.lights) {
    assert.ok(!lightIds.has(light.id), 'duplicate light ID');
    lightIds.add(light.id);
    assert.ok(ids.has(light.tileId), 'orphaned light');
    assert.ok(Number.isInteger(light.onFrame) && Number.isInteger(light.offFrame));
    assert.ok(light.onFrame >= 0 && light.onFrame < light.offFrame && light.offFrame < expectedFrames);
  }
  return { tiles: tiles.length, lights: lightIds.size, frames: expectedFrames };
}

function stateAt(scene, frame) {
  if (!Number.isInteger(frame) || frame < 0 || frame >= scene.timeline.expectedFrames) throw new RangeError('frame range');
  return {
    frame, t: frame / scene.timeline.fps,
    lit: scene.lights.filter((x) => frame >= x.onFrame && frame < x.offFrame).map((x) => x.id).sort(),
  };
}

export function run() {
  return [
    check('synthetic-world-contract', 'Fictional tile joins and light identities are checked', () => {
      const x = validate(fixture);
      return x.tiles + ' fictional tiles, ' + x.lights + ' scheduled lights; no actual geometry or GPU rendering.';
    }),
    check('synthetic-frame-seek', 'Frozen light state is independent of frame query order', () => {
      const frames = fixture.probeFrames;
      assert.deepEqual(
        frames.map((f) => stateAt(fixture, f)),
        [...frames].reverse().map((f) => stateAt(fixture, f)).reverse(),
      );
      assert.equal(stateAt(fixture, 0).lit.length, 0);
      assert.ok(stateAt(fixture, 96).lit.length > 0);
      assert.equal(stateAt(fixture, 239).lit.length, 0);
      assert.throws(() => stateAt(fixture, 240), RangeError);
      return 'Synthetic timebase is seekable over 240 declared frames; no frames were rendered.';
    }),
    check('synthetic-invalid-manifests', 'Duplicate IDs, orphaned lights and incorrect joins fail closed', () => {
      const damaged = (fn) => { const x = structuredClone(fixture); fn(x); return x; };
      assert.throws(() => validate(damaged((x) => { x.tiles[1].id = x.tiles[0].id; })), /duplicate tile ID/);
      assert.throws(() => validate(damaged((x) => { x.tiles[1].origin.x = 1; })), /tile gap or overlap/);
      assert.throws(() => validate(damaged((x) => { x.lights[1].id = x.lights[0].id; })), /duplicate light ID/);
      assert.throws(() => validate(damaged((x) => { x.lights[0].tileId = 'unowned'; })), /orphaned light/);
      return 'Four synthetic invalid manifests refused; no tenant isolation or GPU sandbox was exercised.';
    }),
    {
      id: 'studio-film-not-verified',
      name: 'A real editable film and GPU run require separate proof',
      status: 'blocked',
      detail: 'Not run: Studio #532 has not supplied actual agent-authored scene, browser renderer, 240 decoded frames, source reopen, human visual review or cost receipts. Do not count fixture passes as production support.',
    },
  ];
}
