import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  discoveryHubDescription,
  discoveryJob,
  discoveryJobForRole,
  discoveryJobIds,
  discoveryJobPath,
  discoveryJobs,
  discoveryRoles,
} from '../src/lib/role-discovery.ts';
import { publicPagePaths } from '../src/lib/public-pages.mjs';
import { sitemapPaths } from '../src/lib/sitemap.mjs';

test('every job has one canonical, indexable route instead of an unused query', () => {
  assert.deepEqual(discoveryJobs.map((job) => job.id), [...discoveryJobIds]);
  assert.equal(new Set(discoveryJobs.map((job) => job.id)).size, discoveryJobs.length);
  const indexable = sitemapPaths([]);
  for (const job of discoveryJobs) {
    const path = discoveryJobPath(job.id);
    assert.ok(publicPagePaths.includes(path), `${path} must be an indexable public page`);
    assert.ok(indexable.includes(path), `${path} must appear in the sitemap`);
    assert.equal(discoveryJob(job.id), job);
    assert.ok(!job.action.href.includes('?job='), `${job.id} still points at the unused query`);
    assert.ok(!job.example.href.includes('?job='), `${job.id} example still points at the unused query`);
  }
  assert.equal(discoveryJob('not-a-job'), undefined);
});

test('every job leads with a plain outcome, one real example and one working action', () => {
  for (const job of discoveryJobs) {
    assert.ok(job.label.length > 3, `${job.id} needs a menu label`);
    assert.ok(job.title.length > 8, `${job.id} needs a page title`);
    assert.ok(job.headline.length > 12, `${job.id} needs a plain-language outcome`);
    assert.ok(job.outcome.length > 40, `${job.id} needs an explanatory outcome`);
    assert.ok(job.description.length > 40, `${job.id} needs metadata`);
    assert.ok(job.action.label.length > 3 && job.action.href, `${job.id} needs one action`);
    assert.match(job.action.href, /^(https:\/\/|\/)/, `${job.id} action must be a real destination`);
    assert.ok(job.example.title && job.example.description, `${job.id} needs an example`);
    assert.ok(job.example.href, `${job.id} example needs a destination`);
    assert.ok(job.example.alt.length > 20, `${job.id} example needs useful alt text`);
    assert.ok(existsSync(new URL('../public' + job.example.image, import.meta.url)), `${job.id} example capture is missing`);
    assert.ok(existsSync(new URL('../public' + job.share, import.meta.url)), `${job.id} share image is missing`);
    assert.ok(job.support.length > 40, `${job.id} needs an honest support note`);
  }
});

test('each job names real related roles and an existing app', () => {
  const roleIds = new Set(discoveryRoles.map((role) => role.id));
  for (const job of discoveryJobs) {
    assert.ok(job.relatedRoles.length > 0, `${job.id} needs related role context`);
    for (const roleId of job.relatedRoles) assert.ok(roleIds.has(roleId), `${job.id} names an unknown role`);
    assert.ok(job.roleNote.length > 8, `${job.id} needs role context`);
    assert.ok(['paperwork', 'launch-kit', 'ldraw', 'linkcheck', 'guestbook', 'showcase', 'hello'].includes(job.app));
  }
});

test('role-linked jobs reuse the role example and an existing role action', () => {
  for (const job of discoveryJobs.filter((entry) => entry.relatedRoles.length === 1)) {
    const role = discoveryRoles.find((entry) => entry.id === job.relatedRoles[0]);
    assert.ok(role, `${job.id} must map to one role`);
    assert.equal(job.example.href, role.example.href, `${job.id} must reuse the role example`);
    assert.equal(job.example.image, role.example.image, `${job.id} must reuse the role capture`);
    const roleHrefs = [role.primary.href, role.start.href, ...role.steps.map((step) => step.href)];
    assert.ok(roleHrefs.includes(job.action.href), `${job.id} must reuse an existing role action`);
    assert.equal(job.support, role.support, `${job.id} must reuse the role support note`);
  }
});

test('legacy role job links resolve to the canonical job route, never a role-only page', () => {
  assert.equal(discoveryJobForRole('creator', 'profile')?.id, 'profile');
  assert.equal(discoveryJobForRole('small-business', 'enquiries')?.id, 'enquiries');
  assert.equal(discoveryJobForRole('developer', 'first-app')?.id, 'first-app');
  assert.equal(discoveryJobForRole('designer', 'branding')?.id, 'branding');
  assert.equal(discoveryJobForRole('creator', 'pdf'), undefined);
  assert.equal(discoveryJobForRole('not-a-role', 'profile'), undefined);
  assert.equal(discoveryJobForRole('creator', 'not-a-job'), undefined);
});

test('the hub names all seven roles and all seven jobs', () => {
  for (const role of discoveryRoles) assert.ok(discoveryHubDescription.includes(role.label), `hub metadata must name ${role.label}`);
  for (const job of discoveryJobs) assert.ok(discoveryHubDescription.includes(job.label), `hub metadata must name ${job.label}`);
  assert.equal(discoveryRoles.length, 7);
  assert.equal(discoveryJobs.length, 7);
});
