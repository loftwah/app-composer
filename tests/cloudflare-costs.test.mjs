import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicPagePaths } from "../src/lib/public-pages.mjs";

const page = readFileSync("src/pages/cloudflare.astro", "utf8");
const brief = readFileSync(
  "docs/evidence/cloudflare-comparison-20261122/README.md",
  "utf8",
);

test("the Cloudflare cost page has one public route and attribution-safe claims", () => {
  assert.ok(publicPagePaths.includes("/cloudflare"));
  assert.match(page, /Baselime/);
  assert.match(page, /83\.25% lower/);
  assert.match(page, /1 − \$325 ÷ \$1,940/);
  assert.match(page, /an App\s+Composer result/);
  assert.match(page, /not a\s+Cloudflare partnership, endorsement or official integration/);
  assert.match(
    page,
    /https:\/\/blog\.cloudflare\.com\/80-percent-lower-cloud-cost-how-baselime-moved-from-aws-to-cloudflare\//,
  );
  assert.match(page, /Do not read this as “83% cheaper with App Composer”/);
});

test("the historical estimate is not presented as a measurement or a benchmark", () => {
  assert.match(page, /Cloudflare’s historical Baselime migration estimate\./);
  assert.doesNotMatch(page, /What Cloudflare measured at another company/);
  assert.match(page, /AWS before \(reported\)/);
  assert.match(page, /Cloudflare after \(modelled\)/);
  assert.match(page, /does not isolate provider pricing from the rewrite/);
  assert.match(page, /not run<\/strong>/);
});

test("the page answers the architecture-versus-provider objection", () => {
  assert.match(page, /Did Cloudflare save the money, or did the redesign\?/);
  assert.match(page, /Why not just optimise AWS\?/);
  assert.match(page, /Is the 2024 example still relevant\?/);
  assert.match(page, /Is the functionality equivalent\?/);
  assert.match(page, /What does the estimate leave out\?/);
  assert.match(page, /When should you stay where you are\?/);
  assert.match(page, /active\s+CPU time/);
  assert.match(page, /wall-clock duration/);
  assert.match(page, /three months of\s+retention/);
  assert.match(page, /spending limit can stop new\s+invocations across every Worker/);
  assert.match(page, /prospective\s+rates it is not currently billing/);
  assert.match(page, /docs\/evidence\/cloudflare-comparison-20261122/);
});

test("the comparison brief records the primary sources and their status", () => {
  for (const url of [
    "https://blog.cloudflare.com/80-percent-lower-cloud-cost-how-baselime-moved-from-aws-to-cloudflare/",
    "https://aws.amazon.com/lambda/pricing/",
    "https://aws.amazon.com/lambda/lambda-web-functions/",
    "https://developers.cloudflare.com/workers/platform/pricing/",
    "https://developers.cloudflare.com/workers/platform/spend-management/",
    "https://developers.cloudflare.com/durable-objects/platform/pricing/",
    "https://developers.cloudflare.com/analytics/analytics-engine/pricing/",
    "https://developers.cloudflare.com/analytics/analytics-engine/limits/",
  ]) {
    assert.ok(brief.includes(url), `brief should link ${url}`);
  }
  assert.match(brief, /2026-11-22/);
  assert.match(brief, /not run/i);
  assert.match(brief, /No apportionment/i);
});

test("the cost page keeps the measured reference and its limits together", () => {
  assert.match(page, /1,660 across both apps/);
  assert.match(page, /2,841/);
  assert.match(page, /249,856 bytes/);
  assert.match(page, /US\$5 monthly Workers\s+Paid minimum/);
  assert.match(page, /operator-owned, not a customer-owned onboarding proof/);
  assert.match(page, /docs\/evidence\/cloudflare-review-20261112/);
});
