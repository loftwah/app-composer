import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = ts.createSourceFile('launcher.ts', read('src/browser/launcher.ts'), ts.ScriptTarget.Latest, true);
function registrations(name) {
  let result;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      result = node.initializer.elements.map(element => Object.fromEntries(element.properties.map(property => {
        assert(ts.isPropertyAssignment(property));
        const value = property.initializer;
        assert(ts.isStringLiteral(value) || value.kind === ts.SyntaxKind.TrueKeyword);
        return [property.name.getText(source), ts.isStringLiteral(value) ? value.text : true];
      })));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert(result, `Missing ${name} registrations`);
  return result;
}
const catalogue = [...read('src/lib/apps.ts').matchAll(/\{id:'([^']+)',name:'([^']+)'/g)].map(([,id,name]) => ({id,name}));

test('every shipped mini-app is registered once in Apps and never as a studio task', () => {
  const apps = registrations('apps'), tasks = registrations('tasks');
  assert.equal(new Set(apps.map(app => app.name)).size, apps.length);
  assert.deepEqual(apps.map(app => app.name).sort(), catalogue.map(app => app.name).sort());
  assert(!tasks.some(task => catalogue.some(app => app.name === task.name)));
});

test('the two standalone editors open their actual app origins', () => {
  const apps = registrations('apps');
  for (const name of ['Launch Kit', 'Paperwork']) {
    const app = apps.find(app => app.name === name);
    assert.equal(app.standaloneOnly, true);
    const line = read('src/lib/apps.ts').split('\n').find(line => line.includes(`name:'${name}'`));
    assert.equal(app.href, new URL(line.match(/standalone:'([^']+)'/)[1]).href);
  }
});
