import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createStack,
  saveStack,
  workspaceForUser,
} from "../src/lib/stacks.mjs";
import { readResourceInventory } from "../src/lib/resource-inventory.ts";
import {
  launcherProjectHref,
  launcherWorkspaceHref,
} from "../src/lib/launcher-recents.ts";
import { stackSelection } from "../src/plugins/stacks/workspace-scope.ts";
import { sqliteD1 } from "./helpers/stacks-sqlite.mjs";
import {
  account,
  document,
  instance,
  settings,
  user,
} from "./helpers/resource-fixture.mjs";

const RESOURCE = "fictional-launch-resource";
const INSTANCE = "fictional-instance-0001";
const SOURCE = "a1b2c3d4".repeat(5);

async function seedBoundResource(f, names) {
  const workspace = await workspaceForUser(f, user);
  const bindings = [];
  for (const name of names) {
    const stack = await createStack(f, workspace.id, name);
    await saveStack(
      f,
      workspace.id,
      stack.id,
      document(name, [instance(INSTANCE, `${name} card`)]),
      stack.revision,
    );
    bindings.push(stack.id);
  }
  await f
    .prepare(
      "INSERT INTO creator_app_resources (id,workspace_id,app,account_id,environment,target,version,state,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      RESOURCE,
      workspace.id,
      "guestbook",
      account,
      "production",
      "https://composer.loftwah.com/guestbook",
      1,
      "ready",
      "2026-11-18 00:00:00",
    )
    .run();
  for (const stackId of bindings)
    await f
      .prepare(
        "INSERT INTO creator_stack_resource_bindings (stack_id,instance_id,resource_id,mode) VALUES (?,?,?,?)",
      )
      .bind(stackId, INSTANCE, RESOURCE, "own")
      .run();
  return { workspace, bindings };
}

async function readAction(f, workspace) {
  const inventory = await readResourceInventory(f, {
    workspace: { id: workspace.id, name: workspace.name },
    account,
    environment: "production",
    installedSource: SOURCE,
    now: Date.parse("2026-11-18T00:00:00Z"),
  });
  const resource = inventory.resources.find((entry) => entry.id === RESOURCE);
  assert.ok(resource, "the seeded resource is in the authorized read");
  const finding = resource.findings.find((entry) => entry.action);
  assert.ok(finding, "a finding offers the native Creator stacks action");
  return finding.action.href;
}

test("one bound stack opens that exact stack through the native route", async () => {
  const f = sqliteD1();
  try {
    const { workspace, bindings } = await seedBoundResource(f, [
      "Fictional Launch Board",
    ]);
    assert.equal(
      await readAction(f, workspace),
      launcherProjectHref(workspace.id, bindings[0]),
    );
    assert.deepEqual(
      stackSelection(["archived-train-copy", bindings[0]], {
        requested: bindings[0],
      }),
      { stackId: bindings[0], refused: false },
    );
  } finally {
    f.cleanup();
  }
});

test("the connected-app-source-changed finding carries the bound stack link", async () => {
  const f = sqliteD1();
  try {
    const { workspace, bindings } = await seedBoundResource(f, [
      "Fictional Launch Board",
    ]);
    await f
      .prepare(
        "UPDATE creator_app_resources SET configuration_revision=?, configuration_digest=?, configuration_source=?, configuration_json=? WHERE id=?",
      )
      .bind(
        1,
        "b".repeat(64),
        "c".repeat(40),
        JSON.stringify(settings("Launch feedback card")),
        RESOURCE,
      )
      .run();
    const inventory = await readResourceInventory(f, {
      workspace: { id: workspace.id, name: workspace.name },
      account,
      environment: "production",
      installedSource: SOURCE,
      now: Date.parse("2026-11-18T00:00:00Z"),
    });
    const resource = inventory.resources.find((entry) => entry.id === RESOURCE);
    const drift = resource.findings.find((entry) => entry.code === "source-drift");
    assert.ok(drift, "the reported source-change finding is present");
    assert.equal(drift.title, "The connected app source changed");
    assert.equal(drift.action.href, launcherProjectHref(workspace.id, bindings[0]));
  } finally {
    f.cleanup();
  }
});

test("nil and multiple bindings keep the workspace scope and name no stack", async () => {
  assert.equal(
    launcherWorkspaceHref("fictional-workspace"),
    "/_emdash/admin/plugins/composer-stacks/stacks?workspace=fictional-workspace",
  );
  for (const names of [[], ["First board", "Second board"]]) {
    const f = sqliteD1();
    try {
      const { workspace } = await seedBoundResource(f, names);
      assert.equal(await readAction(f, workspace), launcherWorkspaceHref(workspace.id));
    } finally {
      f.cleanup();
    }
  }
});

test("a stale or foreign stack request refuses selection instead of another stack", () => {
  const authorized = ["fictional-launch-board", "archived-train-copy"];
  assert.deepEqual(
    stackSelection(authorized, { requested: "deleted-stack-id" }),
    { stackId: undefined, refused: true },
  );
  assert.deepEqual(
    stackSelection(["fictional-launch-board"], {
      requested: "another-workspace-stack",
    }),
    { stackId: undefined, refused: true },
  );
  // No explicit request keeps the editor's existing default behaviour.
  assert.deepEqual(stackSelection(authorized, {}), {
    stackId: "fictional-launch-board",
    refused: false,
  });
  assert.deepEqual(stackSelection(authorized, { current: "archived-train-copy" }), {
    stackId: "archived-train-copy",
    refused: false,
  });
});

test("the editor consumes stackSelection and the card links every binding", () => {
  const editor = readFileSync(
    new URL("../src/plugins/stacks-admin.tsx", import.meta.url),
    "utf8",
  );
  assert.match(editor, /stackSelection\(/);
  assert.match(editor, /selection\.refused/);
  assert.match(editor, /requestedStack\.current = null/);
  // The refusal must not fall through to the old first-stack default.
  assert.doesNotMatch(
    editor,
    /data\.stacks\?\.find\(\(entry\) => entry\.id === next\)/,
  );
  const card = readFileSync(
    new URL("../src/plugins/resource-inventory-page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(card, /launcherProjectHref\(workspace, binding\.stackId\)/);
});
