import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { resources, renderResource, resourceVersion } from '../src/lib/resource-library.ts';
import { renderPrompt } from '../src/lib/prompt-library.ts';
import { packageResources } from '../scripts/package-resources.mjs';

test('resource selection anchors land on the named runbook heading before its download action', () => {
  const component = readFileSync('src/components/ResourceDesk.astro', 'utf8');
  const target = component.match(/<([a-z][\w-]*)\b([^>]*\bid="resource"[^>]*)>/);
  assert.ok(target, 'existing selected-resource fragments keep their destination');
  assert.equal(target[1], 'h2', 'selection targets the runbook heading');
  assert.match(target[2], /\btabindex="-1"/, 'the native fragment target accepts focus without adding a Tab stop');
  assert.match(component, /<section\b[^>]*class="resource-detail"[^>]*aria-labelledby="resource"/);
  const afterHeading = component.slice(target.index + target[0].length);
  const nextControl = afterHeading.match(/<(?:a|button|input|select|textarea|summary)\b[^>]*>/)?.[0];
  assert.match(nextControl ?? '', /^<a\b[^>]*href=\{download\}[^>]*\bdownload(?:\s|>)/, 'the next native Tab destination downloads the selected runbook');
  assert.ok(component.includes('href={`/resources/${resource.id}#resource`}'), 'selection remains an ordinary resource URL without JavaScript');
});

test('resource downloads embed the same complete maintained prompt and specific continuation', () => {
  for (const item of resources) {
    const text = renderResource(item.id);
    assert.ok(text.includes(renderPrompt(item.id, {}, { template: true }).text));
    assert.ok(text.includes(item.recovery));
    assert.ok(text.includes(resourceVersion));
    assert.equal(readFileSync(`public/resources/v1/${item.id}.md`, 'utf8'), text);
    for (const file of item.files) assert.ok(readFileSync(`public/resources/v1/${file}`).length > 40);
  }
  assert.throws(() => renderResource('__proto__'), /Unknown resource/);
  assert.throws(() => renderResource('../private'), /Unknown resource/);
});

test('the real starter ZIP is deterministic, complete and runnable after extraction', () => {
  const before = readFileSync('public/resources/v1/starter-kit.zip');
  const metadata = packageResources();
  const archive = readFileSync('public/resources/v1/starter-kit.zip');
  assert.deepEqual(archive, before);
  assert.equal(metadata.sha256, createHash('sha256').update(archive).digest('hex'));
  const members = new Map();
  for (let position = 0; archive.readUInt32LE(position) === 0x04034b50;) {
    const method = archive.readUInt16LE(position + 8);
    const size = archive.readUInt32LE(position + 18);
    const nameLength = archive.readUInt16LE(position + 26);
    const extraLength = archive.readUInt16LE(position + 28);
    const name = archive.subarray(position + 30, position + 30 + nameLength).toString();
    const start = position + 30 + nameLength + extraLength;
    const data = archive.subarray(start, start + size);
    assert.doesNotMatch(name, /(^\/|\.\.|\\)/);
    assert.ok(!members.has(name));
    members.set(name, method === 8 ? inflateRawSync(data) : data);
    position = start + size;
  }
  assert.equal(members.size, metadata.files.length);
  for (const file of metadata.files) {
    assert.equal(createHash('sha256').update(members.get(file.name)).digest('hex'), file.sha256);
  }
  assert.equal(members.get('operating-cheatsheet.pdf').subarray(0, 5).toString(), '%PDF-');
  for (const item of resources) assert.equal(members.get(`${item.id}.md`).toString(), renderResource(item.id));
  const temporary = mkdtempSync(join(tmpdir(), 'composer-kit-test-'));
  try {
    execFileSync('unzip', ['-q', resolve('public/resources/v1/starter-kit.zip'), '-d', temporary]);
    const result = JSON.parse(execFileSync(process.execPath, [join(temporary, 'examples/exercise.mjs')], { encoding: 'utf8' }));
    assert.equal(result.passed, true);
    assert.equal(result.scope, 'fictional local fixtures only');
    assert.ok(result.checks.includes('uncertain effect is not replayed'));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
