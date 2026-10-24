import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { discoveryRoles, discoveryJobs, discoveryRole, discoveryRoleIds } from '../src/lib/role-discovery.ts';

const root = new URL('../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('four role paths point to existing working examples and supported start journeys', () => {
  assert.deepEqual(discoveryRoles.map((role) => role.id), discoveryRoleIds);
  for (const role of discoveryRoles) {
    assert.equal(discoveryRole(role.id), role);
    assert.ok(role.headline && role.description && role.support);
    assert.equal(role.steps.length, 3);
    for (const url of [role.example.href, role.primary.href, role.start.href, ...role.steps.map((step) => step.href)]) {
      const target = new URL(url, 'https://composer.loftwah.com');
      assert.equal(target.protocol, 'https:');
      assert.ok(!target.username && !target.password);
      if (target.hostname === 'composer.loftwah.com' && !target.pathname.startsWith('/s/') && !['/showcase/', '/guestbook/'].includes(target.pathname)) {
        const route = target.pathname === '/' ? 'index' : target.pathname.slice(1);
        assert.ok(existsSync(new URL(`src/pages/${route}.astro`, root)), `Missing route ${url}`);
      }
    }
    assert.ok(existsSync(new URL('public' + role.example.image, root)));
    assert.match(role.example.captured, /^2026-\d{2}-\d{2}$/);
  }
  for (const id of [null, {}, '__proto__', 'constructor', 'creator/../../admin', 'future-role']) assert.equal(discoveryRole(id), undefined);
});

test('task entry is one choice to a focused role or directly to a working tool', () => {
  for (const job of discoveryJobs) {
    if (job.role) {
      assert.ok(discoveryRole(job.role));
      assert.equal(new URL(job.href, 'https://composer.loftwah.com').pathname, '/for/' + job.role);
    } else assert.match(job.href, /^https:\/\/(paperwork|share|ldraw)\.loftwah\.com$/);
  }
});

test('provider and admission gaps remain explicit before a visitor starts', () => {
  assert.match(discoveryRole('small-business').support, /Email notifications, replies and delivery are not yet supported/);
  assert.match(discoveryRole('small-business').support, /fictional/);
  assert.match(discoveryRole('creator').support, /existing invitation and permissions/);
  assert.match(discoveryRole('developer').support, /Codex on an Apple Silicon Mac with Node 22/);
  assert.match(discoveryRole('designer').support, /does not publish a client site/);
});

test('role share images retain real-capture provenance and exact 1200x630 PNG bytes', () => {
  const provenance = JSON.parse(readFileSync(new URL('public/discovery/provenance-20261024.json', root)));
  assert.equal(provenance.assets.length, 4);
  for (const role of discoveryRoles) {
    const asset = provenance.assets.find((entry) => entry.role === role.id);
    const png = readFileSync(new URL('public' + role.share, root));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert.equal(asset.sha256, sha(png));
    assert.equal(asset.capture.sha256, sha(readFileSync(new URL('public' + role.example.image, root))));
    assert.equal(asset.capture.origin, role.example.origin);
    assert.equal(asset.capture.captured, role.example.captured);
  }
});

test('role hub preserves shipped tools behind a finite disclosure and uses native links', () => {
  const hub = readFileSync(new URL('src/pages/discover.astro', root), 'utf8');
  const component = readFileSync(new URL('src/components/RoleDiscovery.astro', root), 'utf8');
  const route = readFileSync(new URL('src/pages/for/[role].astro', root), 'utf8');
  assert.match(hub, /<details class="more-tools">/);
  assert.match(hub, /<DiscoverWork/);
  assert.match(component, /aria-current=/);
  assert.match(component, /<DeviceSupport/);
  assert.match(route, /Astro.response.status = 404/);
  assert.doesNotMatch(component, /setInterval|scroll-snap|addEventListener\(['"]wheel/);
});
