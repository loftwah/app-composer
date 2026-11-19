import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("Cloudflare real-product profiles extend the existing six-journey benchmark without claiming results", async () => {
  const [campaign, extension] = await Promise.all([
    readJson("../benchmarks/cloudflare-composition/cases/scenarios.json"),
    readJson("../benchmarks/cloudflare-composition/cases/real-product-profiles.json"),
  ]);

  assert.equal(campaign.schema, "cloudflare-creation/v1");
  assert.equal(extension.schema, "cloudflare-outcome-profiles/v1");
  assert.equal(extension.parentCampaign, "benchmarks/cloudflare-composition/cases/scenarios.json");
  assert.equal(extension.evaluationOwner, "https://github.com/loftwah/app-composer/issues/601");
  assert.equal(campaign.cases.length, 6, "the required campaign denominator must remain six");
  assert.deepEqual(
    campaign.coveragePolicy.requiredCaseIds,
    campaign.cases.map(({ id }) => id),
    "original required cases should remain the canonical six",
  );
  assert.ok(extension.profiles.length >= 9);
  assert.equal(extension.status, "definitions-only; all profiles not-run");

  const existing = new Set(campaign.cases.map(({ id }) => id));
  const profileIds = new Set();
  for (const profile of extension.profiles) {
    assert.match(profile.id, /^CF-R\d{2}$/);
    assert.ok(!profileIds.has(profile.id), "profile ids must be unique");
    profileIds.add(profile.id);
    assert.equal(profile.required, false, "follow-on profiles do not silently alter the six-journey denominator");
    assert.equal(profile.status, "not-run", "no unexecuted provider/agent/browser trial may claim a pass");
    assert.deepEqual(profile.evidenceRecorded, [], "no invented test evidence");
    assert.ok(profile.relatedJourneys.length > 0);
    assert.ok(profile.relatedJourneys.every((id) => existing.has(id)));
    assert.ok(profile.wishlistRefs.length > 0);
    assert.ok(profile.product && profile.outcome && profile.baseline && profile.positiveControl);
    assert.ok(profile.prerequisites.length >= 2);
    assert.ok(profile.steps.length >= 3);
    assert.ok(profile.negativeCases.length >= 2);
    assert.ok(profile.metrics.length >= 3);
    assert.ok(profile.evidence.length >= 2);
    assert.ok(profile.owners.length >= 1);
    for (const negative of profile.negativeCases) {
      assert.ok(negative.id && negative.scenario && negative.expected);
    }
    for (const metric of profile.metrics) {
      assert.equal(metric.missing, "null-with-reason");
      assert.ok(metric.id && metric.unit);
    }
  }

  const declared = new Set(extension.capabilityCatalogue.map(({ id }) => id));
  assert.equal(declared.size, 31);
  for (let n = 1; n <= 13; n++) assert.ok(declared.has(`MCP-${String(n).padStart(2, "0")}`));
  for (let n = 1; n <= 18; n++) assert.ok(declared.has(`PLATFORM-${String(n).padStart(2, "0")}`));
  const tested = new Set(extension.profiles.flatMap(({ wishlistRefs }) => wishlistRefs));
  assert.deepEqual([...tested].sort(), [...declared].sort(), "every MCP and wider-platform wishlist theme needs an actual evaluation profile");
});

test("Cloudflare campaign is discoverable from the existing Benchmarks Studio and doesn't publish fabricated passes", async () => {
  const landing = await readFile(new URL("../src/pages/benchmarks.astro", import.meta.url), "utf8");
  assert.match(landing, /import cloudflareCampaign from/);
  assert.match(landing, /import cloudflareProfiles from/);
  assert.match(landing, /cloudflareCampaign\.cases\.map/);
  assert.match(landing, /cloudflareProfiles\.profiles\.map/);
  assert.match(landing, /not claims that Cloudflare or App Composer has passed the journeys/);
  assert.match(landing, /CF-COMPOSE-01/);
});
