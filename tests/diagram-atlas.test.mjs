import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { diagramAtlas, diagramByName } from '../src/lib/diagram-atlas.ts';
import { publicPagePaths } from '../src/lib/public-pages.mjs';

const root = new URL('../public/diagrams/ldraw/', import.meta.url);

test('the atlas publishes three native editable scenes with real rendered exports', async () => {
  assert.equal(diagramAtlas.length, 3);
  assert.ok(publicPagePaths.includes('/diagrams'));
  for (const diagram of diagramAtlas) {
    const scene = JSON.parse(await readFile(new URL(diagram.name + '.excalidraw', root), 'utf8'));
    assert.equal(scene.type, 'excalidraw');
    assert.equal(scene.version, 2);
    assert.ok(scene.elements.length >= 20, diagram.name + ' has real content');
    const ids = scene.elements.map((element) => element.id);
    assert.equal(new Set(ids).size, ids.length, diagram.name + ' has unique element IDs');
    assert.ok(scene.elements.some((element) => element.type === 'text'));
    assert.ok(scene.elements.some((element) => element.type === 'arrow' || element.type === 'line'));
    assert.equal(scene.files && Object.keys(scene.files).length, 0, diagram.name + ' needs no remote images');
    const svg = await readFile(new URL(diagram.name + '.svg', root), 'utf8');
    assert.match(svg, /^<svg/);
    assert.ok(svg.includes('<text'), diagram.name + ' SVG keeps real text');
    assert.doesNotMatch(svg, /<image[^>]+href="https?:/, diagram.name + ' SVG has no remote image');
    assert.doesNotMatch(svg, /url\(["']?https?:/, diagram.name + ' SVG has no remote asset dependency');
    const png = await readFile(new URL(diagram.name + '.png', root));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok((await stat(new URL(diagram.name + '.png', root))).size > 10000);
  }
});

test('the atlas summary, alt text and text equivalents name the claim, not decoration', () => {
  const lifecycle = diagramByName('get-ready-lifecycle');
  assert.match(lifecycle.alt, /Get Ready/);
  assert.match(lifecycle.alt, /EmDash/);
  assert.equal(lifecycle.steps.length, 4);
  const agent = diagramByName('agent-approval-boundary');
  assert.match(agent.alt, /human/i);
  assert.match(agent.alt, /cannot approve, deploy, merge, spend, read secrets or change access/);
  const cloudflare = diagramByName('cloudflare-isolation');
  assert.match(cloudflare.alt, /Preview/);
  assert.match(cloudflare.caption, /fails closed/);
  assert.throws(() => diagramByName('constructor'), /Unknown diagram/);
});

test('the atlas page and contextual pages link to editable source and downloads', async () => {
  const page = await readFile(new URL('../src/pages/diagrams.astro', import.meta.url), 'utf8');
  assert.match(page, /Diagram atlas/);
  assert.match(page, /downloaded|Download/i);
  const figure = await readFile(new URL('../src/components/DiagramFigure.astro', import.meta.url), 'utf8');
  assert.match(figure, /Download editable scene/);
  assert.match(figure, /Read this diagram as text/);
  assert.match(figure, /\.svg/);
  assert.match(figure, /\.png/);
  for (const file of ['ready', 'architecture']) {
    const source = await readFile(new URL(`../src/pages/${file}.astro`, import.meta.url), 'utf8');
    assert.match(source, /DiagramFigure/, file + ' embeds a contextual diagram');
  }
});
