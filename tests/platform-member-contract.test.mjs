import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  platformRequest,
  platformProfile,
  platformPlan,
  platformDigest,
  evaluatePlatformRequest,
} from "../src/lib/platform-contract.ts";
import {
  memberContributionsQualified,
  qualifiedMemberManifest,
} from "../src/lib/member-contribution-contract.ts";
import { effectiveGuestbookConfiguration } from "../src/lib/resource-client.ts";
import { validateManifest } from "../scripts/contracts.mjs";
import { governedSyntheticConfiguration } from "../src/lib/member-contribution-bridge.ts";
import {
  beginContribution,
  confirmContribution,
  observeContribution,
} from "../src/components/members/contribution-state.ts";

const request = {
  version: 1,
  name: "Fictional legacy",
  recipe: "guestbook",
  environment: "preview",
  dataClass: "synthetic",
  location: "provider-default",
  quota: "small",
};
const profile = {
  version: 1,
  revision: 1,
  enabled: true,
  allowedRecipes: ["guestbook"],
  environments: ["preview"],
  dataClasses: ["synthetic"],
  maxApplications: 2,
  reviewRequired: false,
};
const { version: _version, revision: _revision, ...profileInput } = profile;
const target = {
  account: "fictional-account",
  environment: "production",
  url: "https://composer.loftwah.com/guestbook",
};

test("existing closed plan JSON and digest stay exact until an explicit contribution update", async () => {
  const parsed = platformRequest.parse(request);
  const { version, revision, ...input } = profile;
  const saved = platformProfile.parse(input);
  assert.equal(Object.hasOwn(parsed, "contributions"), false);
  assert.equal(Object.hasOwn(saved, "allowMemberContributions"), false);
  const plan = platformPlan(parsed, profile, target);
  assert.equal(Object.hasOwn(plan, "contributionMode"), false);
  assert.equal(
    await platformDigest(plan),
    "e127122c2e5f5d7c72a8f6c511e314451ecf15a5226252f1cff12a49937dd401",
  );
  assert.equal(plan.spec.appSettings.guestbook.guestAccess, "closed");
});

test("current v1 pin cannot qualify member mode or silently replace it with postcards", () => {
  assert.equal(memberContributionsQualified(), false);
  const input = platformRequest.parse({ ...request, contributions: "members" });
  assert.equal(
    evaluatePlatformRequest(
      input,
      { ...profile, allowMemberContributions: true },
      0,
    ).outcome,
    "unsupported",
  );
  const plan = platformPlan(input, profile, target);
  assert.deepEqual(plan.contributionMode, {
    requested: "members",
    effective: "closed",
    qualified: false,
  });
  assert.match(plan.handoff, /non-executable fallback/);
  assert.doesNotMatch(plan.handoff, /guestAccess": "postcards/);
  assert.equal(
    effectiveGuestbookConfiguration({ guestAccess: "closed" }).guestAccess,
    "closed",
  );
  assert.equal(
    effectiveGuestbookConfiguration({ guestAccess: "postcards" }).guestAccess,
    "postcards",
  );
  assert.throws(() =>
    effectiveGuestbookConfiguration({ guestAccess: "members" }),
  );
});

test("only the exact version 2 descriptor and finite configuration options qualify", () => {
  const lock = JSON.parse(
    readFileSync(new URL("../composition.lock.json", import.meta.url), "utf8"),
  );
  const manifest = structuredClone(
    lock.apps.find((app) => app.id === "guestbook").manifest,
  );
  manifest.memberService.version = 2;
  manifest.configuration.guestAccess.options = [
    "closed",
    "postcards",
    "members",
  ];
  assert.equal(qualifiedMemberManifest(manifest), true);
  assert.doesNotThrow(() => validateManifest(manifest));
  for (const change of [
    (m) => {
      m.memberService.version = 1;
    },
    (m) => {
      m.memberService.entrypoint = "OtherService";
    },
    (m) => {
      m.memberService.extra = true;
    },
    (m) => {
      m.configuration.guestAccess.default = "members";
    },
    (m) => {
      m.configuration.guestAccess.options.push("public");
    },
  ]) {
    const bad = structuredClone(manifest);
    change(bad);
    assert.equal(qualifiedMemberManifest(bad), false);
    assert.throws(() => validateManifest(bad));
  }
});

test("trusted governed context requires synthetic publication, policy opt-in and exact resource configuration", () => {
  const configuration = {
    revision: 2,
    digest: "a".repeat(64),
    source: "b".repeat(40),
  };
  const row = {
    request_json: JSON.stringify({ ...request, contributions: "members" }),
    profile_json: JSON.stringify({
      ...platformProfile.parse(profileInput),
      allowMemberContributions: true,
    }),
    request_status: "complete",
    stack_status: "published",
    configuration_revision: 2,
    configuration_digest: configuration.digest,
    configuration_source: configuration.source,
    configuration_json: JSON.stringify({ guestAccess: "members" }),
    published_json: JSON.stringify({
      instances: [
        {
          app: "guestbook",
          resource: {
            id: "fictional-resource",
            configurationRevision: 2,
            digest: configuration.digest,
            source: configuration.source,
          },
        },
      ],
    }),
  };
  assert.deepEqual(
    governedSyntheticConfiguration(row, "fictional-resource", true),
    configuration,
  );
  for (const patch of [
    {
      request_json: JSON.stringify({
        ...request,
        dataClass: "sensitive",
        contributions: "members",
      }),
    },
    { profile_json: JSON.stringify(platformProfile.parse(profileInput)) },
    { configuration_digest: "c".repeat(64) },
    { configuration_source: "d".repeat(40) },
    { configuration_json: JSON.stringify({ guestAccess: "postcards" }) },
    { request_status: "waiting" },
  ])
    assert.throws(() =>
      governedSyntheticConfiguration(
        { ...row, ...patch },
        "fictional-resource",
        true,
      ),
    );
  assert.throws(() =>
    governedSyntheticConfiguration(row, "different-resource", true),
  );
  // Read-only original receipt lookup is possible after explicit closure.
  assert.deepEqual(
    governedSyntheticConfiguration(
      {
        ...row,
        profile_json: JSON.stringify({
          ...platformProfile.parse(profileInput),
          enabled: false,
        }),
        configuration_json: JSON.stringify({ guestAccess: "closed" }),
      },
      "fictional-resource",
      false,
    ),
    configuration,
  );
});

test("unknown contribution keeps one operation until explicit matching receipt observation", () => {
  const attempt = beginContribution("fictional-resource", {
    caption: "Fictional message",
    author: "Fictional member",
    consent: true,
    png: "fictional-png",
  });
  const original = structuredClone(attempt);
  const status = {
    contract: 2,
    resource: attempt.resource,
    operationId: attempt.input.operationId,
    outcome: "pending",
  };
  assert.equal(observeContribution(attempt, status).outcome, "pending");
  assert.equal(
    observeContribution(attempt, { ...status, outcome: "not-recorded" })
      .outcome,
    "not-recorded",
  );
  assert.deepEqual(attempt, original);
  const receipt = {
    id: "fictional-item",
    resource: attempt.resource,
    operationId: attempt.input.operationId,
    status: "pending",
    message: "Review required",
  };
  assert.deepEqual(confirmContribution(attempt, receipt), receipt);
  assert.throws(() =>
    confirmContribution(attempt, {
      ...receipt,
      operationId: crypto.randomUUID(),
    }),
  );
  assert.throws(() =>
    observeContribution(attempt, { ...status, outcome: "completed" }),
  );
  assert.throws(() =>
    observeContribution(attempt, { ...status, resource: "other-resource" }),
  );
  assert.equal(
    observeContribution(attempt, { ...status, outcome: "completed", receipt })
      .receipt.id,
    receipt.id,
  );
});
