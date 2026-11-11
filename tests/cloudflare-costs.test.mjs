import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicPagePaths } from "../src/lib/public-pages.mjs";

const page = readFileSync("src/pages/cloudflare.astro", "utf8");

test("the Cloudflare cost page has one public route and attribution-safe claims", () => {
  assert.ok(publicPagePaths.includes("/cloudflare"));
  assert.match(page, /Baselime/);
  assert.match(page, /83% lower estimated/);
  assert.match(page, /not an App Composer result/);
  assert.match(page, /not a\s+Cloudflare partnership, endorsement or official integration/);
  assert.match(
    page,
    /https:\/\/blog\.cloudflare\.com\/80-percent-lower-cloud-cost-how-baselime-moved-from-aws-to-cloudflare\//,
  );
  assert.match(page, /Do not read this as “83% cheaper with App Composer”/);
});

test("the cost page keeps the measured reference and its limits together", () => {
  assert.match(page, /1,660 across both apps/);
  assert.match(page, /2,841/);
  assert.match(page, /249,856 bytes/);
  assert.match(page, /US\$5 monthly Workers\s+Paid minimum/);
  assert.match(page, /operator-owned, not a customer-owned onboarding proof/);
  assert.match(page, /docs\/evidence\/cloudflare-review-20261112/);
});
