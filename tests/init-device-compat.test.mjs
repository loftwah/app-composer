import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { validateSpec, presets } from '../src/lib/spec.mjs';
import { selectedSources } from '../src/lib/app-settings.mjs';

// Exercise the actual Init fill -> read roundtrip with native select semantics.
// A select assigned an absent option becomes empty; it cannot invent a fallback.
const source = readFileSync(new URL('../src/lib/init-client.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('init-client.ts', source, ts.ScriptTarget.Latest, true);
const functions = parsed.statements.filter((statement) => ts.isFunctionDeclaration(statement) && ['fill', 'read', 'value'].includes(statement.name?.text)).map((statement) => statement.getFullText(parsed)).join('\n');
const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;

function roundtrip(input) {
  const controls = new Map();
  const device = {
    current: 'unknown',
    set value(value) { this.current = ['unknown', 'desktop', 'mobile', 'both'].includes(value) ? value : ''; },
    get value() { return this.current; },
  };
  const form = {
    elements: { namedItem(name) { if (name === 'deviceTarget') return device; if (!controls.has(name)) controls.set(name, { value: '' }); return controls.get(name); } },
    querySelector() { return null; },
  };
  const document = {
    querySelector(selector) { assert.equal(selector, '#card-rows'); return { replaceChildren() {} }; },
    querySelectorAll(selector) { assert.equal(selector, '.repeat-row'); return []; },
  };
  const execute = new Function('validateSpec', 'presets', 'selectedSources', 'form', 'document', 'input', `let displayedPreset,decisions={}; const specVersion=2,appSettings={}; function show(){read();} ${compiled}; fill(input); return {spec:read(),device:form.elements.namedItem('deviceTarget').value};`);
  return execute(validateSpec, presets, selectedSources, form, document, input);
}
const legacy = () => ({ version: 1, preset: 'composition', config: { title: 'Fictional saved owner draft', intro: 'Keep the existing work', theme: 'daylight', layout: 'grid' }, privacy: 'review-first', cards: [], deployment: { mode: 'preview' }, decisions: {} });

test('legacy version 1 and version 2 drafts reopen with a valid undecided device selection', () => {
  for (const input of [legacy(), validateSpec(legacy())]) {
    const original = JSON.stringify(input);
    assert.equal(Object.hasOwn(input, 'deviceTarget'), false);
    const restored = roundtrip(input);
    assert.equal(restored.device, 'unknown');
    assert.equal(restored.spec.deviceTarget, 'unknown');
    assert.equal(restored.spec.config.title, input.config.title);
    assert.equal(restored.spec.config.intro, input.config.intro);
    assert.equal(JSON.stringify(input), original, 'opening a form must not mutate the imported/persisted specification');
  }
});

test('explicit saved device targets survive the same actual form roundtrip', () => {
  for (const deviceTarget of ['unknown', 'desktop', 'mobile', 'both']) {
    const restored = roundtrip({ ...legacy(), deviceTarget });
    assert.equal(restored.device, deviceTarget);
    assert.equal(restored.spec.deviceTarget, deviceTarget);
  }
});
