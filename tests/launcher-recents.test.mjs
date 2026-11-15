import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  launcherProjectHref,
  launcherWorkspaceHref,
  loadLauncherRecents,
  selectLauncherRecents,
} from "../src/lib/launcher-recents.ts";
import {sqliteD1, stackSchema} from "./helpers/stacks-sqlite.mjs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const row = (overrides = {}) => ({
  id: "stack-valid-01",
  slug: "valid-project",
  name: "Valid project",
  status: "draft",
  revision: 2,
  published_revision: null,
  updated_at: "2026-11-16T02:00:00.000Z",
  published_at: null,
  ...overrides,
});

test("a recent project is chosen only from eligible rows in one workspace", () => {
  const workspace = {id: "ws-alpha-01", name: "Alpha", role: "owner"};
  assert.deepEqual(selectLauncherRecents(workspace, []), {
    workspace: {name: "Alpha", allHref: "/_emdash/admin/plugins/composer-stacks/stacks?workspace=ws-alpha-01"},
    project: null,
  });
  const selected = selectLauncherRecents(workspace, [
    row({id: "stack-archived", name: "Archived", status: "archived"}),
    row({id: "bad", name: "Malformed id"}),
    row({slug: "Bad Slug", name: "Malformed slug"}),
    row({name: "   "}),
    row({revision: 0}),
    row({updated_at: "not a date"}),
    row({id: "stack-newest-1", slug: "newest-project", name: "Newest project", revision: 3}),
    row({id: "stack-older-1", name: "Older project"}),
  ]);
  assert.equal(selected.project.name, "Newest project");
  assert.equal(selected.project.state, "draft");
  assert.equal(selected.project.action, "Continue editing");
  assert.equal(selected.project.href, launcherProjectHref("ws-alpha-01", "stack-newest-1"));
  assert.equal(selected.project.updatedAt, "2026-11-16T02:00:00.000Z");
  assert.equal(selected.project.publishedHref, null);
  assert.doesNotMatch(JSON.stringify(selected), /Archived|Malformed/);
});

test("the project action and published link tell the truth about its state", () => {
  const workspace = {id: "ws-alpha-01", name: "Alpha", role: "editor"};
  const fresh = selectLauncherRecents(workspace, [row({revision: 1})]);
  assert.equal(fresh.project.action, "Finish this project");
  const published = selectLauncherRecents(workspace, [
    row({status: "published", revision: 4, published_at: "2026-11-15T23:30:00.000Z"}),
  ]);
  assert.equal(published.project.action, "Continue editing");
  assert.equal(published.project.state, "published");
  assert.equal(published.project.publishedHref, "/s/valid-project");
  const stalePublication = selectLauncherRecents(workspace, [
    row({status: "published", published_at: "yesterday"}),
  ]);
  assert.equal(stalePublication.project.publishedHref, null, "an unreadable date must not invent a published page");
  const viewer = selectLauncherRecents({...workspace, role: "viewer"}, [row()]);
  assert.equal(viewer.project.action, "Open project", "a viewer must not be offered an edit action");
  assert.equal(selectLauncherRecents({id: "../../etc", name: "Bad", role: "owner"}, [row()]).workspace, null);
});

test("native project links carry the confirmed workspace and stack only", () => {
  const href = launcherProjectHref("ws-alpha-01", "stack-valid-01");
  const url = new URL(href, "https://composer.loftwah.com/");
  assert.equal(url.pathname, "/_emdash/admin/plugins/composer-stacks/stacks");
  assert.deepEqual([...url.searchParams.keys()].sort(), ["stack", "workspace"]);
  assert.equal(url.searchParams.get("workspace"), "ws-alpha-01");
  assert.equal(url.searchParams.get("stack"), "stack-valid-01");
  assert.equal(launcherWorkspaceHref("ws-alpha-01"), "/_emdash/admin/plugins/composer-stacks/stacks?workspace=ws-alpha-01");
});

const schema = stackSchema();
const insertWorkspace = (db, id, name) =>
  db.prepare("INSERT INTO creator_workspaces(id,name,created_at) VALUES(?,?,?)").bind(id, name, "2026-11-01T00:00:00.000Z").run();
const insertMember = (db, workspace, user, role) =>
  db.prepare("INSERT INTO creator_members(workspace_id,user_id,role,created_at) VALUES(?,?,?,?)").bind(workspace, user, role, "2026-11-01T00:00:00.000Z").run();
const insertStack = (db, stack) =>
  db.prepare(
    "INSERT INTO creator_stacks(id,workspace_id,slug,name,status,revision,draft_json,published_json,published_revision,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
  ).bind(
    stack.id,
    stack.workspace,
    stack.slug,
    stack.name,
    stack.status ?? "draft",
    stack.revision ?? 1,
    "{}",
    stack.published_json ?? null,
    stack.published_revision ?? null,
    "2026-11-01T00:00:00.000Z",
    stack.updated_at,
    stack.published_at ?? null,
  ).run();

test("recents are read-only, workspace-scoped and never cross a tenant", async () => {
  const db = sqliteD1();
  try {
    await insertWorkspace(db, "ws-alpha-01", "Alpha workspace");
    await insertWorkspace(db, "ws-bravo-01", "Bravo workspace");
    await insertWorkspace(db, "ws-charlie-1", "Charlie workspace");
    await insertMember(db, "ws-alpha-01", "user-alpha", "owner");
    await insertMember(db, "ws-bravo-01", "user-bravo", "owner");
    await insertMember(db, "ws-alpha-01", "user-both", "viewer");
    await insertMember(db, "ws-bravo-01", "user-both", "owner");
    await insertMember(db, "ws-charlie-1", "user-charlie", "editor");
    await insertStack(db, {id: "stack-alpha-old", workspace: "ws-alpha-01", slug: "alpha-old", name: "Alpha old", updated_at: "2026-11-10T00:00:00.000Z"});
    await insertStack(db, {id: "stack-alpha-pub", workspace: "ws-alpha-01", slug: "alpha-published", name: "Alpha published", status: "published", revision: 5, published_revision: 5, updated_at: "2026-11-15T00:00:00.000Z", published_at: "2026-11-15T00:00:00.000Z"});
    await insertStack(db, {id: "stack-alpha-ark", workspace: "ws-alpha-01", slug: "alpha-archived", name: "Alpha archived", status: "archived", updated_at: "2026-11-17T00:00:00.000Z"});
    await insertStack(db, {id: "bad", workspace: "ws-alpha-01", slug: "alpha-bad", name: "Alpha malformed", updated_at: "2026-11-18T00:00:00.000Z"});
    await insertStack(db, {id: "stack-bravo-1", workspace: "ws-bravo-01", slug: "bravo-one", name: "Bravo one", updated_at: "2026-11-12T00:00:00.000Z"});

    const alpha = await loadLauncherRecents(db, "user-alpha");
    assert.equal(alpha.workspace.name, "Alpha workspace");
    assert.equal(alpha.project.name, "Alpha published");
    assert.equal(alpha.project.publishedHref, "/s/alpha-published");
    assert.match(alpha.project.href, /workspace=ws-alpha-01&stack=stack-alpha-pub/);
    assert.doesNotMatch(JSON.stringify(alpha), /Bravo|Charlie|Alpha archived|Alpha malformed/);

    const bravo = await loadLauncherRecents(db, "user-bravo");
    assert.equal(bravo.workspace.name, "Bravo workspace");
    assert.equal(bravo.project.name, "Bravo one");
    assert.doesNotMatch(JSON.stringify(bravo), /Alpha|Charlie/);

    const both = await loadLauncherRecents(db, "user-both");
    assert.equal(both.workspace.name, "Bravo workspace", "an owner workspace keeps the existing owner-first default");
    assert.equal(both.project.name, "Bravo one");
    assert.doesNotMatch(JSON.stringify(both), /Alpha/);

    assert.deepEqual(await loadLauncherRecents(db, "user-none"), {workspace: null, project: null});
    assert.deepEqual(await loadLauncherRecents(db, "user-charlie"), {
      workspace: {name: "Charlie workspace", allHref: "/_emdash/admin/plugins/composer-stacks/stacks?workspace=ws-charlie-1"},
      project: null,
    });
    assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM creator_stacks").first()).count, 5, "reading recents must not write or remove rows");
  } finally {
    db.cleanup();
  }
});

test("the recents endpoint is session-derived and query-free", () => {
  const route = read("src/pages/api/launcher/recents.ts");
  assert.match(route, /prerender = false/);
  assert.match(route, /locals\.user/);
  assert.doesNotMatch(route, /searchParams|Astro\.url|request\.url|\.get\("workspace"\)/);
  assert.match(route, /no-store/);
  assert.match(route, /401/);
});
