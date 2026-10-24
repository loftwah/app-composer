import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  pendingContributionResumable,
} from "../src/lib/member-contribution-contract.ts";
import { effectiveGuestbookConfiguration } from "../src/lib/resource-client.ts";
import { validateManifest } from "../scripts/contracts.mjs";
import { validateSpec } from "../src/lib/spec.mjs";
import { governedSyntheticConfiguration } from "../src/lib/member-contribution-bridge.ts";
import {
  beginContribution,
  confirmContribution,
  observeContribution,
  contributionRecovery,
  recoverContribution,
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

test("omitted contribution fields preserve the released source's closed canonical plan", async () => {
  const parsed = platformRequest.parse(request);
  const { version, revision, ...input } = profile;
  const saved = platformProfile.parse(input);
  assert.equal(Object.hasOwn(parsed, "contributions"), false);
  assert.equal(Object.hasOwn(saved, "allowMemberContributions"), false);
  const plan = platformPlan(parsed, profile, target);
  const released = JSON.parse(
    readFileSync(new URL("../composition.lock.json", import.meta.url), "utf8"),
  ).apps.find((app) => app.id === "guestbook");
  assert.equal(plan.source.commit, released.commit);
  assert.deepEqual(plan.spec.sources, [plan.source]);
  assert.ok(plan.handoff.endsWith(JSON.stringify(plan.spec, null, 2)));
  assert.equal(Object.hasOwn(plan, "contributionMode"), false);
  // Freeze the original closed-plan shape and values while allowing reviewed
  // source promotions. Normalize only that SHA, including its spec/handoff copies.
  const legacyPlan = JSON.parse(
    JSON.stringify(plan).replaceAll(
      released.commit,
      "400fc2219ebb461acf6ea7abc3242a682192dd2c",
    ),
  );
  assert.equal(
    await platformDigest(legacyPlan),
    "9dd7d28e973d843fe00ae6d0bdd3b2a0b83bda0c479de28873b1bb46f9681239",
  );
  assert.equal(plan.spec.appSettings.guestbook.guestAccess, "closed");
});

test("durable pending contribution resumes only explicitly with its frozen original body and current configuration", async () => {
  const attempt = beginContribution("fictional-resource", {
    caption: " Fictional pending message ",
    author: "Fictional member",
    consent: true,
    png: "fictional-png",
  });
  const original = structuredClone(attempt.input);
  const { operationId, caption, author, consent, png } = attempt.input;
  const configuration = {
    revision: 2,
    digest: "a".repeat(64),
    source: "b".repeat(40),
  };
  const pending = {
    contract: 2,
    resource: attempt.resource,
    operationId,
    outcome: "pending",
    identity: {
      configuration,
      dataClass: "synthetic",
      bodyDigest: createHash("sha256")
        .update(JSON.stringify({ operationId, caption, author, consent, png }))
        .digest("hex"),
    },
  };
  const observed = {
    ...pending,
    resumablePending: pendingContributionResumable(
      pending,
      configuration,
      true,
    ),
  };
  assert.equal(await contributionRecovery(attempt, observed), "resume");
  assert.throws(() => {
    attempt.input.caption = "Changed message";
  }, TypeError);
  assert.throws(() => {
    attempt.input.operationId = crypto.randomUUID();
  }, TypeError);
  assert.deepEqual(attempt.input, original);
  let dispatches = 0;
  const receipt = {
    id: "fictional-item",
    resource: attempt.resource,
    operationId,
    status: "pending",
    message: "Review required",
  };
  const dispatch = async (input) => {
    dispatches++;
    assert.strictEqual(input, attempt.input);
    assert.deepEqual(input, original);
    return receipt;
  };
  assert.equal(dispatches, 0, "Receipt observation itself sends no submission");
  for (const invalid of [
    { ...observed, resumablePending: false },
    { ...observed, identity: undefined },
    {
      ...observed,
      identity: { ...observed.identity, bodyDigest: "c".repeat(64) },
    },
    { ...observed, resource: "other-resource" },
    { ...observed, operationId: crypto.randomUUID() },
  ])
    await assert.rejects(() => recoverContribution(attempt, invalid, dispatch));
  assert.equal(dispatches, 0);
  for (const patch of [
    { revision: 3 },
    { digest: "c".repeat(64) },
    { source: "c".repeat(40) },
  ])
    assert.equal(
      pendingContributionResumable(
        { ...observed, resumablePending: true },
        { ...configuration, ...patch },
        true,
      ),
      false,
    );
  assert.equal(
    pendingContributionResumable(observed, configuration, false),
    false,
  );
  assert.equal(
    pendingContributionResumable(
      { ...pending, identity: { ...pending.identity, dataClass: "internal" } },
      configuration,
      true,
    ),
    false,
  );
  assert.deepEqual(
    await recoverContribution(attempt, observed, dispatch),
    receipt,
  );
  assert.equal(dispatches, 1);
  const completed = { ...observed, outcome: "completed", receipt };
  assert.equal(observeContribution(attempt, completed).receipt.id, receipt.id);
  assert.equal(await contributionRecovery(attempt, completed), undefined);
  assert.equal(dispatches, 1);
});

test("released v2 source requires explicit member policy and cannot enter generic portable settings", () => {
  assert.equal(memberContributionsQualified(), true);
  const input = platformRequest.parse({ ...request, contributions: "members" });
  assert.equal(
    evaluatePlatformRequest(
      input,
      { ...profile, allowMemberContributions: true },
      0,
    ).outcome,
    "allowed",
  );
  assert.equal(evaluatePlatformRequest(input, profile, 0).outcome, "denied");
  const plan = platformPlan(input, profile, target);
  assert.deepEqual(plan.contributionMode, {
    requested: "members",
    effective: "members",
    qualified: true,
  });
  assert.match(plan.handoff, /qualified member service/);
  assert.doesNotMatch(plan.handoff, /guestAccess": "postcards/);
  assert.throws(() => validateSpec(plan.spec));
  assert.equal(
    effectiveGuestbookConfiguration({ guestAccess: "closed" }).guestAccess,
    "closed",
  );
  assert.equal(
    effectiveGuestbookConfiguration({ guestAccess: "postcards" }).guestAccess,
    "postcards",
  );
  assert.equal(
    effectiveGuestbookConfiguration({ guestAccess: "members" }).guestAccess,
    "members",
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
