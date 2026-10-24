#!/usr/bin/env node
// Code-native sharing layouts composed from approved identity and real captures.
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { discoveryRoles } from '../src/lib/role-discovery.ts';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const escape = (text) => text.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
const audiences = { creator: 'creators', 'small-business': 'small business owners', developer: 'developers and AI builders', designer: 'designers and agencies' };
const headlines = {
  creator: ['Give your work', 'a place to live.'],
  'small-business': ['Publish the page.', 'Keep up with', 'the work.'],
  developer: ['An idea.', 'A working app.', 'Your source.'],
  designer: ['Make the identity', 'work in the', 'finished product.'],
};
const temporary = await mkdtemp(join(tmpdir(), 'composer-role-assets-'));
try {
  await initWasm(await readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  const font = await readFile(join(root, 'src/assets/fonts/SpaceGrotesk.ttf.bin'));
  const mark = await readFile(join(root, 'public/brand/composer-icon-20261022b-96.png'));
  await mkdir(join(root, 'public/discovery'), { recursive: true });
  const provenance = [];
  for (const role of discoveryRoles) {
    const source = join(root, 'public', role.example.image);
    const original = await readFile(source);
    let screenshot = original;
    if (!role.example.image.endsWith('.png')) {
      const converted = join(temporary, role.id + '.png');
      execFileSync('/usr/bin/sips', ['-s', 'format', 'png', source, '--out', converted], { stdio: 'ignore' });
      screenshot = await readFile(converted);
    }
    const lines = headlines[role.id].map((line, index) => `<text x="48" y="${250 + index * 65}" font-size="${role.id === 'designer' ? 50 : 54}" font-weight="600">${escape(line)}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#17181b"/><rect width="570" height="630" fill="#fc5b05"/><image x="48" y="42" width="72" height="72" href="data:image/png;base64,${mark.toString('base64')}"/><g fill="#17181b" font-family="Space Grotesk"><text x="138" y="86" font-size="28" font-weight="600">App Composer</text><text x="48" y="164" font-size="25">For ${escape(audiences[role.id])}</text>${lines}<text x="48" y="568" font-size="23">composer.loftwah.com/for/${role.id}</text></g><rect x="602" y="48" width="566" height="437" fill="#23252a"/><image x="610" y="56" width="550" height="421" preserveAspectRatio="xMidYMin meet" href="data:image/png;base64,${screenshot.toString('base64')}"/><g fill="#f2f3f5" font-family="Space Grotesk"><text x="610" y="528" font-size="23" font-weight="500">${escape(role.example.title)}</text><text x="610" y="566" font-size="18" fill="#afb3bb">Actual capture · ${role.example.captured}</text></g></svg>`;
    const renderer = new Resvg(svg, { font: { fontBuffers: [font], defaultFontFamily: 'Space Grotesk' } });
    let png;
    try { const image = renderer.render(); try { png = image.asPng(); } finally { image.free(); } } finally { renderer.free(); }
    await writeFile(join(root, 'public', role.share), png);
    provenance.push({ role: role.id, image: role.share, sha256: sha(png), width: 1200, height: 630, capture: { source: role.example.image, sha256: sha(original), captured: role.example.captured, origin: role.example.origin }, scope: 'Flat code-native sharing layout using the existing actual capture; no generated product screen.' });
  }
  await writeFile(join(root, 'public/discovery/provenance-20261024.json'), JSON.stringify({ version: 1, assets: provenance }, null, 2) + '\n');
  console.log(`Composed ${provenance.length} role sharing images from existing captures.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
