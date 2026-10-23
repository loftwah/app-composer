import { platformPublicFixture } from "./helpers/platform-public-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  platformPlan,
  evaluatePlatformRequest,
  platformDigest,
} from "../src/lib/platform-contract.ts";
import {
  decodePlatformList,
  decodePlatformMutation,
} from "../src/plugins/platform/protocol.ts";
import { fixture, user, origin } from "./helpers/resource-fixture.mjs";
import { workspaceForUser } from "../src/lib/stacks.mjs";
import { managePlatform } from "../src/lib/platform-admin.ts";
import { validateSpec } from "../src/lib/spec.mjs";

const workspace = {
  id: "fictional-team-alpha",
  name: "Fictional Alpha",
  role: "editor",
};
const profile = {
  version: 1,
  revision: 2,
  enabled: true,
  reviewRequired: false,
  allowedRecipes: ["guestbook"],
  environments: ["preview"],
  dataClasses: ["synthetic"],
  maxApplications: 2,
};
const target = {
  account: "fictional-account",
  environment: "production",
  url: "https://composer.loftwah.com/guestbook",
};
const request = {
  version: 1,
  name: "Fictional visitor book",
  recipe: "guestbook",
  environment: "preview",
  dataClass: "synthetic",
  location: "provider-default",
  quota: "small",
};
async function snapshot(overrides = {}) {
  const input = { ...request, ...overrides };
  const plan = platformPlan(input, profile, target);
  const decision = evaluatePlatformRequest(input, profile, 0);
  return {
    ok: true,
    workspace,
    profile,
    recipes: [
      {
        id: "guestbook",
        name: "Moderated team guestbook",
        purpose: "Synthetic visitor book",
      },
    ],
    runner: {
      available: true,
      kind: "existing-resource-adapter",
      message: "Existing shared runtime",
    },
    requests: [
      {
        id: "fictional-request-alpha",
        name: input.name,
        actorIsRequester: true,
        resumable: true,
        revision: 1,
        request: input,
        plan,
        planDigest: await platformDigest(plan),
        status: ["unsupported", "denied"].includes(decision.outcome)
          ? "denied"
          : "waiting",
        decision,
        stackId: null,
        url: null,
        resources: [],
        reason: null,
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

test("native decoder keeps supported and unsupported/denied requests inspectable", async () => {
  const cases = [
    [{}, "allowed"],
    [{ recipe: "knowledge" }, "unsupported"],
    [{ environment: "production" }, "unsupported"],
    [{ location: "australia-only" }, "unsupported"],
    [{ dataClass: "internal" }, "denied"],
    [{ dataClass: "sensitive" }, "denied"],
  ];
  for (const [overrides, expected] of cases) {
    const decoded = decodePlatformList(await snapshot(overrides));
    assert.equal(decoded.requests[0].decision.outcome, expected);
    assert.equal(decoded.requests[0].plan.spec.version, 2);
    assert.equal(decoded.requests[0].request.name, request.name);
  }
});

test("native decoder rejects malformed plans, unsafe service links and resource substitutions", async () => {
  const good = await snapshot();
  const variants = [
    (value) => {
      value.requests[0].url = "javascript:alert(1)";
    },
    (value) => {
      value.requests[0].url = "https://elsewhere.example/s/private";
    },
    (value) => {
      value.requests[0].plan.spec.privacy = "publish-all";
    },
    (value) => {
      value.requests[0].plan.source.commit = "unpinned";
    },
    (value) => {
      value.requests[0].plan.target.url = "https://elsewhere.example/guestbook";
    },
    (value) => {
      value.requests[0].status = "complete";
    },
    (value) => {
      value.requests[0].name = "Another application";
    },
    (value) => {
      value.requests[0].resources = [
        {
          instance: "fictional-instance-alpha",
          resource: "fictional-resource-alpha",
          app: "guestbook",
          shared: false,
          state: "ready",
          version: 1,
          configuration: {
            revision: 1,
            digest: "a".repeat(64),
            source: "a".repeat(40),
            path: "/guestbook/r/another-resource/c/1/",
          },
        },
      ];
    },
  ];
  for (const alter of variants) {
    const candidate = structuredClone(good);
    alter(candidate);
    assert.throws(() => decodePlatformList(candidate));
  }
  assert.equal(decodePlatformList(good).workspace.id, workspace.id);
});

test("saved platform plans retain historical source bytes without enabling stale portable execution", async () => {
  const response = await snapshot();
  const entry = response.requests[0];
  const historical = {
    ...entry.plan.source,
    commit: "a".repeat(40),
    manifestDigest: "sha256:" + "b".repeat(64),
  };
  entry.plan.source = historical;
  entry.plan.spec.sources = [{ ...historical }];
  entry.status = "complete";
  entry.resumable = false;
  entry.stackId = "fictional-retained-stack";
  entry.url = "/s/fictional-retained-stack";
  entry.resources = [
    {
      instance: "fictional-retained-instance",
      resource: "fictional-retained-resource",
      app: "guestbook",
      shared: false,
      state: "ready",
      version: 4,
      configuration: {
        revision: 2,
        digest: "c".repeat(64),
        source: historical.commit,
        path: "/guestbook/r/fictional-retained-resource/c/2/",
      },
    },
  ];
  const original = JSON.stringify(response),
    originalSpec = JSON.stringify(entry.plan.spec);
  const decoded = decodePlatformList(response);
  assert.equal(decoded.requests[0].sourceObservation.kind, "historical");
  assert.equal(decoded.requests[0].status, "complete");
  assert.equal(
    decoded.requests[0].resources[0].configuration.source,
    historical.commit,
  );
  assert.equal(decoded.requests[0].plan.source.commit, historical.commit);
  assert.equal(JSON.stringify(decoded.requests[0].plan.spec), originalSpec);
  assert.equal(
    JSON.stringify(response),
    original,
    "Read-only decode must not migrate stored response bytes",
  );
  assert.throws(() => validateSpec(entry.plan.spec), /changed|match/);
  assert.equal(
    decodePlatformList(await snapshot()).requests[0].sourceObservation.kind,
    "current",
  );
  for (const alter of [
    (value) => {
      value.requests[0].plan.spec.sources[0].commit = "c".repeat(40);
    },
    (value) => {
      value.requests[0].plan.spec.appSettings.guestbook.title =
        "Different title";
    },
    (value) => {
      value.requests[0].plan.spec.appSettings.guestbook.guestAccess =
        "postcards";
    },
    (value) => {
      value.requests[0].plan.spec.deployment.mode = "existing-domain";
    },
    (value) => {
      value.requests[0].plan.spec.script = "untrusted";
    },
    (value) => {
      value.requests[0].plan.recipe = "other";
    },
  ]) {
    const invalid = structuredClone(response);
    alter(invalid);
    assert.throws(() => decodePlatformList(invalid));
  }
});

test("read-only member plan decoding requires exact retained request/mode agreement while portable execution refuses members", async () => {
  const response = await snapshot({ contributions: "members" });
  const entry = response.requests[0];
  // Inert retained data from a qualified source, independently of this test
  // process's current unpromoted v1 pin. Actual qualified graph coverage is in
  // member-v2-scenario; no lock or runner guard is changed here.
  entry.plan.contributionMode = {
    requested: "members",
    effective: "members",
    qualified: true,
  };
  entry.plan.spec.appSettings.guestbook.guestAccess = "members";
  const original = JSON.stringify(entry.plan.spec);
  assert.equal(
    JSON.stringify(decodePlatformList(response).requests[0].plan.spec),
    original,
  );
  assert.throws(() => validateSpec(entry.plan.spec), /supported/);
  for (const alter of [
    (value) => {
      value.requests[0].plan.contributionMode.qualified = false;
    },
    (value) => {
      value.requests[0].plan.contributionMode.effective = "closed";
    },
    (value) => {
      value.requests[0].plan.request.contributions = "closed";
    },
    (value) => {
      delete value.requests[0].plan.contributionMode;
    },
  ]) {
    const invalid = structuredClone(response);
    alter(invalid);
    assert.throws(() => decodePlatformList(invalid));
  }
});

test("actual native response validates through configuration, automatic provisioning and public receipt", async () => {
  const f = fixture();
  f.runtime.PLATFORM_PUBLIC_FETCH = platformPublicFixture(f);
  try {
    if (
      !f.sqlite
        .prepare(
          "SELECT name FROM sqlite_schema WHERE name='creator_platform_profiles'",
        )
        .get()
    )
      f.sqlite.exec(
        readFileSync("migrations/0011_platform_requests.sql", "utf8"),
      );
    const service = f.runtime.GUESTBOOK;
    f.runtime.GUESTBOOK = {
      fetch(req) {
        if (
          /^\/guestbook\/r\/[a-z0-9-]+\/c\/\d+\/$/.test(
            new URL(req.url).pathname,
          )
        )
          return Promise.resolve(
            new Response(
              "<!doctype html><title>Fictional visitor book</title>",
              { headers: { "Content-Type": "text/html" } },
            ),
          );
        return service.fetch(req);
      },
    };
    const workspace = await workspaceForUser(f.db, user);
    const call = (input) =>
      managePlatform(
        {
          user,
          input,
          request: new Request(
            origin + "/_emdash/api/plugins/composer-stacks/platformWrite",
            {
              method: "POST",
              headers: { Origin: origin, "X-EmDash-Request": "1" },
            },
          ),
        },
        f.runtime,
      );
    const { version: _version, revision: _revision, ...input } = profile;
    const configured = decodePlatformList(
      await call({
        action: "configure",
        workspace: workspace.id,
        expectedRevision: 0,
        profile: input,
      }),
    );
    assert.equal(configured.profile.revision, 1);
    const submitted = decodePlatformList(
      await call({
        action: "submit",
        workspace: workspace.id,
        key: crypto.randomUUID(),
        request,
      }),
    );
    const created = submitted.requests[0];
    assert.equal(created.status, "complete");
    assert.equal(created.resources[0].state, "ready");
    assert.match(created.url, /^\/s\/team-/);
    assert.equal(created.plan.target.environment, "production");
    assert.equal(created.request.environment, "preview");
  } finally {
    f.close();
  }
});

test("unacknowledged mutations never become a successful native response", () => {
  for (const value of [
    null,
    { ok: false, code: "FORBIDDEN" },
    { ok: "true" },
    { ok: true, workspace: { ...workspace, role: "administrator" } },
  ]) {
    assert.throws(() => decodePlatformMutation(value));
  }
  assert.equal(
    decodePlatformMutation({ ok: true, workspace }).workspace.id,
    workspace.id,
  );
});
