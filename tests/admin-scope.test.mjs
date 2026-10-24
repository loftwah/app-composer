import test from "node:test";
import assert from "node:assert/strict";
import {
  appLabel,
  confirmScope,
  moveScope,
  parseScopeSelection,
  scopeQuery,
  withScope,
} from "../src/lib/admin-scope.ts";
import {
  attentionView,
  beginRecheck,
  firstBlockedSource,
  rankAttention,
  settleRecheck,
} from "../src/lib/overview-attention.ts";

const workspace = "fictional-workspace-0001";
const other = "fictional-workspace-0002";

test("scope parsing accepts one well-formed value per key", () => {
  const parsed = parseScopeSelection(
    "?workspace=" + workspace + "&environment=preview&app=guestbook",
  );
  assert.deepEqual(parsed, {
    workspace,
    environment: "preview",
    app: "guestbook",
  });
  assert.deepEqual(parseScopeSelection(""), {
    workspace: undefined,
    environment: undefined,
    app: undefined,
  });
});

test("duplicate or malformed scope values are refused, never guessed", () => {
  assert.throws(
    () => parseScopeSelection("?workspace=" + workspace + "&workspace=" + other),
    /Choose one workspace/,
  );
  assert.throws(
    () => parseScopeSelection("?environment=Production%20Live"),
    /one environment/,
  );
  assert.throws(() => parseScopeSelection("?app=Guest%20Book"), /one recorded app/);
  assert.throws(() => parseScopeSelection("?workspace=short"), /one workspace/);
});

test("the canonical query keeps a stable order and drops an absent app", () => {
  assert.equal(
    scopeQuery({ workspace, environment: "production", app: "guestbook" }),
    "workspace=" + workspace + "&environment=production&app=guestbook",
  );
  assert.equal(
    scopeQuery({ workspace, environment: "production", app: null }),
    "workspace=" + workspace + "&environment=production",
  );
});

test("drill-down links keep their record anchor and replace stale scope", () => {
  const href =
    "/_emdash/admin/plugins/composer-stacks/workflows?workspace=" +
    other +
    "#workflow-run-fictional-0001";
  assert.equal(
    withScope(href, { workspace, environment: "preview", app: "guestbook" }),
    "/_emdash/admin/plugins/composer-stacks/workflows?workspace=" +
      workspace +
      "&environment=preview&app=guestbook#workflow-run-fictional-0001",
  );
  assert.equal(
    withScope(href, { workspace, environment: "production", app: null }),
    "/_emdash/admin/plugins/composer-stacks/workflows?workspace=" +
      workspace +
      "&environment=production#workflow-run-fictional-0001",
  );
});

test("changing environment clears app focus; changing app keeps the rest", () => {
  const current = { workspace, environment: "production", app: "guestbook" };
  assert.deepEqual(moveScope(current, "environment", "preview"), {
    workspace,
    environment: "preview",
    app: null,
  });
  assert.deepEqual(moveScope(current, "app", ""), {
    workspace,
    environment: "production",
    app: null,
  });
  assert.deepEqual(moveScope(current, "app", "guestbook"), current);
});

test("a server-confirmed scope must match what was requested", () => {
  const confirmed = { workspace, environment: "production", app: null };
  assert.deepEqual(confirmScope({ workspace }, confirmed), confirmed);
  assert.deepEqual(confirmScope({}, confirmed), confirmed);
  assert.throws(
    () => confirmScope({ workspace: other }, confirmed),
    /did not confirm the selected workspace/,
  );
  assert.throws(
    () => confirmScope({ environment: "preview" }, confirmed),
    /did not confirm the selected environment/,
  );
  assert.throws(
    () => confirmScope({ app: "paperwork" }, confirmed),
    /did not confirm the selected app/,
  );
});

test("app labels never invent a product name for an unknown id", () => {
  assert.equal(appLabel("guestbook"), "Guestbook");
  assert.equal(appLabel("paperwork"), "paperwork");
});

const item = (id, app, lastObserved, count, source = "workflows") => ({
  id,
  source,
  app,
  title: "A recorded problem " + id,
  summary: "Inspect the retained record.",
  action: "Open record",
  href:
    "/_emdash/admin/plugins/composer-stacks/workflows?workspace=" +
    workspace +
    "#workflow-run-" +
    id,
  count,
  firstObserved: "2026-10-20T00:00:00.000Z",
  lastObserved,
});

const source = (id, status, count) => ({
  id,
  label: id,
  status,
  count,
  atLimit: false,
  note: "Window note.",
});

test("attention ranking puts the selected app first, then the latest record", () => {
  const ranked = rankAttention(
    [
      item("fictional-wide-0001", null, "2026-10-25T05:00:00.000Z", 1),
      item("fictional-app-0002", "guestbook", "2026-10-24T05:00:00.000Z", 1),
      item("fictional-app-0001", "guestbook", "2026-10-25T04:00:00.000Z", 2),
    ],
    "guestbook",
  );
  assert.deepEqual(
    ranked.map((entry) => entry.id),
    ["fictional-app-0001", "fictional-app-0002", "fictional-wide-0001"],
  );
});

test("with no app chosen, the latest observation leads regardless of attribution", () => {
  const ranked = rankAttention(
    [
      item("fictional-wide-0001", null, "2026-10-25T06:00:00.000Z", 1),
      item("fictional-app-0001", "guestbook", "2026-10-25T02:00:00.000Z", 1),
    ],
    null,
  );
  assert.deepEqual(
    ranked.map((entry) => entry.id),
    ["fictional-wide-0001", "fictional-app-0001"],
  );
});

test("equal observations break on retained count and then stable id", () => {
  const ranked = rankAttention(
    [
      item("fictional-b-0002", "guestbook", "2026-10-25T05:00:00.000Z", 1),
      item("fictional-a-0001", "guestbook", "2026-10-25T05:00:00.000Z", 3),
      item("fictional-c-0003", "guestbook", "2026-10-25T05:00:00.000Z", 1),
    ],
    "guestbook",
  );
  assert.deepEqual(
    ranked.map((entry) => entry.id),
    ["fictional-a-0001", "fictional-b-0002", "fictional-c-0003"],
  );
});

test("an overview leads with exactly one problem and counts app focus", () => {
  const view = attentionView({
    selection: { app: "guestbook" },
    items: [
      item("fictional-app-0001", "guestbook", "2026-10-25T05:00:00.000Z", 2),
      item("fictional-wide-0001", null, "2026-10-25T06:00:00.000Z", 1),
    ],
    sources: [
      source("platform", "checked", 0),
      source("workflows", "checked", 1),
      source("notifications", "checked", 2),
    ],
  });
  assert.equal(view.kind, "problems");
  assert.equal(view.leader?.id, "fictional-app-0001");
  assert.equal(view.rest.length, 1);
  assert.equal(view.total, 2);
  assert.equal(view.appScoped, 1);
});

test("no problems with a failed read is unreadable, not clear", () => {
  const view = attentionView({
    selection: { app: null },
    items: [],
    sources: [
      source("platform", "checked", 0),
      source("workflows", "unavailable", null),
      source("notifications", "checked", 0),
    ],
  });
  assert.equal(view.kind, "unreadable");
  assert.equal(view.leader, null);
  assert.equal(firstBlockedSource(view)?.id, "workflows");
});

test("all sources read and no problems is the only clear state", () => {
  const view = attentionView({
    selection: { app: null },
    items: [],
    sources: [
      source("platform", "checked", 0),
      source("workflows", "checked", 0),
      source("notifications", "restricted", null),
    ],
  });
  assert.equal(view.kind, "clear");
  assert.deepEqual(
    view.restricted.map((entry) => entry.id),
    ["notifications"],
  );
});

test("a recheck starts running and only a real read becomes success", () => {
  const running = beginRecheck("workflows", "2026-10-25T05:00:00.000Z");
  assert.equal(running.status, "running");
  assert.equal(running.message, "");
  const succeeded = settleRecheck(running, {
    ok: true,
    message: "Workflows rechecked. 2 retained problem records.",
    at: "2026-10-25T05:00:01.000Z",
  });
  assert.equal(succeeded.status, "succeeded");
  assert.match(succeeded.message, /2 retained problem records/);
});

test("a failed recheck stays failed with the real reason", () => {
  const running = beginRecheck("notifications", "2026-10-25T05:00:00.000Z");
  const failed = settleRecheck(running, {
    ok: false,
    message:
      "Owner notifications could not be rechecked. It remains unavailable, which is not zero.",
    at: "2026-10-25T05:00:01.000Z",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.source, "notifications");
  assert.match(failed.message, /remains unavailable/);
  assert.equal(failed.at, "2026-10-25T05:00:01.000Z");
});
