import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  inspectPlatformReport,
  platformObservation,
} from "../lib/get-ready/platform.mjs";

const now = Date.now();
function observation(patch = {}) {
  return {
    schema: "app-composer.platform-observation",
    version: 1,
    checkedAt: new Date(now).toISOString(),
    installation: {
      origin: "https://composer.example.test",
      source: "a".repeat(40),
    },
    workspace: {
      id: "fictional-alpha",
      name: "Fictional Alpha",
      role: "owner",
    },
    operator: true,
    target: { account: "b".repeat(32), environment: "production" },
    inventory: {
      existingStacks: 0,
      managed: false,
      resumable: [],
      partial: false,
    },
    policy: null,
    runner: true,
    ...patch,
  };
}
const policy = {
  revision: 1,
  enabled: true,
  supported: true,
  reviewRequired: false,
  maxApplications: 2,
};

test("an observed empty workspace advances to the existing owner setup; it never certifies preparation", () => {
  const result = inspectPlatformReport(observation(), now);
  assert.equal(result.next.id, "configure");
  assert.equal(result.ready, false);
  assert.equal(result.readOnly, true);
  assert.equal(result.stale, false);
  assert.equal(result.report.workspace.id, "fictional-alpha");
});

test("populated unmanaged workspaces show adoption conflict without blocking another workspace", () => {
  const current = observation({
    inventory: {
      existingStacks: 2,
      managed: false,
      resumable: [],
      partial: false,
    },
  });
  assert.equal(inspectPlatformReport(current, now).next.id, "adoption");
  assert.equal(inspectPlatformReport(observation(), now).next.id, "configure");
  const unknown = observation({
    inventory: {
      existingStacks: null,
      managed: false,
      resumable: [],
      partial: false,
    },
  });
  assert.equal(inspectPlatformReport(unknown, now).next.id, "inspect");
});

test("enabled policy inherits defaults; interrupted work is resumed before creating another request", () => {
  const inventory = {
    existingStacks: 1,
    managed: true,
    resumable: [],
    partial: false,
  };
  const current = observation({ policy, inventory });
  assert.equal(inspectPlatformReport(current, now).next.id, "request");
  inventory.resumable = ["fictional-request"];
  assert.equal(inspectPlatformReport(current, now).next.id, "resume");
  assert.equal(
    inspectPlatformReport({ ...current, runner: false }, now).next.id,
    "connection",
  );
});

test("member/viewer and paused policy results keep operator work separate", () => {
  const member = observation({
    operator: false,
    workspace: {
      id: "fictional-alpha",
      name: "Fictional Alpha",
      role: "editor",
    },
  });
  assert.equal(inspectPlatformReport(member, now).next.id, "ask-owner");
  const managed = {
    existingStacks: 0,
    managed: true,
    resumable: [],
    partial: false,
  };
  assert.equal(
    inspectPlatformReport({ ...member, policy, inventory: managed }, now).next
      .id,
    "request",
  );
  assert.equal(
    inspectPlatformReport(
      { ...member, policy: { ...policy, enabled: false }, inventory: managed },
      now,
    ).next.id,
    "paused",
  );
  assert.equal(
    inspectPlatformReport(
      {
        ...member,
        policy,
        inventory: managed,
        workspace: { ...member.workspace, role: "viewer" },
      },
      now,
    ).next.id,
    "view",
  );
});

test("missing target/source and old observations never become current readiness or execution authority", () => {
  for (const target of [
    null,
    { account: "unavailable", environment: "production" },
    { account: "b".repeat(32), environment: "unavailable" },
  ]) {
    assert.equal(
      inspectPlatformReport(observation({ target }), now).next.id,
      "target",
    );
  }
  assert.equal(
    inspectPlatformReport(
      observation({
        installation: { origin: "https://composer.example.test", source: null },
      }),
      now,
    ).next.id,
    "target",
  );
  const stale = inspectPlatformReport(observation(), now + 300001);
  assert.equal(stale.stale, true);
  assert.equal(stale.next.id, "refresh");
  assert.equal(stale.ready, false);
  assert.throws(() => inspectPlatformReport(observation(), now - 60000));
});

test("reports are bounded data; imported credentials, actions and unsafe origins are refused", () => {
  const bad = [
    { ...observation(), token: "fictional-secret" },
    { ...observation(), ready: true },
    {
      ...observation(),
      workspace: { id: "other", name: "Other", role: "owner" },
    },
    {
      ...observation(),
      installation: {
        origin: "https://user:secret@example.test",
        source: "a".repeat(40),
      },
    },
    {
      ...observation(),
      installation: {
        origin: "https://example.test/path",
        source: "a".repeat(40),
      },
    },
    {
      ...observation(),
      inventory: {
        existingStacks: 0,
        managed: true,
        resumable: [],
        partial: false,
      },
    },
    { ...observation(), policy: { ...policy, enabled: "yes" } },
    { ...observation(), runner: "connected" },
  ];
  for (const value of bad)
    assert.throws(() => inspectPlatformReport(value, now));
  assert.throws(() =>
    inspectPlatformReport(
      JSON.stringify(observation()) + " ".repeat(32769),
      now,
    ),
  );
});

test("projection excludes private request bodies, identities and resource identifiers", () => {
  const snapshot = {
    workspace: {
      id: "fictional-alpha",
      name: "Fictional Alpha",
      role: "owner",
    },
    profile: {
      ...policy,
      allowedRecipes: ["guestbook"],
      environments: ["preview"],
      dataClasses: ["synthetic"],
    },
    runner: { available: true },
    requests: [
      {
        id: "fictional-request",
        actorIsRequester: true,
        resumable: true,
        status: "needs-attention",
        plan: { secret: "private" },
        resources: [{ resource: "private-resource" }],
      },
    ],
    setup: {
      target: {
        account: "b".repeat(32),
        environment: "production",
        url: "https://composer.example.test/guestbook",
      },
      existingStacks: 1,
      managed: true,
    },
  };
  const report = platformObservation({
    origin: "https://composer.example.test",
    source: "a".repeat(40),
    operator: true,
    snapshot,
    checkedAt: new Date(now).toISOString(),
  });
  assert.equal(inspectPlatformReport(report, now).next.id, "resume");
  assert.doesNotMatch(JSON.stringify(report), /private-resource|secret|plan/);
  const old = platformObservation({
    origin: "https://composer.example.test",
    source: "a".repeat(40),
    operator: true,
    snapshot: { ...snapshot, setup: undefined },
    checkedAt: new Date(now).toISOString(),
  });
  assert.equal(old.target, null);
  assert.equal(old.inventory.existingStacks, null);
  assert.equal(inspectPlatformReport(old, now).next.id, "target");
});

test("policy setup observations use the workspace capability without borrowing global administrator authority", () => {
  const snapshot = {
    workspace: observation().workspace,
    profile: null,
    runner: { available: true },
    requests: [],
    setup: {
      target: {
        account: "b".repeat(32),
        environment: "production",
        url: "https://composer.example.test/guestbook",
      },
      existingStacks: 0,
      managed: false,
    },
  };
  const inspect = (operator, capability, role = "owner") => {
    const setup = { ...snapshot.setup };
    if (capability !== undefined) setup.canConfigurePolicy = capability;
    return inspectPlatformReport(
      platformObservation({
        origin: "https://composer.example.test",
        source: "a".repeat(40),
        operator,
        snapshot: {
          ...snapshot,
          workspace: { ...snapshot.workspace, role },
          setup,
        },
        checkedAt: new Date(now).toISOString(),
      }),
      now,
    );
  };
  assert.equal(
    inspect(false, true).next.id,
    "configure",
    "Creator owner uses the observed native capability",
  );
  assert.equal(
    inspect(false, false).next.id,
    "ask-owner",
    "Subscriber owner remains outside native configuration",
  );
  assert.equal(
    inspect(true, false).next.id,
    "ask-owner",
    "Explicit false overrides an older global operator hint",
  );
  assert.equal(
    inspect(true, undefined).next.id,
    "configure",
    "Older administrator owner observation remains supported",
  );
  assert.equal(
    inspect(false, undefined).next.id,
    "ask-owner",
    "Older creator observation remains conservative",
  );
  assert.equal(inspect(true, undefined, "editor").report.operator, false);
  for (const invalid of [null, "true", 1])
    assert.throws(() => inspect(true, invalid));
});

test("CLI inspects only the selected offline observation and refuses setup flags, aliases and secret-bearing data", () => {
  const root = mkdtempSync(join(tmpdir(), "composer-platform-observation-"));
  try {
    const file = join(root, "observation.json");
    const bytes = JSON.stringify(observation());
    writeFileSync(file, bytes);
    const cli = resolve("lib/get-ready/cli.mjs");
    const run = (args) =>
      spawnSync(process.execPath, [cli, ...args], {
        cwd: root,
        encoding: "utf8",
      });
    const good = run(["--inspect-platform", file]);
    assert.equal(good.status, 0, good.stderr);
    const result = JSON.parse(good.stdout);
    assert.equal(result.mode, "offline-observation");
    assert.equal(result.liveAccessChecked, false);
    assert.equal(result.ready, false);
    assert.equal(result.report.workspace.id, "fictional-alpha");
    for (const args of [
      ["--inspect-platform", file, "--deploy-reference"],
      ["--inspect-platform", file, "--workspace", root],
      ["--inspect-platform", file, "--inspect-project", root],
      ["--inspect-platform", file, "--inspect-platform", file],
    ])
      assert.notEqual(run(args).status, 0);
    const alias = join(root, "linked.json");
    symlinkSync(file, alias);
    assert.notEqual(run(["--inspect-platform", alias]).status, 0);
    assert.equal(readFileSync(file, "utf8"), bytes);
    writeFileSync(
      file,
      JSON.stringify({ ...observation(), token: "fictional-private-secret" }),
    );
    const bad = run(["--inspect-platform", file]);
    assert.notEqual(bad.status, 0);
    assert.doesNotMatch(bad.stdout + bad.stderr, /fictional-private-secret/);
    assert.equal(existsSync(join(root, ".private")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false);
  }
});
